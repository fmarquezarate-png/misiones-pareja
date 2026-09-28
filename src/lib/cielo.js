// El cielo del hábitat: el MISMO sol y el mismo tiempo que tiene su dueño.
//
// Dos fuentes, a propósito separadas:
//  · La posición del sol se CALCULA aquí (fórmula astronómica de la NOAA,
//    simplificada): no necesita red ni API. Amanecer, día, atardecer y noche
//    son siempre correctos para la ubicación, aunque no haya conexión.
//  · El tiempo (nubes, lluvia, nieve, niebla) viene de Open-Meteo (sin
//    clave, con CORS). Si falla, el cielo queda despejado y se DICE que no
//    hay datos del tiempo — nunca se pinta un clima inventado (CLAUDE.md §5,
//    procedencia visible).

const RAD = Math.PI / 180;

/** Elevación del sol en grados (negativa = bajo el horizonte) y ángulo horario. */
export function sol(fecha, lat, lon) {
  const d = fecha.getTime() / 864e5 + 2440587.5 - 2451545.0;          // días desde J2000
  const g = ((357.529 + 0.98560028 * d) % 360) * RAD;                // anomalía media
  const q = (280.459 + 0.98564736 * d) % 360;                        // longitud media
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD; // longitud eclíptica
  const e = (23.439 - 0.00000036 * d) * RAD;                         // oblicuidad
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / RAD / 15;   // horas
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  let ha = ((gmst + lon / 15 - ra) * 15) % 360;                      // grados
  if (ha > 180) ha -= 360;
  if (ha < -180) ha += 360;
  const elev = Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha * RAD)) / RAD;
  return { elevacion: elev, anguloHorario: ha };
}

/** noche · crepúsculo · dorada (amanecer/atardecer) · día */
export function fase({ elevacion, anguloHorario }) {
  const manana = anguloHorario < 0;
  if (elevacion < -6) return { id: "noche", nombre: "noche" };
  if (elevacion < 0) return { id: "crepusculo", nombre: manana ? "antes del amanecer" : "anochecer" };
  if (elevacion < 10) return { id: "dorada", nombre: manana ? "amanecer" : "atardecer" };
  return { id: "dia", nombre: "de día" };
}

// Códigos WMO que usa Open-Meteo → lo que se pinta.
export function clima(codigo) {
  const c = Number(codigo);
  if (!Number.isFinite(c)) return { id: "desconocido", texto: "sin datos del tiempo", nubes: 0 };
  if (c === 0) return { id: "despejado", texto: "despejado", nubes: 0 };
  if (c === 1) return { id: "poco_nuboso", texto: "poco nuboso", nubes: 1 };
  if (c === 2) return { id: "nuboso", texto: "nuboso", nubes: 2 };
  if (c === 3) return { id: "cubierto", texto: "cubierto", nubes: 3, gris: true };
  if (c === 45 || c === 48) return { id: "niebla", texto: "niebla", nubes: 1, niebla: true, gris: true };
  if (c >= 51 && c <= 57) return { id: "llovizna", texto: "llovizna", nubes: 3, lluvia: 1, gris: true };
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { id: "lluvia", texto: c >= 65 || c === 82 ? "lluvia fuerte" : "lluvia", nubes: 3, lluvia: c >= 65 || c === 82 ? 2 : 1, gris: true };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { id: "nieve", texto: "nieve", nubes: 3, nieve: true, gris: true };
  if (c >= 95) return { id: "tormenta", texto: "tormenta", nubes: 3, lluvia: 2, tormenta: true, gris: true };
  return { id: "nuboso", texto: "nuboso", nubes: 2 };
}

// Colores del cielo y del suelo según la fase y el tiempo. `agua` para el
// hábitat de Nix, que nada en vez de andar.
const PALETA = {
  dia:        { arriba: "#2f7fc4", abajo: "#9fd3f5", tierra: "#4f8a4b", agua: "#2b7bb9" },
  dorada:     { arriba: "#3b4a8c", abajo: "#f5a37f", tierra: "#5a6b3c", agua: "#3a6aa0" },
  crepusculo: { arriba: "#1e1b4b", abajo: "#6d4c7d", tierra: "#2c3a2e", agua: "#1f3f66" },
  noche:      { arriba: "#070a1f", abajo: "#1a1e3f", tierra: "#16221c", agua: "#0d1f3a" },
};
const GRIS = { dia: ["#6f7d8c", "#aab5c0"], dorada: ["#555a72", "#a58f86"], crepusculo: ["#2a2838", "#4a4252"], noche: ["#0c0e18", "#1e2130"] };

export function paleta(faseId, cl = {}, { agua = false } = {}) {
  const p = PALETA[faseId] || PALETA.dia;
  const [arriba, abajo] = cl.gris ? GRIS[faseId] || GRIS.dia : [p.arriba, p.abajo];
  return { arriba, abajo, suelo: agua ? p.agua : p.tierra };
}

/** Posición del disco del sol en el hábitat (0..1), o null si no se ve. */
export function discoSol({ elevacion, anguloHorario }) {
  if (elevacion < -2) return null;
  // Sale por la izquierda (este) y se pone por la derecha (oeste).
  const x = Math.min(0.92, Math.max(0.08, 0.5 + anguloHorario / 200));
  const y = Math.min(0.5, Math.max(0.06, 0.52 - (elevacion / 75) * 0.46));
  return { x, y };
}

export const UBICACION_DEFECTO = { lat: 41.39, lon: 2.17, nombre: "Barcelona", porDefecto: true };
