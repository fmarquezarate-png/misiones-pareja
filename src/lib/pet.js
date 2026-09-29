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
//   huevo → jr   ~ 2-4 semanas          (30)
//   jr → pro     ~ 1 mes                (300)
//   pro → prime  ~ 3 meses              (900)
//   prime → upf  ~ 6-7 meses            (2000)
// Huevo → Jr: con el umbral anterior (60) la eclosión tardaba una MEDIANA de 38
// días (p75 78, máx 131) sobre los datos reales de Fran: semanas con la mascota
// inmóvil dentro de un huevo. Con 30: mediana ~15 días, p75 ~31, máx ~67.
export const ETAPAS = [
  { id: "huevo", nombre: "Huevo", desde: 0 },
  { id: "jr",    nombre: "Jr",    desde: 30 },
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

/**
 * Día y hora LOCALES de un instante ISO (p. ej. el `start_at timestamptz` de un
 * entreno, que Supabase devuelve en UTC). Cortar el texto en 10 caracteres daba el
 * día UTC: un entreno a las 00:30 en España caía en el día anterior (~5 % de los
 * entrenos de Fran) y la hora se enseñaba 1-2 h desfasada.
 * Un texto de solo fecha ("2026-09-24") no tiene hora ni huso: se respeta tal cual.
 */
export function diaLocalDe(iso) {
  if (typeof iso !== "string" || iso.length < 10) return null;
  if (iso.length === 10) return iso;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : isoDia(d);
}
export function horaLocalDe(iso) {
  if (typeof iso !== "string" || iso.length <= 10) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
// Y pasos: en 5 años de historial, 37 días (1,9 %) por debajo de 300, el más
// bajo con 25 pasos. Con el móvil encima es imposible un día entero así: son
// días sin llevarlo o sincronizaciones a medias. Como "día más bajo de siempre"
// o como meta fallada, mentían.
const MINIMOS = { sleep_asleep: 2, step_count: 300 };
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
    const dia = diaLocalDe(w?.start_at);
    if (!dia) continue;
    if (!porDia.has(dia)) porDia.set(dia, {});
    const d = porDia.get(dia);
    d.__workouts = (d.__workouts || 0) + 1;
    if (Number.isFinite(w.minutes) && w.minutes > 0) d.__workout_min = (d.__workout_min || 0) + w.minutes;
  }
  return porDia;
}

function valorDe(datosDia, tipo) {
  return valorConOrigen(datosDia, tipo).valor;
}

// Devuelve también de DÓNDE sale el valor: el ejercicio puede derivarse de los
// minutos de los entrenos (relojes sin `apple_exercise_time`, como el Huawei de
// Fran) y esa medida no se comporta como las demás.
function valorConOrigen(datosDia, tipo) {
  const m = METRICAS[tipo];
  if (!m || !datosDia) return { valor: null, derivado: false };
  for (const clave of [m.metric, ...(m.alias || [])]) {
    const v = datosDia[clave];
    if (Number.isFinite(v)) return { valor: v, derivado: false };
  }
  if (tipo === "ejercicio" && Number.isFinite(datosDia.__workout_min)) return { valor: datosDia.__workout_min, derivado: true };
  return { valor: null, derivado: false };
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
    const { valor, derivado } = valorConOrigen(datos, m.tipo);
    const cumplida = valor != null && valor >= m.objetivo;
    // Ejercicio derivado de entrenos = BONUS: si se cumple, suma; si no llega,
    // no cuenta. Sin esto castigaba un paseo corto pero NO descansar (sin
    // entreno era "sin dato"): solo existía en el 4-7 % de los días, y el
    // resultado era que hacer algo poco valía menos que no hacer nada.
    const bonus = derivado && !cumplida;
    return { id: m.id, tipo: m.tipo, objetivo: m.objetivo, valor, cumplida, derivado, cuenta: valor != null && !bonus };
  });
  const medibles = res.filter(r => r.cuenta);
  // Un día sin datos no es un día malo: es un día que no sabemos cómo fue.
  const puntuacion = medibles.length ? medibles.filter(r => r.cumplida).length / medibles.length : null;
  return {
    dia, puntuacion, metas: res,
    medibles: medibles.length,                                   // metas con dato que puntúan
    cobertura: diarias.length ? medibles.length / diarias.length : 0,
  };
}

// ── Evaluar una semana ──────────────────────────────────────────────────────
// Días con dato que hacen falta para LIQUIDAR una semana cerrada. Con menos, la
// semana es neutra: que el móvil no sincronizara 4 días no es una semana fallada
// (regla del proyecto: un fallo de sincronización jamás penaliza). Los totales
// (suma) necesitan más días que las medias.
export const MIN_DIAS_SEMANA = { sum: 5, avg: 3 };

/**
 * @param {string} lunes
 * @param {Map} porDia
 * @param {Array} metas
 * @param {string|null} hastaDia  semana EN CURSO hasta este día (progreso, sin liquidar)
 * @param {string|null} desdeDia  primer día que cuenta (el nacimiento de la mascota:
 *        los días anteriores a que existiera no puntúan)
 */
export function evaluarSemana(lunes, porDia, metas = METAS_POR_DEFECTO, hastaDia = null, desdeDia = null) {
  const semanales = metas.filter(m => m.periodo === "semana");
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
    .filter(d => (!hastaDia || d <= hastaDia) && (!desdeDia || d >= desdeDia));
  const cerrada = !hastaDia;
  return semanales.map(m => {
    const vals = dias.map(d => valorDe(porDia.get(d), m.tipo)).filter(v => v != null);
    const agg = METRICAS[m.tipo]?.agg === "avg" ? "avg" : "sum";
    const base = { id: m.id, tipo: m.tipo, objetivo: m.objetivo, diasConDato: vals.length };
    if (!vals.length || (cerrada && vals.length < MIN_DIAS_SEMANA[agg])) {
      return { ...base, valor: vals.length ? valor(vals, agg) : null, cumplida: false, sinDatos: true };
    }
    const v = valor(vals, agg);
    // Semana cerrada con algún día sin dato: el objetivo se prorratea por los
    // días que sí hay (5 de 7 días → 5/7 del objetivo), no se exige el total.
    const objetivo = cerrada && agg === "sum" ? m.objetivo * Math.min(1, vals.length / 7) : m.objetivo;
    return { ...base, valor: v, cumplida: v >= objetivo, sinDatos: false };
  });
}
const valor = (vals, agg) => (agg === "avg" ? vals.reduce((a, b) => a + b, 0) / vals.length : vals.reduce((a, b) => a + b, 0));

export function puntosDelDia(puntuacion, P = PUNTOS, medibles = 2) {
  if (puntuacion == null) return 0;                 // neutro: sin datos
  let pts;
  if (puntuacion >= 1) pts = P.diaPerfecto;
  else if (puntuacion >= 0.5) pts = P.diaBueno;
  else if (puntuacion > 0) pts = P.diaFlojo;
  else pts = P.diaMalo;
  // Con UNA sola meta medible (p. ej. solo llegó el sueño), «cumplirla todas»
  // es un 100 % de un dato: no puede valer un día perfecto entero. Y un fallo
  // con un solo dato pesa la mitad. Medido con el historial real: sin esto un
  // único dato daba +10 o −6 con la misma fuerza que cuatro.
  if (medibles <= 1) pts = pts > 0 ? Math.round(pts * 0.6) : Math.round(pts * 0.5);
  return pts;
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
    xp = acotar(xp + puntosDelDia(ev.puntuacion, P, ev.medibles));

    // El domingo cierra la semana: se liquidan las metas semanales.
    if (aFecha(dia).getDay() === 0) {
      for (const s of evaluarSemana(lunesDe(dia), porDia, metas, null, nacimiento)) {
        if (s.sinDatos) continue;   // semana sin datos: neutra
        xp = acotar(xp + (s.cumplida ? P.semanaCumplida : P.semanaFallada));
      }
    }
    cambiar(dia, siguienteEtapa(etapa, xp));
    historial.push({ dia, puntuacion: ev.puntuacion, xp, etapa: ETAPAS[etapa].id });
  }

  // Hoy: SOLO suma, y solo lo YA LOGRADO. La puntuación normal de un día
  // (cumplidas / con dato) no es monótona mientras el día está en curso: por la
  // mañana llega el sueño (1/1 = perfecto, +10), después los pasos suben o no, y
  // la fracción baja — la mascota evolucionaba a las 8:00 y desevolucionaba a
  // las 11:00. Para hoy se cuenta lo cumplido sobre TODAS las metas diarias:
  // solo puede crecer a lo largo del día (los pasos no bajan).
  const evHoy = evaluarDia(hoy, porDia, metas);
  const diariasHoy = evHoy.metas.length;
  const cumplidasHoy = evHoy.metas.filter(m => m.cumplida).length;
  const puntuacionHoy = diariasHoy && evHoy.medibles ? cumplidasHoy / diariasHoy : null;
  const extra = Math.max(0, puntosDelDia(puntuacionHoy, P, evHoy.medibles));
  const etapaAyer = etapa;
  xp = acotar(xp + extra);
  // Nunca por debajo de la etapa con la que se cerró ayer.
  cambiar(hoy, Math.max(etapaAyer, siguienteEtapa(etapa, xp)));

  const sig = ETAPAS[etapa + 1];
  const base = ETAPAS[etapa].desde;
  const progreso = sig ? Math.min(1, Math.max(0, (xp - base) / (sig.desde - base))) : 1;

  return {
    xp, etapa, etapaId: ETAPAS[etapa].id, nacida: etapa > 0, progreso,
    eventos, historial,
    hoy: evHoy,
    semana: evaluarSemana(lunesDe(hoy), porDia, metas, hoy, nacimiento),
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
      // Sin datos no hay valoración: se dice, no se inventa. Y NO se llama «triste»:
      // la regla acordada es que la mascota solo está triste por falta de cariño;
      // los hábitos se ven en su FORMA. Este es un adjetivo del MES, no de su ánimo.
      racha: media == null ? "sin datos" : media >= 0.67 ? "buena" : media >= 0.34 ? "regular" : "floja",
    };
  });
}


// ── Metas iniciales calibradas con los hábitos REALES ───────────────────────
// Las metas por defecto (8.000 pasos, 3.500 kcal/semana) salieron de una cifra
// redonda, no de la persona: con los datos reales de Fran, 8.000 pasos estaba
// bien (percentil 62) pero 3.500 kcal/semana era el percentil ~92 — una meta que
// casi nunca se cumplía, con una penalización que anulaba el progreso diario.
// Al adoptar (o al pulsar «recalcular» en el editor), las metas de pasos y de
// energía semanal se ajustan a los últimos 56 días cerrados de la persona; el
// sueño (7 h) y el ejercicio (30 min) son recomendaciones, no percentiles.
// Con menos de 21 días de datos se dejan las de por defecto.
const percentil = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
const redondeaA = (x, paso) => Math.round(x / paso) * paso;
const acota = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function calibrarMetas(filas = [], hoy = isoDia(new Date()), { dias = 56, minDias = 21 } = {}) {
  const metas = METAS_POR_DEFECTO.map(m => ({ ...m }));
  const desde = sumarDias(hoy, -dias);
  const idx = indexar(filas.filter(f => f.day >= desde && f.day < hoy));
  const dia = [...idx.entries()];
  const pasos = dia.map(([, v]) => valorDe(v, "pasos")).filter(x => x != null);
  const calibrada = { pasos: false, kcal: false };
  if (pasos.length >= minDias) {
    metas.find(m => m.tipo === "pasos").objetivo = acota(redondeaA(percentil(pasos, 0.6), 500), 4000, 12000);
    calibrada.pasos = true;
  }
  // Energía semanal: suma de las semanas con al menos 5 días con dato.
  const semanas = new Map();
  for (const [d, v] of dia) {
    const x = valorDe(v, "kcal");
    if (x == null) continue;
    const l = lunesDe(d);
    if (!semanas.has(l)) semanas.set(l, []);
    semanas.get(l).push(x);
  }
  const sumas = [...semanas.values()].filter(v => v.length >= 5).map(v => v.reduce((a, b) => a + b, 0) * (7 / v.length));
  if (sumas.length >= 3) {
    metas.find(m => m.tipo === "kcal").objetivo = acota(redondeaA(percentil(sumas, 0.6), 100), 1500, 6000);
    calibrada.kcal = true;
  }
  return { metas, calibrada };
}
