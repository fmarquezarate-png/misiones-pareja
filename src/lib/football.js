// Partidos de tu equipo (v5.30.0).
//
// FUENTE: openfootball/football.json en raw.githubusercontent.com — el MISMO
// host que la app ya usa en producción para el Mundial. Sin clave, sin CORS y
// sin cuota. Se descartaron dos alternativas:
//   · football-data.org (la del widget de Scriptable): necesita una clave en
//     una cabecera. En una PWA la clave quedaría a la vista en el bundle y
//     además su API no manda cabeceras CORS: el navegador ni llegaría a pedirla.
//     Scriptable no sufre nada de esto porque hace HTTP nativo, no del navegador.
//   · ESPN: no pide clave, pero no está verificado que permita CORS y no se
//     puede comprobar desde el entorno de desarrollo. Queda como mejora futura.
//
// LIMITACIÓN HONESTA de la fuente: trae SIEMPRE la fecha, pero la hora solo
// cuando la liga ya la ha anunciado (en LaLiga, unas dos semanas antes). Los
// partidos sin hora se crean como evento del día, y al volver a sincronizar se
// les rellena la hora — por eso `mergeFixtures` actualiza, no duplica.

import { teamById, teamByName } from "./teams.js";

const BASE = "https://raw.githubusercontent.com/openfootball/football.json/master";
const TTL_MS = 12 * 60 * 60 * 1000;   // 12 h
const CACHE_PREFIX = "mp-fb-";

// Temporada al estilo europeo: de julio en adelante ya es la siguiente.
export function seasonOf(date = new Date()) {
  const y = date.getFullYear();
  const start = date.getMonth() >= 6 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export const leagueUrl = (leagueId, season) => `${BASE}/${season}/${leagueId}.json`;

// ── Selección de partidos (puro) ────────────────────────────────────────────
// Partidos de un equipo a partir de una fecha. Comparación EXACTA de nombres:
// "RCD Espanyol de Barcelona" contiene "Barcelona", así que un `includes`
// metería los partidos del Espanyol en el calendario del culé.
export function teamFixtures(matches = [], teamId, { fromDate, limit = 60 } = {}) {
  const team = teamById(teamId);
  if (!team) return [];
  const from = fromDate || new Date().toISOString().slice(0, 10);
  return (matches || [])
    .filter(m => m && m.date && m.date >= from)
    .filter(m => {
      const h = teamByName(m.team1), a = teamByName(m.team2);
      return (h && h.id === teamId) || (a && a.id === teamId);
    })
    .sort((x, y) => (x.date + (x.time || "")).localeCompare(y.date + (y.time || "")))
    .slice(0, limit);
}

// Identidad estable de un partido: misma fecha y mismos dos equipos. No incluye
// la hora a propósito — si la liga la cambia, sigue siendo el mismo partido.
export function fixtureKey(m) {
  const teams = [m.team1, m.team2].map(t => String(t || "").trim()).sort().join("|");
  return `${m.date}|${teams}`;
}

// Partido → misión de la app. El icono es el emoji ⚽ (viaja bien a push y
// exportaciones) y en `crest` va SIEMPRE el escudo de TU equipo, juegue en casa
// o fuera. (v5.30.0 ponía el del rival, pensando en distinguir un partido de
// otro; Fran lo corrigió: lo que quieres ver en tu calendario es tu escudo. El
// rival ya está en el título.)
export function fixtureToMission(m, myTeamId, { uid = () => String(Math.random()).slice(2) } = {}) {
  const home = teamByName(m.team1), away = teamByName(m.team2);
  const mine = teamById(myTeamId);
  const homeLabel = home ? home.short : m.team1;
  const awayLabel = away ? away.short : m.team2;
  return {
    id: uid(),
    emoji: "⚽",
    crest: mine ? mine.id : null,
    title: `${homeLabel} – ${awayLabel}`,
    type: "event",
    who: "together",
    status: "TBC",
    date: m.date,
    time: m.time || null,
    duration: 115,                 // 90' + descanso: ocupa la franja real
    categories: ["ocio"],
    category: null,
    createdAt: Date.now(),
    completedAt: null,
    carriedFrom: null,
    carriedFromWeek: null,
    fixtureKey: fixtureKey(m),     // marca de "esto lo trajo la sincronización"
  };
}

// Fusiona lo que llega con lo que ya está: ni duplica ni pisa tus cambios.
// - Si el partido ya está importado, solo se le actualiza la HORA (y solo si
//   antes no tenía o cambió): el título o la persona los puedes haber tocado tú.
// - Los partidos ya jugados no se tocan.
// Devuelve { nuevos, actualizados } — puro, sin efectos.
export function mergeFixtures(existing = [], incoming = []) {
  const byKey = new Map();
  for (const m of existing) if (m && m.fixtureKey) byKey.set(m.fixtureKey, m);
  const nuevos = [], actualizados = [];
  for (const inc of incoming) {
    const prev = byKey.get(inc.fixtureKey);
    if (!prev) { nuevos.push(inc); continue; }
    if (prev.status === "DONE") continue;
    if ((inc.time || null) !== (prev.time || null) && inc.time) {
      actualizados.push({ id: prev.id, patch: { time: inc.time } });
    }
  }
  return { nuevos, actualizados };
}

// ── Descarga con caché (efectos) ────────────────────────────────────────────
function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw);
    return env && typeof env.ts === "number" ? env : null;
  } catch { return null; }
}

// `stale` permite seguir funcionando sin red con lo último que se descargó.
export async function fetchLeague(leagueId, { season = seasonOf(), timeoutMs = 12000 } = {}) {
  const key = `${season}-${leagueId}`;
  const env = readCache(key);
  if (env && Date.now() - env.ts < TTL_MS) return env.data;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(leagueUrl(leagueId, season), { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    const matches = Array.isArray(json?.matches) ? json.matches : null;
    if (!matches || !matches.length) throw new Error("sin partidos");
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data: matches })); } catch { /* cuota */ }
    return matches;
  } catch {
    return env ? env.data : null;   // caché caducada antes que nada
  }
}
