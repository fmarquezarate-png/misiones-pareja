// Lluvia del hábitat: nubes de tormenta, gotas en dos capas y ondas/charcos.
// `sinLluvia`: solo las nubes (cielo cubierto o niebla, sin gotas).
// Solo transform y opacity. Sin «reducir movimiento»: nubes y velo quietos, sin gotas.
// Ver petClima.js.

import { useMemo } from "react";
import { gotas, rizos } from "../lib/petClima.js";
import { rngConSemilla } from "../lib/petBehavior.js";

const img = id => `/mascotas/clima/${id}.webp?v=1`;
const DIM = { nube_lluvia_0: [200, 63], nube_lluvia_1: [137, 59], onda_0: [182, 68], onda_1: [136, 60], charco_0: [104, 68], charco_1: [107, 27] };

export default function Lluvia({ sinLluvia = false, intensidad = 1, tormenta = false, agua = false, ancho, alto, horizonte, reducir = false }) {
  const gs = useMemo(() => gotas({ intensidad, tormenta, ancho, alto }, rngConSemilla(7 + intensidad)), [intensidad, tormenta, ancho, alto]);
  const rs = useMemo(() => rizos({ agua, ancho, alto, horizonte }, rngConSemilla(31), tormenta || intensidad > 1 ? 8 : 5), [agua, ancho, alto, horizonte, tormenta, intensidad]);
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* Nubes de lluvia: solo arriba, despacio */}
      {[["nube_lluvia_0", 6, 70], ["nube_lluvia_1", 34, 95]].map(([id, top, seg], i) => (
        <img key={id} src={img(id)} alt="" draggable={false} width={DIM[id][0]} height={DIM[id][1]}
          style={{ position: "absolute", left: `${i * 46}%`, top, filter: `blur(0.7px) brightness(${tormenta ? 0.72 : 0.92})`, opacity: 0.92,
            animation: reducir ? undefined : `mpNube ${seg}s linear ${-i * 30}s infinite` }} />
      ))}
      {!reducir && !sinLluvia && rs.map((r, i) => (
        <img key={`r${i}`} src={img(r.id)} alt="" draggable={false} width={Math.round(DIM[r.id][0] * r.escala)} height={Math.round(DIM[r.id][1] * r.escala)}
          style={{ position: "absolute", left: r.x, top: r.y, imageRendering: "pixelated", opacity: 0, transformOrigin: "50% 60%",
            animation: `mpRizo ${r.dur}s ease-out ${r.delay}s infinite` }} />
      ))}
      {!reducir && !sinLluvia && gs.map((g, i) => (
        // `rotate` (propiedad independiente) se compone con el `transform` animado: una sola capa por gota.
        <span key={i} style={{ position: "absolute", left: g.x, top: -40, width: g.cerca ? 2 : 1.5, height: g.largo, borderRadius: 2, opacity: g.op, rotate: "12deg",
          background: "linear-gradient(to bottom, rgba(225,238,255,0), rgba(225,238,255,0.95))",
          "--dx": `${g.dx}px`, "--dy": `${g.dy}px`, animation: `mpGota ${g.dur}s linear ${g.delay}s infinite`, willChange: "transform" }} />
      ))}
    </div>
  );
}
