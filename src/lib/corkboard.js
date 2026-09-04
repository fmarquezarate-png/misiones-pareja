// Pizarra de corcho con post-its (v5.24.0). El aspecto de cada nota (color de
// papel e inclinación) se deriva de su id de forma DETERMINISTA: así una nota
// siempre se ve igual y no "baila" al re-renderizar. La chincheta sí la elige
// la persona al escribirla. Todo puro y testeable.

export const PIN_COLORS = [
  { id: "red",    label: "Rojo",     hex: "#e5484d" },
  { id: "blue",   label: "Azul",     hex: "#3b82f6" },
  { id: "yellow", label: "Amarillo", hex: "#f5b800" },
  { id: "green",  label: "Verde",    hex: "#16a34a" },
  { id: "purple", label: "Morado",   hex: "#a855f7" },
  { id: "pink",   label: "Rosa",     hex: "#ec4899" },
];

// Papeles pastel de post-it (el color no lo elige el usuario: se reparte solo).
export const PAPER_COLORS = ["#fff7a0", "#ffd6e7", "#c9f7d8", "#cfe8ff", "#ffe2bd", "#ead9ff"];

// Hash estable de un id (djb2-ish). Puro.
export function hashId(id) {
  const s = String(id ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Aspecto del post-it a partir del id: papel + inclinación (-3..3 grados).
export function noteVisual(id) {
  const h = hashId(id);
  return {
    paper: PAPER_COLORS[h % PAPER_COLORS.length],
    rotation: ((h >>> 3) % 7) - 3,
  };
}

// Hex de una chincheta por id de color (con fallback al primero).
export function pinHex(pinColor) {
  return (PIN_COLORS.find(p => p.id === pinColor) || PIN_COLORS[0]).hex;
}

// Normaliza el id de chincheta antes de guardarlo en el blob: nunca se persiste
// un valor arbitrario venido de la UI (o de una versión futura de la app).
export function normalizePin(pinColor) {
  return PIN_COLORS.some(p => p.id === pinColor) ? pinColor : PIN_COLORS[0].id;
}
