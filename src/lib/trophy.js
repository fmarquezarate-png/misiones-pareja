// Copa de los agradecimientos (v5.24.0). Cada gratitud es una "placa" atornillada
// al pedestal de una copa, como los campeones grabados en la Libertadores.
// Aquí vive solo la lógica PURA: cuántas placas caben, en qué ángulo va cada una
// y quién agradece a quién. El 3D es CSS puro en TrophyView.jsx.
import { isMineEntry } from "./identity.js";

// Placas por anillo y anillos del pedestal. 8×3 = 24 placas visibles en la copa;
// el resto se consulta en la lista de abajo (el blob guarda hasta 200).
export const RING_CAPACITY = 8;
export const MAX_RINGS = 3;

// Reparte las gratitudes (más reciente primero) por los anillos del pedestal.
// Cada anillo se desfasa medio hueco respecto al anterior para que las placas
// queden al tresbolillo y no formen columnas.
export function trophyLayout(gratitudes = [], { perRing = RING_CAPACITY, maxRings = MAX_RINGS } = {}) {
  const shown = (gratitudes || []).filter(g => g && g.id).slice(0, perRing * maxRings);
  const step = 360 / perRing;
  return shown.map((g, i) => {
    const ring = Math.floor(i / perRing);
    const slot = i % perRing;
    return { g, ring, slot, angle: slot * step + (ring % 2 ? step / 2 : 0) };
  });
}

// Cuántas gratitudes no caben en la copa y solo aparecen en la lista.
export function overflowCount(gratitudes = [], { perRing = RING_CAPACITY, maxRings = MAX_RINGS } = {}) {
  return Math.max(0, (gratitudes || []).filter(g => g && g.id).length - perRing * maxRings);
}

// "De quién y para quién". Una gratitud siempre va dirigida a la pareja, así que
// el destinatario se deduce de la autoría (por person-id, con fallback a nombre).
export function gratitudeParties(g, { myName = "", myPersonId = null, partnerName = "" } = {}) {
  const mine = isMineEntry(g, myName, myPersonId);
  const from = mine ? (myName || g?.fromName || "Tú") : (g?.fromName || partnerName || "Tu pareja");
  const to = mine ? (partnerName || "Tu pareja") : (myName || "Tú");
  return { from, to, mine };
}

// Rotación mínima (en grados, con signo) para llevar la placa `angle` al frente
// desde la rotación actual `currentY`. Evita el "giro largo" de 350° cuando
// bastaba con -10°: la copa siempre gira por el camino corto.
export function rotationToFace(angle, currentY) {
  const target = -angle;
  let delta = (target - currentY) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return currentY + delta;
}
