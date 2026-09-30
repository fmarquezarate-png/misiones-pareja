// El deporte del calendario como entrenamiento.
//
// Por qué existe (Fran, 30/09/2026): el reloj (Huawei → Apple Salud) no guarda los
// partidos de pádel como entrenos, pero SÍ se notan en el día: más energía, más
// pasos y un pico de pulso. Y en el calendario de la app ya está apuntado cada
// partido, con su hora. Aquí se cruzan las dos cosas.
//
// La regla se AJUSTÓ contra el historial real (39 días de pádel apuntados, mar–sep 2026):
//   · Señales de que el partido se jugó ese día, frente a la mediana de los 35 días
//     anteriores sin deporte apuntado:
//       pulso máximo ≥ 160 · energía activa +250 kcal · pasos +2.500
//     Dos o más → «confirmado» (30 de 39). Una → «probable». Ninguna → «no coincide»
//     o «sin datos del reloj». TODO lo apuntado cuenta: el calendario manda (la app de
//     Huawei registró partidos que Apple Salud nunca recibió); el reloj solo afina las kcal.
//   · Calorías del partido: 0,045 × pasos extra + 379 × horas de juego (error mediano
//     12 %; «kcal por hora» a secas: 21 %). Si el día está confirmado se usa lo que
//     el reloj MIDIÓ de más, acotado a ±50 % de esa estimación (así un día con más
//     cosas no se atribuye entero al partido).
//   · Si el servidor sabe a qué hora subió el pulso (hr_pico_desde/hasta, ver
//     parse.js › ventanaPico) y esa franja no toca el horario del evento, el pico
//     del día no cuenta como señal del partido.
//
// Puro: sin red, sin reloj, sin DOM. Todo se prueba con datos.

import { esSinDato, normalizar, sumarDias } from "./pet.js";

// Regla de Fran (30/09/2026): «Padel», «Pádel», «Futbol», «Pichanga», «Gym»,
// «Americana» en el título, o el emoji 🎾, es deporte. Así entran también los
// nombres de liga que escribe a su manera («Liga Masc Moli», «Master Masculi
// Semis», «Mixto ft Gonza»), que antes se escapaban.
export const DEPORTES = [
  { id: "padel",  nombre: "Pádel",      emoji: /🎾|🏸/u, re: /p[aá]del|americana|torneo de p[aá]del|\bpartido (vs|con)\b|\bliga (masc|mixta|mixto|fem)/i, min: 75, tasa: 379, tasaSinPasos: 542, sesionTipica: 707, pideEmoji: /\bpartido\b/i,
    // Masculino vs mixto (13 partidos reales del reloj, 30/09/2026): masculino 10,7
    // kcal/min, pulso medio 168, partido típico ~754 kcal; mixto 9,2 kcal/min, 153
    // lpm, ~566 kcal. El de amigos sin etiqueta (844 kcal, 168 lpm) es masculino.
    // Solo identifican y describen; las kcal usan el típico general (ver evaluarDia).
    variantes: {
      masculino: { nombre: "Pádel masculino", sesionTipica: 754, kcalMin: 10.7, pulsoMedio: 168 },
      mixto:     { nombre: "Pádel mixto",     sesionTipica: 566, kcalMin: 9.2,  pulsoMedio: 153 },
    } },
  { id: "gym",    nombre: "Gimnasio",   emoji: /🏋/u,     re: /\bgym\b|gimnasio|crossfit|\bbox\b|\bentreno\b|pesas/i, min: 60, tasa: 300, tasaSinPasos: 360 },
  { id: "correr", nombre: "Correr",     emoji: /🏃/u,     re: /correr|running|\bcarrera\b|trail/i, min: 45, tasa: 600, tasaSinPasos: 700 },
  { id: "futbol", nombre: "Fútbol",     emoji: null,       re: /\bf[uú]tbol\b|futsal|pachanga|pichanga/i, min: 60, tasa: 480, tasaSinPasos: 600 },
  { id: "bici",   nombre: "Bici",       emoji: /🚴/u,     re: /\bbici\b|ciclismo|spinning/i, min: 60, tasa: 450, tasaSinPasos: 500 },
  { id: "nadar",  nombre: "Natación",   emoji: /🏊/u,     re: /nataci[oó]n|\bnadar\b|piscina/i, min: 45, tasa: 450, tasaSinPasos: 500 },
  { id: "yoga",   nombre: "Yoga",       emoji: /🧘/u,     re: /\byoga\b|pilates|estiramientos/i, min: 60, tasa: 150, tasaSinPasos: 180 },
];
// Títulos que MENCIONAN un deporte sin serlo (medido en el calendario real:
// «Cumple mini Luca Box», «Comidita CROSSFITEROS», «Cotizar zapatillas de pádel»,
// «Comprar patines… 🎾», «Montar partidito próxima semana 🎾»…).
const NO_DEPORTE = /cumple|comid|\bcena\b|playita|cotiz|compr|coordin|verific|zapas|zapatill|reserv|\bpagar\b|ver (el )?partido|inscrib|\bpala\b|\bmontar\b|organiz|\bvolver a mi f/i;

export const UMBRAL = { pulso: 160, kcal: 250, pasos: 2500 };
export const KCAL_POR_PASO = 0.045;
const DIAS_BASE = 35, MIN_DIAS_BASE = 7, MAX_MIN = 180;

/** ¿Es deporte este evento? → la entrada de DEPORTES o null. */
export function detectarDeporte(m) {
  const t = String(m?.title || "");
  if (!t || m?.crest || NO_DEPORTE.test(t)) return null;      // crest = partido de Mi Equipo (se ve, no se juega)
  const e = String(m?.emoji || "");
  // 🎾/🏸 sin título reconocible (p. ej. «Master Masculi Semis», «Mascu ft Gonza»): pádel.
  const porEmoji = /🎾|🏸/u.test(e) && !DEPORTES.some(d => d.re.test(t)) ? DEPORTES[0] : null;
  if (porEmoji) return porEmoji;
  for (const d of DEPORTES) {
    if (!d.re.test(t)) continue;
    if (d.pideEmoji && d.pideEmoji.test(t) && !/p[aá]del|americana/i.test(t) && !(d.emoji && d.emoji.test(e))) continue;
    return d;
  }
  return null;
}

/**
 * Tipo de partido. «masc…» → masculino; «mix…» o jugado JUNTOS → mixto; tú solo sin
 * etiqueta → masculino (los partidos con amigos gastan como los masculinos). La otra
 * persona sola, sin etiqueta → null (no hay datos suyos para afirmarlo).
 */
export function varianteDe(m, dep) {
  if (!dep?.variantes) return null;
  const t = String(m?.title || "");
  if (/\bmasc|mascu|masculi/i.test(t)) return "masculino";
  if (/\bmix/i.test(t) || (m?.who || "together") === "together") return "mixto";
  return m?.who === "person1" ? "masculino" : null;
}

const minutosDe = hhmm => (/^\d{1,2}:\d{2}$/.test(hhmm || "") ? +hhmm.slice(0, -3) * 60 + +hhmm.slice(-2) : null);
const hhmmDe = min => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Eventos de deporte HECHOS de una persona (o de los dos juntos), hasta hoy.
 * @param {object} weeks   data.weeks del blob
 * @param {'person1'|'person2'} persona
 */
export function eventosDeporte(weeks, persona, hoy) {
  const out = [], vistos = new Set();
  for (const w of Object.values(weeks || {})) {
    for (const m of w?.missions || []) {
      if (!m?.date || m.date > hoy || m.status !== "DONE" || vistos.has(m.id)) continue;
      const quien = m.who || "together";
      if (quien !== persona && quien !== "together") continue;
      const dep = detectarDeporte(m);
      if (!dep) continue;
      vistos.add(m.id);
      const ini = minutosDe(m.time), finEv = minutosDe(m.endTime);
      const dur = Number(m.duration);
      let min = finEv != null && ini != null && finEv > ini ? finEv - ini : Number.isFinite(dur) && dur > 0 ? dur : dep.min;
      min = Math.min(MAX_MIN, min);
      const variante = varianteDe(m, dep);
      out.push({ id: m.id, dia: m.date, inicio: ini, fin: ini != null ? ini + min : null, minutos: min, deporte: dep.id, variante,
        nombreDeporte: variante ? dep.variantes[variante].nombre : dep.nombre, titulo: m.title, emoji: m.emoji || "" });
    }
  }
  return out.sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : (a.inicio ?? 0) - (b.inicio ?? 0)));
}

/** Día → { pasos, kcal, pulsoMax, picoDesde, picoHasta } (kcal siempre en kcal). */
export function indexarDias(filas = []) {
  const m = new Map();
  const CLAVE = { step_count: "pasos", active_energy: "kcal", heart_rate_max: "pulsoMax", hr_pico_desde: "picoDesde", hr_pico_hasta: "picoHasta" };
  for (const f of filas) {
    const k = CLAVE[f?.metric];
    if (!k || !f.day || !Number.isFinite(f.value) || esSinDato(f.metric, f.value)) continue;
    if (!m.has(f.day)) m.set(f.day, {});
    m.get(f.day)[k] = k === "kcal" ? normalizar(f.metric, f.value, f.unit) : f.value;
  }
  return m;
}

const mediana = xs => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length >= MIN_DIAS_BASE ? s[s.length >> 1] : null; };

/** Línea base del día: mediana de los 35 días anteriores sin deporte apuntado (mínimo 7 días con dato). */
export function lineaBase(dia, dias, diasConDeporte) {
  const p = [], k = [];
  for (let i = 1; i <= DIAS_BASE; i++) {
    const x = sumarDias(dia, -i);
    if (diasConDeporte.has(x)) continue;
    const o = dias.get(x);
    if (!o) continue;
    p.push(o.pasos); k.push(o.kcal);
  }
  return { pasos: mediana(p), kcal: mediana(k) };
}

/** Segundos Unix de un minuto del día en la hora LOCAL del dispositivo. */
function segLocal(dia, min) {
  const [y, mo, d] = dia.split("-").map(Number);
  return Math.floor(new Date(y, mo - 1, d, Math.floor(min / 60), min % 60).getTime() / 1000);
}

/**
 * Evalúa los eventos de UN día (pueden ser varios) contra lo que midió el reloj.
 * @returns {Array<evento & { nivel, señales, kcal, kcalMedidas, cuenta }>}
 */
export function evaluarDia(evs, o = {}, base = {}, tipicas = null) {
  const hayPulso = Number.isFinite(o.pulsoMax);
  const dK = Number.isFinite(o.kcal) && Number.isFinite(base.kcal) ? o.kcal - base.kcal : null;
  const dP = Number.isFinite(o.pasos) && Number.isFinite(base.pasos) ? o.pasos - base.pasos : null;
  const minTot = evs.reduce((a, e) => a + e.minutos, 0) || 1;

  // ¿El pico de pulso cayó a la hora de algún evento? (null = no se sabe)
  let picoEnHora = null;
  if (Number.isFinite(o.picoHasta)) {
    const desde = Number.isFinite(o.picoDesde) ? o.picoDesde : segLocal(evs[0].dia, 0);
    const conHora = evs.filter(e => e.inicio != null);
    if (conHora.length) picoEnHora = conHora.some(e => segLocal(e.dia, e.inicio) - 900 <= o.picoHasta && segLocal(e.dia, e.fin) + 900 >= desde);
  }
  const señales = {
    pulso: hayPulso && o.pulsoMax >= UMBRAL.pulso && picoEnHora !== false,
    kcal: dK != null && dK >= UMBRAL.kcal,
    pasos: dP != null && dP >= UMBRAL.pasos,
  };
  const n = señales.pulso + señales.kcal + señales.pasos;
  // Sin ninguna señal: si el reloj tomó pulso ese día lo llevabas puesto y no vio
  // el partido. Si no hay pulso en todo el día, Apple Salud no recibió nada del
  // reloj: la app de Huawei sí registró esos partidos (captura del 30/09: 04/08 y
  // 27/09), fue la SINCRONIZACIÓN la que falló. Los pasos y la energía de ese día
  // vienen solo del móvil, así que no sirven para medir el partido.
  const nivel = n >= 2 ? "confirmado" : n === 1 ? "probable" : hayPulso ? "no_coincide" : "sin_reloj";

  return evs.map(e => {
    const dep = DEPORTES.find(d => d.id === e.deporte);
    const parte = e.minutos / minTot, h = e.minutos / 60;
    // Partido TÍPICO: media real de las sesiones del reloj (Huawei, 2026: 64
    // partidos, 51.905 kcal totales, 81 min → 707 kcal ACTIVAS). Si el deporte no
    // tiene sesión típica medida, su tasa por hora.
    // El TIPO (masculino/mixto) cambia las kcal solo cuando la app ya aprendió su
    // típico con tus partidos (aprenderTipicas, ≥ 15 confirmados de ese tipo). Con los
    // valores de partida por tipo (5–7 partidos) la estimación empeoraba.
    const tipica = tipicas?.[`${dep.id}:${e.variante || ""}`] ?? dep.sesionTipica ?? dep.tasaSinPasos * h;
    const estimada = KCAL_POR_PASO * Math.max(0, dP ?? 0) * parte + dep.tasa * h;
    let kcal, kcalMedidas = null;
    if (nivel === "confirmado" && dK != null) {
      // Lo que midió el reloj ese día (acotado a ±50 % de la fórmula) promediado con
      // el partido típico: el día puede traer más cosas que el partido (06/09: +58 %
      // midiendo solo el día). Contra 13 sesiones reales: 9 % de error mediano.
      kcalMedidas = Math.round(dK * parte);
      const medido = Math.min(estimada * 1.5, Math.max(estimada * 0.5, kcalMedidas));
      kcal = (medido + tipica) / 2;
    } else {
      // Probable, sin datos o «no coincide»: el partido típico. El calendario MANDA:
      // Apple Salud a veces no recibe nada del reloj (04/08, 22/06, 27/09 — la app de
      // Huawei SÍ registró esos partidos).
      kcal = tipica;
    }
    return {
      ...e, nivel, señales, picoEnHora, kcalMedidas,
      kcal: Math.round(kcal), cuenta: true,
      delta: { kcal: dK == null ? null : Math.round(dK), pasos: dP == null ? null : Math.round(dP) }, pulsoMax: o.pulsoMax ?? null,
    };
  });
}

/** ¿Ya lo registró el reloj como entreno? (mismo día y a una hora que se solapa, ±60 min). */
function yaEnReloj(e, entrenosReloj) {
  if (e.inicio == null) return false;
  return entrenosReloj.some(w => {
    const t = Date.parse(w.start_at);
    if (!Number.isFinite(t)) return false;
    const d = new Date(t);
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const min = d.getHours() * 60 + d.getMinutes();
    return dia === e.dia && min >= e.inicio - 60 && min <= e.fin + 60;
  });
}

/**
 * Entrenos que salen del calendario, listos para sumarse a los del reloj.
 * @returns {{ entrenos: Array, evaluados: Array, resumen: { confirmados, probables, sinReloj, noCoincide, enReloj } }}
 */
export function entrenosDelCalendario({ weeks, persona, filas = [], entrenos = [], hoy }) {
  if (!persona) return { entrenos: [], evaluados: [], resumen: { confirmados: 0, probables: 0, sinReloj: 0, noCoincide: 0, enReloj: 0 } };
  const evs = eventosDeporte(weeks, persona, hoy);
  const dias = indexarDias(filas);
  const conDeporte = new Set(evs.map(e => e.dia));
  const porDia = new Map();
  let enReloj = 0;
  for (const e of evs) {
    if (yaEnReloj(e, entrenos)) { enReloj++; continue; }
    if (!porDia.has(e.dia)) porDia.set(e.dia, []);
    porDia.get(e.dia).push(e);
  }
  const bases = new Map([...porDia.keys()].map(dia => [dia, lineaBase(dia, dias, conDeporte)]));
  let evaluados = [];
  for (const [dia, lista] of porDia) evaluados.push(...evaluarDia(lista, dias.get(dia), bases.get(dia)));
  // Aprende TU partido típico de cada tipo con los que el reloj confirmó, y vuelve a
  // estimar con él (ver aprenderTipicas).
  const tipicas = aprenderTipicas(evaluados);
  if (Object.keys(tipicas).length) {
    evaluados = [];
    for (const [dia, lista] of porDia) evaluados.push(...evaluarDia(lista, dias.get(dia), bases.get(dia), tipicas));
  }
  evaluados.sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : (a.inicio ?? 0) - (b.inicio ?? 0)));

  const salida = evaluados.filter(e => e.cuenta).map(e => ({
    start_at: e.inicio != null ? `${e.dia}T${hhmmDe(e.inicio)}:00` : e.dia,
    end_at: e.fin != null ? `${e.dia}T${hhmmDe(Math.min(e.fin, 1439))}:00` : null,
    name: e.titulo, minutes: e.minutos, kcal: e.kcal, distance_km: null, avg_hr: null,
    source: "calendario", nivel: e.nivel, deporte: e.deporte, nombreDeporte: e.nombreDeporte,
  }));
  const cuenta = n => evaluados.filter(e => e.nivel === n).length;
  return { entrenos: salida, evaluados, tipos: estadisticasPorTipo(evaluados, tipicas), resumen: { confirmados: cuenta("confirmado"), probables: cuenta("probable"), sinReloj: cuenta("sin_reloj"), noCoincide: cuenta("no_coincide"), enReloj } };
}

export const TEXTO_NIVEL = {
  confirmado: "confirmado por tu reloj",
  probable: "probable (una señal del reloj)",
  sin_reloj: "sin datos del reloj ese día · estimado",
  no_coincide: "Apple Salud no lo reflejó · estimado",
};

// ── Anomalías de pulso: «¿hiciste deporte?» ─────────────────────────────────
// Días con el pulso muy por encima de lo normal y NADA de deporte apuntado.
// Regla elegida entre tres con el historial real (2022–2026):
//   pulso máx ≥ 175, o ≥ 160 con +150 kcal o +1.500 pasos sobre el día normal.
//   · caza 33 de los 37 días de deporte que SÍ estaban apuntados (sensibilidad),
//   · detecta el tenis del 10/08/2026 que no estaba en el calendario (170 lpm),
//   · ~30–47 avisos por año en el pasado: más o menos uno por semana, el ritmo
//     real de deporte. «Pulso ≥ 160» a secas avisaba hasta 61 veces al año.
// Medido también (30/09/2026): los bolos NO dan señal (pulso 100–141, menos pasos
// y energía que un día normal), así que no se preguntan ni se cuentan.
export const ANOMALIA = { pulsoSolo: 175, pulso: 160, kcal: 150, pasos: 1500 };

/**
 * @param {{ filas, weeks, persona, hoy, descartados?: string[], dias?: number }} p
 * @returns {Array<{ dia, pulsoMax, delta:{kcal,pasos}, pico:{desde,hasta}|null, horaSugerida:string|null }>}  lo más reciente primero
 */
export function posiblesEntrenos({ filas = [], weeks, persona, hoy, descartados = [], dias = 120 }) {
  if (!persona) return [];
  const idx = indexarDias(filas);
  const apuntados = new Set(eventosDeporte(weeks, persona, hoy).map(e => e.dia));
  // Cualquier cosa apuntada con hora ese día que YA explique el pico (p. ej. bolos,
  // una boda bailando): si la persona la marcó hecha, no se pregunta.
  const descartes = new Set(descartados);
  const desde = sumarDias(hoy, -dias);
  const out = [];
  for (const [dia, o] of idx) {
    if (dia < desde || dia > hoy || apuntados.has(dia) || descartes.has(dia) || !Number.isFinite(o.pulsoMax)) continue;
    const b = lineaBase(dia, idx, apuntados);
    const dK = Number.isFinite(o.kcal) && Number.isFinite(b.kcal) ? o.kcal - b.kcal : null;
    const dP = Number.isFinite(o.pasos) && Number.isFinite(b.pasos) ? o.pasos - b.pasos : null;
    const salta = o.pulsoMax >= ANOMALIA.pulsoSolo || (o.pulsoMax >= ANOMALIA.pulso && ((dK ?? 0) >= ANOMALIA.kcal || (dP ?? 0) >= ANOMALIA.pasos));
    if (!salta) continue;
    const pico = Number.isFinite(o.picoHasta) ? { desde: Number.isFinite(o.picoDesde) ? o.picoDesde : null, hasta: o.picoHasta } : null;
    // Hora sugerida: el pico fue DESPUÉS del envío anterior → esa hora, redondeada al
    // cuarto siguiente. Solo si la franja es razonable (≤ 5 h) y cae en ese día.
    let horaSugerida = null;
    if (pico?.desde != null && pico.hasta - pico.desde <= 5 * 3600) {
      const t = new Date(pico.desde * 1000);
      const diaT = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
      if (diaT === dia) { const m = Math.min(23 * 60 + 45, Math.ceil((t.getHours() * 60 + t.getMinutes()) / 15) * 15); horaSugerida = hhmmDe(m); }
    }
    out.push({ dia, pulsoMax: Math.round(o.pulsoMax), delta: { kcal: dK == null ? null : Math.round(dK), pasos: dP == null ? null : Math.round(dP) }, pico, horaSugerida });
  }
  return out.sort((a, b) => (a.dia < b.dia ? 1 : -1));
}

/** Deportes para las opciones de «¿qué hiciste?», el más habitual primero. */
export function deportesHabituales(weeks, persona, hoy) {
  const n = {};
  for (const e of eventosDeporte(weeks, persona, hoy)) n[e.deporte] = (n[e.deporte] || 0) + 1;
  return [...DEPORTES].sort((a, b) => (n[b.id] || 0) - (n[a.id] || 0)).slice(0, 4);
}

export const EMOJI_DEPORTE = { padel: "🎾", gym: "🏋️", correr: "🏃", futbol: "⚽", bici: "🚴", nadar: "🏊", yoga: "🧘" };

// ── Metas de deporte ────────────────────────────────────────────────────────
// Todo deporte cuenta en su meta (Fran, 30/09/2026): lo que hace una persona en
// SU meta de deporte («Gym/Deporte»), lo que hacéis juntos en la de los dos
// («Hacer deporte juntos»). Solo se rellena lo que no tiene meta: nunca se pisa
// una meta elegida a mano.
const META_DEPORTE = /deporte|\bgym\b|gimnasio|entren|ejercicio/i;

/** La meta de deporte activa de esa persona («person1»/«person2»/«together»), o null. */
export function metaDeporteDe(goals = [], who) {
  return (goals || []).find(g => g && g.active !== false && (g.who || "together") === who && META_DEPORTE.test(String(g.title || ""))) || null;
}

/**
 * Vincula a su meta de deporte las misiones de deporte que no tienen meta. Pura.
 * @returns {{ data, vinculadas: number }}
 */
export function vincularDeporteAMetas(data) {
  const goals = data?.goals || [];
  const metas = { person1: metaDeporteDe(goals, "person1"), person2: metaDeporteDe(goals, "person2"), together: metaDeporteDe(goals, "together") };
  if (!metas.person1 && !metas.person2 && !metas.together) return { data, vinculadas: 0 };
  let vinculadas = 0;
  const weeks = {};
  for (const [k, w] of Object.entries(data.weeks || {})) {
    let cambio = false;
    const missions = (w?.missions || []).map(m => {
      if (!m || m.goalId || !detectarDeporte(m)) return m;
      const meta = metas[m.who || "together"];
      if (!meta) return m;
      cambio = true; vinculadas++;
      return { ...m, goalId: meta.id };
    });
    weeks[k] = cambio ? { ...w, missions } : w;
  }
  return vinculadas ? { data: { ...data, weeks }, vinculadas } : { data, vinculadas: 0 };
}

// ── Aprender el partido típico de cada tipo ─────────────────────────────────
// Con al menos MIN_APRENDER partidos de un tipo confirmados por el reloj, su valor
// típico pasa a ser la mediana de lo que el reloj midió en TUS partidos de ese tipo.
// Validación justa (30/09/2026, aprendido SOLO de la app y comparado con 13
// sesiones reales de Huawei que no intervienen): error medio 19 % → 17 %, mediano
// 10 % → 9 %, peor caso 60 % → 50 % frente al típico general. Con pocos partidos por
// tipo (5–7) empeoraba, por eso el umbral.
// Umbral alto a propósito: con 5–7 partidos por tipo, el típico propio empeoraba la
// estimación fuera de muestra. Con 15+ confirmados de un tipo, la mediana ya es estable.
export const MIN_APRENDER = 15;

export function aprenderTipicas(evaluados = []) {
  const grupos = {};
  for (const e of evaluados) {
    if (e.nivel !== "confirmado" || !Number.isFinite(e.kcalMedidas)) continue;
    (grupos[`${e.deporte}:${e.variante || ""}`] ||= []).push(e.kcalMedidas);
  }
  const out = {};
  for (const [clave, xs] of Object.entries(grupos)) {
    if (xs.length < MIN_APRENDER) continue;
    if (!clave.split(":")[1]) continue;           // solo tipos (masculino/mixto)
    const s = [...xs].sort((a, b) => a - b);
    out[clave] = Math.round(s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2);
  }
  return out;
}

/**
 * Lo que distingue a cada tipo de partido EN TUS DATOS: cuántos hay, el pulso
 * máximo mediano y las kcal de más que midió el reloj (confirmados). Para enseñarlo.
 * @returns {Array<{ nombre, partidos, confirmados, pulsoMax:number|null, kcalMedidas:number|null, kcalMinReloj:number|null, usandose:boolean }>}
 */
export function estadisticasPorTipo(evaluados = [], tipicas = {}) {
  const med = xs => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
  const out = [];
  for (const dep of DEPORTES) {
    for (const [v, def] of Object.entries(dep.variantes || {})) {
      const es = evaluados.filter(e => e.deporte === dep.id && e.variante === v);
      if (!es.length) continue;
      const conf = es.filter(e => e.nivel === "confirmado");
      out.push({ nombre: def.nombre, partidos: es.length, confirmados: conf.length, pulsoMax: med(conf.map(e => e.pulsoMax)),
        kcalMedidas: med(conf.map(e => e.kcalMedidas)), kcalMinReloj: def.kcalMin ?? null, usandose: `${dep.id}:${v}` in tipicas });
    }
  }
  return out;
}
