// Consolidación del inicio (v5.9.0): en vez de apilar "próximas fechas" y
// "nuestro momento" siempre, se muestra UNA tarjeta del día: las fechas solo
// cuando hay algo inminente; si no, una idea de plan. Selector puro.

export function hasImminentDate(upcoming = [], withinDays = 7) {
  return (upcoming || []).some(i => typeof i?.daysUntil === "number" && i.daysUntil <= withinDays);
}
