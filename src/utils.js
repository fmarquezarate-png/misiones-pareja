// ─── ID / week helpers ────────────────────────────────────────────────────────
export const uid = () => Math.random().toString(36).slice(2, 9);

// Timeout duro para llamadas de red del arranque. En iOS (WKWebView, motor
// único de toda PWA) un fetch puede quedar COLGADO para siempre tras un cold
// start o al volver de segundo plano — no resuelve ni rechaza jamás. Android y
// desktop no hacen esto (su capa de red completa o falla). Sin este guard,
// cualquier `await` del arranque congela la app en "cargando" indefinidamente.
// Nota: Promise.race no cancela el promise original — si al final responde,
// el resultado se ignora sin efectos (los callers ya son idempotentes).
export const withTimeout = (promise, ms, label = "op") =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout: ${label} tras ${ms}ms`)), ms)),
  ]);

// El cuelgue de WKWebView (ver comentario arriba) golpea casi siempre al
// PRIMER fetch tras un cold start o volver de background — el intento
// siguiente, con una request de red nueva, casi siempre responde de
// inmediato. `fn` debe ser una FACTORY (() => promise), no un promise ya
// creado, porque reintentar requiere disparar una request nueva — el
// promise colgado original nunca se resuelve, reusarlo no ayudaría.
export const withTimeoutRetry = async (fn, ms, label = "op", retries = 1) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withTimeout(fn(), ms, label);
    } catch (e) {
      if (attempt >= retries) throw e;
      console.warn(`[retry] ${label} intento ${attempt + 1} falló (${e.message}) — reintentando con request nueva`);
    }
  }
};

// Token para links que dan acceso de lectura a datos (compartir calendario) —
// uid() usa Math.random(), insuficiente para algo que otorga acceso. Usa el
// generador criptográfico del navegador; solo cae al fallback débil en
// navegadores muy viejos sin window.crypto.randomUUID.
export const secureToken = () =>
  window.crypto?.randomUUID ? window.crypto.randomUUID().replace(/-/g, "") : uid() + uid() + uid();

export const isoWeekKey = (wn, yr) => `${yr}-W${String(wn).padStart(2, "0")}`;

// Parsea "YYYY-MM-DD" como medianoche LOCAL (no UTC). new Date("2026-05-01")
// devuelve medianoche UTC, que en husos por delante de UTC (ej. España, UTC+2)
// cae DESPUÉS de la medianoche local del día 1 → cualquier comparación contra
// fechas construidas en local (new Date(yr, mo, 1)) excluye erróneamente el mes
// de inicio. Misma clase de bug que el manejo dual de completedAt (ver CLAUDE.md).
export const parseLocalDate = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const getWeekAndYear = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil((((d - ys) / 86400000) + 1) / 7), year: d.getUTCFullYear() };
};

export const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

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
  let current;
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
  const startDate = parseLocalDate(goal.startDate);
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

export const dlBlob = (blob, name) => {
  const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 3000);
};

// Normaliza texto para búsquedas: minúsculas y sin tildes ("Cañería" → "caneria")
export const normText = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Tiempo relativo corto para timestamps recientes ("hace 5 min", "hace 2 días")
export const relTime = ts => {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d !== 1 ? "s" : ""}`;
};
