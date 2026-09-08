// Director de celebraciones (v5.26.0).
//
// Antes cada celebración vivía en su propio `useState` y se pisaban entre ellas:
// completar dos tareas seguidas reemplazaba el estado del aviso, React lo
// re-montaba (la `key` incluía el %) y la animación se CORTABA a media. Si una
// era "juntos", el overlay a pantalla completa y el aviso corrían a la vez, uno
// encima del otro. Eso es el "a veces se traba y no se ve del todo bien".
//
// Aquí vive la decisión —pura y testeable— de qué se ve, qué se encola, qué se
// fusiona y qué se descarta. Nunca hay dos celebraciones en pantalla.

import { useCallback, useState } from "react";

// Mayor gana la pantalla.
export const PRIORITY = { special: 3, juntos: 2, congrat: 1 };

// Dos avisos de progreso seguidos NO se cortan: se fusionan en uno que va desde
// donde estaba la barra hasta el nuevo total. La animación continúa, no salta.
export function mergeCongrat(prev, next) {
  const beforePct = prev.beforePct;
  return { ...next, beforePct, delta: next.afterPct - beforePct };
}

// `key` estable por tipo: si dos avisos de progreso se fusionan, React NO
// re-monta el componente (la barra sigue viva). Un "juntos" distinto sí re-monta.
export function celebrationKey(item) {
  if (!item) return null;
  if (item.kind === "juntos") return `juntos-${item.payload?.mission?.id ?? "x"}`;
  return item.kind;
}

const empty = { current: null, queue: [] };

// Llega una celebración nueva. Devuelve el estado siguiente. Puro.
export function pushCelebration(state = empty, incoming, { maxQueue = 1 } = {}) {
  if (!incoming?.kind) return state;
  const cur = state.current;
  if (!cur) return { current: incoming, queue: state.queue };

  // El día especial manda: interrumpe lo que haya y vacía la cola.
  if (incoming.kind === "special") return { current: incoming, queue: [] };
  // …y nada lo interrumpe a él.
  if (cur.kind === "special") return state;

  // Dos avisos de progreso → uno solo, fusionado, sin re-montar.
  if (cur.kind === "congrat" && incoming.kind === "congrat") {
    return { current: { ...incoming, payload: mergeCongrat(cur.payload, incoming.payload) }, queue: state.queue };
  }
  // Ya se está celebrando algo mayor: el aviso de progreso sobra.
  if (cur.kind === "juntos" && incoming.kind === "congrat") return state;
  // Un "juntos" desplaza a un aviso de progreso (el aviso se descarta, es menor).
  if (cur.kind === "congrat" && incoming.kind === "juntos") return { current: incoming, queue: state.queue };

  // juntos + juntos → se encola (con tope, para no encadenar diez seguidas).
  if (state.queue.length >= maxQueue) return state;
  return { current: cur, queue: [...state.queue, incoming] };
}

// Termina la celebración actual: pasa la siguiente de la cola. Puro.
export function shiftCelebration(state = empty) {
  const [next, ...rest] = state.queue;
  return { current: next ?? null, queue: rest };
}

// Hook fino sobre las funciones puras — la lógica sigue estando arriba.
export function useCelebrations() {
  const [state, setState] = useState(empty);
  const celebrate = useCallback((kind, payload) => {
    setState(s => pushCelebration(s, { kind, payload }));
  }, []);
  const celebrationDone = useCallback(() => setState(shiftCelebration), []);
  return { celebration: state.current, celebrate, celebrationDone };
}
