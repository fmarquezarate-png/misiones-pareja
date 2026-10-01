// Estadística de verdad sobre los datos de salud — puro y probado.
//
// POR QUÉ (01/10/2026, Fran): «tenemos mucha información y poca estadística».
// El panel enseñaba medias de 7 días y extremos; nada que cruzara métricas ni
// dijera si una diferencia es real o ruido. Aquí:
//   · patrones por día de la semana,
//   · comparaciones entre grupos de días (dormir bien vs mal → pasos del día
//     siguiente; día de deporte → pulso en reposo al día siguiente; fin de
//     semana vs entre semana…), con prueba t de Welch,
//   · regularidad del horario de sueño,
//   · en qué percentil está tu semana respecto a tu año.
//
// Reglas de honestidad (las mismas del proyecto):
//   · Un día sin dato no es un cero (esSinDato).
//   · Un hallazgo solo se enseña si hay datos de sobra (MIN_GRUPO días por
//     grupo) y la diferencia es estadísticamente clara (|t| ≥ T_MIN) y además
//     relevante en la práctica (umbral mínimo por métrica). Si no, se calla.
//   · Correlación no es causa: los textos dicen «cuando…», nunca «porque…».

import { sumarDias, esSinDato, lunesDe, diaLocalDe } from "./pet.js";

export const MIN_GRUPO = 12;     // días mínimos en CADA grupo comparado
export const T_MIN = 2;          // |t| de Welch ≈ p < 0,05 con estos tamaños
const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

const media = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
function varianza(xs) {
  if (xs.length < 2) return null;
  const m = media(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
}
export const desviacion = xs => { const v = varianza(xs); return v == null ? null : Math.sqrt(v); };

/** Prueba t de Welch entre dos muestras: { diff, t, na, nb, ma, mb }. */
export function welch(a, b) {
  const na = a.length, nb = b.length;
  if (na < 2 || nb < 2) return null;
  const ma = media(a), mb = media(b), va = varianza(a), vb = varianza(b);
  const se = Math.sqrt(va / na + vb / nb);
  const diff = ma - mb;
  return { diff, t: se > 0 ? diff / se : (diff === 0 ? 0 : Infinity * Math.sign(diff)), na, nb, ma, mb };
}

/** Correlación de Pearson: { r, n } (null con menos de 3 pares o sin variación). */
export function pearson(pares) {
  const n = pares.length;
  if (n < 3) return null;
  const mx = media(pares.map(p => p[0])), my = media(pares.map(p => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pares) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (!sxx || !syy) return null;
  return { r: sxy / Math.sqrt(sxx * syy), n };
}

/** día → valor de una métrica (solo días con dato real). */
export function indice(filas, metric, { desde = null, hasta = null } = {}) {
  const m = new Map();
  for (const f of filas) {
    if (f.metric !== metric || esSinDato(metric, f.value)) continue;
    if ((desde && f.day < desde) || (hasta && f.day > hasta)) continue;
    m.set(f.day, f.value);
  }
  return m;
}

const dow = dia => { const [y, mo, d] = dia.split("-").map(Number); return (new Date(y, mo - 1, d).getDay() + 6) % 7; };

/** Media por día de la semana (lunes = 0): [{ dia, nombre, media, n }]. */
export function porDiaSemana(filas, metric, opciones = {}) {
  const grupos = Array.from({ length: 7 }, () => []);
  for (const [dia, v] of indice(filas, metric, opciones)) grupos[dow(dia)].push(v);
  return grupos.map((g, i) => ({ dia: i, nombre: DIAS_SEMANA[i], media: media(g), n: g.length }));
}

/**
 * Percentil de la media de los últimos 7 días cerrados dentro de TODAS las
 * ventanas de 7 días del último año (con ≥ 5 días de dato cada una).
 * 0,9 = esta semana supera al 90 % de tus semanas.
 */
export function percentilSemana(filas, metric, hoy) {
  const idx = indice(filas, metric);
  const ventana = fin => {
    const v = [];
    for (let i = 0; i < 7; i++) { const d = sumarDias(fin, -i); if (idx.has(d)) v.push(idx.get(d)); }
    return v.length >= 5 ? media(v) : null;
  };
  const fin = sumarDias(hoy, -1);
  const actual = ventana(fin);
  if (actual == null) return null;
  const otras = [];
  for (let k = 7; k <= 365; k++) { const m = ventana(sumarDias(fin, -k)); if (m != null) otras.push(m); }
  if (otras.length < 30) return null;
  return { actual, percentil: otras.filter(x => x < actual).length / otras.length, n: otras.length };
}

/** Regularidad de una hora (bed_min / wake_min): desviación en minutos, últimos `dias` vs los anteriores. */
export function regularidad(filas, metric, hoy, dias = 30) {
  const idx = indice(filas, metric);
  const tramo = (desde, hasta) => [...idx].filter(([d]) => d > desde && d <= hasta).map(([, v]) => v);
  const ahora = tramo(sumarDias(hoy, -dias), hoy);
  const antes = tramo(sumarDias(hoy, -2 * dias), sumarDias(hoy, -dias));
  return { ahora: ahora.length >= 10 ? desviacion(ahora) : null, antes: antes.length >= 10 ? desviacion(antes) : null, n: ahora.length };
}

const fmtMiles = n => Math.round(n).toLocaleString("es-ES");
const fmtHm = h => { const t = Math.round(Math.abs(h) * 60); return t >= 60 ? `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, "0")} min` : `${t} min`; };
const fmtReloj = m => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };

function comparar(a, b, minDiff) {
  const w = welch(a, b);
  if (!w || w.na < MIN_GRUPO || w.nb < MIN_GRUPO) return null;
  if (Math.abs(w.t) < T_MIN || Math.abs(w.diff) < minDiff) return null;
  return w;
}

/**
 * Hallazgos en lenguaje llano, solo los que pasan las pruebas. Cada uno:
 * { id, icono, texto, detalle, fuerza } — `detalle` dice sobre cuántos días y
 * qué prueba; `fuerza` (|t|) ordena de más a menos claro.
 */
export function hallazgos({ filas = [], entrenos = [], hoy, metaSueno = 7, desde = null }) {
  const opts = { desde, hasta: sumarDias(hoy, -1) };   // días cerrados
  const sueno = indice(filas, "sleep_asleep", opts);
  const pasos = indice(filas, "step_count", opts);
  const pulso = indice(filas, "resting_heart_rate", opts);
  const acostarse = indice(filas, "bed_min", opts);
  const kcal = indice(filas, "active_energy", opts);
  const out = [];
  // Para la persona: cuántos días y si la diferencia es clara o MUY clara (|t| ≥ 3).
  const detalle = w => `${w.na} días con ${w.nb} · diferencia ${Math.abs(w.t) >= 3 ? "muy clara" : "clara"}`;

  // 1. Dormir bien → pasos del día siguiente (la noche cuenta en el día que despiertas).
  {
    const bien = [], mal = [];
    for (const [dia, h] of sueno) { const p = pasos.get(dia); if (p == null) continue; (h >= metaSueno ? bien : mal).push(p); }
    const w = comparar(bien, mal, 500);
    if (w) out.push({ id: "sueno-pasos", icono: "🌙👟", fuerza: Math.abs(w.t),
      texto: `Los días después de dormir ${metaSueno} h o más das ${fmtMiles(Math.abs(w.diff))} pasos ${w.diff > 0 ? "más" : "menos"} (${fmtMiles(w.ma)} frente a ${fmtMiles(w.mb)}).`,
      detalle: detalle(w) });
  }
  // 2. Fin de semana vs entre semana: sueño y pasos.
  for (const [m, idx, nombre, minDiff, fmt] of [["sueno", sueno, "duermes", 0.33, fmtHm], ["pasos", pasos, "andas", 800, v => `${fmtMiles(v)} pasos`]]) {
    const finde = [], laborable = [];
    for (const [dia, v] of idx) (dow(dia) >= 5 ? finde : laborable).push(v);
    const w = comparar(finde, laborable, minDiff);
    if (w) out.push({ id: `finde-${m}`, icono: "📅", fuerza: Math.abs(w.t),
      texto: `El fin de semana ${nombre} ${fmt(Math.abs(w.diff))} ${w.diff > 0 ? "más" : "menos"} que entre semana.`,
      detalle: detalle(w) });
  }
  // 3. Día con deporte → pulso en reposo del día siguiente.
  {
    const diasDeporte = new Set(entrenos.map(e => diaLocalDe(String(e.start_at || ""))).filter(Boolean));
    const tras = [], sin = [];
    for (const [dia, v] of pulso) (diasDeporte.has(sumarDias(dia, -1)) ? tras : sin).push(v);
    const w = comparar(tras, sin, 1.5);
    if (w) out.push({ id: "deporte-pulso", icono: "🎾❤️", fuerza: Math.abs(w.t),
      texto: `El día después de hacer deporte tu pulso en reposo está ${Math.abs(w.diff).toFixed(1).replace(".", ",")} lpm ${w.diff > 0 ? "más alto" : "más bajo"}.`,
      detalle: detalle(w) });
  }
  // 4. Acostarse pronto vs tarde → horas de sueño (corte: tu mediana).
  {
    const pares = [...acostarse].filter(([d]) => sueno.has(d)).map(([d, b]) => [b, sueno.get(d)]);
    if (pares.length >= 2 * MIN_GRUPO) {
      const orden = pares.map(p => p[0]).sort((a, b) => a - b);
      const corte = orden[Math.floor(orden.length / 2)];
      const pronto = pares.filter(p => p[0] < corte).map(p => p[1]), tarde = pares.filter(p => p[0] >= corte).map(p => p[1]);
      const w = comparar(pronto, tarde, 0.33);
      if (w) out.push({ id: "hora-sueno", icono: "🛏️", fuerza: Math.abs(w.t),
        texto: `Cuando te acuestas antes de las ${fmtReloj(corte)} duermes ${fmtHm(w.diff)} ${w.diff > 0 ? "más" : "menos"}.`,
        detalle: detalle(w) });
    }
  }
  // 5. Mucha energía activa → sueño de esa noche (día siguiente).
  {
    const valores = [...kcal.values()].sort((a, b) => a - b);
    if (valores.length >= 2 * MIN_GRUPO) {
      const corte = valores[Math.floor(valores.length * 0.75)];
      const activos = [], resto = [];
      for (const [dia, k] of kcal) { const s = sueno.get(sumarDias(dia, 1)); if (s == null) continue; (k >= corte ? activos : resto).push(s); }
      const w = comparar(activos, resto, 0.33);
      if (w) out.push({ id: "kcal-sueno", icono: "🔥🌙", fuerza: Math.abs(w.t),
        texto: `Tras tus días más activos (más de ${fmtMiles(corte)} kcal) duermes ${fmtHm(w.diff)} ${w.diff > 0 ? "más" : "menos"} esa noche.`,
        detalle: detalle(w) });
    }
  }
  return out.sort((a, b) => b.fuerza - a.fuerza);
}

/** Resumen de una semana frente al año, para las métricas que se piden. */
export function semanaEnElAno(filas, hoy, metricas = ["step_count", "sleep_asleep", "active_energy", "resting_heart_rate"]) {
  return metricas.map(metric => ({ metric, ...(percentilSemana(filas, metric, hoy) || {}) })).filter(x => x.percentil != null);
}

/** Totales de la semana pasada vs la anterior (lunes a domingo, días cerrados). */
export function semanasCerradas(filas, hoy, metric) {
  const idx = indice(filas, metric);
  const lunesActual = lunesDe(hoy);
  const sem = lunes => { const v = []; for (let i = 0; i < 7; i++) { const d = sumarDias(lunes, i); if (idx.has(d)) v.push(idx.get(d)); } return v; };
  const pasada = sem(sumarDias(lunesActual, -7)), anterior = sem(sumarDias(lunesActual, -14));
  return { pasada: media(pasada), anterior: media(anterior), nPasada: pasada.length, nAnterior: anterior.length };
}
