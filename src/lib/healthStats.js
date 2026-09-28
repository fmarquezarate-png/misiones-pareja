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


// ── Detalle de una métrica (al tocar su caja) ───────────────────────────────
/**
 * Resumen de una métrica en los últimos `dias` días: serie, media, mejor y
 * peor día, cobertura, tendencia (segunda mitad vs primera) y, si hay meta,
 * la racha actual de días cumpliéndola. Todo sobre días CON dato.
 */
export function detalleMetrica(filas, metric, hoy, dias = 30, { meta = null, mejorSi = "sube" } = {}) {
  const s = serie(filas, metric, hoy, dias);
  const con = s.filter(d => d.valor != null);
  const media = con.length ? con.reduce((a, d) => a + d.valor, 0) / con.length : null;
  const orden = [...con].sort((a, b) => b.valor - a.valor || (a.dia < b.dia ? -1 : 1));
  // "Mejor" depende de la métrica: el pulso en reposo es mejor cuanto más bajo.
  const [alto, bajo] = [orden[0] || null, orden[orden.length - 1] || null];
  const mitad = Math.floor(s.length / 2);
  const m1 = con.filter(d => d.dia < s[mitad].dia), m2 = con.filter(d => d.dia >= s[mitad].dia);
  const med = xs => (xs.length ? xs.reduce((a, d) => a + d.valor, 0) / xs.length : null);
  const tendencia = m1.length >= 3 && m2.length >= 3 ? (med(m2) - med(m1)) / med(m1) : null;
  let racha = null;
  if (meta != null) {
    racha = 0;
    for (let i = s.length - 1; i >= 0; i--) {
      const v = s[i].valor;
      if (v == null && i === s.length - 1) continue;          // hoy sin dato aún: no rompe la racha
      if (v != null && (mejorSi === "sube" ? v >= meta : v <= meta)) racha++; else break;
    }
  }
  return {
    serie: s, media, conDato: con.length, total: s.length,
    mas: alto, menos: bajo,
    mejor: mejorSi === "sube" ? alto : bajo,
    peor: mejorSi === "sube" ? bajo : alto,
    tendencia, racha,
  };
}

/** Semanas (lunes a domingo) con su media, para vistas largas. */
export function porSemanas(s) {
  const grupos = new Map();
  for (const d of s) {
    const f = new Date(+d.dia.slice(0, 4), +d.dia.slice(5, 7) - 1, +d.dia.slice(8, 10));
    const lunes = sumarDias(d.dia, -((f.getDay() + 6) % 7));
    if (!grupos.has(lunes)) grupos.set(lunes, []);
    if (d.valor != null) grupos.get(lunes).push(d.valor);
  }
  return [...grupos.entries()].map(([dia, vs]) => ({ dia, valor: vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null }));
}

/**
 * Texto compacto para preguntarle a la IA. SOLO esta métrica y este periodo:
 * es lo mínimo necesario para responder, y es lo que sale del teléfono.
 */
export function resumenParaIA({ nombre, unidad, dias, detalle, pregunta }) {
  const fmt = v => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
  const valores = detalle.serie.map(d => `${d.dia.slice(5)}:${d.valor == null ? "-" : fmt(d.valor)}`).join(" ");
  const linea = (et, x) => (x ? `${et} ${fmt(x.valor)} (${x.dia})` : `${et} -`);
  return [
    `[Consulta sobre MI salud desde la app. Responde breve, en español, solo con estos datos; si no bastan, dilo. No des consejos médicos: sugiere consultar a un profesional si procede.]`,
    `Métrica: ${nombre} (${unidad}). Últimos ${dias} días, ${detalle.conDato} con dato ("-" = sin dato, no es cero).`,
    `Media ${detalle.media == null ? "-" : fmt(detalle.media)}; ${linea("máx", detalle.mas)}; ${linea("mín", detalle.menos)}.`,
    `Valores (mes-día:valor): ${valores}`,
    `Pregunta: ${pregunta}`,
  ].join("\n");
}
