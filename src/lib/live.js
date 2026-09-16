// "En vivo" — estado de un partido en juego, ritmo de sondeo y cuenta atrás.
//
// DOS RESTRICCIONES QUE MANDAN EN EL DISEÑO
//
// 1. El plan gratuito de football-data da 10 peticiones/minuto. Sondear cada
//    5 segundos "porque es en vivo" agota la cuota y deja la app entera sin
//    datos, no solo esta pestaña. El ritmo se decide aquí, con una función
//    pura y probada, no con un `setInterval` puesto a ojo.
//
// 2. La fuente NO siempre publica el minuto de juego (`minute` solo viene en
//    los planes de pago). Un minuto inventado sería peor que no enseñarlo, así
//    que si no viene, no se pinta: se dice el estado, que sí es fiable.
//
// Regla de CLAUDE.md §5 que aplica: "si la fuente no trae un campo, no se
// inventa". Y su corolario aquí: un marcador viejo presentado como "en vivo"
// es peor que no enseñar nada — por eso el estado caducado se marca.

// Estados que football-data considera "partido en curso".
const EN_JUEGO = new Set(["IN_PLAY", "LIVE"]);
const PARADO = new Set(["PAUSED"]);

export function esEnVivo(status) {
  return EN_JUEGO.has(status) || PARADO.has(status);
}

/**
 * Cómo se etiqueta un partido en la tarjeta de en vivo.
 * @returns {{vivo:boolean, texto:string, color:string, pulso:boolean}}
 */
export function estadoEnVivo(m) {
  const s = m?.status;
  if (PARADO.has(s)) return { vivo: true, texto: "Descanso", color: "#fbbf24", pulso: false };
  if (EN_JUEGO.has(s)) {
    // El minuto solo se pinta si la fuente lo manda. Nunca se estima.
    const min = Number.isFinite(m?.minute) ? `${m.minute}'` : "En juego";
    return { vivo: true, texto: min, color: "#f87171", pulso: true };
  }
  if (s === "FINISHED") return { vivo: false, texto: "Final", color: "#34d399", pulso: false };
  if (s === "POSTPONED") return { vivo: false, texto: "Aplazado", color: "#94a3b8", pulso: false };
  if (s === "SUSPENDED") return { vivo: false, texto: "Suspendido", color: "#94a3b8", pulso: false };
  if (s === "CANCELLED") return { vivo: false, texto: "Cancelado", color: "#94a3b8", pulso: false };
  return { vivo: false, texto: "Por jugar", color: "#94a3b8", pulso: false };
}

// Marcador en vivo. Se trabaja sobre la forma ya normalizada de la app (`ft`),
// que football-data va rellenando durante el partido. Si aún no hay marcador y
// el partido está en juego, va 0-0 — eso no es inventar, es el estado inicial.
export function marcadorEnVivo(m) {
  const ft = m?.ft;
  if (Array.isArray(ft) && Number.isFinite(ft[0]) && Number.isFinite(ft[1])) return [ft[0], ft[1]];
  return esEnVivo(m?.status) ? [0, 0] : null;
}

// ── Ritmo de sondeo ─────────────────────────────────────────────────────────

export const RITMO = {
  enVivo: 45e3,        // hay algo en juego: cada 45 s
  inminente: 90e3,     // falta poco para el saque inicial
  reposo: 5 * 60e3,    // nada a la vista: cada 5 min, por si empieza otro
  dormido: 0,          // pestaña oculta: no se sondea NADA
};

// Ventana alrededor del saque inicial en la que merece la pena mirar seguido.
const ANTES = 20 * 60e3;   // 20 min antes
const DESPUES = 150 * 60e3; // 2 h 30 después (90' + descanso + añadido)

/**
 * Cada cuánto volver a preguntar. Puro: se decide con datos, no con un reloj
 * escondido dentro de un efecto.
 * @param {{hayEnVivo:boolean, visible:boolean, proximoTs:number|null, ahora:number}} p
 * @returns {number} ms; 0 = no sondear
 */
export function pollDelay({ hayEnVivo, visible = true, proximoTs = null, ahora = Date.now() }) {
  if (!visible) return RITMO.dormido;
  if (hayEnVivo) return RITMO.enVivo;
  if (proximoTs != null) {
    const falta = proximoTs - ahora;
    if (falta <= ANTES && falta >= -DESPUES) return RITMO.inminente;
  }
  return RITMO.reposo;
}

// ── Cuenta atrás ────────────────────────────────────────────────────────────

// Momento del saque inicial a partir de los campos que guarda la app.
// Sin hora, el partido "empieza" a medianoche local: la fuente aún no la ha
// publicado y no se inventa una.
export function kickoffTs(m) {
  if (!m?.date) return null;
  const [y, mo, d] = m.date.split("-").map(Number);
  if (!y || !mo || !d) return null;
  const [hh, mm] = (m.time || "00:00").split(":").map(Number);
  const t = new Date(y, mo - 1, d, hh || 0, mm || 0, 0, 0).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * "en 2 h 15 min", "en 3 días", "empieza ya".
 * Sin hora publicada devuelve solo el día, para no fingir precisión.
 */
export function cuentaAtras(ts, ahora = Date.now(), { conHora = true } = {}) {
  if (ts == null) return null;
  const falta = ts - ahora;
  if (falta <= 0) return "empieza ya";

  const min = Math.floor(falta / 60e3);
  const horas = Math.floor(min / 60);
  const dias = Math.floor(horas / 24);

  if (dias >= 1) return dias === 1 ? "mañana" : `en ${dias} días`;
  if (!conHora) return "hoy";
  if (horas >= 1) {
    const resto = min - horas * 60;
    return resto ? `en ${horas} h ${resto} min` : `en ${horas} h`;
  }
  return min <= 1 ? "en 1 min" : `en ${min} min`;
}

// ── Orden de la lista ───────────────────────────────────────────────────────

// Mi equipo siempre arriba; luego los que llevan más goles (más emocionantes);
// luego por nombre, para que la lista no baile entre sondeos.
export function ordenarEnVivo(matches = [], teamId = null) {
  const esMio = m => teamId != null && (m.homeId === teamId || m.awayId === teamId);
  const goles = m => {
    const s = marcadorEnVivo(m);
    return s ? s[0] + s[1] : 0;
  };
  return [...matches].sort((a, b) =>
    (esMio(b) ? 1 : 0) - (esMio(a) ? 1 : 0) ||
    goles(b) - goles(a) ||
    String(a.home || "").localeCompare(String(b.home || ""))
  );
}

// Quita duplicados: el partido de mi equipo llega por las dos vías (consulta
// de equipo y consulta de liga) y saldría dos veces en la lista.
export function dedupe(matches = []) {
  const vistos = new Set();
  const out = [];
  for (const m of matches) {
    const k = m?.id != null ? `id:${m.id}` : `${m?.date}|${m?.home}|${m?.away}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(m);
  }
  return out;
}

// ── Frescura del dato en vivo ───────────────────────────────────────────────
// Si la última respuesta buena tiene más de dos minutos, el marcador puede
// haberse quedado atrás. Se avisa en vez de pintarlo como si fuera de ahora.
export const CADUCA_MS = 2 * 60e3;

export function frescura(fetchedAt, ahora = Date.now()) {
  if (!fetchedAt) return { fresco: false, texto: "sin datos" };
  const seg = Math.round((ahora - fetchedAt) / 1000);
  if (seg < 60) return { fresco: true, texto: seg < 10 ? "ahora mismo" : `hace ${seg} s` };
  const min = Math.round(seg / 60);
  return { fresco: ahora - fetchedAt < CADUCA_MS, texto: `hace ${min} min` };
}
