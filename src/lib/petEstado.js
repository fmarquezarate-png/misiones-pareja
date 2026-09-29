// Cómo los DATOS reales de hoy se ven en la mascota.
//
// El motor (pet.js) decide la forma a largo plazo; el comportamiento
// (petBehavior.js) decide qué hace en cada momento. Esto es lo que faltaba:
// el puente visible entre lo que envía el reloj y lo que se ve en pantalla,
// para que se note que ella "come" de tus datos, no solo cada semana.
//
// Reglas de Fran que NO se tocan aquí:
//   · «Triste» solo existe por falta de cariño. Un mal día de sueño la vuelve
//     más tranquila, jamás triste ni enferma.
//   · Un día sin dato es neutro: sin dato no hay efecto ni mensaje.
//   · Cada uno alimenta solo a la suya.
//
// Puro: recibe filas + la simulación ya hecha y devuelve datos. Sin reloj, sin
// DOM, así se prueba con números.

import { sumarDias } from "./pet.js";

const hm = h => { const H = Math.floor(h), M = Math.round((h - H) * 60); return M === 60 ? `${H + 1} h` : `${H} h ${String(M).padStart(2, "0")}`; };
const mediana = xs => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Energía = cuánto se mueve (largo de las pausas). 1 = ritmo normal. Nunca
// pasa de 1,1: dormir muy bien anima un poco, no la vuelve loca.
export const ENERGIA = { min: 0.6, max: 1.1 };
export function energiaPorSueno(horas) {
  if (!Number.isFinite(horas)) return 1;
  if (horas < 5) return 0.6;
  if (horas < 6) return 0.75;
  if (horas < 7) return 0.9;
  return horas >= 7.5 ? ENERGIA.max : 1;
}
export function nivelSueno(horas) {
  if (!Number.isFinite(horas)) return null;
  return horas >= 7 ? "descansada" : horas >= 6 ? "justa" : "corta";
}

/** Días seguidos con todas las metas diarias cumplidas (los sin dato ni suman ni cortan). */
export function rachaPerfecta(historial = [], hoyCumplido = false) {
  let n = hoyCumplido ? 1 : 0;
  for (let i = historial.length - 1; i >= 0; i--) {
    const p = historial[i].puntuacion;
    if (p == null) continue;
    if (p >= 1) n++; else break;
  }
  return n;
}

/**
 * @param {{ filas: Array<{day,metric,value}>, sim: ReturnType<import('./pet.js').simular>, hoy: string }} p
 */
export function estadoDeDatos({ filas = [], sim, hoy }) {
  const metas = sim?.hoy?.metas || [];
  const de = tipo => metas.find(m => m.tipo === tipo);

  const sueño = de("sueno");
  const horas = sueño?.valor != null ? sueño.valor : null;
  const sueno = horas != null ? { horas, nivel: nivelSueno(horas) } : null;

  const p = de("pasos");
  const pasos = p?.valor != null ? { valor: p.valor, objetivo: p.objetivo, frac: Math.min(1, p.valor / p.objetivo), cumplida: !!p.cumplida } : null;

  // Pulso en reposo: hoy (o el último de los 2 últimos días) frente a la
  // mediana de las 4 semanas anteriores. Solo informa; no cambia su ánimo.
  const desde = sumarDias(hoy, -30);
  const rhr = filas.filter(f => f.metric === "resting_heart_rate" && f.day >= desde && f.day <= hoy && Number.isFinite(f.value) && f.value > 0);
  const ultimo = [...rhr].sort((a, b) => (a.day < b.day ? 1 : -1)).find(f => f.day >= sumarDias(hoy, -1));
  const base = mediana(rhr.filter(f => f.day < (ultimo?.day || hoy)).map(f => f.value));
  let pulso = null;
  if (ultimo && base != null && rhr.length >= 8) {
    const diff = Math.round(ultimo.value - base);
    pulso = { valor: Math.round(ultimo.value), base: Math.round(base), diff, nivel: diff >= 5 ? "alto" : diff <= -3 ? "bajo" : "normal" };
  }

  const todasHoy = metas.length > 0 && metas.every(m => m.cumplida);
  const racha = rachaPerfecta(sim?.historial || [], todasHoy);

  const energia = energiaPorSueno(horas);
  const aura = racha >= 3 ? "racha" : pasos?.cumplida ? "pasos" : null;

  // La frase que se ve bajo la mascota. Una sola, la más útil, siempre en
  // positivo o neutra. Orden: lo que acaba de pasar > lo que explica su ritmo.
  let burbuja = null;
  if (pasos?.cumplida) burbuja = { icono: "✨", texto: `¡Meta de pasos lograda hoy! (${pasos.valor.toLocaleString("es-ES")})` };
  else if (sueno?.nivel === "corta") burbuja = { icono: "💤", texto: `Dormiste ${hm(sueno.horas)}: hoy va más despacio, con calma.` };
  else if (racha >= 3) burbuja = { icono: "🔥", texto: `${racha} días seguidos cumpliendo tus metas.` };
  else if (sueno?.nivel === "descansada" && horas >= 7.5) burbuja = { icono: "🌟", texto: `Dormiste ${hm(sueno.horas)}: viene con energía.` };
  else if (pulso?.nivel === "alto") burbuja = { icono: "❤️", texto: `Tu pulso en reposo va ${pulso.diff} lpm por encima de lo normal: hoy, tranquilidad.` };

  const insignias = [];
  if (sueno) insignias.push({ id: "sueno", icono: "🌙", texto: hm(sueno.horas), tono: sueno.nivel === "corta" ? "aviso" : "bien" });
  if (pasos) insignias.push({ id: "pasos", icono: "👟", texto: `${Math.round(pasos.frac * 100)} %`, tono: pasos.cumplida ? "bien" : "neutro" });
  if (pulso) insignias.push({ id: "pulso", icono: "❤️", texto: `${pulso.valor} lpm`, tono: pulso.nivel === "alto" ? "aviso" : "neutro" });
  if (racha >= 2) insignias.push({ id: "racha", icono: "🔥", texto: `${racha} d`, tono: "bien" });

  return { energia, sueno, pasos, pulso, racha, aura, burbuja, insignias };
}
