// Lectura de los datos de salud que manda Health Auto Export.
//
// Solo LEE. Escribe únicamente la Edge Function `health-ingest`; las políticas
// de Supabase (RLS) hacen que cada pareja vea solo lo suyo, así que aquí no
// hace falta filtrar por pareja: la base de datos no devuelve otra cosa.
//
// Todo lleva tiempo límite (regla §5 de CLAUDE.md, el cuelgue de WKWebView en
// iOS): una pantalla de salud colgada para siempre por un fetch que nunca
// vuelve es exactamente el bug que ya costó cuatro versiones.

import supabase from "../supabase.js";
import { withTimeout } from "../utils.js";
import { sumarDias, isoDia } from "./pet.js";

/**
 * Filas diarias y entrenos de los últimos `dias` días, de las dos personas.
 * @returns {{ filas: Array, entrenos: Array, error: string|null }}
 */
export async function cargarSalud({ dias = 120 } = {}) {
  const desde = sumarDias(isoDia(new Date()), -dias);
  try {
    const [d, w] = await Promise.all([
      withTimeout(
        supabase.from("health_daily")
          .select("user_id, day, metric, value, unit, source, updated_at")
          .gte("day", desde)
          .order("day", { ascending: true })
          .limit(20000),
        15000, "health_daily",
      ),
      withTimeout(
        supabase.from("health_workouts")
          .select("user_id, start_at, end_at, name, minutes, kcal, distance_km, avg_hr")
          .gte("start_at", desde)
          .order("start_at", { ascending: true })
          .limit(2000),
        15000, "health_workouts",
      ),
    ]);
    if (d.error) throw new Error(d.error.message);
    if (w.error) throw new Error(w.error.message);
    return { filas: d.data || [], entrenos: w.data || [], error: null };
  } catch (e) {
    // "No existe la tabla" y "sin red" son cosas distintas y se dicen distinto.
    const msg = String(e?.message || e);
    const sinTabla = /does not exist|relation .* does not exist|schema cache/i.test(msg);
    return { filas: [], entrenos: [], error: sinTabla ? "sin_tablas" : "red" };
  }
}

// ── Resumen por persona (puro) ──────────────────────────────────────────────
/**
 * Agrupa por persona y resume lo que ha llegado: cuándo fue el último envío,
 * cuántos días hay, qué métricas y su último valor.
 */
export function resumirPorPersona(filas = [], entrenos = []) {
  const personas = new Map();
  const de = uid => {
    if (!personas.has(uid)) personas.set(uid, { userId: uid, filas: [], entrenos: [], ultimoEnvio: null, dias: new Set(), metricas: new Map() });
    return personas.get(uid);
  };
  for (const f of filas) {
    const p = de(f.user_id);
    p.filas.push(f);
    p.dias.add(f.day);
    if (!p.ultimoEnvio || f.updated_at > p.ultimoEnvio) p.ultimoEnvio = f.updated_at;
    const prev = p.metricas.get(f.metric);
    if (!prev || f.day > prev.day) p.metricas.set(f.metric, { day: f.day, value: f.value, unit: f.unit, source: f.source });
  }
  for (const w of entrenos) de(w.user_id).entrenos.push(w);

  return [...personas.values()].map(p => ({
    userId: p.userId,
    filas: p.filas,
    entrenos: p.entrenos,
    ultimoEnvio: p.ultimoEnvio,
    numDias: p.dias.size,
    primerDia: [...p.dias].sort()[0] || null,
    ultimoDia: [...p.dias].sort().pop() || null,
    metricas: [...p.metricas.entries()]
      .map(([metric, v]) => ({ metric, ...v }))
      .sort((a, b) => a.metric.localeCompare(b.metric)),
  }));
}

// Nombres legibles de las métricas que manda Health Auto Export. Las que no
// estén aquí se enseñan con su nombre técnico: mejor eso que esconderlas.
export const NOMBRES_METRICA = {
  step_count: "Pasos",
  active_energy: "Calorías activas",
  basal_energy_burned: "Calorías en reposo",
  apple_exercise_time: "Minutos de ejercicio",
  apple_stand_hour: "Horas de pie",
  apple_stand_time: "Tiempo de pie",
  sleep_asleep: "Sueño",
  sleep_in_bed: "En la cama",
  sleep_deep: "Sueño profundo",
  sleep_rem: "Sueño REM",
  sleep_core: "Sueño ligero",
  sleep_awake: "Despierto (noche)",
  resting_heart_rate: "Pulso en reposo",
  heart_rate: "Pulso",
  walking_heart_rate_average: "Pulso caminando",
  heart_rate_variability: "Variabilidad cardiaca",
  distance_walking_running: "Distancia",
  flights_climbed: "Pisos subidos",
  mindful_minutes: "Mindfulness",
  weight_body_mass: "Peso",
  respiratory_rate: "Respiración",
  blood_oxygen_saturation: "Oxígeno en sangre",
  vo2_max: "VO₂ máx",
};

export function formatoValor(metric, value, unit) {
  if (!Number.isFinite(value)) return "—";
  if (metric.startsWith("sleep_")) {
    const h = Math.floor(value), m = Math.round((value - h) * 60);
    return m === 60 ? `${h + 1} h` : `${h} h ${String(m).padStart(2, "0")}`;
  }
  const u = unit && unit !== "count" ? ` ${unit}` : "";
  const n = Math.abs(value) >= 100 ? Math.round(value).toLocaleString("es-ES") : value.toLocaleString("es-ES", { maximumFractionDigits: 1 });
  return `${n}${u}`;
}
