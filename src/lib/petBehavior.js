// Qué está haciendo la mascota AHORA — su día a día, no su evolución.
//
// La evolución (pet.js) sale de los hábitos de semanas. Esto es el momento:
// ¿duerme, entrena, pasea, está triste? Reglas de Fran (28/09/2026):
//
//   · Se despierta 15 min DESPUÉS que su dueño, para poder verla dormir.
//   · Termina de entrenar 15 min después que él: "que parezca que hacemos lo
//     mismo".
//   · Triste SOLO si hace mucho que nadie la toca. Los malos hábitos ya se
//     notan en su forma (retrocede); el ánimo del día a día es de cariño.
//   · El resto del tiempo pasea libre, con los sprites de caminar en la
//     dirección en la que se mueve.
//
// Puro: la hora, el horario de sueño y los entrenos entran como datos, así
// que se prueba sin relojes falsos ni DOM.

export const RETRASO_MS = 15 * 60e3;            // 15 min detrás de su dueño
export const TRISTE_TRAS_MS = 48 * 3600e3;      // 2 días sin caricias
// El entreno llega con la sincronización horaria, DESPUÉS de terminar. Si la
// app lo ve por primera vez poco después, la mascota entrena igualmente 15
// min desde ese momento: "se entera y se pone a entrenar".
const VISTO_TARDE_MAX_MS = 3 * 3600e3;

const DEFECTO = { despertar: 7 * 60, acostarse: -30 };   // 07:00 y 23:30 de la víspera

const mediana = xs => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Horario de sueño típico (mediana de las últimas noches REALES) y la hora
 * de despertar de hoy si ya ha llegado.
 * @param {Array<{day, metric, value}>} filas  de health_daily
 */
export function horarioSueno(filas = [], hoy, { dias = 21 } = {}) {
  const porDia = new Map();
  for (const f of filas) {
    if (!["wake_min", "bed_min", "sleep_asleep"].includes(f.metric)) continue;
    if (!porDia.has(f.day)) porDia.set(f.day, {});
    porDia.get(f.day)[f.metric] = f.value;
  }
  // Solo noches de verdad: con menos de 2 h es una siesta o un registro
  // cortado (mismo umbral que el motor), y su "hora de despertar" mentiría.
  const noches = [...porDia.entries()]
    .filter(([d, v]) => d <= hoy && v.sleep_asleep >= 2 && Number.isFinite(v.wake_min))
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, dias);
  const deHoy = porDia.get(hoy);
  return {
    despertarTipico: mediana(noches.map(([, v]) => v.wake_min)) ?? DEFECTO.despertar,
    acostarseTipico: mediana(noches.filter(([, v]) => Number.isFinite(v.bed_min)).map(([, v]) => v.bed_min)) ?? DEFECTO.acostarse,
    despertarHoy: deHoy?.sleep_asleep >= 2 && Number.isFinite(deHoy.wake_min) ? deHoy.wake_min : null,
    noches: noches.length,
  };
}

const minutoDelDia = d => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
const hhmm = m => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };

/** ¿Está dormida a este minuto del día? */
export function estaDormida(min, { despertarTipico, acostarseTipico, despertarHoy }) {
  const despierta = (despertarHoy ?? despertarTipico) + RETRASO_MS / 60e3;
  const retraso = RETRASO_MS / 60e3;
  if (acostarseTipico < 0) {
    // Se acuesta antes de medianoche: dormida desde esa hora (+15) hasta despertar (+15).
    return min >= 1440 + acostarseTipico + retraso || min < despierta;
  }
  // Se acuesta pasada la medianoche: dormida entre esa hora (+15) y despertar (+15).
  return min >= acostarseTipico + retraso && min < despierta;
}

/**
 * @param {{ ahora: Date, horario, entrenos?: Array<{start_at,end_at,name}>, ultimaCaricia?: number, vistos?: Record<string, number> }} p
 * @returns {{ modo: 'entrenando'|'durmiendo'|'triste'|'libre', motivo: string }}
 */
export function decidirModo({ ahora, horario, entrenos = [], ultimaCaricia = null, vistos = {} }) {
  const t = ahora.getTime();

  // 1. Entrenando: gana a todo — si entrenas a deshoras, entrena contigo.
  for (const w of entrenos) {
    const ini = Date.parse(w.start_at), fin = Date.parse(w.end_at || w.start_at);
    if (!Number.isFinite(ini) || !Number.isFinite(fin)) continue;
    const clave = `${w.start_at}|${w.name}`;
    const visto = vistos[clave];
    // Si se enteró tarde (llegó con la sincronización), entrena 15 min desde que lo vio.
    const base = visto && visto > fin && visto - fin < VISTO_TARDE_MAX_MS ? visto : fin;
    if (t >= ini && t < base + RETRASO_MS) {
      return { modo: "entrenando", motivo: `Entrenando contigo: ${String(w.name || "entreno").toLowerCase()}.` };
    }
  }

  // 2. Durmiendo: 15 min detrás de ti al acostarte y al despertar.
  if (estaDormida(minutoDelDia(ahora), horario)) {
    const despierta = (horario.despertarHoy ?? horario.despertarTipico) + RETRASO_MS / 60e3;
    return { modo: "durmiendo", motivo: `Duerme. Se despertará sobre las ${hhmm(despierta)}, un poco después que tú.` };
  }

  // 3. Triste: solo por falta de cariño.
  if (ultimaCaricia != null && t - ultimaCaricia > TRISTE_TRAS_MS) {
    const dias = Math.floor((t - ultimaCaricia) / 864e5);
    return { modo: "triste", motivo: `Hace ${dias} días que no le haces caso. Tócala.` };
  }

  return { modo: "libre", motivo: "Paseando por ahí." };
}

// ── El paseo ────────────────────────────────────────────────────────────────
// La mascota elige un punto al azar y va hacia él con el sprite de caminar
// que corresponde a la dirección; al llegar se para un rato (idle feliz).
export const LIMITES = { x: [0.1, 0.9], y: [0.3, 0.82] };
export const VELOCIDAD_PX_S = 38;

/**
 * @param {{x,y}} pos       posición actual, 0..1 dentro del hábitat
 * @param {() => number} rng
 * @param {{ ancho: number, alto: number }} caja   px, para que la dirección sea la VISUAL
 * @param {Set<string>} anims   animaciones disponibles en esta etapa
 * @returns {{ destino:{x,y}, anim:string, ms:number, pausaMs:number }}
 */
export function planificarPaseo(pos, rng, caja, anims) {
  const pausaMs = 1500 + rng() * 3000;
  // A veces solo se queda donde está, mirando: no todo es andar.
  if (rng() < 0.2) return { destino: pos, anim: anims.has("feliz") ? "feliz" : [...anims][0], ms: 0, pausaMs: pausaMs + 1500 };

  const destino = {
    x: LIMITES.x[0] + rng() * (LIMITES.x[1] - LIMITES.x[0]),
    y: LIMITES.y[0] + rng() * (LIMITES.y[1] - LIMITES.y[0]),
  };
  const dx = (destino.x - pos.x) * caja.ancho, dy = (destino.y - pos.y) * caja.alto;
  let anim = Math.abs(dx) >= Math.abs(dy)
    ? (dx >= 0 ? "caminar_derecha" : "caminar_izquierda")
    : (dy >= 0 ? "caminar_frente" : "caminar_atras");
  if (!anims.has(anim)) anim = anims.has("feliz") ? "feliz" : [...anims][0];
  const ms = Math.round((Math.hypot(dx, dy) / VELOCIDAD_PX_S) * 1000);
  return { destino, anim, ms, pausaMs };
}

// La animación de "reacción" al tocarla: la más alegre que tenga la etapa.
export function animCaricia(anims) {
  for (const id of ["alegria", "celebracion", "feliz"]) if (anims.has(id)) return id;
  return [...anims][0];
}

// Generador pseudoaleatorio con semilla (para tests y paseos reproducibles).
export function rngConSemilla(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
