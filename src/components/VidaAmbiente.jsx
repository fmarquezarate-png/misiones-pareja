// Visitantes del hábitat (mariposas, pájaros, gaviotas). Ver petAmbiente.js.
//
// Solo transform (cruzar) y opacity/transform (aleteo): nada repinta. Sus
// timers son PROPIOS (no comparten el later()/clearTimers() del paseo: éste se
// vacía al tocar a la mascota y se llevaría por delante el siguiente visitante).
// Un visitante se retira solo al acabar su animación (onAnimationEnd).

import { useCallback, useEffect, useRef, useState } from "react";
import { elegirVisitante, proximaEspera, MAX_A_LA_VEZ } from "../lib/petAmbiente.js";

const url = id => `/mascotas/fauna/${id}.webp?v=1`;

export default function VidaAmbiente({ especie, ancho, alto, activo }) {
  const [lista, setLista] = useState([]);
  const cuenta = useRef(0);
  const recientes = useRef([]);
  const numero = useRef(0);
  cuenta.current = lista.length;

  useEffect(() => {
    if (!activo) { setLista([]); return undefined; }
    const timers = new Set();
    let vivo = true;
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (vivo) fn(); }, ms); timers.add(id); };
    const aparece = () => {
      if (cuenta.current < MAX_A_LA_VEZ) {
        const v = elegirVisitante(especie, Math.random, alto, recientes.current);
        if (v) {
          recientes.current = [v.id, ...recientes.current].slice(0, 3);
          setLista(l => [...l, { ...v, k: ++numero.current }]);
        }
      }
      later(aparece, proximaEspera(Math.random) * 1000);
    };
    // El primero, pronto: que se note que el hábitat está vivo.
    later(aparece, 2500);
    return () => { vivo = false; timers.forEach(clearTimeout); timers.clear(); };
  }, [activo, especie, alto]);

  const quitar = useCallback(k => setLista(l => l.filter(x => x.k !== k)), []);
  if (!activo || !lista.length) return null;

  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {lista.map(v => {
        const x0 = v.dir > 0 ? -v.ancho - 10 : ancho + 10, x1 = v.dir > 0 ? ancho + 10 : -v.ancho - 10;
        return (
          <div key={v.k} onAnimationEnd={e => { if (e.target === e.currentTarget) quitar(v.k); }}
            style={{ position: "absolute", left: 0, top: v.y, "--x0": `${x0}px`, "--x1": `${x1}px`, animation: `mpCruza ${v.dur.toFixed(1)}s linear forwards`, willChange: "transform" }}>
            <div style={{ animation: `mpAletea ${v.tipo === "gaviota" ? 2.6 : v.tipo === "pajaro" ? 0.9 : 1.4}s ease-in-out infinite alternate` }}>
              <img src={url(v.id)} alt="" draggable={false} width={v.ancho} height={v.alto}
                style={{ display: "block", imageRendering: "pixelated", transform: v.volteado ? "scaleX(-1)" : undefined,
                  animation: v.tipo === "mariposa" || v.tipo === "abeja" ? "mpAlas 0.28s ease-in-out infinite alternate" : undefined, transformOrigin: "50% 50%" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
