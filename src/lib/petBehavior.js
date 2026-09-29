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

// Sábado y domingo se duermen a otras horas. Con la mediana de TODAS las
// noches, un horario bimodal (07:00 entre semana, 09:30 el finde) daba una
// hora intermedia que no era la de ningún día — la mascota se despertaba
// "a deshoras" los dos tipos de día. Ahora se usa la mediana de los días del
// MISMO tipo (laborable/finde) que el de hoy (para despertar) y el de mañana
// (para acostarse: la noche que empieza esta tarde termina mañana).
const esFinde = dia => { const d = new Date(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10)).getDay(); return d === 0 || d === 6; };
const diaSiguiente = dia => { const d = new Date(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10) + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const MIN_DEL_TIPO = 5;   // noches del mismo tipo para fiarse; con menos, se usan todas

/**
 * Horario de sueño típico (mediana de las últimas noches REALES, del mismo tipo
 * de día) y la hora de despertar de hoy si ya ha llegado.
 * @param {Array<{day, metric, value}>} filas  de health_daily
 */
export function horarioSueno(filas = [], hoy, { dias = 42 } = {}) {
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
  const del = (tipoFinde, campo) => {
    const propias = noches.filter(([d, v]) => esFinde(d) === tipoFinde && Number.isFinite(v[campo])).map(([, v]) => v[campo]);
    const todas = noches.filter(([, v]) => Number.isFinite(v[campo])).map(([, v]) => v[campo]);
    return mediana(propias.length >= MIN_DEL_TIPO ? propias : todas);
  };
  const deHoy = porDia.get(hoy);
  return {
    despertarTipico: del(esFinde(hoy), "wake_min") ?? DEFECTO.despertar,
    acostarseTipico: del(esFinde(diaSiguiente(hoy)), "bed_min") ?? DEFECTO.acostarse,
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
// Versión 3 (29/09/2026, auditoría de la mascota). Lo que la v2 no resolvía:
//
//   · Velocidad CONSTANTE (34 px/s) para cualquier etapa y sprite: los pies
//     "patinaban" — el dibujo daba una zancada de un tamaño y el cuerpo
//     avanzaba otro. Ahora la velocidad SALE del sprite: un ciclo de caminar
//     (frames/fps) avanza una zancada (fracción del ancho del cuerpo).
//   · Tramos de duración arbitraria: el ciclo se cortaba a medias al pararse.
//     Ahora cada tramo dura un NÚMERO ENTERO de ciclos: termina justo cuando
//     el sprite vuelve a su primer fotograma (la postura de pie).
//   · Cruces de pared a pared. Ahora un tramo son 2–4 ciclos (unos 0,5–1,5
//     cuerpos), nunca la mitad del hábitat de golpe.
//
// Se mantiene lo bueno de la v2: tramos RECTOS (el sprite coincide con lo que
// hace), inercia, poca profundidad, y pausas quietas entre tramos.
//
// Coordenadas: 0..1 sobre el área útil por la que pisa (x: de pared a pared,
// y: del horizonte a la parte baja), medidas en el punto de apoyo del cuerpo.
export const LIMITES = { x: [0, 1], y: [0, 1] };
export const CICLOS = { min: 2, max: 4, profundidad: 2 };
export const MARCHA_POR_DEFECTO = { cicloMs: 800, zancadaPx: 30 };

// Pausa normal QUIETA; solo de vez en cuando, un momento de alegría (Fran:
// "mucho rato celebrando y poco caminando" — medido, hay test).
const PROB = { quedarse: 0.05, profundidad: 0.12, seguir: 0.75, celebrar: 0.12 };

// `energia` (0,6–1,1, de petEstado.js): con poca energía descansa más entre
// tramos y celebra menos; con mucha, casi no para. Se nota en el ritmo, no en el ánimo.
function pausa(rng, anims, energia = 1) {
  const e = Math.min(1.1, Math.max(0.5, energia));
  if (anims.has("feliz") && rng() < PROB.celebrar * Math.min(1, e)) return { tipo: "feliz", ms: 2200 + rng() * 800 };
  return { tipo: "quieto", ms: Math.round((500 + rng() * 1000) / (e * e)) };
}

/**
 * Marcha de una etapa: cuánto dura su ciclo de caminar y cuánto avanza en él.
 * @param {object} etapaDef  stage del manifest
 * @param {number} tam       px del sprite en pantalla
 */
export function marchaDe(etapaDef, tam) {
  const a = etapaDef?.anims?.caminar_derecha || etapaDef?.anims?.caminar_izquierda;
  if (!a?.frames || !a?.fps) return { ...MARCHA_POR_DEFECTO };
  const ancho = Math.max(0.2, (etapaDef.cuerpo?.x1 ?? 0.9) - (etapaDef.cuerpo?.x0 ?? 0.1)) * tam;
  return { cicloMs: Math.round((a.frames / a.fps) * 1000), zancadaPx: Math.max(8, Math.round(ancho * 0.7)) };
}

/**
 * @param {{x,y}} pos   posición actual (0..1 del área útil)
 * @param {() => number} rng
 * @param {{ ancho: number, alto: number }} caja   px del área útil
 * @param {Set<string>} anims   animaciones disponibles en esta etapa
 * @param {number} dir   dirección horizontal que llevaba: 1 derecha, -1 izquierda
 * @param {{cicloMs:number, zancadaPx:number}} marcha
 * @param {number} energia   ritmo del día (petEstado.energia); 1 = normal
 * @returns {{ destino:{x,y}, anim:string, ms:number, ciclos:number, pausa:{tipo:'quieto'|'feliz', ms:number}, pausaMs:number, dir:number }}
 */
export function planificarPaseo(pos, rng, caja, anims, dir = 1, marcha = MARCHA_POR_DEFECTO, energia = 1) {
  const idle = anims.has("feliz") ? "feliz" : [...anims][0];
  const tiene = a => (anims.has(a) ? a : idle);
  const { cicloMs, zancadaPx } = marcha;
  const conPausa = o => { const p = pausa(rng, anims, energia); return { ciclos: 0, ...o, pausa: p, pausaMs: p.ms }; };
  // Ciclos completos que caben en `espacioPx` (el destino siempre cae en una zancada exacta).
  const caben = espacioPx => Math.floor(espacioPx / zancadaPx + 1e-9);
  const r = rng();

  // Quedarse un momento donde está (quieta, mirando hacia donde iba).
  if (r < PROB.quedarse) {
    return conPausa({ destino: pos, anim: tiene(dir > 0 ? "caminar_derecha" : "caminar_izquierda"), ms: 0, dir });
  }

  // Un paso corto hacia ti o alejándose (cambiar de "carril").
  if (r < PROB.quedarse + PROB.profundidad) {
    const abajo = caben((LIMITES.y[1] - pos.y) * caja.alto), arriba = caben((pos.y - LIMITES.y[0]) * caja.alto);
    const haciaTi = abajo >= 1 && (arriba < 1 || rng() < 0.5);
    const n = Math.min(CICLOS.profundidad, haciaTi ? abajo : arriba);
    if (n >= 1) {
      const dy = (n * zancadaPx) / caja.alto;
      return conPausa({
        destino: { x: pos.x, y: Math.min(LIMITES.y[1], Math.max(LIMITES.y[0], haciaTi ? pos.y + dy : pos.y - dy)) },
        anim: tiene(haciaTi ? "caminar_frente" : "caminar_atras"),
        ms: n * cicloMs, ciclos: n, dir,
      });
    }
    // sin sitio en profundidad: sigue al tramo horizontal
  }

  // Tramo horizontal, con inercia. Si en su dirección no caben 2 ciclos, gira.
  let d = rng() < PROB.seguir ? dir : -dir;
  const espacio = dd => caben((dd > 0 ? LIMITES.x[1] - pos.x : pos.x - LIMITES.x[0]) * caja.ancho);
  if (espacio(d) < CICLOS.min) d = -d;
  const n = Math.min(CICLOS.max, espacio(d));
  if (n < 1) return conPausa({ destino: pos, anim: tiene(d > 0 ? "caminar_derecha" : "caminar_izquierda"), ms: 0, dir: d });
  const min = Math.min(CICLOS.min, n);
  const ciclos = min + Math.floor(rng() * (n - min + 1));
  const x = Math.min(LIMITES.x[1], Math.max(LIMITES.x[0], pos.x + d * (ciclos * zancadaPx) / caja.ancho));
  return conPausa({
    destino: { x, y: pos.y },
    anim: tiene(d > 0 ? "caminar_derecha" : "caminar_izquierda"),
    ms: ciclos * cicloMs, ciclos, dir: d,
  });
}

// ── Qué sprite toca ─────────────────────────────────────────────────────────
//
// UNA sola función decide el dibujo (antes lo hacían tres sitios, y el
// `animId` del paseo ganaba al modo: si una animación de caminar seguía
// "activa" al empezar a dormir o entrenar, se veía andar dormida).
// Prioridad: caricia > modo (duerme/entrena/triste) > paseo > reposo.
// `quieto` = fotograma de pie (el primero de caminar) en vez de celebrar: el
// reposo por defecto ya no es la celebración (esa salía al montar).
export function elegirSprite({ modo, caricia, animId, anims, reposo }) {
  if (caricia && anims.has(caricia)) return { id: caricia, loop: false, quieto: false };
  if (modo !== "libre") return { id: null, loop: true, quieto: false };            // lo resuelve elegirAnimacion(modo)
  if (animId && anims.has(animId)) return { id: animId, loop: true, quieto: false };
  const parado = ["caminar_frente", "caminar_derecha"].find(a => anims.has(a));
  return parado ? { id: parado, loop: true, quieto: true } : { id: null, loop: true, quieto: false, reposo };
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
