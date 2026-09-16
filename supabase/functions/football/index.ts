// football — Supabase Edge Function (Deno)
//
// POR QUÉ EXISTE
// La app leía los partidos de openfootball (raw.githubusercontent), la única
// fuente sin clave y con CORS. Medido el 15/09/2026: su último resultado era
// del 07/09 y había 14 partidos ya jugados sin marcador, incluida la jornada 5
// entera. Una clasificación con ocho días de retraso no sirve, y esa fuente
// tampoco publica Champions ni Copa.
//
// La cura es esta función: en el SERVIDOR sí se puede guardar una clave y sí se
// puede llamar a cualquier API sin CORS. El navegador habla solo con nosotros.
//
//   El navegador NO lleva ninguna clave. Nunca.
//
// FUENTE: football-data.org v4 (la misma del widget de Scriptable de Fran).
// Plan gratuito: 10 peticiones/minuto, así que aquí se cachea en memoria y se
// sirve caché caducada antes que fallar.
//
// Modo:
//   GET ?probe=1                     -> ping de vida (sin secret, sin llamar fuera)
//   POST { action, ...params }       -> datos
//     action "teamMatches"  { competition?, teamName }  -> partidos del equipo (TODAS sus competiciones)
//     action "standings"    { competition }             -> clasificación
//     action "scorers"      { competition, limit? }     -> goleadores (goles y asistencias)
//     action "live"         { competition, teamName }    -> partidos EN JUEGO ahora mismo
//     action "competitionMatches" { competition }       -> todos los partidos de la liga
//                                                          (alimenta la proyección de temporada)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Content-Type': 'application/json',
};

const BASE = 'https://api.football-data.org/v4';

// Se devuelve en ?probe=1 y en la acción 'probe'. Sirve para que la app pueda
// distinguir "desplegada con el código de hoy" de "desplegada hace meses".
const FN_VERSION = '2026-09-16';

// Códigos de competición de football-data. El plan gratuito cubre estas.
const COMPETITIONS: Record<string, { code: string; name: string }> = {
  'es.1': { code: 'PD', name: 'LaLiga' },
  'en.1': { code: 'PL', name: 'Premier League' },
  'cl':   { code: 'CL', name: 'Champions League' },
};

// Caché en memoria del worker. TTL corto en día de partido, largo si no.
const cache = new Map<string, { ts: number; data: unknown }>();
// `live` va aparte y muy corto: es el único dato que cambia cada minuto. Aun
// así se cachea, porque varias pestañas abiertas consumirían el límite de 10
// peticiones/minuto del plan gratuito en segundos.
const TTL = { matches: 5 * 60e3, standings: 5 * 60e3, scorers: 60 * 60e3, teams: 30 * 864e5, live: 25e3 };

function cached<T>(key: string, ttl: number): T | null {
  const e = cache.get(key);
  return e && Date.now() - e.ts < ttl ? (e.data as T) : null;
}
function stale<T>(key: string): T | null {
  const e = cache.get(key);
  return e ? (e.data as T) : null;
}

async function fd(path: string, key: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-Auth-Token': key } });
  if (res.status === 429) throw new Error('rate_limit');
  if (res.status === 403 || res.status === 400) throw new Error('key_invalida');
  if (!res.ok) throw new Error('http_' + res.status);
  return await res.json();
}

// Resuelve el id numérico de un equipo por su nombre, sin tabla que mantener:
// se pide la lista de equipos de la competición y se cachea 30 días.
// La comparación es por igualdad de nombre normalizado o por el nombre corto
// que devuelve la propia API — nunca por `includes` (el "RCD Espanyol de
// Barcelona" contiene "Barcelona" y colaría partidos ajenos).
const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

async function resolveTeam(compCode: string, teamName: string, key: string) {
  const ck = `teams:${compCode}`;
  let list = cached<any>(ck, TTL.teams);
  if (!list) {
    list = await fd(`/competitions/${compCode}/teams`, key);
    cache.set(ck, { ts: Date.now(), data: list });
  }
  const target = norm(teamName);
  for (const t of list.teams ?? []) {
    for (const cand of [t.name, t.shortName, t.tla]) {
      if (cand && norm(cand) === target) return t;
    }
  }
  return null;
}

async function handle(body: any, key: string) {
  const { action } = body ?? {};

  if (action === 'standings') {
    const comp = COMPETITIONS[body.competition];
    if (!comp) return { error: 'competicion_desconocida' };
    const ck = `standings:${comp.code}`;
    const fresh = cached(ck, TTL.standings);
    if (fresh) return fresh;
    try {
      const j = await fd(`/competitions/${comp.code}/standings`, key);
      const out = { competition: comp.name, standings: j.standings, season: j.season, fetchedAt: Date.now() };
      cache.set(ck, { ts: Date.now(), data: out });
      return out;
    } catch (e) {
      const s = stale(ck);
      return s ?? { error: String((e as Error).message) };
    }
  }

  if (action === 'teamMatches') {
    const comp = COMPETITIONS[body.competition] ?? COMPETITIONS['es.1'];
    const ck = `tm:${comp.code}:${norm(body.teamName)}`;
    const fresh = cached(ck, TTL.matches);
    if (fresh) return fresh;
    try {
      const team = await resolveTeam(comp.code, body.teamName, key);
      if (!team) return { error: 'equipo_no_encontrado' };
      // Sin filtro de competición: devuelve liga, Champions y copas a la vez.
      const j = await fd(`/teams/${team.id}/matches?limit=100`, key);
      const out = {
        team: { id: team.id, name: team.name, shortName: team.shortName, tla: team.tla, crest: team.crest },
        matches: j.matches ?? [],
        fetchedAt: Date.now(),
      };
      cache.set(ck, { ts: Date.now(), data: out });
      return out;
    } catch (e) {
      const s = stale(ck);
      return s ?? { error: String((e as Error).message) };
    }
  }

  // Todos los partidos de una competición: lo que alimenta la proyección de
  // temporada (hacen falta los pendientes de TODOS los equipos, no solo los míos).
  if (action === 'competitionMatches') {
    const comp = COMPETITIONS[body.competition];
    if (!comp) return { error: 'competicion_desconocida' };
    const ck = `cm:${comp.code}`;
    const fresh = cached(ck, TTL.matches);
    if (fresh) return fresh;
    try {
      const j = await fd(`/competitions/${comp.code}/matches`, key);
      const out = { competition: comp.name, matches: j.matches ?? [], fetchedAt: Date.now() };
      cache.set(ck, { ts: Date.now(), data: out });
      return out;
    } catch (e) {
      const s = stale(ck);
      return s ?? { error: String((e as Error).message) };
    }
  }

  if (action === 'scorers') {
    const comp = COMPETITIONS[body.competition];
    if (!comp) return { error: 'competicion_desconocida' };
    // Límite alto: la app filtra "solo mi equipo" del lado del cliente, y para
    // que aparezca el tercer goleador de un equipo hay que bajar bastante en la
    // tabla de la competición. La caché va por código Y por límite.
    const lim = Math.min(Math.max(body.limit ?? 100, 1), 100);
    const ck = `scorers:${comp.code}:${lim}`;
    const fresh = cached(ck, TTL.scorers);
    if (fresh) return fresh;
    try {
      const j = await fd(`/competitions/${comp.code}/scorers?limit=${lim}`, key);
      const out = {
        competition: comp.name,
        scorers: (j.scorers ?? []).map((s: any) => ({
          name: s.player?.name, teamName: s.team?.name, teamTla: s.team?.tla,
          goals: s.goals ?? 0, assists: s.assists ?? null, penalties: s.penalties ?? null,
          playedMatches: s.playedMatches ?? null,
        })),
        fetchedAt: Date.now(),
      };
      cache.set(ck, { ts: Date.now(), data: out });
      return out;
    } catch (e) {
      const s = stale(ck);
      return s ?? { error: String((e as Error).message) };
    }
  }

  // ── EN VIVO ───────────────────────────────────────────────────────────────
  // Dos llamadas como mucho: los partidos en juego de MI equipo (sin filtrar
  // por competición, así sale igual la Champions o la Copa) y los del resto de
  // la liga. Con TTL de 25s y el cliente sondeando cada 45s, el peor caso son
  // ~5 peticiones/minuto — la mitad del límite del plan gratuito.
  if (action === 'live') {
    const comp = COMPETITIONS[body.competition] ?? COMPETITIONS['es.1'];
    const ck = `live:${comp.code}:${norm(body.teamName)}`;
    const fresh = cached(ck, TTL.live);
    if (fresh) return fresh;
    try {
      const team = body.teamName ? await resolveTeam(comp.code, body.teamName, key) : null;
      const [mios, liga] = await Promise.all([
        team ? fd(`/teams/${team.id}/matches?status=LIVE`, key).catch(() => ({ matches: [] })) : Promise.resolve({ matches: [] }),
        fd(`/competitions/${comp.code}/matches?status=LIVE`, key).catch(() => ({ matches: [] })),
      ]);
      const out = {
        teamId: team?.id ?? null,
        mine: mios.matches ?? [],
        others: liga.matches ?? [],
        fetchedAt: Date.now(),
      };
      cache.set(ck, { ts: Date.now(), data: out });
      return out;
    } catch (e) {
      // Aquí NO se sirve caché caducada: un marcador viejo presentado como
      // "en vivo" es peor que no enseñar nada.
      return { error: String((e as Error).message) };
    }
  }

  // Autodiagnóstico. No se limita a decir "estoy viva": llama de verdad a
  // football-data con la clave y devuelve el código HTTP que contesta. Una
  // clave caducada o revocada da 403 y hasta ahora eso era indistinguible de
  // "la función no está" — la app caía al respaldo en silencio.
  if (action === 'probe') {
    let upstream: Record<string, unknown> = { probado: false };
    try {
      const r = await fetch(`${BASE}/competitions/PD`, { headers: { 'X-Auth-Token': key } });
      let msg = '';
      try { msg = ((await r.json()) as { message?: string })?.message || ''; } catch { /* sin cuerpo */ }
      upstream = { probado: true, status: r.status, ok: r.ok, mensaje: msg };
    } catch (e) {
      upstream = { probado: true, status: 0, ok: false, mensaje: String((e as Error).message) };
    }
    return {
      ok: true,
      fn: 'football',
      version: FN_VERSION,
      hasKey: true,
      upstream,
      competitions: Object.keys(COMPETITIONS),
    };
  }

  return { error: 'accion_desconocida' };
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  if (url.searchParams.get('probe') === '1') {
    return new Response(JSON.stringify({
      ok: true, fn: 'football', version: FN_VERSION,
      hasKey: !!Deno.env.get('FOOTBALL_DATA_KEY'),
      competitions: Object.keys(COMPETITIONS),
    }), { headers: corsHeaders });
  }

  const key = Deno.env.get('FOOTBALL_DATA_KEY');
  if (!key) {
    return new Response(JSON.stringify({ error: 'sin_clave' }), { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const data = await handle(body, key);
    return new Response(JSON.stringify(data), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { status: 200, headers: corsHeaders });
  }
});
