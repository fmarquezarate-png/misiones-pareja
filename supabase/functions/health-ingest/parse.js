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
  sleep_asleep: [0, 16], sleep_in_bed: [0, 20], sleep_deep: [0, 8],
  sleep_rem: [0, 8], sleep_core: [0, 14], sleep_awake: [0, 8],
  mindful_minutes: [0, 600],
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
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s.trim());
  return m ? m[1] : null;
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
/** @returns {Array<{day, metric, value, unit, source}>} */
export function aplanar(metrics = []) {
  const out = [];
  for (const m of metrics || []) {
    const nombre = String(m?.name ?? "").trim();
    if (!nombre || NUNCA.has(nombre)) continue;
    const unidad = m?.units ? String(m.units) : null;

    for (const d of m?.data || []) {
      const source = d?.source ? String(d.source) : null;

      if (nombre === "sleep_analysis") {
        // La noche cuenta en el día del DESPERTAR.
        const day = diaLocal(d?.sleepEnd) ?? diaLocal(d?.date) ?? diaLocal(d?.sleepStart);
        if (!day) continue;
        // Según el reloj, unos campos vienen a 0 y otros rellenos (Huawei:
        // fases a 0 y total en totalSleep; Apple Watch: al revés). Un 0 en
        // el sueño no es una medida. Total = primer POSITIVO de
        // totalSleep → asleep → suma de fases.
        const fases = [pos(d?.core), pos(d?.deep), pos(d?.rem), pos(d?.asleepUnspecified)].filter(v => v !== null);
        const suma = fases.length ? fases.reduce((a, b) => a + b, 0) : null;
        const total = pos(d?.totalSleep) ?? pos(d?.asleep) ?? suma;
        // Minutos u horas: lo dice `units`; si no, se decide UNA vez por noche.
        const u = (unidad || "").toLowerCase();
        const enMin = u.startsWith("min") || (!u.startsWith("h") && (total ?? 0) > 24);
        const h = v => (v === null ? null : enMin ? v / 60 : v);
        for (const [metric, v] of [
          ["sleep_asleep", h(total)], ["sleep_in_bed", h(pos(d?.inBed))],
          ["sleep_deep", h(pos(d?.deep))], ["sleep_rem", h(pos(d?.rem))],
          ["sleep_core", h(pos(d?.core))], ["sleep_awake", h(pos(d?.awake))],
        ]) if (v !== null) out.push({ day, metric, value: v, unit: "h", source });
        continue;
      }

      const day = diaLocal(d?.date);
      if (!day) continue;

      // Pulso y similares: llegan como { Min, Avg, Max } sin `qty`. Antes se
      // descartaban enteros (972 días de pulso de Fran, en silencio).
      if (d?.qty === undefined && (d?.Avg !== undefined || d?.avg !== undefined)) {
        const avg = num(d?.Avg ?? d?.avg), mn = num(d?.Min ?? d?.min), mx = num(d?.Max ?? d?.max);
        if (avg !== null) out.push({ day, metric: nombre, value: avg, unit: unidad, source });
        if (mn !== null) out.push({ day, metric: `${nombre}_min`, value: mn, unit: unidad, source });
        if (mx !== null) out.push({ day, metric: `${nombre}_max`, value: mx, unit: unidad, source });
        continue;
      }

      let value = num(d?.qty);
      if (value === null) continue;
      let u = unidad;
      // Energía siempre en kcal, aunque el iPhone esté en kJ: así las metas
      // y los rangos significan lo mismo para todo el mundo.
      if ((nombre === "active_energy" || nombre === "basal_energy_burned") && String(unidad).toLowerCase() === "kj") {
        value = aKcal(value, "kj"); u = "kcal";
      }
      out.push({ day, metric: nombre, value, unit: u, source });
    }
  }
  return out;
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
    const e = w?.activeEnergyBurned ?? w?.activeEnergy;
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
      source: w?.source ? String(w.source) : null,
    });
  }
  // Mismo entreno reenviado = misma clave natural: se queda el último.
  return [...new Map(out.map(w => [`${w.start_at}|${w.name}`, w])).values()];
}
