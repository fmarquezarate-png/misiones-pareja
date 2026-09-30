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
export function kpi(filas, metric, hoy, { mejorSi = "sube", n = 7, cerrados = false } = {}) {
  // `cerrados`: para lo que se ACUMULA durante el día (pasos, energía): hoy va
  // por la mitad y meterlo en la media la hunde ("4.000 pasos de media" a las
  // 10:00) y hace que la variación mienta. La media y la comparación se hacen
  // sobre días cerrados; la gráfica sí incluye hoy y `hoyValor` lo da aparte.
  const fin = cerrados ? sumarDias(hoy, -1) : hoy;
  const grafica = serie(filas, metric, hoy, n);
  const ultimos = cerrados ? serie(filas, metric, fin, n) : grafica;
  const previos = serie(filas, metric, sumarDias(fin, -n), n);
  const actual = media(ultimos.map(d => d.valor));
  const antes = media(previos.map(d => d.valor));
  const delta = actual != null && antes != null ? actual - antes : null;
  const pct = delta != null && antes ? delta / antes : null;
  const bueno = delta == null || Math.abs(pct ?? 0) < 0.02 || (mejorSi !== "sube" && mejorSi !== "baja") ? null : (mejorSi === "sube" ? delta > 0 : delta < 0);
  return { serie: grafica, actual, antes, delta, pct, bueno, diasConDato: ultimos.filter(d => d.valor != null).length,
    n, cerrados, hoyValor: cerrados ? (grafica[grafica.length - 1]?.valor ?? null) : null };
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
    // El deporte del calendario se agrupa por DEPORTE («Pádel»), no por el título
    // del evento: «Padel Masc Moli» y «Padel Mixto» son lo mismo para esta cuenta.
    const k = String(w.nombreDeporte || w.name || "Otro");
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
    // «Mejor»/«peor» SOLO si la métrica tiene dirección. Antes una métrica neutra
    // (peso, pulso medio, longitud de paso abierta desde «Datos y conexión») caía
    // en la rama de «baja»: el valor MÁS BAJO salía rotulado «Día más alto».
    mejor: mejorSi === "sube" ? alto : mejorSi === "baja" ? bajo : null,
    peor: mejorSi === "sube" ? bajo : mejorSi === "baja" ? alto : null,
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

// ── Histórico completo ──────────────────────────────────────────────────────
// "Logro ver hasta 90 días, pero no históricamente el peor o mejor dato"
// (Fran, 28/09/2026). Con años de datos, la vista "Todo" agrupa por MESES
// (60 barras se leen; 1.900 no) y da los récords de siempre.

/** Días entre dos fechas ISO (inclusive). */
export function diasEntre(desde, hasta) {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 864e5) + 1;
}

/** Medias mensuales (solo de días con dato), en orden. */
export function porMeses(s) {
  const grupos = new Map();
  for (const d of s) {
    const mes = d.dia.slice(0, 7);
    if (!grupos.has(mes)) grupos.set(mes, []);
    if (d.valor != null) grupos.get(mes).push(d.valor);
  }
  return [...grupos.entries()].map(([mes, vs]) => ({
    dia: `${mes}-01`, mes, dias: vs.length,
    valor: vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null,
  }));
}

/**
 * Mejor y peor MES. Solo cuentan meses con datos suficientes (≥ 10 días):
 * un mes con 2 días sueltos no es "tu mejor mes", es un mes sin datos.
 */
export function extremosMensuales(meses, { mejorSi = "sube", minDias = 10 } = {}) {
  const validos = meses.filter(m => m.valor != null && m.dias >= minDias);
  if (!validos.length) return { alto: null, bajo: null, mejor: null, peor: null };
  const orden = [...validos].sort((a, b) => b.valor - a.valor || (a.mes < b.mes ? -1 : 1));
  const [alto, bajo] = [orden[0], orden[orden.length - 1]];
  if (mejorSi === "sube") return { alto, bajo, mejor: alto, peor: bajo };
  if (mejorSi === "baja") return { alto, bajo, mejor: bajo, peor: alto };
  return { alto, bajo, mejor: null, peor: null };
}

/**
 * Resumen para la IA en vistas largas: medias MENSUALES + récords, en vez de
 * cientos de valores diarios (compacto y suficiente para "¿he mejorado desde
 * 2023?"). Los días sueltos se quedan en el teléfono.
 */
export function resumenHistoricoParaIA({ nombre, unidad, detalle, meses, extremos, pregunta }) {
  const fmt = v => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
  const lista = meses.map(m => `${m.mes}:${m.valor == null ? "-" : fmt(m.valor)}(${m.dias}d)`).join(" ");
  const rec = (et, x) => (x ? `${et} ${fmt(x.valor)} (${x.dia})` : `${et} -`);
  const mes = (et, x) => (x ? `${et} ${x.mes} (media ${fmt(x.valor)})` : `${et} -`);
  return [
    `[Consulta sobre MI salud desde la app. Responde breve, en español, solo con estos datos; si no bastan, dilo. No des consejos médicos: sugiere consultar a un profesional si procede.]`,
    `Métrica: ${nombre} (${unidad}). HISTÓRICO COMPLETO: ${detalle.conDato} días con dato entre ${detalle.serie[0]?.dia} y ${detalle.serie.at(-1)?.dia}.`,
    `Media histórica ${detalle.media == null ? "-" : fmt(detalle.media)}; ${rec("día más alto", detalle.mas)}; ${rec("día más bajo", detalle.menos)}; ${mes("mes más alto", extremos.alto)}; ${mes("mes más bajo", extremos.bajo)}.`,
    `Medias mensuales (mes:media(días con dato), "-" = sin dato, no es cero): ${lista}`,
    `Pregunta: ${pregunta}`,
  ].join("\n");
}
