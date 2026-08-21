import { uid } from "../utils.js";

// Migraciones puras de FORMA del blob al cargar (idempotentes, deterministas
// salvo el uid() de una notita nueva). No incluye reparaciones async
// (repairGoalIdLinks) ni carry-over — solo transformaciones locales.
//
// Historial:
// - birthdays: array por defecto (v4.x).
// - loveNote (objeto único, v5.6.0) → loveNotes (array/muro, v5.10.0).
//
// Devuelve { data, changed }. Re-ejecutar sobre un blob ya migrado NO cambia nada.
export function migrateBlob(base) {
  let b = base;
  let changed = false;
  if (!b.birthdays) { b = { ...b, birthdays: [] }; changed = true; }
  if (!b.loveNotes) {
    b = { ...b, loveNotes: b.loveNote ? [{ id: uid(), ...b.loveNote }] : [] };
    changed = true;
  }
  return { data: b, changed };
}
