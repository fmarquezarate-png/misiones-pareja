// Números del panel de salud — puros y probados. Los componentes solo pintan.
//
// Reglas que aplican:
//  · Un día sin dato NO es un cero (esSinDato de pet.js): las medias se hacen
//    sobre los días con dato, y se dice sobre cuántos.
//  · Las comparaciones son "estos 7 días vs los 7 anteriores", con el mismo
//    criterio en los dos lados.

import { sumarDias, esSinDato, evaluarDia, indexar } from "./pet.js";

/** Serie de N días (del más antiguo a hoy) de una métrica: [{ dia, valor|null }]. */
export function serie(filas, metric, hoy, n = 7) {
  const porDia = new Map();
  for (const f of filas) if (f.metric === metric && !esSinDato(metric, f.value)) porDia.set(f.day, f.value);
  return Array.from({ length: n }, (_, i) => {
    const dia = sumarDias(hoy, i - (n - 1));
    return { dia, valor: porDia.has(dia) ? porDia.get(dia) : null };
  });
}

const media = xs => { const v = xs.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

/**
 * KPI de una métrica: media de los últimos 7 días, la de los 7 anteriores y
 * la variación. `mejorSi` dice qué dirección es buena (el pulso en reposo
 * mejora al BAJAR), para colorear la flecha con sentido.
 */
export function kpi(filas, metric, hoy, { mejorSi = "sube" } = {}) {
  const ultimos = serie(filas, metric, hoy, 7);
  const previos = serie(filas, metric, sumarDias(hoy, -7), 7);
  const actual = media(ultimos.map(d => d.valor));
  const antes = media(previos.map(d => d.valor));
  const delta = actual != null && antes != null ? actual - antes : null;
  const pct = delta != null && antes ? delta / antes : null;
  const bueno = delta == null || Math.abs(pct ?? 0) < 0.02 ? null : (mejorSi === "sube" ? delta > 0 : delta < 0);
  return { serie: ultimos, actual, antes, delta, pct, bueno, diasConDato: ultimos.filter(d => d.valor != null).length };
}

/**
 * Metas de ESTA semana (lunes → hoy): cuántos días se cumplió cada meta
 * diaria, y el acumulado de cada semanal contra su objetivo.
 */
export function metasSemana(filas, entrenos, metas, hoy) {
  const idx = indexar(filas, entrenos);
  const f = new Date(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10));
  const lunes = sumarDias(hoy, -((f.getDay() + 6) % 7));
  const dias = [];
  for (let d = lunes; d <= hoy; d = sumarDias(d, 1)) dias.push(d);
  return metas.map(m => {
    if (m.periodo === "dia") {
      const evals = dias.map(d => evaluarDia(d, idx, [m]).metas[0]);
      return { ...m, cumplidos: evals.filter(e => e.cumplida).length, conDato: evals.filter(e => e.valor != null).length, dias: dias.length };
    }
    const evs = dias.map(d => evaluarDia(d, idx, [{ ...m, periodo: "dia", objetivo: Infinity }]).metas[0].valor).filter(v => v != null);
    const valor = m.tipo === "sueno" ? media(evs) : evs.reduce((a, b) => a + b, 0);
    return { ...m, valor: evs.length ? valor : null, progreso: evs.length ? Math.min(1, valor / m.objetivo) : 0 };
  });
}

/** Tipos de entreno de los últimos `dias` días, ordenados por veces. */
export function repartoEntrenos(entrenos, hoy, dias = 90) {
  const desde = sumarDias(hoy, -dias);
  const cuenta = new Map();
  let total = 0;
  for (const w of entrenos) {
    const d = String(w.start_at || "").slice(0, 10);
    if (d < desde || d > hoy) continue;
    const k = String(w.name || "Otro");
    cuenta.set(k, (cuenta.get(k) || 0) + 1);
    total++;
  }
  return { total, tipos: [...cuenta.entries()].map(([nombre, n]) => ({ nombre, n, pct: n / total })).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre)) };
}

/** La última noche con sueño real, y sus fases si el reloj las manda. */
export function ultimaNoche(filas, hoy) {
  const porDia = new Map();
  for (const f of filas) {
    if (!f.metric.startsWith("sleep_") && f.metric !== "wake_min" && f.metric !== "bed_min") continue;
    if (!porDia.has(f.day)) porDia.set(f.day, {});
    porDia.get(f.day)[f.metric] = f.value;
  }
  const dias = [...porDia.keys()].filter(d => d <= hoy && !esSinDato("sleep_asleep", porDia.get(d).sleep_asleep)).sort();
  const dia = dias.pop();
  if (!dia) return null;
  const v = porDia.get(dia);
  const fases = [["Profundo", v.sleep_deep], ["Ligero", v.sleep_core], ["REM", v.sleep_rem], ["Despierto", v.sleep_awake]]
    .filter(([, h]) => Number.isFinite(h) && h > 0).map(([nombre, horas]) => ({ nombre, horas }));
  return { dia, total: v.sleep_asleep, fases, acostarse: v.bed_min ?? null, despertar: v.wake_min ?? null };
}

