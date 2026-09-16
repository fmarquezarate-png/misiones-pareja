// Cliente de datos de fútbol (v5.32.0).
//
// Dos caminos, y el bueno es el primero:
//
//   1. Edge Function `football` (servidor) → football-data.org con clave.
//      Datos en vivo: clasificación al minuto, Champions, Copa y goleadores.
//      La clave vive en Supabase, jamás en el navegador.
//
//   2. Respaldo: openfootball (sin clave). Solo liga, y con retraso REAL
//      medido el 15/09/2026: último resultado del 07/09, jornada 5 entera sin
//      marcador. Sirve para no quedarse en blanco si la función no está
//      desplegada o se queda sin cuota, pero no es el destino.
//
// `source` en la respuesta dice cuál de los dos contestó, para poder avisarlo
// en pantalla en vez de mostrar datos viejos como si fueran frescos.

import supabase from "../supabase.js";
import { fetchLeague, seasonOf } from "./football.js";
import { buildStandings } from "./standings.js";
import { teamById, teamByName } from "./teams.js";

const CACHE_PREFIX = "mp-fapi-";
const TTL_MS = 10 * 60 * 1000;

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw);
    return env && typeof env.ts === "number" ? env : null;
  } catch { return null; }
}
function writeCache(key, data) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data })); } catch { /* cuota */ }
}

// ¿Está la función desplegada y con clave? Se comprueba una vez por sesión.
let liveState = null;   // null = sin comprobar · true/false
export async function isLive() {
  if (liveState !== null) return liveState;
  try {
    const { data, error } = await supabase.functions.invoke("football", { body: { action: "probe" } });
    // La función responde `sin_clave` si está desplegada pero falta el secreto.
    liveState = !error && !!data && data.error !== "sin_clave" && data.error !== "accion_desconocida" ? true
      : (!error && data?.error === "accion_desconocida");   // desplegada y con clave
    if (!error && data?.error === "sin_clave") liveState = false;
  } catch { liveState = false; }
  return liveState;
}

async function call(body) {
  const { data, error } = await supabase.functions.invoke("football", { body });
  if (error) throw new Error(error.message || "edge_error");
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── Clasificación ───────────────────────────────────────────────────────────
// Devuelve { source, updatedAt, table: [{ pos, teamId, name, pj, g, e, p, gf, gc, dg, pts }] }
export async function getStandings(competitionId) {
  const ck = `st-${competitionId}`;
  const env = readCache(ck);
  if (env && Date.now() - env.ts < TTL_MS) return env.data;

  try {
    const j = await call({ action: "standings", competition: competitionId });
    const total = (j.standings || []).find(s => s.type === "TOTAL") || (j.standings || [])[0];
    const table = (total?.table || []).map(r => ({
      pos: r.position,
      teamId: matchTeamId(r.team),
      name: r.team?.shortName || r.team?.name || "?",
      crestUrl: r.team?.crest || null,
      pj: r.playedGames ?? 0, g: r.won ?? 0, e: r.draw ?? 0, p: r.lost ?? 0,
      gf: r.goalsFor ?? 0, gc: r.goalsAgainst ?? 0, dg: r.goalDifference ?? 0, pts: r.points ?? 0,
    }));
    const out = { source: "live", updatedAt: j.fetchedAt || Date.now(), table, competition: j.competition };
    writeCache(ck, out);
    return out;
  } catch {
    // Respaldo: calcularla de openfootball, avisando de que es la vieja.
    const league = competitionId === "cl" ? null : competitionId;
    if (!league) return env?.data || { source: "none", table: [] };
    const ms = await fetchLeague(league);
    if (!ms) return env?.data || { source: "none", table: [] };
    const table = buildStandings(ms).map(r => ({ ...r, crestUrl: null }));
    const ultimo = lastResultDate(ms);
    const out = { source: "openfootball", updatedAt: null, staleUntil: ultimo, table };
    writeCache(ck, out);
    return out;
  }
}

// ── Partidos de un equipo, TODAS sus competiciones ──────────────────────────
// Devuelve { source, matches: [{ date, time, comp, home, away, homeId, awayId, ft, status }] }
export async function getTeamMatches(teamId) {
  const team = teamById(teamId);
  if (!team) return { source: "none", matches: [] };
  const ck = `tm-${teamId}`;
  const env = readCache(ck);
  if (env && Date.now() - env.ts < TTL_MS) return env.data;

  try {
    const j = await call({ action: "teamMatches", competition: team.league, teamName: team.names[0] });
    const matches = (j.matches || []).map(normalizeLiveMatch).filter(Boolean);
    const out = { source: "live", updatedAt: j.fetchedAt || Date.now(), matches };
    writeCache(ck, out);
    return out;
  } catch {
    const ms = await fetchLeague(team.league);
    if (!ms) return env?.data || { source: "none", matches: [] };
    const matches = ms
      .filter(m => {
        const h = teamByName(m.team1), a = teamByName(m.team2);
        return (h && h.id === teamId) || (a && a.id === teamId);
      })
      .map(m => ({
        date: m.date, time: m.time || null, comp: "Liga", round: m.round || null,
        home: m.team1, away: m.team2,
        homeId: teamByName(m.team1)?.id || null, awayId: teamByName(m.team2)?.id || null,
        ft: Array.isArray(m.score?.ft) ? m.score.ft : null,
        status: Array.isArray(m.score?.ft) ? "FINISHED" : "SCHEDULED",
      }));
    const out = { source: "openfootball", updatedAt: null, staleUntil: lastResultDate(ms), matches };
    writeCache(ck, out);
    return out;
  }
}

// ── En vivo ─────────────────────────────────────────────────────────────────
// SIN CACHÉ de localStorage a propósito: un marcador guardado de hace un rato
// y pintado como "en vivo" es peor que no enseñar nada. La única caché es la
// del servidor (25 s), que protege el límite de peticiones sin mentir.
// No hay respaldo de openfootball: esa fuente publica con días de retraso, así
// que para "en vivo" no existe. Si no hay conexión en vivo, se dice.
export async function getLive(teamId) {
  const team = teamById(teamId);
  if (!team) return { source: "none", mine: [], others: [], fetchedAt: null };
  try {
    const j = await call({ action: "live", competition: team.league, teamName: team.names[0] });
    return {
      source: "live",
      mine: (j.mine || []).map(normalizeLiveMatch).filter(Boolean),
      others: (j.others || []).map(normalizeLiveMatch).filter(Boolean),
      fetchedAt: j.fetchedAt || Date.now(),
    };
  } catch (e) {
    return { source: "none", mine: [], others: [], fetchedAt: null, error: String(e.message || e) };
  }
}

// ── Goleadores ──────────────────────────────────────────────────────────────
// `limit` alto a propósito: para poder filtrar "solo mi equipo" hace falta
// bajar bastante en la tabla de la competición — un jugador con 3 goles no
// está entre los 20 primeros de LaLiga, pero sí es el tercer goleador de su
// equipo. La caché va por competición Y por límite.
export async function getScorers(competitionId, limit = 100) {
  const ck = `sc-${competitionId}-${limit}`;
  const env = readCache(ck);
  if (env && Date.now() - env.ts < 60 * 60 * 1000) return env.data;
  try {
    const j = await call({ action: "scorers", competition: competitionId, limit });
    const out = { source: "live", competition: j.competition || null, scorers: j.scorers || [], updatedAt: j.fetchedAt || Date.now() };
    writeCache(ck, out);
    return out;
  } catch {
    return env?.data || { source: "none", competition: null, scorers: [] };
  }
}

// Varias competiciones a la vez, para el modo "Todas". Devuelve las entradas
// por separado (con su etiqueta) para que la fusión pueda decir de dónde sale
// cada gol. Una competición que falle no tumba a las demás: se omite y se
// refleja en `parciales`, para poder avisar de que el total está incompleto.
export async function getScorersMulti(competitionIds = [], limit = 100) {
  const res = await Promise.all(competitionIds.map(id =>
    getScorers(id, limit)
      .then(r => ({ id, ok: (r.scorers || []).length > 0, comp: r.competition || compIdLabel(id), scorers: r.scorers || [], source: r.source, updatedAt: r.updatedAt }))
      .catch(() => ({ id, ok: false, comp: compIdLabel(id), scorers: [], source: "none" }))
  ));
  return {
    entries: res.filter(r => r.ok).map(({ comp, scorers }) => ({ comp, scorers })),
    parciales: res.filter(r => !r.ok).map(r => r.comp),
    source: res.some(r => r.source === "live") ? "live" : "none",
    updatedAt: Math.max(0, ...res.map(r => r.updatedAt || 0)) || null,
  };
}

export function compIdLabel(id) {
  return { "es.1": "Liga", "en.1": "Premier", cl: "Champions" }[id] || id;
}


// ── Todos los partidos de la liga (para la proyección) ──────────────────────
// La proyección necesita los pendientes de TODOS los equipos, no solo los míos.
// Devuelve { source, matches: [{ homeId, awayId, ft }] }.
export async function getCompetitionMatches(competitionId) {
  const ck = `cm-${competitionId}`;
  const env = readCache(ck);
  if (env && Date.now() - env.ts < TTL_MS) return env.data;
  try {
    const j = await call({ action: "competitionMatches", competition: competitionId });
    const matches = (j.matches || []).map(normalizeLiveMatch).filter(Boolean);
    const out = { source: "live", matches, updatedAt: j.fetchedAt || Date.now() };
    writeCache(ck, out);
    return out;
  } catch {
    const ms = await fetchLeague(competitionId);
    if (!ms) return env?.data || { source: "none", matches: [] };
    const out = { source: "openfootball", staleUntil: lastResultDate(ms), matches: ms.map(ofToMatch) };
    writeCache(ck, out);
    return out;
  }
}

// ── Temporada ANTERIOR ──────────────────────────────────────────────────────
// Aquí openfootball es perfecto: los datos históricos no caducan, así que su
// retraso —fatal para la temporada en curso— da exactamente igual. Se usa
// siempre, esté o no la conexión en vivo. Alimenta el encogido de las fuerzas,
// que es lo que impide que un 6-0 en la jornada 1 dispare las probabilidades.
export async function getPriorSeason(leagueId) {
  const ck = `prev-${leagueId}`;
  const env = readCache(ck);
  if (env) return env.data;                       // una temporada cerrada no cambia
  const prevSeason = previousSeason(seasonOf());
  const ms = await fetchLeague(leagueId, { season: prevSeason });
  const rows = ms ? buildStandings(ms) : [];
  writeCache(ck, rows);
  return rows;
}

export function previousSeason(season) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(season || ""));
  if (!m) return season;
  const start = Number(m[1]) - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// Partido de openfootball → la forma común.
export function ofToMatch(m) {
  return {
    date: m.date, time: m.time || null, comp: "Liga", round: m.round || null,
    home: m.team1, away: m.team2,
    homeId: teamByName(m.team1)?.id || null,
    awayId: teamByName(m.team2)?.id || null,
    ft: Array.isArray(m.score?.ft) ? m.score.ft : null,
    status: Array.isArray(m.score?.ft) ? "FINISHED" : "SCHEDULED",
  };
}

// ── Utilidades puras (exportadas para poder probarlas) ──────────────────────

// Un partido de football-data → la forma que usa la app.
export function normalizeLiveMatch(m) {
  if (!m || !m.utcDate) return null;
  const d = new Date(m.utcDate);
  if (isNaN(d.getTime())) return null;
  const pad = n => String(n).padStart(2, "0");
  return {
    id: m.id ?? null,
    // El minuto de juego solo viene en los planes de pago. Si no llega, se
    // queda en null y la UI no lo pinta — nunca se estima.
    minute: Number.isFinite(m.minute) ? m.minute : null,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    comp: compLabel(m.competition?.code),
    round: m.matchday ? `J ${m.matchday}` : (m.stage ? stageLabel(m.stage) : null),
    home: m.homeTeam?.name || "?",
    away: m.awayTeam?.name || "?",
    homeId: matchTeamId(m.homeTeam),
    awayId: matchTeamId(m.awayTeam),
    ft: Number.isFinite(m.score?.fullTime?.home) && Number.isFinite(m.score?.fullTime?.away)
      ? [m.score.fullTime.home, m.score.fullTime.away] : null,
    status: m.status || "SCHEDULED",
  };
}

export function compLabel(code) {
  return { PD: "Liga", PL: "Premier", CL: "Champions", CDR: "Copa", SA: "Serie A", BL1: "Bundesliga", FL1: "Ligue 1", EC: "Euro", WC: "Mundial", CLI: "Libertadores" }[code] || code || "—";
}

export function stageLabel(stage) {
  return {
    LEAGUE_STAGE: "Fase liga", GROUP_STAGE: "Grupos", PLAY_OFFS: "Playoff",
    LAST_16: "Octavos", ROUND_OF_16: "Octavos", QUARTER_FINALS: "Cuartos",
    SEMI_FINALS: "Semis", FINAL: "Final",
  }[stage] || null;
}

// El equipo que devuelve la API → nuestro id de catálogo, comparando por
// igualdad de nombre normalizado contra los alias. Si no está en el catálogo
// (un rival europeo, por ejemplo), devuelve null y se pinta sin escudo.
export function matchTeamId(apiTeam) {
  if (!apiTeam) return null;
  for (const cand of [apiTeam.name, apiTeam.shortName]) {
    const t = teamByName(cand);
    if (t) return t.id;
  }
  return null;
}

export function lastResultDate(openfootballMatches = []) {
  let last = null;
  for (const m of openfootballMatches) {
    if (Array.isArray(m?.score?.ft) && (!last || m.date > last)) last = m.date;
  }
  return last;
}
