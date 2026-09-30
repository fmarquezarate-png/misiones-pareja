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
    return { filas: filas.map(normalizarFila), entrenos, error: null };
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
    const prev = p.metricas.get(f.metric);
    if (!prev || f.day > prev.day) p.metricas.set(f.metric, { day: f.day, value: f.value, unit: f.unit, source: f.source });
  }
  for (const w of entrenos) de(w.user_id).entrenos.push(w);

  return [...personas.values()].map(p => {
    // «Último envío» = el último de los envíos AUTOMÁTICOS del reloj, que solo
    // tocan los últimos días. Un import de historial reescribe `updated_at` de
    // filas antiguas y, contado, hacía parecer «acaba de llegar» algo de hace
    // años: la conexión aparecía sana con el automático caído.
    const ultimoDia = [...p.dias].sort().pop() || null;
    const corte = ultimoDia ? sumarDias(ultimoDia, -2) : null;
    let ultimoEnvio = null;
    for (const f of p.filas) if (f.day >= corte && f.updated_at && (!ultimoEnvio || f.updated_at > ultimoEnvio)) ultimoEnvio = f.updated_at;
    return {
    userId: p.userId,
    filas: p.filas,
    entrenos: p.entrenos,
    ultimoEnvio,
    numDias: p.dias.size,
    primerDia: [...p.dias].sort()[0] || null,
    ultimoDia,
    metricas: [...p.metricas.entries()]
      .map(([metric, v]) => ({ metric, ...v }))
      .sort((a, b) => a.metric.localeCompare(b.metric)),
    };
  });
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
  wake_min: "Hora de despertar",
  bed_min: "Hora de acostarte",
  walking_running_distance: "Distancia caminando/corriendo",
  heart_rate_min: "Pulso mínimo del día",
  heart_rate_max: "Pulso máximo del día",
  height: "Altura",
  body_mass_index: "Índice de masa corporal",
  uv_exposure: "Exposición al sol (UV)",
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

// Qué dirección es «mejor» en cada métrica (para marcar «tu mejor día» y colorear
// la tendencia). Lo que no está aquí es NEUTRO: ni subir ni bajar es mejor.
export const DIRECCION = {
  step_count: "sube", active_energy: "sube", apple_exercise_time: "sube", apple_stand_hour: "sube", apple_stand_time: "sube",
  flights_climbed: "sube", walking_running_distance: "sube", distance_walking_running: "sube", mindful_minutes: "sube",
  sleep_asleep: "sube", sleep_deep: "sube", sleep_rem: "sube", sleep_awake: "baja",
  resting_heart_rate: "baja", walking_heart_rate_average: "baja", heart_rate_variability: "sube", vo2_max: "sube",
  blood_oxygen_saturation: "sube", walking_speed: "sube", walking_step_length: "sube", six_minute_walking_test_distance: "sube",
  walking_asymmetry_percentage: "baja", walking_double_support_percentage: "baja", stair_speed_up: "sube", stair_speed_down: "sube",
  headphone_audio_exposure: "baja", environmental_audio_exposure: "baja",
};
export const direccionDe = metric => DIRECCION[metric] || "neutral";

export function formatoValor(metric, value, unit) {
  if (!Number.isFinite(value)) return "—";
  // Horas del día guardadas como minutos desde medianoche (negativo = antes de las 00:00).
  if (metric === "wake_min" || metric === "bed_min") {
    const m = ((Math.round(value) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  }
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

export const METRICAS_MOTOR = [...new Set([
  ...Object.values(METRICAS).flatMap(m => [m.metric, ...(m.alias || [])]).filter(m => !m.startsWith("__")),
  // Para confirmar el deporte del calendario (deporteCalendario.js).
  "heart_rate_max", "hr_pico_desde", "hr_pico_hasta",
])];

// La energía llegó en kJ hasta el 22/09/2026 (se corrigió en la base el 30/09).
// Por si vuelve a pasar: todo lo que se lee sale en kcal, para TODOS los lectores
// (panel, detalle, Misi), no solo para el motor.
export function normalizarFila(f) {
  if ((f?.metric === "active_energy" || f?.metric === "basal_energy_burned") && String(f.unit || "").toLowerCase() === "kj" && Number.isFinite(f.value)) {
    return { ...f, value: f.value / 4.184, unit: "kcal" };
  }
  return f;
}

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
    return { filas: filas.map(normalizarFila), entrenos, error: null };
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
    error_guardando: "El servidor no pudo guardar este trozo. Vuelve a intentarlo en un momento.",
    demasiadas_peticiones: "Demasiados envíos seguidos. Espera unos minutos y reintenta.",
  })[codigo] || "No se pudo guardar este trozo.";
}

// ── Histórico completo de UNA métrica ───────────────────────────────────────
// Para la vista "Todo" del detalle: solo esa métrica y esa persona, bajo
// demanda (al pulsar "Todo"). Años de pasos son ~2.000 filas: 2-3 páginas.
export async function cargarMetricaCompleta(userId, metric) {
  try {
    const filas = await withTimeout(leerTodo((a, b) =>
      supabase.from("health_daily")
        .select("day, metric, value, unit")
        .eq("user_id", userId)
        .eq("metric", metric)
        .order("day", { ascending: true })
        .range(a, b)), 30000, "metrica_completa");
    return { filas: filas.map(normalizarFila), error: null };
  } catch (e) {
    return { filas: [], error: String(e?.message || e) };
  }
}
