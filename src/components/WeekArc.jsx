import { DEFAULT_COLORS } from "../constants.js";

// Punto sobre la curva Bézier cuadrática del arco base: M20,130 Q200,10 380,130
const P0 = { x: 20, y: 130 }, CP = { x: 200, y: 10 }, P2 = { x: 380, y: 130 };
function arcPoint(t) {
  const mt = 1 - t;
  return {
    x: mt * mt * P0.x + 2 * mt * t * CP.x + t * t * P2.x,
    y: mt * mt * P0.y + 2 * mt * t * CP.y + t * t * P2.y,
  };
}
// t equiespaciados dentro de un rango (centrados), máximo n
function spread(count, from, to) {
  if (count <= 0) return [];
  if (count === 1) return [(from + to) / 2];
  const step = (to - from) / (count - 1);
  return Array.from({ length: count }, (_, i) => from + i * step);
}

export default function WeekArc({ missions = [], colors, onSelectMission, p1Name = "P1", p2Name = "P2" }) {
  const clr = { ...DEFAULT_COLORS, ...colors };

  // Solo tareas (excluye eventos) y priorizamos pendientes para que la jerarquía tenga sentido
  const real = missions.filter(m => m.type !== "event");
  const byPending = (a, b) => (a.status === "DONE" ? 1 : 0) - (b.status === "DONE" ? 1 : 0);
  const MAX_SIDE = 4, MAX_MID = 3;

  const p1 = real.filter(m => m.who === "person1").sort(byPending).slice(0, MAX_SIDE);
  const p2 = real.filter(m => m.who === "person2").sort(byPending).slice(0, MAX_SIDE);
  const tg = real.filter(m => m.who === "together").sort(byPending).slice(0, MAX_MID);

  const p1Total = real.filter(m => m.who === "person1").length;
  const p2Total = real.filter(m => m.who === "person2").length;
  const tgTotal = real.filter(m => m.who === "together").length;

  // Posicionar: persona1 a la izquierda (t bajo), juntos al centro, persona2 a la derecha (t alto)
  const nodes = [];
  spread(p1.length, 0.10, 0.40).forEach((t, i) => nodes.push({ m: p1[i], t, color: clr.person1, r: 11 }));
  spread(tg.length, 0.44, 0.56).forEach((t, i) => nodes.push({ m: tg[i], t, color: clr.together, r: 13 }));
  spread(p2.length, 0.60, 0.90).forEach((t, i) => nodes.push({ m: p2[i], t, color: clr.person2, r: 11 }));

  if (real.length === 0) return null;

  // Mensaje de balance
  const diff = Math.abs(p1Total - p2Total);
  const balanceMsg = (p1Total + p2Total) === 0
    ? "Semana compartida"
    : diff === 0
      ? "semana equilibrada ⚖️"
      : `${p1Total > p2Total ? p1Name : p2Name} carga un poco más`;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, padding:"6px 0 2px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", width:"100%", fontSize:11.5, fontWeight:600, marginBottom:2, padding:"0 4px" }}>
        <span style={{ color:clr.person1 }}>● {p1Total}</span>
        <span style={{ color:clr.together }}>● Juntos {tgTotal}</span>
        <span style={{ color:clr.person2 }}>{p2Total} ●</span>
      </div>
      <svg viewBox="0 0 400 150" width="100%" height="auto" fill="none" style={{ display:"block" }}>
        <defs>
          <linearGradient id="wa-thread" x1="0" y1="0" x2="400" y2="0">
            <stop offset="0%" stopColor={clr.person1} />
            <stop offset="100%" stopColor={clr.person2} />
          </linearGradient>
        </defs>
        <path d="M20,130 Q200,10 380,130" stroke="url(#wa-thread)" strokeWidth="2.5" opacity="0.45" />
        {nodes.map(({ m, t, color, r }) => {
          const { x, y } = arcPoint(t);
          const isDone = m.status === "DONE";
          return (
            <g key={m.id} style={{ cursor:"pointer" }} onClick={() => onSelectMission && onSelectMission(m)}>
              <circle cx={x} cy={y} r={r} fill={color} opacity={isDone ? 0.4 : 1}
                stroke={isDone ? "none" : "rgba(255,255,255,0.18)"} strokeWidth="1" />
              <text x={x} y={y + 4} fontSize={r >= 13 ? 13 : 11} textAnchor="middle"
                opacity={isDone ? 0.55 : 1} style={{ pointerEvents:"none" }}>{m.emoji || "🎯"}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize:11.5, color:"var(--t-text-muted,#8b7fa8)", textAlign:"center", marginTop:2 }}>
        {balanceMsg}
      </div>
    </div>
  );
}
