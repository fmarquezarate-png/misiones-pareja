import { useState } from "react";

// El icono de una misión se guarda como TEXTO (`mission.emoji`) y ese texto
// viaja a sitios donde no cabe una imagen: el cuerpo de las notificaciones
// push, el enlace a Google Calendar, la exportación ICS. Por eso el valor
// guardado sigue siendo un emoji de verdad — el par blaugrana 🔵🔴 — y lo único
// que cambia es cómo se PINTA dentro de la app. Así el escudo se ve donde tiene
// que verse y en el resto degrada solo a dos círculos azulgrana, sin sentinelas
// raras tipo "img:barca" colándose en un aviso del móvil.
export const BARCA = "🔵🔴";

// Si el repo tiene el escudo oficial en /escudo-barca.png, se usa ese. Si no
// (que es el caso por defecto), se dibuja este escudo blaugrana en SVG: nítido
// a cualquier tamaño y sin depender de ningún archivo.
const CREST_SRC = "/escudo-barca.png";
let crestFailed = false;   // memoria de módulo: si falta, no se reintenta nunca

function BlaugranaShield({ size }) {
  const stripes = ["#004D98", "#A50044", "#004D98", "#A50044", "#004D98", "#A50044", "#004D98"];
  const w = 19 / stripes.length;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <clipPath id="mp-shield">
          <path d="M12 1.6 2.6 5.3v6.8c0 5.9 4.2 9.3 9.4 11.3 5.2-2 9.4-5.4 9.4-11.3V5.3Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#mp-shield)">
        {stripes.map((c, i) => <rect key={i} x={2.5 + i * w} y="0" width={w + 0.05} height="24" fill={c} />)}
      </g>
      <path d="M12 1.6 2.6 5.3v6.8c0 5.9 4.2 9.3 9.4 11.3 5.2-2 9.4-5.4 9.4-11.3V5.3Z"
        fill="none" stroke="#EDBB00" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}

// `size` en píxeles cuando se pinta el escudo; el emoji normal usa `fontSize`.
export default function MissionEmoji({ emoji, size = 20, style }) {
  const [failed, setFailed] = useState(crestFailed);
  if (emoji !== BARCA) return <span style={{ fontSize: size, ...style }}>{emoji}</span>;
  if (failed) return <BlaugranaShield size={size} />;
  return (
    <img
      src={CREST_SRC} alt="" draggable={false}
      onError={() => { crestFailed = true; setFailed(true); }}
      style={{ width: size, height: size, objectFit: "contain", display: "block", flexShrink: 0, ...style }}
    />
  );
}
