// appUtils.js — utility functions extracted from App.jsx (Monolito Fase 2c)
import { useRef } from "react";
import { uid, isoWeekKey, getWeekAndYear, prevWeekFn, isoWeeksInYear } from "../utils.js";

// ─── Swipe hook ───────────────────────────────────────────────────────────────
export function useSwipe(onLeft, onRight, minDist = 110) {
  const x0 = useRef(null);
  const y0 = useRef(null);
  return {
    onTouchStart: e => { x0.current = e.touches[0].clientX; y0.current = e.touches[0].clientY; },
    onTouchEnd:   e => {
      if (x0.current === null) return;
      const dx = e.changedTouches[0].clientX - x0.current;
      const dy = e.changedTouches[0].clientY - y0.current;
      x0.current = null; y0.current = null;
      if (Math.abs(dx) < minDist) return;
      if (Math.abs(dx) <= Math.abs(dy) * 1.5) return;
      if (dx < 0) onLeft?.(); else onRight?.();
    },
  };
}

// ─── Date formatting helpers ──────────────────────────────────────────────────
const _SD = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const _SM = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

export const weekStartDate = (wn, yr) => {
  const jan4 = new Date(yr, 0, 4);
  const dow = (jan4.getDay() + 6) % 7;
  return new Date(yr, 0, 4 - dow + (wn - 1) * 7);
};
export const fmtShortDate = d => `${_SD[d.getDay()]} ${d.getDate()} ${_SM[d.getMonth()]}`;
export const fmtWeekRange = (wn, yr) => {
  const mon = weekStartDate(wn, yr);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const from = `${mon.getDate()} ${_SM[mon.getMonth()]}`;
  const to   = `${sun.getDate()} ${_SM[sun.getMonth()]}`;
  return mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()}–${sun.getDate()} ${_SM[mon.getMonth()]}`
    : `${from} – ${to}`;
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const showNotif = (title, body, opts = {}) => {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try { new Notification(title, { icon: "/icon-192.png", badge: "/icon-192.png", body, ...opts }); }
  catch { /* unsupported env */ }
};

let _rTimers = [];
export const clearRTimers = () => { _rTimers.forEach(clearTimeout); _rTimers = []; };
export const scheduleReminders = (data, p1, p2) => {
  clearRTimers();
  if (!data?.settings?.notifications?.eventReminders) return;
  const OFFSETS = { ontime: 0, "15min": 15 * 60e3, "30min": 30 * 60e3, "1h": 60 * 60e3, "1day": 24 * 3600e3 };
  const now = Date.now();
  Object.values(data.weeks || {}).flatMap(w => w.missions || []).forEach(m => {
    if (m.type !== "event" || !m.date || !m.time || !m.reminder || m.reminder === "none") return;
    const offset = OFFSETS[m.reminder]; if (offset === undefined) return;
    const fireAt = new Date(`${m.date}T${m.time}:00`).getTime() - offset;
    if (fireAt <= now) return;
    // setTimeout usa un entero de 32 bits: cualquier retraso > ~24.85 días
    // desborda y dispara de inmediato. Los eventos así de lejanos se re-agendan
    // solos al reabrir la app (este effect corre en cada carga), así que aquí
    // simplemente los saltamos hasta que estén dentro del rango seguro.
    if (fireAt - now > 2147483647) return;
    const who = m.who === "person1" ? p1 : m.who === "person2" ? p2 : "Juntos";
    const label = { ontime: "¡Ahora!", "15min": "En 15 min", "30min": "En 30 min", "1h": "En 1 hora", "1day": "Mañana" }[m.reminder] || "";
    _rTimers.push(setTimeout(() => showNotif(`${m.emoji} ${m.title}`, `${label} · ${who}`, { tag: `rem-${m.id}` }), fireAt - now));
  });
};

// ─── Blob download ────────────────────────────────────────────────────────────
export const dlBlob = (blob, name) => {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 3000);
};

// ─── Multi-day mission date spans ─────────────────────────────────────────────
export const getMissionDates = m => {
  if (!m.date) return [];
  const startTime = m.time || "00:00";
  const startMs = new Date(m.date + "T" + startTime).getTime();
  if (isNaN(startMs)) return [m.date];
  let endMs = null;
  if (m.endDate) {
    const endTime = m.endTime || "23:59";
    const t = new Date(m.endDate + "T" + endTime).getTime();
    if (!isNaN(t)) endMs = t;
  }
  if (endMs === null && m.duration > 0) endMs = startMs + m.duration * 60000;
  if (endMs === null || endMs <= startMs) return [m.date];
  const dates = [];
  const cur = new Date(m.date + "T00:00");
  const endD = new Date(endMs);
  const lastStr = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;
  let guard = 0;
  while (guard++ < 400) {
    const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    dates.push(ds);
    if (ds === lastStr) break;
    cur.setDate(cur.getDate() + 1);
  }
  return dates.length ? dates : [m.date];
};

// ─── Carry-over logic ─────────────────────────────────────────────────────────
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

// Fecha (yyyy-mm-dd) del mismo día de la semana que `srcDate`, pero dentro de la
// semana ISO (wn/yr) indicada. Para instanciar EVENTOS recurrentes: "cita los
// miércoles" cae en el miércoles de cada semana (a diferencia de las tareas
// recurrentes, que se instancian sin fecha como pendientes).
export function eventInstanceDate(srcDate, wn, yr) {
  const src = new Date(srcDate + "T00:00");
  if (isNaN(src.getTime())) return srcDate;
  const dowMon = (src.getDay() + 6) % 7; // 0=lunes … 6=domingo
  const mon = weekStartDate(wn, yr);
  const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + dowMon);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const _shiftYmd = (ymd, deltaDays) => {
  const d = new Date(ymd + "T00:00");
  if (isNaN(d.getTime())) return ymd;
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Fechas (YYYY-MM-DD) de las instancias DIARIAS de un evento recurrente para la
// semana (wn, yr): un día por cada día de la semana desde `fromDate` (o el lunes
// si es null) hasta el domingo, acotado por `seriesEndDate`. Puro y testeable.
export function dailyEventInstances(m, wn, yr, fromDate) {
  const mon = weekStartDate(wn, yr);
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const out = [];
  for (let i = 0; i < 7; i++) {
    const ds = ymd(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
    if (fromDate && ds < fromDate) continue;               // no antes del inicio elegido
    if (m?.seriesEndDate && ds > m.seriesEndDate) continue; // no después del fin de la serie
    out.push(ds);
  }
  return out;
}
const _ymdDelta = (a, b) => Math.round((new Date(b + "T00:00") - new Date(a + "T00:00")) / 86400000);

export function applyCarryOver(data) {
  const { currentWeekNumber: cwn, currentYear: cyr } = data;
  const { wn: pwn, yr: pyr } = prevWeekFn(cwn, cyr);
  const prevKey = isoWeekKey(pwn, pyr), currKey = isoWeekKey(cwn, cyr);
  const prevW = data.weeks[prevKey]; if (!prevW) return data;
  const currW = data.weeks[currKey] || { weekNumber: cwn, year: cyr, epicObjective: "", missions: [], createdAt: Date.now(), workHours: { person1: 0, person2: 0 } };
  const existingCarriedIds = new Set((currW.missions || []).filter(m => m.carriedFrom).map(m => m.carriedFrom));
  const existingTitles = new Set((currW.missions || []).map(m => m.title));
  const existingSeriesIds = new Set((currW.missions || []).filter(m => m.seriesId).map(m => m.seriesId));
  // Los EVENTOS no se arrastran como pendientes sin fecha (están anclados a un
  // día): un evento que ya pasó se queda en su semana. Solo las TAREAS se
  // arrastran. Los eventos recurrentes se re-instancian abajo con fecha real.
  const toCarry = (prevW.missions || []).filter(m => m.type !== "event" && m.status !== "DONE" && !existingCarriedIds.has(m.id) && !existingTitles.has(m.title));

  const { wn: p2wn, yr: p2yr } = prevWeekFn(pwn, pyr);
  const prev2W = data.weeks[isoWeekKey(p2wn, p2yr)];
  const prevSeries = (prevW.missions || []).filter(m => m.seriesPattern && m.seriesId);
  const prevSeriesIds = new Set(prevSeries.map(m => m.seriesId));
  const biweeklyFromPrev2 = (prev2W?.missions || []).filter(m =>
    m.seriesPattern === "biweekly" && m.seriesId &&
    !existingSeriesIds.has(m.seriesId) && !prevSeriesIds.has(m.seriesId)
  );
  const allSeriesSources = [...prevSeries, ...biweeklyFromPrev2];

  const weekStart = weekStartDate(cwn, cyr);
  // Primer lunes del mes → primera semana mensual. Edge case: en ISO semana 1, el lunes
  // puede caer en diciembre del año anterior (ej. sem 1/2025 empieza el 30/12/2024).
  // En ese caso weekStart.getFullYear() < cyr → lo tratamos como primera semana de enero.
  const isFirstWeekOfMonth = weekStart.getFullYear() < cyr
    ? cwn === 1
    : weekStart.getDate() <= 7;
  const seriesEndOk = m => {
    if (!m.seriesEndDate) return true;
    const { week: eWn, year: eYr } = getWeekAndYear(new Date(m.seriesEndDate));
    return !(cyr > eYr || (cyr === eYr && cwn > eWn));
  };

  // Para deduplicar eventos DIARIOS por (serie, fecha) — no por serie entera.
  const existingSeriesDatePairs = new Set(
    (currW.missions || []).filter(m => m.seriesId && m.date).map(m => `${m.seriesId}|${m.date}`)
  );
  const mkInst = (m, dateVal) => ({ ...m, id: uid(), carriedFrom: null, carriedFromWeek: null, createdAt: Date.now(), completedAt: null, status: "TBC", date: dateVal });

  const newSeriesMissions = allSeriesSources.flatMap(m => {
    if (!seriesEndOk(m)) return [];
    const isDaily = m.seriesPattern === "daily";
    const isEventWithDate = m.type === "event" && m.date;

    // Evento DIARIO → una instancia por CADA día de la semana, single-day,
    // deduplicando por fecha (no por serie: la serie no es "presente/ausente").
    if (isDaily && isEventWithDate) {
      return dailyEventInstances(m, cwn, cyr, null)
        .filter(ds => !existingSeriesDatePairs.has(`${m.seriesId}|${ds}`))
        .map(ds => ({ ...mkInst(m, ds), endDate: null, endTime: null }));
    }

    // Resto de patrones (y tarea diaria ≈ semanal): 1 instancia/semana, dedup por serie.
    if (existingSeriesIds.has(m.seriesId)) return [];
    let due = false;
    if (m.seriesPattern === "weekly" || isDaily) due = true; // tarea diaria se trata como semanal
    else if (m.seriesPattern === "monthly") due = isFirstWeekOfMonth;
    else if (m.seriesPattern === "biweekly") {
      if (m.seriesStartWeek != null && m.seriesStartYear != null) {
        let weeksDiff = cwn - m.seriesStartWeek;
        for (let y = m.seriesStartYear; y < cyr; y++) weeksDiff += isoWeeksInYear(y);
        for (let y = cyr; y < m.seriesStartYear; y++) weeksDiff -= isoWeeksInYear(y);
        due = weeksDiff % 2 === 0;
      } else due = !prevSeriesIds.has(m.seriesId);
    }
    if (!due) return [];

    if (isEventWithDate) {
      const newDate = eventInstanceDate(m.date, cwn, cyr);
      const inst = mkInst(m, newDate);
      if (m.endDate) inst.endDate = _shiftYmd(m.endDate, _ymdDelta(m.date, newDate));
      return [inst];
    }
    return [mkInst(m, null)]; // tarea recurrente → pendiente sin fecha
  });

  if (!toCarry.length && !newSeriesMissions.length) return data;
  const carried = toCarry.map(m => ({ ...m, id: uid(), carriedFrom: m.id, carriedFromWeek: prevKey, date: null, createdAt: Date.now(), completedAt: null, status: m.status === "ASAP" ? "ASAP" : "TBC" }));
  return { ...data, weeks: { ...data.weeks, [currKey]: { ...currW, missions: [...(currW.missions || []), ...carried, ...newSeriesMissions] } } };
}

// Añade misiones (de carry-over o de serie, ya calculadas por applyCarryOver) a
// una semana, deduplicando por identidad. Es idempotente y SEGURO ANTE REBASE:
// cuando un conflicto CAS re-aplica el mutador sobre los datos frescos de la
// pareja, no pisa esos datos ni duplica lo que el otro dispositivo ya carreó.
// Reglas de dedup (espejo de applyCarryOver): no re-agrega por id ya presente,
// ni un carry cuyo original (carriedFrom) o título ya existe, ni una serie
// (seriesId) ya instanciada esta semana. Si la semana no existe, la crea con
// weekMeta {wn, yr}.
export function mergeMissionsInto(data, weekKey, missions, weekMeta = null) {
  if (!missions?.length) return data;
  const w = data.weeks[weekKey]
    || (weekMeta ? { weekNumber: weekMeta.wn, year: weekMeta.yr, epicObjective: "", missions: [], createdAt: Date.now(), workHours: { person1: 0, person2: 0 } } : null);
  if (!w) return data;
  const ids = new Set((w.missions || []).map(m => m.id));
  const carried = new Set((w.missions || []).filter(m => m.carriedFrom).map(m => m.carriedFrom));
  const series = new Set((w.missions || []).filter(m => m.seriesId).map(m => m.seriesId));
  const titles = new Set((w.missions || []).map(m => m.title));
  const toAdd = missions.filter(m => {
    if (ids.has(m.id)) return false;
    if (m.carriedFrom) return !carried.has(m.carriedFrom) && !titles.has(m.title);
    if (m.seriesId) return !series.has(m.seriesId);
    return true;
  });
  if (!toAdd.length) return data;
  return { ...data, weeks: { ...data.weeks, [weekKey]: { ...w, missions: [...(w.missions || []), ...toAdd] } } };
}

export function syncCarryDone(data, weekKey, missionId) {
  const week = data.weeks[weekKey]; if (!week) return data;
  const mission = week.missions.find(m => m.id === missionId);
  if (!mission?.carriedFrom || !mission?.carriedFromWeek) return data;
  const origWeek = data.weeks[mission.carriedFromWeek]; if (!origWeek) return data;
  return { ...data, weeks: { ...data.weeks, [mission.carriedFromWeek]: { ...origWeek, missions: origWeek.missions.map(m => m.id === mission.carriedFrom ? { ...m, status: "DONE", completedAt: Date.now(), completedLate: m.status !== "ASAP" } : m) } } };
}
