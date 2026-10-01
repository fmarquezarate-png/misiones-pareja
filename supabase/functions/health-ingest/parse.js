// Interpretación y limpieza de los envíos de Health Auto Export.
//
// Módulo PURO en JavaScript plano: lo importa la Edge Function (Deno) y lo
// prueban los tests de la app (Vitest). Antes vivía dentro de index.ts sin
// ningún test, y los datos reales de Fran destaparon cuatro fallos que ningún
// ejemplo de la documentación mostraba:
//   1. el sueño llegaba con campos a 0 según el reloj;
//   2. el pulso llega como { Min, Avg, Max }, sin `qty` → se tiraba ENTERO;
//   3. la distancia se llama `walking_running_distance`, no como se suponía;
//   4. las calorías de los entrenos vienen en kJ y se guardaban como kcal
//      (×4,2), y `duration` va en SEGUNDOS, no en minutos.
// Cada uno tiene ahora su test, construido con la forma REAL del dato.

// ── Lo que NO se guarda nunca ───────────────────────────────────────────────
// La mascota no lo necesita, y son de los datos más íntimos que hay. Llegan
// si la persona los marca en Health Auto Export; aquí se descartan sin
// guardarlos (ni siquiera en health_rejects).
export const NUNCA = new Set(["sexual_activity", "menstrual_flow", "cervical_mucus_quality", "ovulation_test_result", "intermenstrual_bleeding"]);
// Y por PATRÓN, no solo por lista: Health Auto Export añade tipos de ciclo y
// salud reproductiva con nombres nuevos, y la lista cerrada de arriba nunca
// los tendría todos. Lo que suene a íntimo se descarta antes de guardarse.
export const INTIMO_RE = /sexual|menstru|ovulat|cervical|contracept|pregnan|lactat|bleeding|cycle|fertil|vaginal|libido|spotting/i;
export const esIntimo = nombre => NUNCA.has(nombre) || INTIMO_RE.test(String(nombre || ""));

// Campos de un entreno que el importador USA. El resto (ruta GPS, pulso
// segundo a segundo, ubicación, metadatos) es lo más pesado y lo más
// personal: no se guarda ni siquiera en el envío crudo.
export const CAMPOS_ENTRENO = ["name", "start", "end", "duration", "activeEnergyBurned", "distance", "avgHeartRate", "heartRate", "averageHeartRate", "source"];

/**
 * Copia SANEADA de un envío, la única que se guarda en `health_raw`. Antes se
 * guardaba el envío íntegro y se filtraba después: durante 7 días quedaban en
 * la base de datos la actividad sexual, el ciclo y las rutas GPS que la app
 * promete no guardar.
 */
export function sanearPayload(payload) {
  const d = payload?.data ?? payload;
  if (!d || typeof d !== "object") return { data: {} };
  const limpio = {};
  for (const k of Object.keys(d)) {
    if (INTIMO_RE.test(k)) continue;                       // cycleTracking, symptoms…
    if (k === "metrics") limpio.metrics = (Array.isArray(d.metrics) ? d.metrics : []).filter(m => !esIntimo(m?.name));
    else if (k === "workouts") {
      limpio.workouts = (Array.isArray(d.workouts) ? d.workouts : []).map(w => {
        const o = {};
        for (const c of CAMPOS_ENTRENO) if (w?.[c] !== undefined) o[c] = w[c];
        if (o.heartRate && typeof o.heartRate === "object") o.heartRate = { avg: o.heartRate.avg };
        return o;
      });
    } else if (typeof d[k] !== "object") limpio[k] = d[k];   // escalares sueltos; nada de estructuras desconocidas
  }
  return { data: limpio };
}


// ── Rangos de cordura ───────────────────────────────────────────────────────
// Fuera de rango no es un dato: es un sensor loco o una importación rota. Se
// descarta y se APUNTA (un descarte silencioso es indistinguible de un bug).
export const RANGOS = {
  step_count: [0, 100000],
  active_energy: [0, 15000],            // kcal (se convierte antes de comprobar)
  basal_energy_burned: [0, 15000],
  apple_exercise_time: [0, 1440],
  apple_stand_hour: [0, 24],
  heart_rate: [25, 230], heart_rate_min: [20, 230], heart_rate_max: [25, 250],
  resting_heart_rate: [25, 150],
  walking_heart_rate_average: [25, 200],
  heart_rate_variability: [1, 500],
  respiratory_rate: [4, 60],
  blood_oxygen_saturation: [50, 100],
  weight_body_mass: [20, 400],
  body_fat_percentage: [1, 70],
  vo2_max: [10, 90],
  walking_running_distance: [0, 300],
  distance_walking_running: [0, 300],
  flights_climbed: [0, 2000],
  // Hasta 22 h de sueño en un día: días de 16–17 h son REALES (lesión, bajón:
  // Fran, mayo de 2025). El tope anterior (16 h) los tiraba como «imposibles».
  sleep_asleep: [0, 22], sleep_in_bed: [0, 24], sleep_deep: [0, 12],
  sleep_rem: [0, 12], sleep_core: [0, 20], sleep_awake: [0, 12],
  mindful_minutes: [0, 600],
  wake_min: [0, 1440], bed_min: [-720, 1440],
};

// Totales del día: si llegan dos veces (dos fuentes contando lo mismo),
// sumarlos duplicaría. Se coge el MAYOR. El resto se promedia.
export const ACUMULADAS = new Set([
  "step_count", "active_energy", "basal_energy_burned", "apple_exercise_time",
  "walking_running_distance", "distance_walking_running", "flights_climbed", "mindful_minutes",
  "sleep_asleep", "sleep_in_bed", "sleep_deep", "sleep_rem", "sleep_core", "sleep_awake",
]);

const KJ_POR_KCAL = 4.184;

// ── Fechas ──────────────────────────────────────────────────────────────────
// El DÍA es el local del teléfono: los 10 primeros caracteres, sin pasar por
// UTC (ahí es donde se pierde un día en husos negativos).
export function diaLocal(s) {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  // Calendario REAL: "2026-02-31" no es una fecha, y una sola así envenenaba
  // toda la tanda de subida (la base de datos rechaza el lote entero).
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const f = new Date(Date.UTC(y, mo - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === mo - 1 && f.getUTCDate() === d ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function instante(s) {
  if (typeof s !== "string") return null;
  const t = s.trim();
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s*([+-]\d{2}):?(\d{2})?$/.exec(t);
  if (m) return `${m[1]}T${m[2]}${m[3]}:${m[4] ?? "00"}`;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export const num = v => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const pos = v => { const n = num(v); return n !== null && n > 0 ? n : null; };

// Energía a kcal según la unidad declarada.
export function aKcal(valor, unidad) {
  if (valor === null) return null;
  return String(unidad || "").toLowerCase() === "kj" ? valor / KJ_POR_KCAL : valor;
}
export function aKm(valor, unidad) {
  if (valor === null) return null;
  const u = String(unidad || "").toLowerCase();
  if (u === "mi") return valor * 1.609344;
  if (u === "m") return valor / 1000;
  return valor;
}

// ── Aplanado ────────────────────────────────────────────────────────────────
const HORAS = (a, b) => (Date.parse(b) - Date.parse(a)) / 3600e3;
const hm = s => { const m = /[ T](\d{2}):(\d{2})/.exec(String(s || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; };

/**
 * Interpreta UN registro de sueño. Devuelve null si no hay sueño real.
 * - Total = primer valor POSITIVO de totalSleep → asleep → suma de fases (un 0
 *   en el sueño no es una medida: Huawei manda fases a 0, Apple Watch manda
 *   asleep a 0).
 * - Minutos u horas: lo dice `units`; si no, se decide UNA vez por noche.
 * - Nadie duerme más de lo que dura su intervalo: si el total (o una fase)
 *   supera sleepStart → sleepEnd, se recorta. En el archivo real de Fran eran
 *   23 de 866 noches, y 8 de ellas cruzaban la meta de 7 h solo por eso.
 */
// Noches con SOLO «tiempo en cama» (iPhone sin reloj, Mi Fitness, Zepp): 134 en el
// archivo de Fran (2021–2023) se tiraban enteras como «sin valor». Se estima el sueño
// como tiempo en cama × SUENO_POR_CAMA — la proporción real medida en 78 noches suyas
// con los dos datos (mediana 0,884; p25 0,76, p75 0,97). El tiempo en cama es el
// MENOR entre `inBed` y el intervalo inBedStart→inBedEnd (Mi Fitness manda `inBed`
// corrupto, hasta 600 h, con el intervalo bien). Solo cuenta si dura 3–12 h y
// termina entre las 03:00 y las 15:00: Zepp registra franjas de DÍA (11:29→19:02).
export const SUENO_POR_CAMA = 0.884;

function nocheSoloCama(d, day, unidad, positivo) {
  const u = (unidad || "").toLowerCase();
  let cama = positivo(d?.inBed);
  if (cama === null) return null;                // sin «tiempo en cama» no hay nada que estimar
  if (u.startsWith("min")) cama /= 60;
  const ci = instante(d?.inBedStart ?? d?.sleepStart), cf = instante(d?.inBedEnd ?? d?.sleepEnd);
  const intervalo = ci && cf ? HORAS(ci, cf) : null;
  const dur = Math.min(cama ?? Infinity, intervalo !== null && intervalo > 0 ? intervalo : Infinity);
  const fin = hm(d?.inBedEnd ?? d?.sleepEnd);
  if (!Number.isFinite(dur) || dur < 3 || dur > 12 || fin === null || fin < 180 || fin > 900) return null;
  const ini = hm(d?.inBedStart ?? d?.sleepStart);
  const diaDeFin = diaLocal(d?.inBedEnd ?? d?.sleepEnd) ?? day;
  const mismoDia = diaLocal(d?.inBedStart ?? d?.sleepStart) === diaDeFin;
  return {
    day: diaDeFin, estimado: true, recortado: false,
    valores: { sleep_asleep: dur * SUENO_POR_CAMA, sleep_in_bed: dur },
    total: dur * SUENO_POR_CAMA,
    wake: fin,
    bed: ini === null ? null : (mismoDia ? ini : ini - 1440),
  };
}

function interpretarNoche(d, unidad) {
  const day = diaLocal(d?.sleepEnd) ?? diaLocal(d?.date) ?? diaLocal(d?.sleepStart);
  if (!day) return { motivo: "sin_fecha" };
  const positivo = v => { const n = num(v); return n !== null && n > 0 ? n : null; };
  const fases = [positivo(d?.core), positivo(d?.deep), positivo(d?.rem), positivo(d?.asleepUnspecified)].filter(v => v !== null);
  const suma = fases.length ? fases.reduce((a, b) => a + b, 0) : null;
  const total = positivo(d?.totalSleep) ?? positivo(d?.asleep) ?? suma;
  if (total === null) return nocheSoloCama(d, day, unidad, positivo) ?? { motivo: positivo(d?.inBed) !== null ? "cama_no_valida" : "sin_valor" };

  const u = (unidad || "").toLowerCase();
  const enMin = u.startsWith("min") || (!u.startsWith("h") && total > 24);
  const h = v => (v === null ? null : enMin ? v / 60 : v);

  const ini = instante(d?.sleepStart), fin = instante(d?.sleepEnd);
  const intervalo = ini && fin ? HORAS(ini, fin) : null;
  let recortado = false;
  const tope = v => {
    if (v === null || intervalo === null || !(intervalo > 0)) return v;
    if (v > intervalo + 0.25) { recortado = true; return intervalo; }
    return v;
  };

  const valores = {
    sleep_asleep: tope(h(total)),
    sleep_in_bed: h(positivo(d?.inBed)),
    sleep_deep: tope(h(positivo(d?.deep))),
    sleep_rem: tope(h(positivo(d?.rem))),
    sleep_core: tope(h(positivo(d?.core))),
    sleep_awake: h(positivo(d?.awake)),
  };
  const despertar = hm(d?.sleepEnd), acostarse = hm(d?.sleepStart);
  const mismoDia = diaLocal(d?.sleepStart) === day;
  // Acostarse: entre las 12:00 de la víspera (−720) y las 15:00 del día (900). Zepp
  // manda intervalos de más de 24 h y salían «acostarse» imposibles (−1296 min).
  let bed = acostarse === null ? null : (mismoDia ? acostarse : acostarse - 1440);
  if (bed !== null && (bed < -720 || bed > 900 || (intervalo !== null && intervalo > 20))) bed = null;
  return {
    day, valores, recortado,
    total: valores.sleep_asleep,
    wake: despertar,
    bed,
  };
}

// ── Sueño en MUESTRAS (exportación sin resumir) ─────────────────────────────
// Health Auto Export «resumido» (una noche por día) se saltó casi todo 2025 de
// Fran aunque Apple Salud sí lo tenía (vídeo del 30/09/2026: marzo–noviembre
// 2025 del HUAWEI WATCH GT Runner, ausentes del archivo). Sin resumir llega cada
// tramo tal cual: { startDate, endDate, value: "Core"|"Deep"|"REM"|"Awake"|
// "In Bed"|"Asleep", qty, source }. Una fuente puede escribir el mismo tramo con
// dos etiquetas (general + fase): se toma la UNIÓN de intervalos, un minuto
// cuenta una vez. Y el total del DÍA suma todas las sesiones que acaban ese día
// (noche + siestas), como Apple Salud: los días de 16–17 h de Fran (mayo de 2025,
// lesión y bajón) son reales y se guardan tal cual. La hora de acostarse y
// despertar sale de la sesión MÁS LARGA (una siesta no es «despertarse»).
const CAT_SUENO = { core: "core", deep: "deep", rem: "rem", asleep: "asleep", asleepunspecified: "asleep", unspecified: "asleep", asleepcore: "core", asleepdeep: "deep", asleeprem: "rem" };
const catDe = v => {
  const k = String(v ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (k === "inbed") return "cama";
  if (k === "awake") return "despierto";
  return CAT_SUENO[k] ?? null;
};
export const esMuestraSueno = d => !!d && (d.startDate ?? d.start) !== undefined && (d.endDate ?? d.end) !== undefined
  && d.totalSleep === undefined && catDe(d.value ?? d.stage) !== null;

function union(tramos) {
  const t = tramos.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0, ini = null, fin = null;
  for (const [a, b] of t) {
    if (fin === null || a > fin) { if (fin !== null) total += fin - ini; ini = a; fin = b; }
    else if (b > fin) fin = b;
  }
  if (fin !== null) total += fin - ini;
  return total / 3600e3;
}
const HUECO_SESION = 2 * 3600e3;   // más de 2 h sin tramos = otra sesión (siesta)

/** Muestras → una noche por (fuente, día de despertar), con la misma forma que interpretarNoche. */
export function nochesDeMuestras(muestras) {
  const porFuente = new Map();
  for (const d of muestras) {
    const si = d.startDate ?? d.start, sf = d.endDate ?? d.end;
    const a = Date.parse(instante(si) ?? ""), b = Date.parse(instante(sf) ?? "");
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a || b - a > 24 * 3600e3) continue;
    const src = d?.source ? String(d.source) : null;
    if (!porFuente.has(src)) porFuente.set(src, []);
    porFuente.get(src).push({ a, b, si, sf, cat: catDe(d.value ?? d.stage) });
  }
  const noches = [];
  for (const [source, lista] of porFuente) {
    lista.sort((x, y) => x.a - y.a);
    const sesiones = [];
    for (const m of lista) {
      const s = sesiones[sesiones.length - 1];
      if (s && m.a - s.fin <= HUECO_SESION) { s.m.push(m); if (m.b > s.fin) { s.fin = m.b; s.sf = m.sf; } }
      else sesiones.push({ m: [m], fin: m.b, sf: m.sf });
    }
    // Sesiones con sueño, agrupadas por el día en que acaban.
    const porDia = new Map();
    for (const s of sesiones) {
      const dormido = s.m.filter(x => x.cat !== "cama" && x.cat !== "despierto");
      if (!dormido.length) continue;
      const ultimo = dormido.reduce((p, x) => (x.b > p.b ? x : p));
      const day = diaLocal(ultimo.sf);
      if (!day) continue;
      const larga = union(dormido.map(x => [x.a, x.b]));
      if (!porDia.has(day)) porDia.set(day, []);
      porDia.get(day).push({ s, dormido, ultimo, larga });
    }
    for (const [day, ses] of porDia) {
      const todos = ses.flatMap(x => x.s.m);
      const tr = f => todos.filter(f).map(x => [x.a, x.b]);
      const total = union(tr(x => x.cat !== "cama" && x.cat !== "despierto"));
      const fase = c => { const h = union(tr(x => x.cat === c)); return h > 0 ? h : null; };
      const cama = union(tr(x => x.cat === "cama"));
      const principal = ses.reduce((p, x) => (x.larga > p.larga ? x : p));
      const primero = principal.dormido.reduce((p, x) => (x.a < p.a ? x : p));
      const ini = hm(primero.si);
      const bed = ini === null ? null : (diaLocal(primero.si) === day ? ini : ini - 1440);
      noches.push({
        day, source, recortado: false, total,
        valores: { sleep_asleep: total, sleep_in_bed: cama > 0 ? cama : null, sleep_deep: fase("deep"), sleep_rem: fase("rem"), sleep_core: fase("core"), sleep_awake: fase("despierto") },
        wake: hm(principal.ultimo.sf),
        bed: bed !== null && bed >= -720 && bed <= 900 ? bed : null,
      });
    }
  }
  return noches;
}

/**
 * Aplana las métricas y CUENTA lo que ignora y por qué. Antes las entradas sin
 * fecha, sin valor o de forma desconocida desaparecían sin dejar rastro:
 * indistinguible de un parser roto.
 *
 * @param {Array} metrics
 * @param {{ hoy?: string }} [opts]  "YYYY-MM-DD": si se da, se rechazan fechas
 *        del futuro (> hoy + 2 días) y anteriores al 2000.
 * @returns {{ filas: Array<{day, metric, value, unit, source}>, avisos: Record<string, number> }}
 */
export function aplanarConAvisos(metrics = [], { hoy = null } = {}) {
  const out = [];
  const avisos = {};
  const av = k => { avisos[k] = (avisos[k] || 0) + 1; };
  const limite = hoy ? new Date(Date.parse(hoy + "T00:00:00Z") + 2 * 864e5).toISOString().slice(0, 10) : null;
  const diaOk = day => {
    if (!day) return false;
    if (day < "2000-01-01") { av("fecha_imposible"); return false; }
    if (limite && day > limite) { av("fecha_futura"); return false; }
    return true;
  };

  for (const m of Array.isArray(metrics) ? metrics : []) {
    // Una métrica mal formada no debe tirar las demás.
    try {
      const nombre = String(m?.name ?? "").trim();
      if (!nombre || nombre.length > 64) { av("metrica_sin_nombre"); continue; }
      if (esIntimo(nombre)) continue;                       // nunca, y sin dejar rastro
      const unidad = m?.units ? String(m.units) : null;

      if (nombre === "sleep_analysis") {
        // Por DÍA se queda la noche principal (la de mayor total): varias
        // fuentes (reloj, Zepp, Mi Fitness) registran la misma noche y las
        // siestas no son "la hora de despertar". Antes wake_min/bed_min se
        // PROMEDIABAN entre siesta y noche: 12 días de Fran tenían dos registros.
        const porDia = new Map();
        const datos = m?.data || [];
        const muestras = datos.filter(esMuestraSueno);
        const resumidas = muestras.length ? datos.filter(d => !esMuestraSueno(d)) : datos;
        const candidatas = [
          ...resumidas.map(d => ({ d, n: null })),
          ...nochesDeMuestras(muestras).map(n => ({ d: null, n })),
        ];
        for (const { d, n: deMuestras } of candidatas) {
          const n = deMuestras ?? interpretarNoche(d, unidad);
          if (n.motivo) { av(n.motivo); continue; }
          if (!diaOk(n.day)) continue;
          if (d) n.source = d?.source ? String(d.source) : null;
          if (n.estimado) { av("sueno_estimado_por_cama"); n.source = `Estimado: tiempo en cama × 0,88${n.source ? ` (${n.source})` : ""}`; }
          const prev = porDia.get(n.day);
          // Sea cual sea el orden de llegada, el registro que NO se queda se cuenta.
          if (prev) av("sueno_secundario");
          // Una noche MEDIDA gana siempre a una estimada por el tiempo en cama.
          const mejor = !prev || (prev.estimado && !n.estimado) || (!!prev.estimado === !!n.estimado && n.total > prev.total);
          if (mejor) porDia.set(n.day, n);
        }
        for (const n of porDia.values()) {
          if (n.recortado) av("sueno_recortado_al_intervalo");
          for (const [metric, v] of Object.entries(n.valores)) {
            if (v !== null) out.push({ day: n.day, metric, value: v, unit: "h", source: n.source });
          }
          if (n.wake !== null) {
            out.push({ day: n.day, metric: "wake_min", value: n.wake, unit: "min", source: n.source });
            if (n.bed !== null) out.push({ day: n.day, metric: "bed_min", value: n.bed, unit: "min", source: n.source });
          }
        }
        continue;
      }

      // Health Auto Export agrupa según «Time Grouping»: por día (una entrada por
      // día), por hora o por MINUTO (01/10/2026: un envío de Fran llegó por minutos
      // y se guardó el trozo más grande — 86 pasos en vez de ~3.900 — y la mascota
      // cayó a 0 %). Ahora se junta SIEMPRE por día y fuente antes de guardar: los
      // totales se SUMAN, las medias se promedian, mínimos y máximos se respetan.
      // Agrupado por día queda igual (un trozo por día y fuente).
      const cubos = new Map();
      const acum = ACUMULADAS.has(nombre);
      for (const d of m?.data || []) {
        const source = d?.source ? String(d.source) : null;
        const day = diaLocal(d?.date);
        if (!day) { av(d?.date ? "fecha_imposible" : "sin_fecha"); continue; }
        if (!diaOk(day)) continue;
        const k = `${day}|${source ?? ""}`;
        if (!cubos.has(k)) cubos.set(k, { day, source, n: 0, suma: 0, nAvg: 0, sumaAvg: 0, min: null, max: null });
        const c = cubos.get(k);

        // Pulso y similares: llegan como { Min, Avg, Max } sin `qty`.
        if (d?.qty === undefined && (d?.Avg !== undefined || d?.avg !== undefined)) {
          const avg = num(d?.Avg ?? d?.avg), mn = num(d?.Min ?? d?.min), mx = num(d?.Max ?? d?.max);
          if (avg === null) { av("sin_valor"); continue; }
          c.nAvg++; c.sumaAvg += avg;
          if (mn !== null) c.min = c.min === null ? mn : Math.min(c.min, mn);
          if (mx !== null) c.max = c.max === null ? mx : Math.max(c.max, mx);
          continue;
        }

        let value = num(d?.qty);
        if (value === null) { av(d?.qty === undefined ? "forma_desconocida" : "sin_valor"); continue; }
        c.n++; c.suma += value;
      }
      // Energía siempre en kcal, aunque el iPhone esté en kJ.
      const enKj = (nombre === "active_energy" || nombre === "basal_energy_burned") && String(unidad).toLowerCase() === "kj";
      const u = enKj ? "kcal" : unidad;
      for (const c of cubos.values()) {
        if (c.nAvg) {
          out.push({ day: c.day, metric: nombre, value: c.sumaAvg / c.nAvg, unit: unidad, source: c.source });
          if (c.min !== null) out.push({ day: c.day, metric: `${nombre}_min`, value: c.min, unit: unidad, source: c.source });
          if (c.max !== null) out.push({ day: c.day, metric: `${nombre}_max`, value: c.max, unit: unidad, source: c.source });
        }
        if (c.n) {
          let value = acum ? c.suma : c.suma / c.n;
          if (enKj) value = aKcal(value, "kj");
          if (c.n > 1) av(acum ? "trozos_sumados" : "trozos_promediados");
          out.push({ day: c.day, metric: nombre, value, unit: u, source: c.source });
        }
      }
    } catch {
      av("metrica_malformada");
    }
  }
  return { filas: out, avisos };
}

/** Compatibilidad: solo las filas. */
export function aplanar(metrics = [], opts) {
  return aplanarConAvisos(metrics, opts).filas;
}

/**
 * Quita las filas de TOTALES del día (pasos, energía, distancia, pisos…) que
 * traen MENOS que lo ya guardado (un 2 % de margen por redondeos): un total
 * diario solo crece a lo largo del día, así que un valor menor es un envío
 * parcial, no una corrección. El sueño queda fuera: puede corregirse a la baja.
 */
export function noBajarTotales(filas, previas = []) {
  const ya = new Map(previas.map(p => [`${p.day}|${p.metric}`, Number(p.value)]));
  return filas.filter(f => {
    if (!ACUMULADAS.has(f.metric) || f.metric.startsWith("sleep_")) return true;
    const v = ya.get(`${f.day}|${f.metric}`);
    return !(Number.isFinite(v) && f.value < v * 0.98);
  });
}

/** Quita los días más recientes (los que la automatización sigue escribiendo). */
export function sinRecientes(filas, desdeDia) {
  return filas.filter(f => f.day < desdeDia);
}

// ── Cuándo fue el pico de pulso del día ─────────────────────────────────────
// Health Auto Export manda el pulso del día ya resumido (mínimo, media, máximo):
// la HORA se pierde. Pero cada envío automático trae el máximo ACUMULADO hasta
// ese momento, así que si entre el envío anterior y este el máximo sube por
// encima de PICO_UMBRAL, el pico ocurrió en esa franja. Medido el 29/09/2026:
// 94 lpm a las 20:10 y 195 a las 00:41 → el pico cayó en el pádel de 20:30.
// Se guarda como dos filas (`hr_pico_desde`/`hr_pico_hasta`, segundos Unix) que
// la regla del deporte del calendario cruza con la hora del evento.
export const PICO_UMBRAL = 150;

/**
 * @param {{value:number, updated_at:string}|null} previo  heart_rate_max guardado de ese día antes de este envío
 * @param {number} nuevoMax  heart_rate_max que trae este envío
 * @param {number} ahoraSeg  segundos Unix de este envío
 * @returns {{desde:number|null, hasta:number}|null}  null = no hay pico nuevo que fechar
 */
export function ventanaPico(previo, nuevoMax, ahoraSeg) {
  if (!Number.isFinite(nuevoMax) || nuevoMax < PICO_UMBRAL) return null;
  if (previo && Number.isFinite(previo.value) && previo.value >= nuevoMax) return null;
  const t = previo?.updated_at ? Date.parse(previo.updated_at) : NaN;
  return { desde: Number.isFinite(t) ? Math.floor(t / 1000) : null, hasta: Math.floor(ahoraSeg) };
}

// ── Limpieza ────────────────────────────────────────────────────────────────
export function limpiar(filas = []) {
  const acc = new Map();
  const rechazos = [];
  for (const f of filas) {
    const r = RANGOS[f.metric];
    if (r && (f.value < r[0] || f.value > r[1])) {
      rechazos.push({ day: f.day, metric: f.metric, value: f.value, reason: `fuera de rango [${r[0]}, ${r[1]}]` });
      continue;
    }
    const k = `${f.day}|${f.metric}`;
    const prev = acc.get(k);
    if (!prev) acc.set(k, { f: { ...f }, n: 1, suma: f.value, max: f.value });
    else {
      prev.n += 1; prev.suma += f.value; prev.max = Math.max(prev.max, f.value);
      if (!prev.f.source) prev.f.source = f.source;
    }
  }
  const filasLimpias = [...acc.values()].map(({ f, n, suma, max }) => ({
    ...f, value: n === 1 ? f.value : (ACUMULADAS.has(f.metric) ? max : suma / n),
  }));
  return { filasLimpias, rechazos };
}

// ── Entrenos ────────────────────────────────────────────────────────────────
export function aplanarEntrenos(workouts = []) {
  const out = [];
  for (const w of workouts || []) {
    const start_at = instante(w?.start);
    if (!start_at) continue;
    const end_at = instante(w?.end);
    // Minutos: de inicio a fin; si falta el fin, `duration` — que va en
    // SEGUNDOS (2426 = 40 min, comprobado contra inicio/fin en el archivo real).
    let minutes = start_at && end_at ? (new Date(end_at).getTime() - new Date(start_at).getTime()) / 60000 : null;
    if (minutes === null && num(w?.duration) !== null) minutes = num(w.duration) / 60;
    // `activeEnergy` es una SERIE (pesada e inútil aquí); el total es activeEnergyBurned.
    const e = w?.activeEnergyBurned;
    const kcal = typeof e === "object" && e ? aKcal(num(e.qty), e.units) : num(e);
    const dist = w?.distance;
    const km = typeof dist === "object" && dist ? aKm(num(dist.qty), dist.units) : num(dist);
    const hr = w?.avgHeartRate ?? w?.heartRate?.avg ?? w?.averageHeartRate;
    out.push({
      start_at, end_at,
      name: String(w?.name ?? "Entreno"),
      minutes: minutes !== null && minutes >= 0 && minutes < 1440 ? minutes : null,
      kcal: kcal !== null && kcal >= 0 && kcal < 10000 ? kcal : null,
      distance_km: km !== null && km >= 0 && km < 500 ? km : null,
      avg_hr: num(typeof hr === "object" && hr ? hr.qty : hr),
      // `source` llega como { name, identifier }: String() daba "[object Object]".
      source: typeof w?.source === "string" ? w.source : (w?.source?.name ? String(w.source.name) : null),
    });
  }
  // Mismo entreno reenviado = misma clave natural: se queda el último.
  return [...new Map(out.map(w => [`${w.start_at}|${w.name}`, w])).values()];
}
