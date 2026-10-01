// Configuración del panel de Salud: qué se ve y cómo.
//
// Antes, los nombres, formatos, metas y preguntas de cada métrica vivían
// repartidos en cuatro tablas (NOMBRES_METRICA, METRICAS, DEFS, MINIMOS) y el
// panel enseñaba 4 de las ~20 métricas que llegan, sin poder elegir. Ahora hay
// UN registro de tarjetas, y la persona elige cuáles ver, en qué orden, con
// qué periodo y qué secciones. La preferencia es de quien mira, y se guarda en
// su mascota (`pet.panel`) para que la acompañe entre dispositivos.
//
// Puro: se prueba sin DOM.
//
// Además de las tarjetas de siempre, CUALQUIER métrica con datos puede ser una
// tarjeta: su id es `m:<métrica>` y se construye del catálogo (nombre, icono,
// formato, dirección). Antes había 8 fijas y 20 métricas sin forma de verse.

import { NOMBRES_METRICA, direccionDe, formatoValor, TOTALES_DIA, iconoDe, nombreDe, NO_TARJETA } from "./metricasCatalogo.js";

const hm = h => { const H = Math.floor(h), M = Math.round((h - H) * 60); return M === 60 ? `${H + 1}h` : `${H}h ${String(M).padStart(2, "0")}m`; };
const miles = n => Math.round(n).toLocaleString("es-ES");
const uno = n => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

/**
 * id → tarjeta. `cerrados`: se acumula durante el día (la media usa días
 * cerrados). `meta`: tipo de meta diaria que la acompaña, si la hay.
 */
export const TARJETAS = {
  sueno:     { metric: "sleep_asleep",        nombre: "Sueño",            icono: "🌙", formato: hm,                       unidad: "",         unidadLarga: "horas por noche", mejorSi: "neutral", meta: "sueno",
    sufijo: "",
    delta: d => `${Math.round(d * 60)} min`,
    sugerencias: ["¿Duermo más los fines de semana?", "¿Mi sueño está mejorando?", "¿Qué noches fueron las peores?"] },
  pulso:     { metric: "resting_heart_rate",  nombre: "Pulso en reposo",  icono: "❤️", formato: v => `${Math.round(v)}`, unidad: "lpm",      unidadLarga: "latidos por minuto", mejorSi: "baja", forma: "linea",
    sufijo: " lpm",
    delta: d => `${Math.round(d)} lpm`,
    sugerencias: ["¿Mi pulso en reposo está bajando?", "¿Qué días lo tuve más alto?"] },
  pasos:     { metric: "step_count",          nombre: "Pasos",            icono: "👟", formato: miles,                    unidad: "al día",   unidadLarga: "pasos al día", mejorSi: "sube", meta: "pasos", cerrados: true,
    sufijo: "",
    delta: d => miles(d),
    sugerencias: ["¿Qué día de la semana ando más?", "¿Cuántos días llegué a la meta?", "¿Voy mejorando?"] },
  kcal:      { metric: "active_energy",       nombre: "Energía activa",   icono: "🔥", formato: miles,                    unidad: "kcal/día", unidadLarga: "kcal al día", mejorSi: "sube", cerrados: true,
    sufijo: " kcal",
    delta: d => `${miles(d)} kcal`,
    sugerencias: ["¿Qué días me moví más?", "¿Estoy más activo que al principio?"] },
  ejercicio: { metric: "apple_exercise_time", nombre: "Ejercicio",        icono: "🏃", formato: v => `${Math.round(v)}`, unidad: "min/día",  unidadLarga: "minutos de ejercicio al día", mejorSi: "sube", meta: "ejercicio", cerrados: true,
    sufijo: " min",
    delta: d => `${Math.round(d)} min`,
    sugerencias: ["¿Qué días hice más ejercicio?", "¿Cuántos días llegué a la meta?"] },
  depie:     { metric: "apple_stand_hour",    nombre: "Horas de pie",     icono: "🧍", formato: v => `${Math.round(v)}`, unidad: "h/día",    unidadLarga: "horas de pie al día", mejorSi: "sube", cerrados: true,
    sufijo: " h",
    delta: d => `${uno(d)} h`,
    sugerencias: ["¿Estoy más tiempo de pie que antes?"] },
  hrv:       { metric: "heart_rate_variability", nombre: "Variabilidad cardiaca", icono: "💓", formato: v => `${Math.round(v)}`, unidad: "ms", unidadLarga: "milisegundos", mejorSi: "sube",
    sufijo: " ms",
    delta: d => `${Math.round(d)} ms`,
    sugerencias: ["¿Mi variabilidad cardiaca está mejorando?"] },
  peso:      { metric: "weight_body_mass",    nombre: "Peso",             icono: "⚖️", formato: v => uno(v),              unidad: "kg",       unidadLarga: "kg", mejorSi: "neutral", forma: "linea",
    sufijo: " kg",
    delta: d => `${uno(d)} kg`,
    sugerencias: ["¿Cómo ha evolucionado mi peso?"] },
};

export const ORDEN_TARJETAS = Object.keys(TARJETAS);
const METRICAS_FIJAS = new Set(Object.values(TARJETAS).map(t => t.metric));
// Tope de tarjetas en el panel (cabe de sobra; evita un panel infinito por error).
export const MAX_TARJETAS = 16;

/** Tarjeta genérica de una métrica cualquiera (id `m:<métrica>`). */
function tarjetaGenerica(metric, unidad = null) {
  const sinUnidad = v => formatoValor(metric, v, null);
  const conUnidad = v => formatoValor(metric, v, unidad);
  const esHora = metric === "wake_min" || metric === "bed_min";
  return {
    metric, nombre: nombreDe(metric), icono: iconoDe(metric),
    formato: sinUnidad, sufijo: "", formatoConUnidad: conUnidad,
    unidad: esHora || metric.startsWith("sleep_") || !unidad || unidad === "count" ? "" : unidad,
    unidadLarga: NOMBRES_METRICA[metric] ? (unidad && unidad !== "count" ? unidad : "") : "",
    mejorSi: direccionDe(metric), cerrados: TOTALES_DIA.has(metric), forma: TOTALES_DIA.has(metric) ? undefined : "linea",
    // Diferencias pequeñas (0,02 km/h) con 2 decimales: redondeadas a 1 salían «0».
    delta: d => (esHora ? `${Math.round(d)} min` : Math.abs(d) < 1 && !metric.startsWith("sleep_")
      ? `${d.toLocaleString("es-ES", { maximumFractionDigits: 2 })}${unidad && unidad !== "count" ? ` ${unidad}` : ""}`
      : formatoValor(metric, d, unidad)),
    sugerencias: [`¿Cómo ha evolucionado mi ${nombreDe(metric).toLowerCase()}?`, "¿Qué días fueron los más altos y los más bajos?"],
    generica: true,
  };
}

/** La definición de una tarjeta por su id (fija o `m:<métrica>`). `unidades`: métrica → unidad. */
export function tarjetaDe(id, unidades = {}) {
  if (TARJETAS[id]) return TARJETAS[id];
  if (typeof id === "string" && id.startsWith("m:") && id.length > 2) return tarjetaGenerica(id.slice(2), unidades[id.slice(2)] ?? null);
  return null;
}
const idValido = id => !!TARJETAS[id] || (typeof id === "string" && /^m:[a-z0-9_]{2,64}$/.test(id) && !NO_TARJETA.test(id.slice(2)) && !METRICAS_FIJAS.has(id.slice(2)));
export const PERIODOS_TARJETA = [7, 14, 30];
export const SECCIONES = {
  metas:   "Metas de la semana",
  noche:   "Última noche",
  entreno: "Último entreno",
  deporte: "Deporte del calendario",
  tipos:   "Tipos de entreno",
  estadisticas: "Estadísticas",
};

export const PANEL_DEFECTO = {
  tarjetas: ["sueno", "pulso", "pasos", "kcal"],
  dias: 7,
  secciones: { metas: true, noche: true, entreno: true, deporte: true, tipos: true, estadisticas: true },
};

/** La configuración guardada es entrada NO fiable (sincronizada, editada, de otra versión): se sanea siempre. */
export function sanearPanel(x) {
  const tarjetas = Array.isArray(x?.tarjetas) ? [...new Set(x.tarjetas.filter(idValido))].slice(0, MAX_TARJETAS) : null;
  return {
    tarjetas: tarjetas && tarjetas.length ? tarjetas : [...PANEL_DEFECTO.tarjetas],
    dias: PERIODOS_TARJETA.includes(x?.dias) ? x.dias : PANEL_DEFECTO.dias,
    secciones: Object.fromEntries(Object.keys(SECCIONES).map(k => [k, x?.secciones?.[k] !== false])),
  };
}

/** Cómo se escribe un valor en el detalle (con su unidad). */
export const formatoDetalle = (id, unidades = {}) => { const t = tarjetaDe(id, unidades); return v => (t.formatoConUnidad ? t.formatoConUnidad(v) : `${t.formato(v)}${t.sufijo || ""}`); };

/**
 * Tarjetas que tienen datos para esta persona: primero las fijas, luego una
 * genérica por cada otra métrica con al menos `minimo` días de dato, de la que
 * más días tiene a la que menos.
 */
export function tarjetasDisponibles(filas = [], minimo = 5) {
  const dias = new Map();
  for (const f of filas) if (Number.isFinite(f.value)) dias.set(f.metric, (dias.get(f.metric) || 0) + 1);
  const fijas = ORDEN_TARJETAS.filter(id => dias.has(TARJETAS[id].metric));
  const otras = [...dias.entries()]
    .filter(([m, n]) => n >= minimo && !METRICAS_FIJAS.has(m) && !NO_TARJETA.test(m))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([m]) => `m:${m}`);
  return [...fijas, ...otras];
}

/** Unidad de cada métrica según las filas (para formatear las genéricas). */
export function unidadesDe(filas = []) {
  const u = {};
  for (const f of filas) if (f.unit && u[f.metric] == null) u[f.metric] = f.unit;
  return u;
}

/** Mueve una tarjeta una posición arriba (-1) o abajo (+1). */
export function moverTarjeta(tarjetas, id, delta) {
  const i = tarjetas.indexOf(id), j = i + delta;
  if (i < 0 || j < 0 || j >= tarjetas.length) return tarjetas;
  const t = [...tarjetas];
  [t[i], t[j]] = [t[j], t[i]];
  return t;
}

// ── Metas editables ─────────────────────────────────────────────────────────
export const LIMITES_META = {
  pasos:     { min: 2000, max: 30000, paso: 500,  unidad: "pasos al día" },
  sueno:     { min: 5,    max: 10,    paso: 0.25, unidad: "horas por noche" },
  ejercicio: { min: 10,   max: 180,   paso: 5,    unidad: "min al día" },
  kcal:      { min: 1000, max: 12000, paso: 100,  unidad: "kcal a la semana" },
};

export function acotarMeta(tipo, valor) {
  const l = LIMITES_META[tipo];
  const v = Number(valor);
  if (!l || !Number.isFinite(v)) return null;
  return Math.min(l.max, Math.max(l.min, Math.round(v / l.paso) * l.paso));
}

/**
 * Nueva versión de las metas a partir de HOY. Guarda también la versión
 * anterior con su fecha de origen, para que cambiar una meta no reescriba el
 * pasado (ver `metasEn` en pet.js).
 * @returns {{ metas: Array, metasHistorial: Array<{desde, metas}> }}
 */
export function nuevaVersionMetas(pet, cambios, hoy) {
  const actuales = pet?.metas || [];
  const metas = actuales.map(m => {
    const v = cambios[m.tipo] != null ? acotarMeta(m.tipo, cambios[m.tipo]) : null;
    return v == null ? { ...m } : { ...m, objetivo: v };
  });
  const base = pet?.metasHistorial?.length ? pet.metasHistorial : [{ desde: pet?.nacimiento || hoy, metas: actuales }];
  // Si ya hay una versión de hoy, se sustituye (varios retoques el mismo día = una versión).
  const historial = [...base.filter(h => h.desde !== hoy), { desde: hoy, metas }].sort((a, b) => (a.desde < b.desde ? -1 : 1)).slice(-50);
  return { metas, metasHistorial: historial };
}
