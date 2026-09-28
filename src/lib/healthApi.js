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
import { sumarDias, isoDia, METRICAS } from "./pet.js";

// ── Lectura completa, por páginas ───────────────────────────────────────────
//
// BUG REAL (28/09/2026): Supabase devuelve como mucho 1.000 filas por
// consulta, diga lo que diga `.limit()`. Pedíamos `.limit(20000)` y llegaban
// las 1.000 primeras, SIN AVISO. Ordenadas por fecha, eso cortaba el
// historial de Fran el 8 de septiembre aunque en la base de datos estaba
// hasta el 28 — y la pantalla decía "últimos 7 días: vacío".
//
// Aquí se pide página a página hasta que una llega incompleta. `pedir` es una
// fábrica (from, to) → promesa, para poder probarlo sin Supabase.
export const PAGINA = 1000;

export async function leerTodo(pedir, { pagina = PAGINA, maxPaginas = 60 } = {}) {
  const todo = [];
  for (let i = 0; i < maxPaginas; i++) {
    const desde = i * pagina;
    const { data, error } = await pedir(desde, desde + pagina - 1);
    if (error) throw new Error(error.message || String(error));
    const filas = data || [];
    todo.push(...filas);
    if (filas.length < pagina) return todo;      // última página: se acabó
  }
  // Tope de seguridad alcanzado: se FALLA en vez de devolver lo leído, porque
  // devolverlo sería fingir que es todo (el mismo bug de las 1.000 filas, con
  // otro número). 60 páginas = 60.000 filas: más de 5 años de datos de pareja.
  throw new Error(`demasiadas filas (más de ${maxPaginas * pagina})`);
}

/**
 * Filas diarias y entrenos desde `desde` (o los últimos `dias` días), de las
 * dos personas.
 * @returns {{ filas: Array, entrenos: Array, error: string|null }}
 */
export async function cargarSalud({ dias = 120, desde = null } = {}) {
  const inicio = desde || sumarDias(isoDia(new Date()), -dias);
  try {
    const [filas, entrenos] = await Promise.all([
      withTimeout(leerTodo((a, b) =>
        supabase.from("health_daily")
          .select("user_id, day, metric, value, unit, source, updated_at")
          .gte("day", inicio)
          // Orden TOTAL (no solo por día): con páginas, un orden ambiguo puede
          // repetir o saltarse filas entre una página y la siguiente.
          .order("day", { ascending: true })
          .order("user_id", { ascending: true })
          .order("metric", { ascending: true })
          .range(a, b)), 30000, "health_daily"),
      withTimeout(leerTodo((a, b) =>
        supabase.from("health_workouts")
          .select("user_id, start_at, end_at, name, minutes, kcal, distance_km, avg_hr")
          .gte("start_at", inicio)
          .order("start_at", { ascending: true })
          .order("user_id", { ascending: true })
          .order("name", { ascending: true })
          .range(a, b)), 30000, "health_workouts"),
    ]);
    return { filas, entrenos, error: null };
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
  headphone_audio_exposure: "Volumen en auriculares",
  environmental_audio_exposure: "Ruido ambiente",
  walking_speed: "Velocidad al caminar",
  walking_step_length: "Longitud de paso",
  walking_asymmetry_percentage: "Asimetría al caminar",
  walking_double_support_percentage: "Doble apoyo al caminar",
  six_minute_walking_test_distance: "Test de 6 min caminando",
  stair_speed_up: "Velocidad subiendo escaleras",
  stair_speed_down: "Velocidad bajando escaleras",
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

// ── Historial largo, solo lo que usa el motor ───────────────────────────────
// Para "la vida de tu mascota" hace falta TODO el historial (años), pero no
// todas las métricas: de las ~20 que manda el iPhone, el motor usa unas 8.
// Pedir solo esas (y sin columnas que no usa) reduce la descarga a menos de
// la mitad. Se carga bajo demanda, al pulsar el botón: no en cada apertura.

export const METRICAS_MOTOR = [...new Set(
  Object.values(METRICAS).flatMap(m => [m.metric, ...(m.alias || [])]).filter(m => !m.startsWith("__")),
)];

export async function cargarHistorialMotor() {
  try {
    const [filas, entrenos] = await Promise.all([
      withTimeout(leerTodo((a, b) =>
        supabase.from("health_daily")
          .select("user_id, day, metric, value, unit")
          .in("metric", METRICAS_MOTOR)
          .order("day", { ascending: true })
          .order("user_id", { ascending: true })
          .order("metric", { ascending: true })
          .range(a, b)), 60000, "historial"),
      withTimeout(leerTodo((a, b) =>
        supabase.from("health_workouts")
          .select("user_id, start_at, name, minutes")
          .order("start_at", { ascending: true })
          .order("user_id", { ascending: true })
          .order("name", { ascending: true })
          .range(a, b)), 60000, "entrenos"),
    ]);
    return { filas, entrenos, error: null };
  } catch (e) {
    return { filas: [], entrenos: [], error: String(e?.message || e) };
  }
}

// ── Enviar un trozo del importador ──────────────────────────────────────────
// Va con la sesión de quien está conectado: los datos quedan a SU nombre.
// Traduce las respuestas de error a algo que se entienda.
export async function enviarTrozo(cuerpo) {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke("health-ingest", { body: cuerpo }), 90000, "health-ingest");
    if (error) {
      let detalle = null;
      try { detalle = await error.context?.json?.(); } catch { /* sin cuerpo */ }
      return { ok: false, motivo: traducir(detalle?.error || error.message) };
    }
    if (data?.ok) return { ok: true, metricas: data.metricas, entrenos: data.entrenos, descartados: data.descartados };
    return { ok: false, motivo: traducir(data?.error) };
  } catch (e) {
    return { ok: false, motivo: /timeout/i.test(String(e?.message)) ? "El servidor tardó demasiado. Prueba otra vez." : "Sin conexión." };
  }
}

function traducir(codigo) {
  return ({
    envio_demasiado_grande: "Este trozo es demasiado grande.",
    falta_token: "No hay sesión iniciada.",
    token_invalido: "Sesión no válida. Cierra y vuelve a abrir la app.",
    sin_pareja: "Tu cuenta no está vinculada a una pareja.",
    json_invalido: "El archivo está dañado.",
  })[codigo] || "No se pudo guardar este trozo.";
}
