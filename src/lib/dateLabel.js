// Etiqueta humana de una fecha de misión (v5.27.0).
//
// Las misiones guardan la fecha como "YYYY-MM-DD" y la app la pintaba TAL CUAL
// en ocho sitios (tarjeta de misión, inicio, pendientes, búsqueda, metas, ánimo,
// vista de invitado, menú). Nadie lee "2026-09-12" de un vistazo: es el dato más
// consultado de la app y estaba en formato de base de datos.
//
// OJO con el parseo: `new Date("2026-09-12")` se interpreta como medianoche UTC,
// así que en husos negativos devuelve el día ANTERIOR. Aquí se construye la
// fecha en local, componente a componente. Todo puro.

const DIAS  = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// "2026-09-12" → Date local (12 sep a las 00:00 de TU huso), o null si no vale.
export function parseLocalDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(y, mo - 1, d);
  // Rechaza fechas imposibles ("2026-02-31" desbordaría a marzo).
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

const dayStart = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();

// Etiqueta corta y humana. Cerca en el tiempo → palabra; lejos → fecha.
//   hoy · mañana · ayer · "sáb 12" (esta semana) · "sáb 12 sep" · "12 sep 2027"
export function humanDate(iso, today = new Date()) {
  const d = parseLocalDate(iso);
  if (!d) return String(iso || "");
  const diff = Math.round((dayStart(d) - dayStart(today)) / 86400000);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  const dow = DIAS[d.getDay()], day = d.getDate(), mes = MESES[d.getMonth()];
  if (d.getFullYear() !== today.getFullYear()) return `${day} ${mes} ${d.getFullYear()}`;
  // Dentro de la semana próxima el mes sobra: "vie 12" ya es inequívoco.
  if (diff > 1 && diff <= 6) return `${dow} ${day}`;
  return `${dow} ${day} ${mes}`;
}

// Fecha + hora en una sola etiqueta: "mañana · 18:30".
export function humanDateTime(iso, time, today = new Date()) {
  const label = humanDate(iso, today);
  return time ? `${label} · ${time}` : label;
}
