import { useState } from "react";
import { teamById } from "../lib/teams.js";

// Escudo de un equipo. Si existe `/escudos/{id}.png` se usa ese; si no, se
// DIBUJA uno con los colores y el patrón de camiseta del equipo. Así los 40
// equipos están disponibles desde el primer día y los escudos oficiales se
// pueden ir añadiendo archivo a archivo, sin tocar código ni desplegar nada.
export const crestUrl = id => `/escudos/${id}.png`;

// Un fallo de imagen se recuerda a nivel de módulo: si el PNG no está, no se
// vuelve a pedir en cada render de cada tarjeta.
const missing = new Set();

const SHIELD = "M12 1.6 2.6 5.3v6.8c0 5.9 4.2 9.3 9.4 11.3 5.2-2 9.4-5.4 9.4-11.3V5.3Z";

function Drawn({ team, size }) {
  const [a, b] = team.colors;
  const cid = `crest-${team.id}`;
  let fill;
  if (team.pattern === "stripes") {
    const n = 7, w = 19 / n;
    fill = Array.from({ length: n }, (_, i) =>
      <rect key={i} x={2.5 + i * w} y="0" width={w + 0.05} height="24" fill={i % 2 ? b : a} />);
  } else if (team.pattern === "halves") {
    fill = [<rect key="l" x="0" y="0" width="12" height="24" fill={a} />,
            <rect key="r" x="12" y="0" width="12" height="24" fill={b} />];
  } else if (team.pattern === "sash") {
    fill = [<rect key="bg" x="0" y="0" width="24" height="24" fill={a} />,
            <path key="s" d="M-2 16 L16 -2 L22 4 L4 22 Z" fill={b} />];
  } else {
    fill = [<rect key="bg" x="0" y="0" width="24" height="24" fill={a} />];
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <defs><clipPath id={cid}><path d={SHIELD} /></clipPath></defs>
      <g clipPath={`url(#${cid})`}>{fill}</g>
      <path d={SHIELD} fill="none" stroke="#1a1a1a" strokeWidth="2.4" strokeLinejoin="round" opacity="0.35" />
      <path d={SHIELD} fill="none" stroke="#EDBB00" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export default function TeamCrest({ teamId, size = 20, style }) {
  const team = teamById(teamId);
  const [failed, setFailed] = useState(() => missing.has(teamId));
  if (!team) return null;
  if (failed) return <Drawn team={team} size={size} />;
  return (
    <img
      src={crestUrl(team.id)} alt="" draggable={false} title={team.short}
      onError={() => { missing.add(team.id); setFailed(true); }}
      style={{ width: size, height: size, objectFit: "contain", display: "block", flexShrink: 0, ...style }}
    />
  );
}
