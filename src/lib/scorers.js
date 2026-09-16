// Goleadores y asistentes — fusión, filtrado y orden.
//
// POR QUÉ ESTE MÓDULO
// football-data publica los máximos goleadores POR COMPETICIÓN. Para responder
// "¿cuántas participaciones de gol lleva este jugador en la temporada?" hay que
// sumar sus filas de Liga y de Champions, que llegan en respuestas distintas.
// Esa fusión es donde están las trampas (mismo nombre en equipos distintos,
// asistencias que la fuente no publica y devuelve `null`), así que vive aquí,
// en funciones puras y probadas, no dentro del componente.
//
// Reglas del proyecto que aplican:
//  · Emparejar por igualdad exacta normalizada, nunca por `includes`
//    (CLAUDE.md §5, el caso "RCD Espanyol de Barcelona" contiene "Barcelona").
//  · Un dato que la fuente no trae NO se inventa: `null` ≠ 0. Un jugador con
//    0 asistencias publicadas y uno cuya competición no publica asistencias
//    son cosas distintas y se pintan distinto.

import { teamByName } from "./teams.js";

const norm = s => String(s || "")
  .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();

// Un jugador es "el mismo" si coinciden nombre Y equipo. Si alguien cambia de
// club a mitad de temporada aparecerá dos veces — que es lo correcto: sus goles
// pertenecen a equipos distintos y juntarlos mentiría en el filtro por equipo.
export function scorerKey(s) {
  return `${norm(s?.name)}|${norm(s?.teamName)}`;
}

// Suma que respeta el null: si NINGUNA competición publica el dato, el total
// sigue siendo null (desconocido). Si alguna lo publica, se suman las que sí.
function sumaNullable(a, b) {
  if (a == null && b == null) return null;
  return (a || 0) + (b || 0);
}

/**
 * Fusiona varias listas de goleadores en una sola.
 * @param {Array<{comp: string, scorers: Array}>} entradas
 * @returns filas con `porComp` = { Liga: {g, a}, Champions: {g, a} }
 */
export function mergeScorers(entradas = []) {
  const mapa = new Map();
  for (const { comp, scorers } of entradas) {
    for (const s of scorers || []) {
      if (!s?.name) continue;
      const k = scorerKey(s);
      const prev = mapa.get(k);
      const g = s.goals || 0;
      const a = s.assists;
      if (!prev) {
        mapa.set(k, {
          name: s.name,
          teamName: s.teamName || null,
          teamTla: s.teamTla || null,
          goals: g,
          assists: a ?? null,
          playedMatches: s.playedMatches ?? null,
          porComp: comp ? { [comp]: { g, a: a ?? null } } : {},
        });
      } else {
        prev.goals += g;
        prev.assists = sumaNullable(prev.assists, a);
        prev.playedMatches = sumaNullable(prev.playedMatches, s.playedMatches);
        if (comp) prev.porComp[comp] = { g, a: a ?? null };
      }
    }
  }
  return [...mapa.values()];
}

// Participaciones de gol = goles + asistencias. Con asistencias desconocidas
// devuelve solo los goles, nunca inventa un 0.
export function participaciones(r) {
  return (r?.goals || 0) + (r?.assists || 0);
}

// ¿Publica la fuente las asistencias de estos datos? El plan gratuito de
// football-data las trae en unas competiciones y en otras no. Sin esto, la
// pestaña de asistentes saldría con todo a cero como si nadie asistiera.
export function hasAssists(rows = []) {
  return rows.some(r => r?.assists != null);
}

export const MODOS = {
  goles: { label: "Goleadores", campo: "goals", corto: "G" },
  asistencias: { label: "Asistentes", campo: "assists", corto: "A" },
};

// Orden con desempates explícitos: por la métrica pedida, luego por la otra y
// por último por nombre — para que la lista no baile entre recargas.
export function sortScorers(rows = [], modo = "goles") {
  const principal = modo === "asistencias" ? r => r.assists || 0 : r => r.goals || 0;
  const secundaria = modo === "asistencias" ? r => r.goals || 0 : r => r.assists || 0;
  return [...rows].sort((a, b) =>
    principal(b) - principal(a) ||
    secundaria(b) - secundaria(a) ||
    participaciones(b) - participaciones(a) ||
    String(a.name).localeCompare(String(b.name))
  );
}

// Filtra a los jugadores de un equipo. Igualdad exacta contra los alias del
// catálogo, con el código de 3 letras como respaldo.
export function filterMyTeam(rows = [], teamId, tla = null) {
  if (!teamId) return rows;
  return rows.filter(r => {
    const t = teamByName(r.teamName);
    if (t) return t.id === teamId;
    return tla ? norm(r.teamTla) === norm(tla) : false;
  });
}

// Totales del bloque que se está mirando, para la cabecera de la tabla.
export function totales(rows = []) {
  return rows.reduce((acc, r) => ({
    goles: acc.goles + (r.goals || 0),
    asistencias: r.assists == null ? acc.asistencias : acc.asistencias + r.assists,
    jugadores: acc.jugadores + 1,
  }), { goles: 0, asistencias: 0, jugadores: 0 });
}

// Las competiciones de las que SÍ se pueden pedir goleadores. La Copa del Rey
// y las supercopas no están en el plan gratuito de football-data, así que
// ofrecer un botón para ellas sería prometer algo que no llega.
export function compsConGoleadores(leagueId, ligaLabel = "Liga") {
  return [
    { id: leagueId, label: ligaLabel },
    { id: "cl", label: "Champions" },
    { id: "todas", label: "Todas" },
  ];
}
