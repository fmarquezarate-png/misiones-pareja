// Clasificación calculada desde los resultados (v5.31.0).
//
// La fuente no publica tabla: publica los 380 partidos con su marcador. Se
// construye aquí, que además es más exacto que una tabla oficial cacheada —
// en cuanto un resultado entra, la clasificación ya lo refleja. Es el mismo
// enfoque que usa el widget de Scriptable de Fran (`construirTabla`).
//
// Desempate de LaLiga: puntos → enfrentamiento directo → diferencia general →
// goles a favor. El enfrentamiento directo solo se aplica cuando el cruce está
// COMPLETO (se han jugado los dos partidos); si no, la regla oficial no
// corresponde todavía y se pasa a la diferencia general.

import { teamByName } from "./teams.js";

const pairKey = (a, b) => [a, b].sort().join("|");

// ¿Tiene marcador final utilizable?
function fullTime(m) {
  const ft = m?.score?.ft;
  if (!Array.isArray(ft) || ft.length < 2) return null;
  const [h, a] = ft;
  return Number.isFinite(h) && Number.isFinite(a) ? [h, a] : null;
}

export function playedMatches(matches = []) {
  return (matches || []).filter(m => m && fullTime(m));
}

// Tabla completa. Devuelve filas con { teamId, name, pj, g, e, p, gf, gc, dg, pts, pos }.
export function buildStandings(matches = []) {
  const rows = {};
  const h2h = {};          // clave de cruce → { equipo: goles }
  const h2hCount = {};     // clave de cruce → partidos jugados entre ellos

  const ensure = name => {
    const t = teamByName(name);
    const id = t ? t.id : name;
    if (!rows[id]) rows[id] = { teamId: t ? t.id : null, name: t ? t.short : name, key: id, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
    return rows[id];
  };

  for (const m of matches || []) {
    const ft = fullTime(m);
    if (!ft) continue;
    const [gh, ga] = ft;
    const local = ensure(m.team1), visita = ensure(m.team2);
    local.pj++; visita.pj++;
    local.gf += gh; local.gc += ga;
    visita.gf += ga; visita.gc += gh;
    if (gh > ga) { local.pts += 3; local.g++; visita.p++; }
    else if (ga > gh) { visita.pts += 3; visita.g++; local.p++; }
    else { local.pts++; visita.pts++; local.e++; visita.e++; }

    const k = pairKey(local.key, visita.key);
    if (!h2h[k]) h2h[k] = {};
    h2h[k][local.key] = (h2h[k][local.key] || 0) + gh;
    h2h[k][visita.key] = (h2h[k][visita.key] || 0) + ga;
    h2hCount[k] = (h2hCount[k] || 0) + 1;
  }

  const table = Object.values(rows);
  for (const r of table) r.dg = r.gf - r.gc;
  sortTable(table, h2h, h2hCount);
  return table;
}

export function sortTable(table, h2h = {}, h2hCount = {}) {
  table.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const k = pairKey(a.key, b.key);
    // El enfrentamiento directo solo cuenta con el cruce cerrado (ida y vuelta).
    if (h2hCount[k] >= 2 && h2h[k]) {
      const dif = (h2h[k][b.key] || 0) - (h2h[k][a.key] || 0);
      if (dif !== 0) return dif;
    }
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name);
  });
  table.forEach((r, i) => { r.pos = i + 1; });
  return table;
}

// Recorte alrededor de un equipo, para no pintar 20 filas en un móvil.
// Siempre se ven las plazas de arriba y el entorno del equipo.
export function standingsAround(table = [], teamId, { top = 4, around = 1 } = {}) {
  const idx = table.findIndex(r => r.teamId === teamId);
  const cabeza = table.slice(0, top);
  if (idx < 0) return { cabeza, entorno: [], hayHueco: table.length > top };
  if (idx < top) return { cabeza, entorno: [], hayHueco: false };
  const desde = Math.max(top, idx - around);
  const hasta = Math.min(table.length, idx + around + 1);
  return { cabeza, entorno: table.slice(desde, hasta), hayHueco: desde > top };
}

// Los últimos N resultados de un equipo, del más antiguo al más reciente:
// "GGEPG". Sirve para la racha.
export function teamForm(matches = [], teamId, n = 5) {
  const out = [];
  for (const m of matches || []) {
    const ft = fullTime(m);
    if (!ft) continue;
    const h = teamByName(m.team1), a = teamByName(m.team2);
    const esLocal = h && h.id === teamId, esVisita = a && a.id === teamId;
    if (!esLocal && !esVisita) continue;
    const propios = esLocal ? ft[0] : ft[1];
    const ajenos = esLocal ? ft[1] : ft[0];
    out.push({ date: m.date, r: propios > ajenos ? "G" : propios === ajenos ? "E" : "P" });
  }
  out.sort((x, y) => x.date.localeCompare(y.date));
  return out.slice(-n).map(x => x.r);
}

// Últimos enfrentamientos jugados y próximos, con marcador cuando lo hay.
export function teamTimeline(matches = [], teamId, { pasados = 3, proximos = 5, hoy } = {}) {
  const today = hoy || new Date().toISOString().slice(0, 10);
  const mios = (matches || []).filter(m => {
    const h = teamByName(m.team1), a = teamByName(m.team2);
    return (h && h.id === teamId) || (a && a.id === teamId);
  }).sort((x, y) => (x.date || "").localeCompare(y.date || ""));

  const jugados = mios.filter(m => fullTime(m));
  const porJugar = mios.filter(m => !fullTime(m) && (m.date || "") >= today);
  return {
    pasados: jugados.slice(-pasados).reverse(),
    proximos: porJugar.slice(0, proximos),
  };
}

// Resultado de un partido desde el punto de vista de un equipo.
export function resultFor(m, teamId) {
  const ft = fullTime(m);
  if (!ft) return null;
  const h = teamByName(m.team1);
  const esLocal = h && h.id === teamId;
  const propios = esLocal ? ft[0] : ft[1];
  const ajenos = esLocal ? ft[1] : ft[0];
  return { propios, ajenos, marcador: `${ft[0]}–${ft[1]}`, r: propios > ajenos ? "G" : propios === ajenos ? "E" : "P" };
}
