import { useState, useId, useMemo } from "react";
import { EMOTIONS } from "../constants.js";
import { dlBlob } from "../utils.js";

const EMOTION_BY_ID = Object.fromEntries(EMOTIONS.map(e => [e.id, e]));

const PERIODS = [["7d","7 días"],["30d","30 días"],["90d","90 días"],["all","Todo"]];

function filterMoods(moods, period, who) {
  let list = [...moods];
  if (period !== "all") {
    const days = parseInt(period);
    const cutoff = Date.now() - days * 86400000;
    list = list.filter(m => m.ts >= cutoff);
  }
  if (who !== "all") list = list.filter(m => m.who === who);
  return list.sort((a, b) => b.ts - a.ts);
}

function MoodChart({ moods, p1, p2, colors }) {
  const uid = useId();
  const posId = `${uid}-pos`;
  const negId = `${uid}-neg`;
  if (moods.length === 0) {
    return (
      <div style={{ textAlign:"center", padding:"36px 0", color:"var(--t-text-muted,#8b7fa8)", fontSize:13 }}>
        Sin datos en este período
      </div>
    );
  }

  const sorted = [...moods].sort((a, b) => a.ts - b.ts);
  const W = 340, H = 180;
  const PAD = { top:18, right:16, bottom:28, left:30 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const getX = i => PAD.left + (sorted.length < 2 ? chartW / 2 : (i / (sorted.length - 1)) * chartW);
  const getY = score => PAD.top + ((10 - score) / 20) * chartH;

  const yZero = getY(0);
  const points = sorted.map((m, i) => ({
    x: getX(i), y: getY(m.valence * m.intensity), m,
  }));

  const linePath = points.map((p, i) => `${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible", display:"block" }}>
      <defs>
        <linearGradient id={posId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id={negId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      {/* Background zones */}
      <rect x={PAD.left} y={PAD.top} width={chartW} height={Math.max(0, yZero - PAD.top)} fill={`url(#${posId})`} rx="3" />
      <rect x={PAD.left} y={yZero} width={chartW} height={Math.max(0, PAD.top + chartH - yZero)} fill={`url(#${negId})`} rx="3" />

      {/* Y axis ticks */}
      {[-10,-5,0,5,10].map(t => (
        <g key={t}>
          <text x={PAD.left - 5} y={getY(t) + 3.5} textAnchor="end" fontSize="8.5" fill="rgba(255,255,255,0.28)">{t>0?`+${t}`:t}</text>
          <line x1={PAD.left} y1={getY(t)} x2={PAD.left + chartW} y2={getY(t)}
            stroke={t === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)"}
            strokeWidth={t === 0 ? 1 : 0.5} />
        </g>
      ))}

      {/* Connecting line */}
      {points.length > 1 && (
        <path d={linePath} fill="none" stroke="rgba(167,139,250,0.55)" strokeWidth="1.5" strokeLinejoin="round" />
      )}

      {/* Dots */}
      {points.map((p, i) => {
        const score  = p.m.valence * p.m.intensity;
        const dotClr = score >= 0 ? "#34d399" : "#f43f5e";
        const pClr   = p.m.who === "person1" ? colors.person1 : colors.person2;
        const em     = EMOTION_BY_ID[p.m.emotion];
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4.5} fill={dotClr} stroke={pClr} strokeWidth={2} />
            <title>{em?.label} ×{p.m.intensity} · {score>0?"+":""}{score} · {p.m.who==="person1"?p1:p2} · {p.m.date}</title>
          </g>
        );
      })}
    </svg>
  );
}

export default function MoodView({ moods = [], p1, p2, colors, onAddMood }) {
  const [period,    setPeriod]    = useState("30d");
  const [who,       setWho]       = useState("all");
  const [showTable, setShowTable] = useState(false);

  const filtered = filterMoods(moods, period, who);
  const { avgScore, posCount, negCount } = useMemo(() => {
    if (filtered.length === 0) return { avgScore: null, posCount: 0, negCount: 0 };
    const { sum, pos, neg } = filtered.reduce((acc, m) => {
      const s = m.valence * m.intensity;
      return { sum: acc.sum + s, pos: acc.pos + (m.valence > 0 ? 1 : 0), neg: acc.neg + (m.valence < 0 ? 1 : 0) };
    }, { sum: 0, pos: 0, neg: 0 });
    return { avgScore: (sum / filtered.length).toFixed(1), posCount: pos, negCount: neg };
  }, [filtered]); // filtered is the only real dep; p1/p2 are string props that don't affect computation

  const personName = (who) => who === "person1" ? p1 : p2;

  const exportCSV = () => {
    const header = ["fecha","quien","emocion","valencia","intensidad","puntuacion","nota"];
    const rows = [...filtered].sort((a,b) => a.ts-b.ts).map(m => [
      m.date,
      personName(m.who),
      EMOTION_BY_ID[m.emotion]?.label || m.emotion,
      m.valence > 0 ? "positiva" : "negativa",
      m.intensity,
      m.valence * m.intensity,
      `"${(m.note||"").replace(/"/g,'""')}"`,
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    dlBlob(new Blob(["﻿" + csv], { type:"text/csv;charset=utf-8" }), "animo-export.csv");
  };

  if (moods.length === 0) {
    return (
      <div style={{ textAlign:"center", padding:"56px 20px" }}>
        <div style={{ fontSize:52, marginBottom:14 }}>🧠</div>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, marginBottom:10, color:"var(--t-text,#f8f4ff)" }}>Seguimiento de ánimo</div>
        <div style={{ fontSize:13, color:"var(--t-text-muted,#8b7fa8)", lineHeight:1.7, marginBottom:28, maxWidth:300, margin:"0 auto 28px" }}>
          Cada día a las <strong>18:00</strong> aparece un popup automático.<br />
          También puedes registrar en cualquier momento.
        </div>
        <button onClick={onAddMood}
          style={{ background:"var(--t-btn-grad,linear-gradient(135deg,#f472b6,#a78bfa))", border:"none", borderRadius:14, color:"#fff", padding:"13px 32px", cursor:"pointer", fontFamily:"inherit", fontSize:15, fontWeight:700 }}>
          ✍️ Primer registro
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:700, color:"var(--t-text,#f8f4ff)" }}>🧠 Ánimo</div>
        <button onClick={onAddMood}
          style={{ background:"var(--t-btn-grad,linear-gradient(135deg,#f472b6,#a78bfa))", border:"none", borderRadius:12, color:"#fff", padding:"8px 16px", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600 }}>
          + Registrar
        </button>
      </div>

      {/* Period filter */}
      <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:10 }}>
        {PERIODS.map(([k,l]) => (
          <button key={k} onClick={() => setPeriod(k)}
            style={{ background: period===k?"rgba(167,139,250,0.18)":"rgba(128,128,128,0.07)", border:`1px solid ${period===k?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.07)"}`, borderRadius:99, color: period===k?"#c4b8ff":"var(--t-text-muted,#6b5f88)", padding:"4px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight: period===k?600:400 }}>
            {l}
          </button>
        ))}
      </div>

      {/* Who filter */}
      <div style={{ display:"flex", gap:7, marginBottom:16 }}>
        {[["all","Ambos",null],["person1",p1,colors.person1],["person2",p2,colors.person2]].map(([k,l,c]) => {
          const active = who === k;
          const bg = active ? (c ? `${c}22` : "rgba(167,139,250,0.18)") : "rgba(128,128,128,0.07)";
          const bd = active ? (c || "rgba(167,139,250,0.4)") : "rgba(255,255,255,0.07)";
          const cl = active ? (c || "#c4b8ff") : "var(--t-text-muted,#6b5f88)";
          return (
            <button key={k} onClick={() => setWho(k)}
              style={{ background:bg, border:`1px solid ${bd}`, borderRadius:99, color:cl, padding:"4px 12px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:active?600:400 }}>
              {l}
            </button>
          );
        })}
      </div>

      {/* Stats strip */}
      {filtered.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
          {[
            { label:"Promedio", value: avgScore, color: Number(avgScore) >= 0 ? "#34d399" : "#f43f5e", bg:"rgba(255,255,255,0.04)" },
            { label:"Positivos", value: posCount, color:"#34d399", bg:"rgba(52,211,153,0.08)" },
            { label:"Negativos", value: negCount, color:"#f43f5e", bg:"rgba(244,63,94,0.08)" },
          ].map(s => (
            <div key={s.label} style={{ background:s.bg, borderRadius:14, padding:"10px 8px", textAlign:"center" }}>
              <div style={{ fontSize:22, fontFamily:"'Fraunces',serif", fontWeight:700, color:s.color, lineHeight:1 }}>{s.value !== null ? (Number(s.value) > 0 && s.label==="Promedio" ? `+${s.value}` : s.value) : "—"}</div>
              <div style={{ fontSize:10, color:"var(--t-text-dim,#4a4166)", marginTop:4, textTransform:"uppercase", letterSpacing:0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:"12px 8px 8px", marginBottom:14 }}>
        <MoodChart moods={filtered} p1={p1} p2={p2} colors={colors} />
      </div>

      {/* Actions */}
      <div style={{ display:"flex", gap:10, marginBottom:12, alignItems:"center" }}>
        <button onClick={() => setShowTable(!showTable)}
          style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"var(--t-text-muted,#8b7fa8)", padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>
          {showTable ? "▲ Ocultar tabla" : "▼ Ver registros"}
        </button>
        <button onClick={exportCSV}
          style={{ background:"rgba(96,165,250,0.08)", border:"1px solid rgba(96,165,250,0.22)", borderRadius:10, color:"#60a5fa", padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:12, marginLeft:"auto" }}>
          ↓ Exportar CSV
        </button>
      </div>

      {/* Table */}
      {showTable && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.length === 0
            ? <div style={{ textAlign:"center", padding:"24px 0", color:"var(--t-text-muted,#8b7fa8)", fontSize:13 }}>Sin registros en este período</div>
            : filtered.map(m => {
                const em     = EMOTION_BY_ID[m.emotion];
                const score  = m.valence * m.intensity;
                const pColor = m.who === "person1" ? colors.person1 : colors.person2;
                const pLabel = personName(m.who);
                return (
                  <div key={m.id || m.ts} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"10px 14px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:22, flexShrink:0 }}>{em?.emoji}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                          <span style={{ fontWeight:600, fontSize:14, color: score >= 0 ? "#34d399" : "#f43f5e" }}>{em?.label}</span>
                          <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>×{m.intensity}</span>
                          <span style={{ fontSize:11, fontWeight:700, color: score >= 0 ? "#34d399" : "#f43f5e" }}>{score > 0 ? "+" : ""}{score}</span>
                        </div>
                        <div style={{ display:"flex", gap:10, marginTop:3 }}>
                          <span style={{ fontSize:11, color:pColor, fontWeight:600 }}>{pLabel}</span>
                          <span style={{ fontSize:11, color:"var(--t-text-dim,#4a4166)" }}>{m.date}</span>
                        </div>
                      </div>
                    </div>
                    {m.note ? <div style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)", marginTop:8, paddingTop:8, borderTop:"1px solid rgba(255,255,255,0.05)", lineHeight:1.55 }}>{m.note}</div> : null}
                  </div>
                );
              })
          }
        </div>
      )}
    </div>
  );
}
