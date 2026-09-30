// Importar un archivo completo de Health Auto Export desde la app.
//
// POR QUÉ: el 28/09 el historial completo (5,7 MB) acabó commiteado en el
// repositorio PÚBLICO, porque no había otra forma de hacerlo llegar. Esto lo
// resuelve: el archivo se elige en el dispositivo y va directo a Supabase con
// la sesión de quien lo sube, sin pasar por ningún sitio intermedio.
//
// Tres cosas antes de enviar, todas en el dispositivo:
//  1. Lo íntimo NO sale del teléfono: actividad sexual y ciclo se quitan aquí.
//  2. Se quita lo pesado que nadie usa (el pulso segundo a segundo de cada
//     entreno, la ruta GPS): el archivo real baja muchísimo.
//  3. Se trocea por años (y por trimestres si un año no cabe): la función
//     rechaza envíos de más de 2,5 MB, y 5 años de golpe la tumbaban.

// Mismo criterio que el importador del servidor (supabase/functions/health-ingest/
// parse.js): aquí se aplica ANTES de enviar, y lo que no se va a guardar,
// tampoco viaja. Las dos listas eran copias sueltas que podían divergir: un test
// (healthImport.test.js) compara la de aquí con la del servidor.
export const NO_ENVIAR = new Set(["sexual_activity", "menstrual_flow", "cervical_mucus_quality", "ovulation_test_result", "intermenstrual_bleeding"]);
export const INTIMO_RE = /sexual|menstru|ovulat|cervical|contracept|pregnan|lactat|bleeding|cycle|fertil|vaginal|libido|spotting/i;
export const esIntimo = nombre => NO_ENVIAR.has(nombre) || INTIMO_RE.test(String(nombre || ""));

// Campos de un entreno que sí usa el importador. El resto (heartRateData, route,
// location, metadata, la serie activeEnergy…) es la mayor parte del peso y lo más
// personal: no viaja.
export const CAMPOS_ENTRENO = ["name", "start", "end", "duration", "activeEnergyBurned", "distance", "avgHeartRate", "heartRate", "averageHeartRate", "source"];

export const MAX_TROZO = 2_000_000;   // margen bajo el tope de 2,5 MB del servidor

// `endDate`: el sueño exportado SIN resumir llega en tramos { startDate, endDate }.
// Se trocea por el FIN del tramo, que es el día al que pertenece la noche.
const fechaDe = x => String(x?.date ?? x?.sleepEnd ?? x?.endDate ?? x?.sleepStart ?? x?.start ?? x?.startDate ?? "");

export function limpiarEntreno(w) {
  const out = {};
  for (const k of CAMPOS_ENTRENO) if (w?.[k] !== undefined) out[k] = w[k];
  // `heartRate` trae {avg,min,max}; nos basta la media.
  if (out.heartRate && typeof out.heartRate === "object") out.heartRate = { avg: out.heartRate.avg };
  return out;
}

/** ¿Es un archivo de Health Auto Export? Devuelve un motivo si no. */
export function validar(json) {
  const d = json?.data;
  if (!d || typeof d !== "object") return "No parece un archivo de Health Auto Export (falta \"data\").";
  if (!Array.isArray(d.metrics) && !Array.isArray(d.workouts)) return "El archivo no trae métricas ni entrenos.";
  return null;
}

// Filtra el archivo a un intervalo [desde, hasta) de fechas "YYYY-MM-DD".
function recortar(d, desde, hasta) {
  const dentro = x => { const f = fechaDe(x).slice(0, 10); return f >= desde && f < hasta; };
  const metrics = (d.metrics || [])
    .filter(m => !esIntimo(m?.name))
    .map(m => ({ name: m.name, units: m.units, data: (m.data || []).filter(dentro) }))
    .filter(m => m.data.length);
  const workouts = (d.workouts || []).filter(dentro).map(limpiarEntreno);
  return { data: { metrics, workouts } };
}

const bytes = o => JSON.stringify(o).length;
const cuenta = t => t.data.metrics.reduce((a, m) => a + m.data.length, 0) + t.data.workouts.length;

/**
 * Trocea el archivo en envíos que caben en el servidor.
 * @returns {Array<{ etiqueta: string, cuerpo: object, kb: number, datos: number }>}
 */
export function trocear(json, { max = MAX_TROZO } = {}) {
  const d = json?.data || {};
  const años = new Set();
  for (const m of d.metrics || []) for (const x of m.data || []) { const a = fechaDe(x).slice(0, 4); if (/^\d{4}$/.test(a)) años.add(a); }
  for (const w of d.workouts || []) { const a = fechaDe(w).slice(0, 4); if (/^\d{4}$/.test(a)) años.add(a); }

  const trozos = [];
  for (const a of [...años].sort()) {
    const año = recortar(d, `${a}-01-01`, `${+a + 1}-01-01`);
    if (!cuenta(año)) continue;
    if (bytes(año) <= max) {
      trozos.push({ etiqueta: a, cuerpo: año, kb: Math.round(bytes(año) / 1024), datos: cuenta(año) });
      continue;
    }
    // El año no cabe: por trimestres.
    for (const [q, i, f] of [["T1", "01", "04"], ["T2", "04", "07"], ["T3", "07", "10"], ["T4", "10", null]]) {
      const t = recortar(d, `${a}-${i}-01`, f ? `${a}-${f}-01` : `${+a + 1}-01-01`);
      if (cuenta(t)) trozos.push({ etiqueta: `${a} ${q}`, cuerpo: t, kb: Math.round(bytes(t) / 1024), datos: cuenta(t) });
    }
  }
  return trozos;
}
