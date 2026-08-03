// Notita de amor (4.2): un mensajito corto, fijado en el inicio, que un miembro
// deja para el otro. Vive en data.loveNote = { text, fromName, at } (una sola
// notita "actual"; la nueva reemplaza a la anterior). Construcción pura.

export const LOVE_NOTE_MAX = 140;

// Devuelve la notita normalizada, o null si el texto está vacío (= quitar).
export function makeLoveNote(text, fromName, at) {
  const t = (text || "").trim();
  if (!t) return null;
  return { text: t.slice(0, LOVE_NOTE_MAX), fromName: fromName || "", at: at || null };
}
