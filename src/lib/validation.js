// Validación estructural del blob de datos de la app.
// Mantener aquí (separado de supabase.js) para poder testear sin instanciar el cliente.

export function isValidAppData(d) {
  if (!d || typeof d !== "object") return false;
  if (!d.weeks || typeof d.weeks !== "object" || Array.isArray(d.weeks)) return false;
  if (!d.settings || typeof d.settings !== "object" || Array.isArray(d.settings)) return false;
  if (d.goals !== undefined && !Array.isArray(d.goals)) return false;
  for (const week of Object.values(d.weeks)) {
    if (!week || typeof week !== "object") return false;
    if (week.missions !== undefined && !Array.isArray(week.missions)) return false;
  }
  return true;
}
