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

// Etiqueta corta de fecha para el muro: hoy / ayer / d de mes.
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
export function noteDateLabel(at, now = new Date()) {
  if (!at) return "";
  const d = new Date(at);
  if (isNaN(d.getTime())) return "";
  const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((dayStart(now) - dayStart(d)) / 86400000);
  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "ayer";
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
