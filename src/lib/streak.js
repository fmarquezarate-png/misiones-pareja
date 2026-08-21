import { getWeekAndYear, isoWeekKey, localDateStr } from "../utils.js";

// Delta del anillo de racha personal (últimos 15 días) al completar `mission`.
// Extraído de cycleStatus/cycleStatusGlobal (estaba duplicado verbatim). Puro:
// `now` inyectable → testeable. Devuelve el objeto de festejo o null si la misión
// no cuenta (evento, futura, completedLate, o no está en la ventana activa).
export function computeStreakDelta(weeks, mission, colors, now = new Date()) {
  if (!mission) return null;
  const todayStr = localDateStr(now);
  const { week: tWn, year: tYr } = getWeekAndYear(now);
  const todayWkey = isoWeekKey(tWn, tYr);
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 14);
  const { week: cWn, year: cYr } = getWeekAndYear(cutoff);
  const cutoffWkey = isoWeekKey(cWn, cYr);

  const last15 = Object.entries(weeks || {})
    .filter(([k]) => k >= cutoffWkey && k <= todayWkey)
    .flatMap(([, w]) => (w.missions || []).filter(m => m.type !== "event" && (!m.date || m.date <= todayStr)));
  const personMs = last15.filter(m => mission.who === "person1"
    ? (m.who === "person1" || m.who === "together")
    : (m.who === "person2" || m.who === "together"));
  const active = personMs.filter(m => !m.completedLate);
  const total = active.length;
  if (total > 0 && active.some(m => m.id === mission.id)) {
    const doneBefore = active.filter(m => m.status === "DONE").length;
    const beforePct = Math.round((doneBefore / total) * 100);
    const afterPct = Math.round(((doneBefore + 1) / total) * 100);
    const color = mission.who === "person1" ? colors?.person1 : colors?.person2;
    return { mission, beforePct, afterPct, delta: afterPct - beforePct, color };
  }
  return null;
}
