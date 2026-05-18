// ─── Helpers de carry-over y reparación de misiones ──────────────────────────
import { uid, isoWeekKey, getWeekAndYear, prevWeekFn } from "../utils.js";

export function repairMisplacedMissions(data) {
  let weeks = { ...data.weeks };
  let moved = 0;
  for (const [key, week] of Object.entries(weeks)) {
    const keep = [], move = [];
    for (const m of (week.missions || [])) {
      if (!m.date) { keep.push(m); continue; }
      const { week: wn, year: yr } = getWeekAndYear(new Date(m.date));
      const targetKey = isoWeekKey(wn, yr);
      if (targetKey === key) { keep.push(m); }
      else { move.push({ m, targetKey, wn, yr }); }
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
  const existingSeriesIds = new Set((currW.missions || []).filter(m => m.seriesId).map(m => m.seriesId));
  const toCarry = (prevW.missions || []).filter(m => m.status !== "DONE" && !existingCarriedIds.has(m.id) && !existingTitles.has(m.title));

  const { wn: p2wn, yr: p2yr } = prevWeekFn(pwn, pyr);
  const prev2W = data.weeks[isoWeekKey(p2wn, p2yr)];
  const prevSeries = (prevW.missions || []).filter(m => m.seriesPattern && m.seriesId);
  const prevSeriesIds = new Set(prevSeries.map(m => m.seriesId));
  const biweeklyFromPrev2 = (prev2W?.missions || []).filter(m =>
    m.seriesPattern === "biweekly" && m.seriesId &&
    !existingSeriesIds.has(m.seriesId) && !prevSeriesIds.has(m.seriesId)
  );
  const allSeriesSources = [...prevSeries, ...biweeklyFromPrev2];

  const today = new Date();
  const isFirstWeekOfMonth = cwn === getWeekAndYear(new Date(today.getFullYear(), today.getMonth(), 1)).week;
  const seriesEndOk = m => {
    if (!m.seriesEndDate) return true;
    const { week: eWn, year: eYr } = getWeekAndYear(new Date(m.seriesEndDate));
    return !(cyr > eYr || (cyr === eYr && cwn > eWn));
  };

  const newSeriesMissions = allSeriesSources.filter(m => {
    if (existingSeriesIds.has(m.seriesId)) return false;
    if (!seriesEndOk(m)) return false;
    if (m.seriesPattern === "weekly") return true;
    if (m.seriesPattern === "monthly") return isFirstWeekOfMonth;
    if (m.seriesPattern === "biweekly") {
      const sWn = m.seriesStartWeek || pwn;
      const sYr = m.seriesStartYear || pyr;
      const weeksDiff = (cyr - sYr) * 52 + (cwn - sWn);
      return weeksDiff % 2 === 0;
    }
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
  const origMission = origWeek.missions.find(m => m.id === mission.carriedFrom);
  if (!origMission) return data;
  const updatedOrigMissions = origWeek.missions.map(m =>
    m.id === origMission.id ? { ...m, status: "DONE", completedAt: Date.now() } : m
  );
  return {
    ...data,
    weeks: {
      ...data.weeks,
      [mission.carriedFromWeek]: { ...origWeek, missions: updatedOrigMissions },
    },
  };
}
