// ─── Helpers de progreso e historial de metas ─────────────────────────────────
import { getWeekAndYear } from "../utils.js";

export function computeGoalProgress(goal, weeks, cwn, cyr) {
  const now = new Date();
  const allDone = Object.values(weeks).flatMap(w =>
    (w.missions || []).filter(m => m.goalId === goal.id && m.status === "DONE")
      .map(m => ({ ...m, wn: w.weekNumber, wy: w.year || cyr }))
  );
  let current = 0;
  if (goal.period === "weekly") {
    current = allDone.filter(m => m.wn === cwn && m.wy === cyr).length;
  } else if (goal.period === "monthly") {
    current = allDone.filter(m => {
      if (m.date) {
        const d = new Date(m.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      const approx = new Date(m.wy, 0, 1 + (m.wn - 1) * 7);
      return approx.getMonth() === now.getMonth() && approx.getFullYear() === now.getFullYear();
    }).length;
  } else {
    current = allDone.filter(m => {
      if (m.date) return new Date(m.date).getFullYear() === now.getFullYear();
      return m.wy === now.getFullYear();
    }).length;
  }
  const isMax = goal.goalType === "max";
  const pct = goal.target > 0 ? Math.min((current / goal.target) * 100, 100) : 0;
  return {
    current,
    target: goal.target,
    pct,
    isMax,
    met: isMax ? current <= goal.target : current >= goal.target,
  };
}

export function computeGoalHistory(goal, weeks) {
  const now = new Date();
  const allDone = Object.values(weeks).flatMap(w =>
    (w.missions || []).filter(m => m.goalId === goal.id && m.status === "DONE")
      .map(m => ({ ...m, wn: w.weekNumber, wy: w.year || now.getFullYear() }))
  );
  const isMax = goal.goalType === "max";
  const startDate = goal.startDate ? new Date(goal.startDate) : null;
  const beforeStart = d => startDate && d < startDate;
  const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  if (goal.period === "weekly") {
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (7 - i) * 7);
      const { week: wn, year: wy } = getWeekAndYear(d);
      if (beforeStart(d)) return { label: `S${wn}`, count: 0, met: false, isPast: i < 7, noData: true };
      const isPast = i < 7;
      const count = allDone.filter(m => m.wn === wn && m.wy === wy).length;
      const met = isMax ? count <= goal.target : count >= goal.target;
      return { label: `S${wn}`, count, met, isPast };
    });
  } else if (goal.period === "monthly") {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const mo = d.getMonth(), yr = d.getFullYear();
      if (beforeStart(d)) return { label: MONTHS_SHORT[mo], count: 0, met: false, isPast: i < 5, noData: true };
      const isPast = i < 5;
      const count = allDone.filter(m => {
        if (m.date) { const md = new Date(m.date); return md.getMonth() === mo && md.getFullYear() === yr; }
        const approx = new Date(m.wy, 0, 1 + (m.wn - 1) * 7);
        return approx.getMonth() === mo && approx.getFullYear() === yr;
      }).length;
      const met = isMax ? count <= goal.target : count >= goal.target;
      return { label: MONTHS_SHORT[mo], count, met, isPast };
    });
  } else {
    return Array.from({ length: 4 }, (_, i) => {
      const yr = now.getFullYear() - (3 - i);
      const d = new Date(yr, 0, 1);
      if (beforeStart(d)) return { label: String(yr), count: 0, met: false, isPast: i < 3, noData: true };
      const isPast = i < 3;
      const count = allDone.filter(m => {
        if (m.date) return new Date(m.date).getFullYear() === yr;
        return m.wy === yr;
      }).length;
      const met = isMax ? count <= goal.target : count >= goal.target;
      return { label: String(yr), count, met, isPast };
    });
  }
}
