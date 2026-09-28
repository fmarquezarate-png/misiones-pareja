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
//
// Versión 2 (28/09/2026). La primera elegía un punto al azar y cruzaba en
// DIAGONAL con el sprite de la dirección dominante: iba "por aquí y por allá
// a lo loco" (Fran), y en las diagonales el dibujo no coincidía con el
// movimiento. Ahora el paseo tiene una lógica que se puede seguir:
//
//   · Tramos RECTOS, nunca diagonales: o se mueve en horizontal (izquierda /
//     derecha, lo normal) o en profundidad (hacia ti / alejándose, poco y
//     corto). Así el sprite siempre coincide con lo que hace.
//   · INERCIA: tiende a seguir en la dirección que llevaba; da la vuelta en
//     los bordes o, de vez en cuando, porque sí.
//   · Anda sobre el suelo: la profundidad cambia poco, en pasos cortos.
//   · Entre tramos, se para y mira (idle); a veces se queda un buen rato.
export const LIMITES = { x: [0.04, 0.96], y: [0.5, 0.95] };
export const VELOCIDAD_PX_S = 34;

// Ajuste v2.1 (Fran, 28/09): "está mucho rato celebrando y camina poco".
// Dos causas medidas: (1) la pausa usaba la animación "feliz", que en las
// hojas de sprites son 20 fotogramas de CELEBRACIÓN (saltos, brillos,
// corazones), no un reposo; (2) las pausas duraban más que los tramos.
// Ahora la pausa normal es QUIETA — de pie, mirando hacia donde iba, con el
// primer fotograma de caminar y una respiración suave — y solo de vez en
// cuando celebra. Un test mide que camine la mayor parte del tiempo.
const PROB = { quedarse: 0.05, profundidad: 0.12, seguir: 0.75, celebrar: 0.12 };
const MIN_TRAMO = 0.1;   // fracción del área útil: menos que esto es un tic, no un paso

// Pausa entre tramos: quieta casi siempre; a veces, un momento de alegría.
function pausa(rng, anims) {
  if (anims.has("feliz") && rng() < PROB.celebrar) return { tipo: "feliz", ms: 2200 + rng() * 800 };
  return { tipo: "quieto", ms: 500 + rng() * 1000 };
}

/**
 * @param {{x,y}} pos   posición actual, 0..1 dentro del área útil del hábitat
 * @param {() => number} rng
 * @param {{ ancho: number, alto: number }} caja   px del área útil
 * @param {Set<string>} anims   animaciones disponibles en esta etapa
 * @param {number} dir   dirección horizontal que llevaba: 1 derecha, -1 izquierda
 * @returns {{ destino:{x,y}, anim:string, ms:number, pausa:{tipo:'quieto'|'feliz', ms:number}, pausaMs:number, dir:number }}
 */
export function planificarPaseo(pos, rng, caja, anims, dir = 1) {
  const idle = anims.has("feliz") ? "feliz" : [...anims][0];
  const tiene = a => (anims.has(a) ? a : idle);
  const r = rng();
  const conPausa = o => { const p = pausa(rng, anims); return { ...o, pausa: p, pausaMs: p.ms }; };

  // Quedarse un momento donde está (quieta).
  if (r < PROB.quedarse) {
    return conPausa({ destino: pos, anim: tiene(dir > 0 ? "caminar_derecha" : "caminar_izquierda"), ms: 0, dir });
  }

  // Un paso corto hacia ti o alejándose (cambiar de "carril").
  if (r < PROB.quedarse + PROB.profundidad) {
    const [lo, hi] = LIMITES.y;
    const paso = 0.12 + rng() * 0.14;
    // Hacia el lado donde quepa un paso de verdad (mismo motivo: nada de tics).
    const cabeAbajo = hi - pos.y >= MIN_TRAMO, cabeArriba = pos.y - lo >= MIN_TRAMO;
    const haciaTi = cabeAbajo && (!cabeArriba || rng() < 0.5);
    // Sujeto a los límites: con la franja estrecha, un paso largo puede no
    // caber hacia ningún lado (en el centro, ni +0,26 ni −0,26) y se salía.
    const y = Math.min(hi, Math.max(lo, haciaTi ? pos.y + paso : pos.y - paso));
    const dy = Math.abs(y - pos.y) * caja.alto;
    return conPausa({
      destino: { x: pos.x, y },
      anim: tiene(haciaTi ? "caminar_frente" : "caminar_atras"),
      ms: Math.round((dy / VELOCIDAD_PX_S) * 1000),
      dir,
    });
  }

  // Tramo horizontal, con inercia; en la pared, llega y gira.
  const [lo, hi] = LIMITES.x;
  let d = rng() < PROB.seguir ? dir : -dir;
  // Si hacia ahí no le cabe un tramo decente, se da la vuelta: pegada a la
  // pared, recortar el tramo dejaba "pasitos" de 0,2 s que se veían como un tic.
  const cabe = dd => (dd > 0 ? hi - pos.x : pos.x - lo) >= MIN_TRAMO;
  if (!cabe(d)) d = -d;
  const largo = 0.25 + rng() * 0.3;
  const x = Math.min(hi, Math.max(lo, pos.x + d * largo));
  const dx = Math.abs(x - pos.x) * caja.ancho;
  return conPausa({
    destino: { x, y: pos.y },
    anim: tiene(d > 0 ? "caminar_derecha" : "caminar_izquierda"),
    ms: Math.round((dx / VELOCIDAD_PX_S) * 1000),
    dir: d,
  });
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
