// Visitantes del hábitat: mariposas y pájaros en el prado de Broot, gaviotas
// sobre el mar de Nix. Solo ambiente — pasan de largo, no interactúan.
//
// Puro: la elección y el reparto se prueban con un rng con semilla. Los dibujos
// están en public/mascotas/fauna/ (recortados de las hojas de entorno).
//
// Reglas: de día (no de noche), con el tiempo apacible (nada de lluvia, nieve
// ni tormenta), con la app a la vista y sin «reducir movimiento». Como mucho
// dos a la vez, con esperas largas entre uno y otro: son un detalle, no un
// espectáculo.

export const MAX_A_LA_VEZ = 2;
export const ESPERA_S = [6, 16];

// mira: hacia dónde MIRA el dibujo original (1 = derecha, -1 = izquierda).
// escala: sobre el tamaño del dibujo. y: banda vertical (fracción del alto).
// dur: segundos en cruzar. El vuelo ondulante lo pone el componente.
export const FAUNA = {
  broot: [
    { id: "mariposa_naranja",  tipo: "mariposa", w: 41, h: 31, mira: -1, escala: 0.9, y: [0.42, 0.78], dur: [20, 30], peso: 3 },
    { id: "mariposa_amarilla", tipo: "mariposa", w: 35, h: 27, mira: -1, escala: 0.9, y: [0.42, 0.78], dur: [20, 30], peso: 3 },
    { id: "mariposa_azul",     tipo: "mariposa", w: 39, h: 35, mira: -1, escala: 0.9, y: [0.42, 0.78], dur: [20, 30], peso: 3 },
    { id: "mariposa_blanca",   tipo: "mariposa", w: 30, h: 35, mira: -1, escala: 0.9, y: [0.42, 0.78], dur: [20, 30], peso: 2 },
    { id: "abeja",             tipo: "abeja",    w: 44, h: 36, mira: -1, escala: 0.8, y: [0.45, 0.75], dur: [14, 20], peso: 2 },
    { id: "pajaro_azul_a",     tipo: "pajaro",   w: 53, h: 26, mira: 1,  escala: 0.85, y: [0.10, 0.34], dur: [9, 14],  peso: 2 },
    { id: "pajaro_azul_b",     tipo: "pajaro",   w: 43, h: 26, mira: -1, escala: 0.85, y: [0.10, 0.34], dur: [9, 14],  peso: 2 },
    { id: "petirrojo",         tipo: "pajaro",   w: 46, h: 26, mira: 1,  escala: 0.85, y: [0.10, 0.34], dur: [9, 14],  peso: 2 },
    { id: "pajaro_marron",     tipo: "pajaro",   w: 42, h: 31, mira: -1, escala: 0.85, y: [0.10, 0.34], dur: [9, 14],  peso: 2 },
  ],
  nix: [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({
    id: `gaviota_${i}`, tipo: "gaviota", mira: 1, escala: 0.5, y: [0.05, 0.26], dur: [14, 22], peso: 1,
    ...[{ w: 114, h: 81 }, { w: 78, h: 67 }, { w: 78, h: 75 }, { w: 118, h: 52 }, { w: 93, h: 100 }, { w: 74, h: 60 }, { w: 74, h: 60 }, { w: 146, h: 47 }][i],
  })),
};

/** ¿Pueden aparecer visitantes ahora? */
export function permitido({ fase, clima = {}, visible = true, reducir = false }) {
  if (!visible || reducir) return false;
  if (fase === "noche") return false;
  return !(clima.lluvia || clima.nieve || clima.tormenta);
}

const entre = (rng, [a, b]) => a + rng() * (b - a);

/** Segundos hasta el próximo visitante. */
export const proximaEspera = rng => entre(rng, ESPERA_S);

/**
 * Elige un visitante y su recorrido.
 * @returns {{ id, tipo, w, h, dir:1|-1, volteado:boolean, y:number, dur:number, ancho:number }|null}
 *   `y` en px desde arriba; `volteado`: hay que reflejar el dibujo para que mire hacia donde va.
 */
export function elegirVisitante(especie, rng, alto, recientes = []) {
  const lista = FAUNA[especie];
  if (!lista) return null;
  // Sin repetir enseguida al mismo.
  const cand = lista.filter(f => !recientes.includes(f.id));
  const base = cand.length ? cand : lista;
  const total = base.reduce((a, f) => a + f.peso, 0);
  let r = rng() * total, f = base[base.length - 1];
  for (const x of base) { r -= x.peso; if (r <= 0) { f = x; break; } }
  const dir = rng() < 0.5 ? 1 : -1;
  return {
    id: f.id, tipo: f.tipo, dir,
    ancho: Math.round(f.w * f.escala), alto: Math.round(f.h * f.escala),
    volteado: dir !== f.mira,
    y: Math.round(entre(rng, f.y) * alto),
    dur: entre(rng, f.dur),
  };
}
