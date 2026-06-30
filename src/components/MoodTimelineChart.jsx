import { useId, useMemo } from "react";
import { aggregateMoods, rollingBand, detectAnnotations } from "../lib/moodAnalysis.js";

// Gráfico de línea con eje 0 centrado, banda de variabilidad local (sube/baja
// con la línea) y anotaciones automáticas (picos, caídas, días atípicos).
// `light` cambia la paleta de ejes/texto para fondos blancos (reporte impreso).
export default function MoodTimelineChart({ moods, light = false }) {
  const uid = useId();
  const posId = `${uid}-pos`;
  const negId = `${uid}-neg`;
  const aboveId = `${uid}-above`;
  const belowId = `${uid}-below`;

  const { points, band, annotations } = useMemo(() => {
    const { points } = aggregateMoods(moods);
    return { points, band: rollingBand(points), annotations: detectAnnotations(points) };
  }, [moods]);

  if (points.length === 0) {
    return (
      <div style={{ textAlign:"center", padding:"36px 0", color: light ? "#9a93b0" : "var(--t-text-muted,#8b7fa8)", fontSize:13 }}>
        Sin datos en este período
      </div>
    );
  }

  const W = 340, H = 200;
  const PAD = { top:18, right:16, bottom:28, left:30 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const getX = i => PAD.left + (points.length < 2 ? chartW / 2 : (i / (points.length - 1)) * chartW);
  const getY = score => PAD.top + ((10 - score) / 20) * chartH;
  const yZero = getY(0);

  const linePts = points.map((p, i) => ({ x: getX(i), y: getY(p.avg) }));
  const linePath = linePts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");

  const upperPath = band.map((b, i) => `${i === 0 ? "M" : "L"}${getX(i).toFixed(1)},${getY(b.upper).toFixed(1)}`).join(" ");
  const lowerPath = [...band].map((b, i) => ({ x: getX(i), y: getY(b.lower) })).reverse()
    .map(pt => `L${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
  const bandPath = points.length > 1 ? `${upperPath} ${lowerPath} Z` : "";

  const labelStep = Math.max(1, Math.ceil(points.length / 8));
  const axisColor    = light ? "rgba(0,0,0,0.4)"  : "rgba(255,255,255,0.28)";
  const gridColor     = light ? "rgba(0,0,0,0.1)"  : "rgba(255,255,255,0.05)";
  const zeroLineColor = light ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.18)";
  const lineColor     = light ? "rgba(109,40,217,0.7)" : "rgba(167,139,250,0.6)";

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible", display:"block" }}>
      <defs>
        <linearGradient id={posId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id={negId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.32" />
        </linearGradient>
        <clipPath id={aboveId}><rect x={0} y={0} width={W} height={yZero} /></clipPath>
        <clipPath id={belowId}><rect x={0} y={yZero} width={W} height={H - yZero} /></clipPath>
      </defs>

      {/* Banda de variabilidad — sigue la línea, coloreada según lado del cero */}
      {bandPath && (
        <>
          <path d={bandPath} fill={`url(#${posId})`} clipPath={`url(#${aboveId})`} />
          <path d={bandPath} fill={`url(#${negId})`} clipPath={`url(#${belowId})`} />
        </>
      )}

      {/* Eje Y */}
      {[-10, -5, 0, 5, 10].map(t => (
        <g key={t}>
          <text x={PAD.left - 5} y={getY(t) + 3.5} textAnchor="end" fontSize="8.5" fill={axisColor}>{t > 0 ? `+${t}` : t}</text>
          <line x1={PAD.left} y1={getY(t)} x2={PAD.left + chartW} y2={getY(t)}
            stroke={t === 0 ? zeroLineColor : gridColor} strokeWidth={t === 0 ? 1 : 0.5} />
        </g>
      ))}

      {/* Eje X */}
      {points.map((p, i) => (i % labelStep === 0 || i === points.length - 1) && (
        <text key={i} x={linePts[i].x} y={H - 6} textAnchor="middle" fontSize="8" fill={axisColor}>{p.label}</text>
      ))}

      {/* Línea */}
      {linePts.length > 1 && <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" />}

      {/* Puntos */}
      {linePts.map((pt, i) => {
        const clr = points[i].avg >= 0 ? "#34d399" : "#f43f5e";
        return (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r={3.6} fill={clr} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
            <title>{points[i].label} · {points[i].avg > 0 ? "+" : ""}{points[i].avg.toFixed(1)} · {points[i].count} registro{points[i].count !== 1 ? "s" : ""}</title>
          </g>
        );
      })}

      {/* Anotaciones automáticas */}
      {annotations.map((a, i) => {
        const pt = linePts[a.idx];
        if (!pt) return null;
        const labelAbove = pt.y > H / 2;
        const ty = labelAbove ? pt.y - 13 : pt.y + 17;
        const ringClr = a.type === "anomaly" ? "#f59e0b" : a.type === "rise" ? "#34d399" : "#f43f5e";
        return (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r={7.5} fill="none" stroke={ringClr} strokeWidth={1.3} strokeDasharray="2.5 2" />
            <text x={pt.x} y={ty} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={ringClr}>{a.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
