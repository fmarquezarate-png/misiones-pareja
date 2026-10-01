// Catálogo de las métricas que manda Health Auto Export — puro, sin red.
//
// Una sola fuente para el nombre, la dirección («mejor» si sube/baja), el
// formato, el icono y si es un TOTAL del día. Antes vivía dentro de healthApi.js
// (que carga Supabase) y el panel solo conocía 8 métricas escritas a mano: las
// otras 20 que llegan no se podían poner como tarjeta (01/10/2026).

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
// El sueño total NO tiene dirección: dormir 12–17 h no es «tu mejor día» — en el
// historial de Fran fueron semanas de lesión y bajón (30/09/2026). Ni más ni menos
// es mejor por sí solo; lo que cuenta es la meta de horas.
export const DIRECCION = {
  step_count: "sube", active_energy: "sube", apple_exercise_time: "sube", apple_stand_hour: "sube", apple_stand_time: "sube",
  flights_climbed: "sube", walking_running_distance: "sube", distance_walking_running: "sube", mindful_minutes: "sube",
  sleep_deep: "sube", sleep_rem: "sube", sleep_awake: "baja",
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

// Totales del día: se acumulan durante el día, así que la media usa días cerrados.
export const TOTALES_DIA = new Set([
  "step_count", "active_energy", "basal_energy_burned", "apple_exercise_time", "apple_stand_hour", "apple_stand_time",
  "walking_running_distance", "distance_walking_running", "flights_climbed", "mindful_minutes", "time_in_daylight",
]);

const ICONOS = [
  [/^sleep_|^bed_min|^wake_min/, "🌙"], [/heart|pulso/, "❤️"], [/oxygen/, "🫁"], [/respirat/, "🌬️"],
  [/energy|kcal/, "🔥"], [/step_count|walking_step/, "👟"], [/distance|walking_speed|six_minute/, "🛣️"],
  [/flights|stair/, "🪜"], [/asymmetry|double_support/, "🚶"], [/audio/, "🎧"], [/weight|body_mass|body_fat|height/, "⚖️"],
  [/vo2/, "🫀"], [/mindful/, "🧘"], [/stand/, "🧍"], [/exercise/, "🏃"], [/daylight|uv_/, "☀️"],
];
export const iconoDe = metric => (ICONOS.find(([re]) => re.test(metric)) || [null, "📈"])[1];
export const nombreDe = metric => NOMBRES_METRICA[metric] || metric.replace(/_/g, " ");

// Métricas que no tiene sentido ofrecer como tarjeta (marcas internas, constantes).
export const NO_TARJETA = /^hr_pico_|^height$|^body_fat_percentage$/;
