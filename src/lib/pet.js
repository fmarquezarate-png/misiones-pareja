// Motor de la mascota virtual — puro, determinista y probado.
//
// IDEA CENTRAL: la mascota NO guarda su estado. Se RECALCULA reproduciendo tu
// historial de salud día a día desde que nació. Así:
//   · no hay estado que se desincronice entre los dos móviles,
//   · si llega tarde un día de datos (el móvil no envió), el recálculo lo
//     incorpora solo,
//   · y si mañana se ajusta una regla, se aplica a todo el pasado sin migrar
//     nada. Lo único que se guarda es la especie, el día de nacimiento y las
//     metas de cada uno.
//
// REGLAS ACORDADAS CON FRAN (28/09/2026):
//   1. Cada persona elige su mascota al empezar, y SOLO se alimenta de SUS datos.
//   2. Metas editables, diarias y semanales.
//   3. Puede ponerse triste y DESEVOLUCIONAR, pero nunca enferma ni muere.
//
// Y una regla del proyecto (CLAUDE.md §5): un fallo de red nunca toma
// decisiones destructivas. Aquí: un día SIN DATOS es neutro. Que el móvil no
// sincronice no puede poner triste a tu mascota ni hacerla retroceder.

// ── Etapas ──────────────────────────────────────────────────────────────────
// Umbrales de "vitalidad" (xp). Un día perfecto da +10, así que:
//   huevo → jr   ~ 1 semana buena       (60)
//   jr → pro     ~ 1 mes                (300)
//   pro → prime  ~ 3 meses              (900)
//   prime → upf  ~ 6-7 meses            (2000)
export const ETAPAS = [
  { id: "huevo", nombre: "Huevo", desde: 0 },
  { id: "jr",    nombre: "Jr",    desde: 60 },
  { id: "pro",   nombre: "Pro",   desde: 300 },
  { id: "prime", nombre: "Prime", desde: 900 },
  { id: "upf",   nombre: "UPF",   desde: 2000 },
];

// Para retroceder hay que caer un 20 % POR DEBAJO del umbral de la etapa
// actual. Sin este margen, una semana regular justo en el límite haría que la
// mascota evolucionara y desevolucionara cada dos días — y un cambio de forma
// tiene que sentirse como algo que pasa, no como un parpadeo.
export const HISTERESIS = 0.8;

// Ajustado con 5 años de datos reales de Fran (28/09/2026), comparando cuatro
// variantes. Con la primera versión (a medias +6, flojo +1, sin techo) la
// mascota llegaba a la forma final en 2 años y ya no bajaba NUNCA — ni en las
// épocas malas —, lo contrario de lo acordado ("puede desevolucionar"). Esta
// es la que reproduce su historia: forma final en su mejor época, baja tras
// la racha floja de la primavera de 2025, y hoy en Prime.
export const PUNTOS = {
  diaPerfecto: 10,       // todas las metas diarias cumplidas
  diaBueno: 3,           // al menos la mitad
  diaFlojo: 0,           // algo hizo: ni sube ni baja
  diaMalo: -6,           // no cumplió casi nada → baja, despacio
  semanaCumplida: 25,    // cada meta semanal cumplida al cerrar la semana
  semanaFallada: -8,     // cada meta semanal fallada (con datos)
};

// ── Catálogo de métricas que pueden ser meta ────────────────────────────────
// `agg` dice cómo se junta una SEMANA: los totales se suman, el sueño se
// promedia (7 h de media, no 49 h "acumuladas").
// Reglas del juego (puntos por día y techo de vitalidad). Van en un objeto
// para poder comparar alternativas contra el historial real antes de fijarlas.
// Techo de vitalidad: 2400 = umbral de la forma final (2000) + 20 %. Sin
// techo, los puntos de sobra hacían de colchón infinito y la mascota no podía
// retroceder nunca.
export const REGLAS = { puntos: PUNTOS, tope: 2400 };

export const METRICAS = {
  pasos:     { metric: "step_count",               unidad: "pasos", nombre: "Pasos",               agg: "sum" },
  sueno:     { metric: "sleep_asleep",             unidad: "h",     nombre: "Sueño",               agg: "avg" },
  ejercicio: { metric: "apple_exercise_time",      unidad: "min",   nombre: "Ejercicio",           agg: "sum" },
  kcal:      { metric: "active_energy",            unidad: "kcal",  nombre: "Calorías activas",    agg: "sum" },
  // Health Auto Export la llama `walking_running_distance`; la documentación
  // de HealthKit, `distance_walking_running`. Se aceptan las dos.
  distancia: { metric: "walking_running_distance", alias: ["distance_walking_running"], unidad: "km", nombre: "Distancia", agg: "sum" },
  depie:     { metric: "apple_stand_hour",         unidad: "h",     nombre: "Horas de pie",        agg: "sum" },
  mente:     { metric: "mindful_minutes",          unidad: "min",   nombre: "Mindfulness",         agg: "sum" },
  entrenos:  { metric: "__workouts",               unidad: "",      nombre: "Entrenos",            agg: "sum" },
};

export const METAS_POR_DEFECTO = [
  { id: "pasos-d",     tipo: "pasos",     objetivo: 8000, periodo: "dia" },
  { id: "sueno-d",     tipo: "sueno",     objetivo: 7,    periodo: "dia" },
  { id: "ejercicio-d", tipo: "ejercicio", objetivo: 30,   periodo: "dia" },
  { id: "kcal-s",      tipo: "kcal",      objetivo: 3500, periodo: "semana" },
];

// ── Unidades ────────────────────────────────────────────────────────────────
// Health Auto Export respeta las unidades del iPhone: la energía puede venir
// en kJ y la distancia en millas. Una meta de 3500 kcal comparada contra kJ
// se cumpliría con cuatro veces menos esfuerzo.
export function normalizar(metric, value, unit) {
  const u = String(unit || "").toLowerCase();
  if (metric === "active_energy" || metric === "basal_energy_burned") {
    if (u === "kj") return value / 4.184;
  }
  if (metric === "distance_walking_running" || metric === "walking_running_distance") {
    if (u === "mi") return value * 1.609344;
    if (u === "m") return value / 1000;
  }
  return value;
}

// ── Fechas (sin `new Date("YYYY-MM-DD")`, que es medianoche UTC) ───────────
const pad = n => String(n).padStart(2, "0");
export function isoDia(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function aFecha(dia) { const [y, m, d] = dia.split("-").map(Number); return new Date(y, m - 1, d); }
export function sumarDias(dia, n) { const f = aFecha(dia); f.setDate(f.getDate() + n); return isoDia(f); }

// Lunes de la semana del día (semanas de lunes a domingo, como el resto de la app).
export function lunesDe(dia) {
  const f = aFecha(dia);
  const dow = (f.getDay() + 6) % 7;   // 0 = lunes
  f.setDate(f.getDate() - dow);
  return isoDia(f);
}

// Métricas en las que 0 significa "sin dato", no "cero". Exportada para que
// la pantalla de Salud enseñe exactamente lo mismo que ve el motor.
const SIN_CEROS = /^(sleep_|step_count$)/;
// Mínimos por debajo de los cuales el valor no representa lo que dice. Medido
// en el historial real de Fran: 25 "noches" de menos de 2 h, que empiezan a
// cualquier hora (muchas por la tarde): siestas y registros cortados, no
// noches. Contarlas como sueño fallado pondría triste a la mascota sin motivo.
const MINIMOS = { sleep_asleep: 2 };
export const esSinDato = (metric, value) =>
  !Number.isFinite(value) || (value <= 0 && SIN_CEROS.test(metric)) || (MINIMOS[metric] != null && value < MINIMOS[metric]);

// ── Índice de datos: día → métrica → valor ──────────────────────────────────
/**
 * @param {Array<{day, metric, value, unit}>} filas   de `health_daily`
 * @param {Array<{start_at}>} entrenos                 de `health_workouts`
 */
export function indexar(filas = [], entrenos = []) {
  const porDia = new Map();
  for (const f of filas) {
    if (!f?.day || !f?.metric || !Number.isFinite(f.value)) continue;
    // En sueño y pasos, un 0 no es una medida: es que no se midió. Nadie
    // duerme 0 h con el reloj puesto, ni da 0 pasos llevando el móvil.
    // Tomarlo por dato contaba la meta como FALLADA: en el primer envío real
    // de Fran (28/09) llegaban campos de sueño a 0 según el reloj, y la
    // mascota no salía del huevo.
    if (esSinDato(f.metric, f.value)) continue;
    if (!porDia.has(f.day)) porDia.set(f.day, {});
    porDia.get(f.day)[f.metric] = normalizar(f.metric, f.value, f.unit);
  }
  for (const w of entrenos) {
    const dia = typeof w?.start_at === "string" ? w.start_at.slice(0, 10) : null;
    if (!dia) continue;
    if (!porDia.has(dia)) porDia.set(dia, {});
    const d = porDia.get(dia);
    d.__workouts = (d.__workouts || 0) + 1;
    if (Number.isFinite(w.minutes) && w.minutes > 0) d.__workout_min = (d.__workout_min || 0) + w.minutes;
  }
  return porDia;
}

function valorDe(datosDia, tipo) {
  const m = METRICAS[tipo];
  if (!m || !datosDia) return null;
  for (const clave of [m.metric, ...(m.alias || [])]) {
    const v = datosDia[clave];
    if (Number.isFinite(v)) return v;
  }
  // Los "minutos de ejercicio" son un invento del Apple Watch: con otros
  // relojes (el de Fran es Huawei) esa métrica no existe. Entonces el
  // ejercicio del día son los minutos de los ENTRENOS registrados. Sin
  // entreno ni minutos, no hay dato — un día de descanso no se puede
  // distinguir de uno sin registrar, así que no se castiga.
  if (tipo === "ejercicio" && Number.isFinite(datosDia.__workout_min)) return datosDia.__workout_min;
  return null;
}

// ── Evaluar un día ──────────────────────────────────────────────────────────
/**
 * @returns {{ dia, puntuacion: number|null, metas: Array<{id,tipo,valor,objetivo,cumplida}> }}
 *   puntuacion = fracción de metas diarias cumplidas, SOLO entre las que
 *   tienen dato. null = no hay ningún dato ese día → día neutro.
 */
export function evaluarDia(dia, porDia, metas = METAS_POR_DEFECTO) {
  const datos = porDia.get(dia);
  const diarias = metas.filter(m => m.periodo === "dia");
  const res = diarias.map(m => {
    const valor = valorDe(datos, m.tipo);
    return { id: m.id, tipo: m.tipo, objetivo: m.objetivo, valor, cumplida: valor != null && valor >= m.objetivo };
  });
  const conDato = res.filter(r => r.valor != null);
  // Un día sin datos no es un día malo: es un día que no sabemos cómo fue.
  const puntuacion = conDato.length ? conDato.filter(r => r.cumplida).length / conDato.length : null;
  return { dia, puntuacion, metas: res };
}

// ── Evaluar una semana ──────────────────────────────────────────────────────
export function evaluarSemana(lunes, porDia, metas = METAS_POR_DEFECTO, hastaDia = null) {
  const semanales = metas.filter(m => m.periodo === "semana");
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
    .filter(d => !hastaDia || d <= hastaDia);
  return semanales.map(m => {
    const vals = dias.map(d => valorDe(porDia.get(d), m.tipo)).filter(v => v != null);
    if (!vals.length) return { id: m.id, tipo: m.tipo, objetivo: m.objetivo, valor: null, cumplida: false, sinDatos: true };
    const valor = METRICAS[m.tipo]?.agg === "avg"
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : vals.reduce((a, b) => a + b, 0);
    return { id: m.id, tipo: m.tipo, objetivo: m.objetivo, valor, cumplida: valor >= m.objetivo, sinDatos: false };
  });
}

export function puntosDelDia(puntuacion, P = PUNTOS) {
  if (puntuacion == null) return 0;                 // neutro: sin datos
  if (puntuacion >= 1) return P.diaPerfecto;
  if (puntuacion >= 0.5) return P.diaBueno;
  if (puntuacion > 0) return P.diaFlojo;
  return P.diaMalo;
}

export function etapaPorXp(xp) {
  let i = 0;
  for (let k = 0; k < ETAPAS.length; k++) if (xp >= ETAPAS[k].desde) i = k;
  return i;
}

// Siguiente etapa con histéresis: subir al cruzar el umbral; bajar solo al
// caer por debajo del 80 % del umbral de la etapa actual. Y una vez nacida,
// la mascota NUNCA vuelve al huevo: desevolucionar es encogerse, no des-nacer.
export function siguienteEtapa(actual, xp) {
  let e = actual;
  while (e < ETAPAS.length - 1 && xp >= ETAPAS[e + 1].desde) e++;
  while (e > 1 && xp < ETAPAS[e].desde * HISTERESIS) e--;
  return e;
}

// ── La simulación completa ──────────────────────────────────────────────────
/**
 * Reproduce la vida de la mascota desde que nació hasta hoy.
 *
 * @param {{ nacimiento: string, metas?: Array, filas?: Array, entrenos?: Array, hoy?: string }} p
 * @returns {{
 *   xp, etapa, etapaId, nacida, progreso,         // progreso 0..1 hacia la siguiente etapa
 *   eventos: Array<{dia, tipo:'evoluciona'|'desevoluciona', de, a}>,
 *   hoy: evaluación del día en curso, semana: evaluación de la semana en curso,
 *   historial: Array<{dia, puntuacion, xp, etapa}>
 * }}
 */
export function simular({ nacimiento, metas = METAS_POR_DEFECTO, filas = [], entrenos = [], hoy = isoDia(new Date()), reglas = REGLAS }) {
  const P = { ...PUNTOS, ...(reglas.puntos || {}) };
  const tope = reglas.tope ?? Infinity;
  // La vitalidad vive entre 0 y el tope. Sin techo, los puntos de sobra se
  // acumulan como colchón y la mascota no puede retroceder nunca.
  const acotar = v => Math.min(tope, Math.max(0, v));
  const porDia = indexar(filas, entrenos);
  let xp = 0;
  let etapa = 0;
  const eventos = [];
  const historial = [];

  if (!nacimiento || nacimiento > hoy) {
    return { xp: 0, etapa: 0, etapaId: "huevo", nacida: false, progreso: 0, eventos, historial,
      hoy: evaluarDia(hoy, porDia, metas), semana: evaluarSemana(lunesDe(hoy), porDia, metas, hoy),
      datosHoy: porDia.get(hoy) || {} };
  }

  const cambiar = (dia, nueva) => {
    if (nueva !== etapa) {
      eventos.push({ dia, tipo: nueva > etapa ? "evoluciona" : "desevoluciona", de: ETAPAS[etapa].id, a: ETAPAS[nueva].id });
      etapa = nueva;
    }
  };

  // Días CERRADOS: de nacimiento a ayer. Hoy aún está en juego y no se castiga.
  for (let dia = nacimiento; dia < hoy; dia = sumarDias(dia, 1)) {
    const ev = evaluarDia(dia, porDia, metas);
    xp = acotar(xp + puntosDelDia(ev.puntuacion, P));

    // El domingo cierra la semana: se liquidan las metas semanales.
    if (aFecha(dia).getDay() === 0) {
      for (const s of evaluarSemana(lunesDe(dia), porDia, metas)) {
        if (s.sinDatos) continue;   // semana sin datos: neutra
        xp = acotar(xp + (s.cumplida ? P.semanaCumplida : P.semanaFallada));
      }
    }
    cambiar(dia, siguienteEtapa(etapa, xp));
    historial.push({ dia, puntuacion: ev.puntuacion, xp, etapa: ETAPAS[etapa].id });
  }

  // Hoy: SOLO suma. Si ya cumpliste, lo ves reflejado ya; si aún no, no resta.
  const evHoy = evaluarDia(hoy, porDia, metas);
  const extra = Math.max(0, puntosDelDia(evHoy.puntuacion, P));
  xp = acotar(xp + extra);
  cambiar(hoy, siguienteEtapa(etapa, xp));

  const sig = ETAPAS[etapa + 1];
  const base = ETAPAS[etapa].desde;
  const progreso = sig ? Math.min(1, Math.max(0, (xp - base) / (sig.desde - base))) : 1;

  return {
    xp, etapa, etapaId: ETAPAS[etapa].id, nacida: etapa > 0, progreso,
    eventos, historial,
    hoy: evHoy,
    semana: evaluarSemana(lunesDe(hoy), porDia, metas, hoy),
    datosHoy: porDia.get(hoy) || {},
  };
}

// ── Ánimo ───────────────────────────────────────────────────────────────────
// La etapa es a largo plazo; el ánimo es de HOY y cambia rápido. Cada ánimo
// lleva su MOTIVO en castellano, para que la mascota no sea una caja negra:
// "está cansada" sin decir por qué no ayuda a cambiar nada.
export const ANIMOS = ["durmiendo", "entrenando", "celebrando", "feliz", "normal", "cansado", "triste"];

/**
 * @param {ReturnType<typeof simular>} sim
 * @param {{ hora?: number, metas?: Array }} o
 * @returns {{ animo: string, motivo: string }}
 */
export function animo(sim, { hora = new Date().getHours(), metas = METAS_POR_DEFECTO } = {}) {
  if (hora >= 23 || hora < 7) return { animo: "durmiendo", motivo: "Es de noche. Shhh." };

  const hoy = sim.hoy;
  const crudo = sim.datosHoy || {};
  const metaSueno = metas.find(m => m.tipo === "sueno" && m.periodo === "dia")?.objetivo ?? 7;
  // Se lee del dato crudo: el sueño cuenta para el ánimo aunque no sea una meta.
  const sueno = Number.isFinite(crudo.sleep_asleep) ? crudo.sleep_asleep : null;

  // Cumplirlo TODO es el logro más grande del día y va primero. Si fuera
  // detrás de "entrenando", con el ejercicio como meta nunca se celebraría:
  // cumplir todas implica cumplir la de ejercicio, y esa ganaría siempre.
  if (hoy.puntuacion === 1) return { animo: "celebrando", motivo: "¡Todas las metas de hoy cumplidas!" };

  // Entrenando: hay un entreno registrado hoy, o ya cumplió los minutos.
  const ej = hoy.metas.find(m => m.tipo === "ejercicio");
  if (crudo.__workouts > 0) return { animo: "entrenando", motivo: crudo.__workouts === 1 ? "Hoy has entrenado." : `Hoy llevas ${crudo.__workouts} entrenos.` };
  if (ej?.cumplida) return { animo: "entrenando", motivo: `Hoy ya llevas ${Math.round(ej.valor)} min de ejercicio.` };

  if (sueno != null && sueno < metaSueno - 1) {
    return { animo: "cansado", motivo: `Anoche dormiste ${sueno.toFixed(1).replace(".", ",")} h.` };
  }

  // Tristeza: tendencia de los últimos 3 días cerrados CON datos.
  const recientes = sim.historial.slice(-3).filter(h => h.puntuacion != null);
  if (recientes.length >= 2) {
    const media = recientes.reduce((a, h) => a + h.puntuacion, 0) / recientes.length;
    if (media < 0.34) return { animo: "triste", motivo: "Los últimos días han sido flojitos. Te echa de menos." };
    if (media >= 0.67) return { animo: "feliz", motivo: "Llevas unos días muy buenos." };
  }

  if (hoy.puntuacion != null && hoy.puntuacion >= 0.5) return { animo: "feliz", motivo: "Vas bien hoy." };
  return { animo: "normal", motivo: "Un día tranquilo." };
}

// Progreso del huevo → frame de la animación de eclosión (0..n-1). Las hojas
// de sprites traen el huevo agrietándose poco a poco: cuanto más cerca de
// nacer, más grietas.
export function frameHuevo(sim, totalFrames = 16) {
  if (sim.nacida) return totalFrames - 1;
  return Math.min(totalFrames - 1, Math.floor(sim.progreso * totalFrames));
}

// ── La vida de la mascota, mes a mes ────────────────────────────────────────
// Para responder "¿cómo habría estado mi mascota en cada época?": se simula
// desde el primer día con datos y se resume por meses. Es un "qué habría
// pasado" — la mascota de verdad nace el día en que se adopta.
//
// Cada mes: la etapa con la que lo TERMINA, la más alta que alcanzó, cómo fue
// de media (ánimo del mes), cuántos días tuvo datos y qué pasó (evoluciones).
export function lineaTemporal(sim) {
  const meses = new Map();
  for (const h of sim?.historial || []) {
    const mes = h.dia.slice(0, 7);
    if (!meses.has(mes)) meses.set(mes, { mes, puntuaciones: [], etapa: h.etapa, etapaMax: h.etapa, xpFin: h.xp, eventos: [] });
    const m = meses.get(mes);
    if (h.puntuacion != null) m.puntuaciones.push(h.puntuacion);
    m.etapa = h.etapa;
    m.xpFin = h.xp;
    if (ETAPAS.findIndex(e => e.id === h.etapa) > ETAPAS.findIndex(e => e.id === m.etapaMax)) m.etapaMax = h.etapa;
  }
  for (const ev of sim?.eventos || []) {
    const m = meses.get(ev.dia.slice(0, 7));
    if (m) m.eventos.push(ev);
  }
  return [...meses.values()].map(({ puntuaciones, ...m }) => {
    const media = puntuaciones.length ? puntuaciones.reduce((a, b) => a + b, 0) / puntuaciones.length : null;
    return {
      ...m,
      diasConDatos: puntuaciones.length,
      media,
      // Sin datos no hay ánimo: se dice, no se inventa.
      animo: media == null ? "sin datos" : media >= 0.67 ? "feliz" : media >= 0.34 ? "normal" : "triste",
    };
  });
}
