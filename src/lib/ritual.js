// Ritual de planificación conjunta (3.4) — OPT-IN desde Perfil. Un momento
// semanal, en el día que elija la pareja, para planificar la semana juntos.
// Lógica pura y testeable; el estado vive en settings.ritual del blob.

export const RITUAL_DAYS = [
  { id: 1, label: "Lunes" },
  { id: 2, label: "Martes" },
  { id: 3, label: "Miércoles" },
  { id: 4, label: "Jueves" },
  { id: 5, label: "Viernes" },
  { id: 6, label: "Sábado" },
  { id: 0, label: "Domingo" },
];

export const RITUAL_STEPS = [
  { id: "review", emoji: "🔍", text: "Repasen la semana que pasó — ¿qué quedó pendiente?" },
  { id: "add",    emoji: "📝", text: "Añadan las misiones de esta semana" },
  { id: "agenda", emoji: "📅", text: "Agenden lo importante (citas, planes, eventos)" },
  { id: "us",     emoji: "💞", text: "Elijan un momento solo para ustedes" },
];

export function ritualDefaults() {
  return { enabled: false, day: 0, lastDoneWeek: null };
}

// ¿Mostrar el banner hoy? Solo si está activado, es el día elegido, y no se
// completó ya esta misma semana (evita insistir tras terminarlo).
export function shouldShowPlanningRitual(ritual, date, currentWeekKey) {
  if (!ritual?.enabled) return false;
  if (!date || typeof date.getDay !== "function") return false;
  if (date.getDay() !== (ritual.day ?? 0)) return false;
  return ritual.lastDoneWeek !== currentWeekKey;
}
