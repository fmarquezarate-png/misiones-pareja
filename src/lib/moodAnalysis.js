// Análisis de series de ánimo: agregación por período, banda de variabilidad
// y detección de anotaciones (picos, caídas, días atípicos). Funciones puras
// para poder testear sin montar componentes — mismo criterio que validation.js.
import { parseLocalDate, getWeekAndYear, isoWeekKey } from "../utils.js";

const MS_DAY = 86400000;
const MONTH_LABELS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

export const scoreOf = m => m.valence * m.intensity;

// ─── Filtro de período + privacidad ────────────────────────────────────────────
// Entradas privadas (shared:false) quedan fuera de la vista "Ambos" — solo se
// ven filtrando explícitamente por esa persona. Entradas sin el campo `shared`
// (anteriores a esta función) se tratan como compartidas, para no ocultar
// retroactivamente datos que ya eran visibles.
export function filterMoods(moods, period, who) {
  let list = [...moods];
  if (period !== "all") {
    const days = parseInt(period);
    const cutoff = Date.now() - days * MS_DAY;
    list = list.filter(m => m.ts >= cutoff);
  }
  if (who !== "all") list = list.filter(m => m.who === who);
  else list = list.filter(m => m.shared !== false);
  return list.sort((a, b) => b.ts - a.ts);
}

// ─── Agrupar entradas por día/semana/mes según el rango total cubierto ────────
export function chooseGranularity(spanDays) {
  if (spanDays <= 45) return "day";
  if (spanDays <= 370) return "week";
  return "month";
}

export function aggregateMoods(moods, granularityOverride = null) {
  if (!moods.length) return { granularity: "day", points: [] };
  const dates = moods.map(m => parseLocalDate(m.date)).filter(Boolean);
  const minD = new Date(Math.min(...dates));
  const maxD = new Date(Math.max(...dates));
  const spanDays = Math.max(1, Math.round((maxD - minD) / MS_DAY));
  const granularity = granularityOverride || chooseGranularity(spanDays);

  const groups = new Map();
  for (const m of moods) {
    const d = parseLocalDate(m.date);
    if (!d) continue;
    let key, label, sortKey;
    if (granularity === "day") {
      key = m.date;
      label = String(d.getDate());
      sortKey = d.getTime();
    } else if (granularity === "week") {
      const { week, year } = getWeekAndYear(d);
      key = isoWeekKey(week, year);
      label = `S${week}`;
      sortKey = year * 1000 + week;
    } else {
      key = `${d.getFullYear()}-${d.getMonth()}`;
      label = MONTH_LABELS[d.getMonth()];
      sortKey = d.getFullYear() * 100 + d.getMonth();
    }
    if (!groups.has(key)) groups.set(key, { key, label, sortKey, entries: [] });
    groups.get(key).entries.push(m);
  }

  const points = [...groups.values()]
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(g => {
      const scores = g.entries.map(scoreOf);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return { key: g.key, label: g.label, avg, count: g.entries.length, entries: g.entries };
    });

  return { granularity, points };
}

// ─── Banda de variabilidad: ancho local (desviación) alrededor de cada punto ──
export function rollingBand(points, windowRadius = 2) {
  return points.map((p, i) => {
    const lo = Math.max(0, i - windowRadius);
    const hi = Math.min(points.length - 1, i + windowRadius);
    const slice = points.slice(lo, hi + 1).map(x => x.avg);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
    const std = Math.sqrt(variance);
    return {
      upper: Math.min(10, p.avg + std),
      lower: Math.max(-10, p.avg - std),
    };
  });
}

// ─── Anotaciones automáticas: mayor subida, mayor caída, día atípico ──────────
export function detectAnnotations(points) {
  if (points.length < 3) return [];
  const deltas = points.map((p, i) => (i === 0 ? 0 : p.avg - points[i - 1].avg));
  let maxRiseIdx = -1, maxRise = 0, maxFallIdx = -1, maxFall = 0;
  deltas.forEach((d, i) => {
    if (i === 0) return;
    if (d > maxRise) { maxRise = d; maxRiseIdx = i; }
    if (d < maxFall) { maxFall = d; maxFallIdx = i; }
  });
  const meanAbsDelta = deltas.slice(1).reduce((a, b) => a + Math.abs(b), 0) / Math.max(1, deltas.length - 1);
  const threshold = Math.max(3.5, meanAbsDelta * 2.1);

  const annotations = [];
  if (maxRiseIdx > 0 && maxRise >= threshold) {
    annotations.push({ idx: maxRiseIdx, type: "rise", label: `Pico de subida (+${maxRise.toFixed(1)} pts)` });
  }
  if (maxFallIdx > 0 && maxFall <= -threshold) {
    annotations.push({ idx: maxFallIdx, type: "fall", label: `Caída abrupta (${maxFall.toFixed(1)} pts)` });
  }

  const overallMean = points.reduce((a, p) => a + p.avg, 0) / points.length;
  const overallStd = Math.sqrt(points.reduce((a, p) => a + (p.avg - overallMean) ** 2, 0) / points.length) || 1;
  let anomalyIdx = -1, anomalyZ = 0;
  points.forEach((p, i) => {
    const z = Math.abs(p.avg - overallMean) / overallStd;
    if (z > anomalyZ) { anomalyZ = z; anomalyIdx = i; }
  });
  if (anomalyIdx >= 0 && anomalyZ >= 1.8 && anomalyIdx !== maxRiseIdx && anomalyIdx !== maxFallIdx) {
    const v = points[anomalyIdx].avg;
    annotations.push({ idx: anomalyIdx, type: "anomaly", label: `Día atípico (${v > 0 ? "+" : ""}${v.toFixed(1)})` });
  }
  return annotations;
}

export function varianceLabel(std) {
  if (std < 2) return "Baja";
  if (std < 4.5) return "Media";
  return "Alta";
}

// ─── Estadísticas de resumen para el período agregado ─────────────────────────
export function summarizePoints(points) {
  if (!points.length) return { std: 0, label: "—", biggestChange: 0 };
  const mean = points.reduce((a, p) => a + p.avg, 0) / points.length;
  const std = Math.sqrt(points.reduce((a, p) => a + (p.avg - mean) ** 2, 0) / points.length);
  let biggestChange = 0;
  for (let i = 1; i < points.length; i++) {
    const d = points[i].avg - points[i - 1].avg;
    if (Math.abs(d) > Math.abs(biggestChange)) biggestChange = d;
  }
  return { std, label: varianceLabel(std), biggestChange };
}
