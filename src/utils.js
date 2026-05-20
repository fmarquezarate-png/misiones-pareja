// ─── ID / week helpers ────────────────────────────────────────────────────────
export const uid = () => Math.random().toString(36).slice(2, 9);

export const isoWeekKey = (wn, yr) => `${yr}-W${String(wn).padStart(2, "0")}`;

export const getWeekAndYear = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil((((d - ys) / 86400000) + 1) / 7), year: d.getUTCFullYear() };
};

export const isTodayMonday    = () => new Date().getDay() === 1;
export const isoWeeksInYear   = yr => getWeekAndYear(new Date(yr, 11, 28)).week;
export const prevWeekFn       = (wn, yr) => wn === 1 ? { wn: isoWeeksInYear(yr - 1), yr: yr - 1 } : { wn: wn - 1, yr };

// ─── Google Calendar URL ──────────────────────────────────────────────────────
export const googleCalendarUrl = (mission, name1, name2) => {
  if (!mission.date) return null;
  const ds = mission.date.replace(/-/g, "");
  let dates;
  if (mission.time) {
    const [hh, mm] = mission.time.split(":").map(Number);
    const tot = hh * 60 + mm + Math.round((mission.duration || mission.estimatedHours || 1) * 60);
    const eh = String(Math.floor(tot / 60) % 24).padStart(2, "0");
    const em = String(tot % 60).padStart(2, "0");
    dates = `${ds}T${String(hh).padStart(2,"0")}${String(mm).padStart(2,"0")}00/${ds}T${eh}${em}00`;
  } else {
    const nd = new Date(mission.date); nd.setDate(nd.getDate() + 1);
    dates = `${ds}/${nd.toISOString().slice(0, 10).replace(/-/g, "")}`;
  }
  const who = mission.who === "person1" ? name1 : mission.who === "person2" ? name2 : `${name1} & ${name2}`;
  const dur = mission.duration || mission.estimatedHours;
  const details = `Quién: ${who}${dur ? ` · ${dur}h` : ""}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(mission.emoji + " " + mission.title)}&dates=${dates}&details=${encodeURIComponent(details)}`;
};

// ─── Goal helpers ─────────────────────────────────────────────────────────────
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
      if (m.date) { const d = new Date(m.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }
      const approx = new Date(m.wy, 0, 1 + (m.wn - 1) * 7);
      return approx.getMonth() === now.getMonth() && approx.getFullYear() === now.getFullYear();
    }).length;
  } else {
    current = allDone.filter(m => {
      if (m.date) return new Date(m.date).getFullYear() === now.getFullYear();
      return m.wy === now.getFullYear();
    }).length;
  }
  const pct = goal.target > 0 ? Math.min((current / goal.target) * 100, 100) : 0;
  return { current, target: goal.target, pct, isMax: goal.goalType === "max", met: goal.goalType === "max" ? current <= goal.target : current >= goal.target };
}

export function computeGoalHistory(goal, weeks, { includeMissions = false } = {}) {
  const now = new Date();
  const allDone = Object.values(weeks).flatMap(w =>
    (w.missions || []).filter(m => m.goalId === goal.id && m.status === "DONE")
      .map(m => ({ ...m, wn: w.weekNumber, wy: w.year || now.getFullYear() }))
  );
  const isMax = goal.goalType === "max";
  const startDate = goal.startDate ? new Date(goal.startDate) : null;
  const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  const beforeStart = (periodDate) => startDate && periodDate < startDate;

  if (goal.period === "weekly") {
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (7 - i) * 7);
      const { week: wn, year: wy } = getWeekAndYear(d);
      if (beforeStart(d)) return { label: `S${wn}`, count: 0, met: false, isPast: i < 7, noData: true, wn, wy, ...(includeMissions ? { missions: [] } : {}) };
      const weekFilter = (m) => m.wn === wn && m.wy === wy;
      const periodMissions = includeMissions ? allDone.filter(weekFilter) : [];
      const count = includeMissions ? periodMissions.length : allDone.filter(weekFilter).length;
      return { label: `S${wn}`, count, met: isMax ? count <= goal.target : count >= goal.target, isPast: i < 7, wn, wy, ...(includeMissions ? { missions: periodMissions } : {}) };
    });
  } else if (goal.period === "monthly") {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const mo = d.getMonth(), yr = d.getFullYear();
      if (beforeStart(d)) return { label: MONTHS_SHORT[mo], count: 0, met: false, isPast: i < 5, noData: true, mo, yr, ...(includeMissions ? { missions: [] } : {}) };
      const monthFilter = (m) => {
        if (m.date) { const md = new Date(m.date); return md.getMonth() === mo && md.getFullYear() === yr; }
        const approx = new Date(m.wy, 0, 1 + (m.wn - 1) * 7);
        return approx.getMonth() === mo && approx.getFullYear() === yr;
      };
      const periodMissions = includeMissions ? allDone.filter(monthFilter) : [];
      const count = includeMissions ? periodMissions.length : allDone.filter(monthFilter).length;
      return { label: MONTHS_SHORT[mo], count, met: isMax ? count <= goal.target : count >= goal.target, isPast: i < 5, mo, yr, ...(includeMissions ? { missions: periodMissions } : {}) };
    });
  } else {
    return Array.from({ length: 4 }, (_, i) => {
      const yr = now.getFullYear() - (3 - i);
      const d = new Date(yr, 0, 1);
      if (beforeStart(d)) return { label: String(yr), count: 0, met: false, isPast: i < 3, noData: true, yr, ...(includeMissions ? { missions: [] } : {}) };
      const yearFilter = (m) => {
        if (m.date) return new Date(m.date).getFullYear() === yr;
        return m.wy === yr;
      };
      const periodMissions = includeMissions ? allDone.filter(yearFilter) : [];
      const count = includeMissions ? periodMissions.length : allDone.filter(yearFilter).length;
      return { label: String(yr), count, met: isMax ? count <= goal.target : count >= goal.target, isPast: i < 3, yr, ...(includeMissions ? { missions: periodMissions } : {}) };
    });
  }
}

// ─── Data repair & carry-over ─────────────────────────────────────────────────
export function repairMisplacedMissions(data) {
  let weeks = { ...data.weeks };
  let moved = 0;
  for (const [key, week] of Object.entries(weeks)) {
    const keep = [], move = [];
    for (const m of (week.missions || [])) {
      if (!m.date) { keep.push(m); continue; }
      const { week: wn, year: yr } = getWeekAndYear(new Date(m.date));
      const targetKey = isoWeekKey(wn, yr);
      if (targetKey === key) keep.push(m);
      else move.push({ m, targetKey, wn, yr });
    }
    if (!move.length) continue;
    weeks = { ...weeks, [key]: { ...week, missions: keep } };
    for (const { m, targetKey, wn, yr } of move) {
      const tw = weeks[targetKey] || { weekNumber: wn, year: yr, epicObjective: "", missions: [], createdAt: Date.now(), workHours: { person1: 0, person2: 0 } };
      if (!tw.missions.find(x => x.id === m.id)) {
        weeks = { ...weeks, [targetKey]: { ...tw, missions: [...tw.missions, m] } };
        moved++;
      }
    }
  }
  return { data: { ...data, weeks }, moved };
}

export function applyCarryOver(data) {
  const { currentWeekNumber: cwn, currentYear: cyr } = data;
  const { wn: pwn, yr: pyr } = prevWeekFn(cwn, cyr);
  const prevKey = isoWeekKey(pwn, pyr), currKey = isoWeekKey(cwn, cyr);
  const prevW = data.weeks[prevKey]; if (!prevW) return data;
  const currW = data.weeks[currKey] || { weekNumber: cwn, year: cyr, epicObjective: "", missions: [], createdAt: Date.now(), workHours: { person1: 0, person2: 0 } };
  const existingCarriedIds = new Set((currW.missions || []).filter(m => m.carriedFrom).map(m => m.carriedFrom));
  const existingTitles = new Set((currW.missions || []).map(m => m.title));
  const toCarry = (prevW.missions || []).filter(m => m.status !== "DONE" && !existingCarriedIds.has(m.id) && !existingTitles.has(m.title));
  const allPrevSeries = (prevW.missions || []).filter(m => m.seriesPattern && m.seriesId);
  const existingSeriesIds = new Set((currW.missions || []).filter(m => m.seriesId).map(m => m.seriesId));
  const today = new Date();
  const isFirstWeekOfMonth = cwn === getWeekAndYear(new Date(today.getFullYear(), today.getMonth(), 1)).week;
  const newSeriesMissions = allPrevSeries.filter(m => {
    if (existingSeriesIds.has(m.seriesId)) return false;
    if (m.seriesPattern === "weekly") return true;
    if (m.seriesPattern === "monthly") return isFirstWeekOfMonth;
    return false;
  }).map(m => ({ ...m, id: uid(), carriedFrom: null, carriedFromWeek: null, date: null, createdAt: Date.now(), completedAt: null, status: "TBC" }));
  if (!toCarry.length && !newSeriesMissions.length) return data;
  const carried = toCarry.map(m => ({ ...m, id: uid(), carriedFrom: m.id, carriedFromWeek: prevKey, date: null, createdAt: Date.now(), completedAt: null, status: m.status === "ASAP" ? "ASAP" : "TBC" }));
  return { ...data, weeks: { ...data.weeks, [currKey]: { ...currW, missions: [...(currW.missions || []), ...carried, ...newSeriesMissions] } } };
}

export function syncCarryDone(data, weekKey, missionId) {
  const week = data.weeks[weekKey]; if (!week) return data;
  const mission = week.missions.find(m => m.id === missionId);
  if (!mission?.carriedFrom || !mission?.carriedFromWeek) return data;
  const origWeek = data.weeks[mission.carriedFromWeek]; if (!origWeek) return data;
  return {
    ...data, weeks: {
      ...data.weeks,
      [mission.carriedFromWeek]: { ...origWeek, missions: origWeek.missions.map(m => m.id === mission.carriedFrom ? { ...m, status: "DONE", completedAt: Date.now() } : m) }
    }
  };
}
