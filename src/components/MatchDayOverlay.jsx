import { useState, useEffect } from "react";

export default function MatchDayOverlay({ matches, onDone }) {
  const [phase, setPhase] = useState(0); // 0=entering, 1=visible

  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 50);
    return () => clearTimeout(t);
  }, []);

  // Unique teams playing today (from the match list)
  const teams = [...new Set(matches.flatMap(m => [
    m.home !== "TBD" ? m.home : null,
    m.away !== "TBD" ? m.away : null,
  ].filter(Boolean)))];

  const mainTeam = teams[0] || "";
  const matchFlag = matches[0]?.homeFlag || matches[0]?.awayFlag || "⚽";

  return (
    <div
      onClick={onDone}
      style={{
        position: "fixed", inset: 0, zIndex: 2100,
        background: "rgba(0,0,0,0.97)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 28, textAlign: "center", cursor: "pointer",
        opacity: phase === 1 ? 1 : 0,
        transition: "opacity 0.4s ease",
        userSelect: "none",
      }}
    >
      {/* Big ball */}
      <div style={{ fontSize: 72, marginBottom: 12, animation: "matchday-bounce 0.9s ease-in-out infinite alternate" }}>
        ⚽
      </div>

      <style>{`
        @keyframes matchday-bounce {
          from { transform: translateY(0) scale(1); }
          to   { transform: translateY(-10px) scale(1.05); }
        }
        @keyframes matchday-fade {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      <div style={{ fontFamily:"'Fraunces',serif", fontSize:32, fontWeight:700, color:"#22c55e", lineHeight:1.1, marginBottom:8, animation:"matchday-fade 0.5s 0.15s both" }}>
        ¡Día de<br/>partido!
      </div>

      <div style={{ fontSize:14, color:"rgba(255,255,255,0.6)", marginBottom:24, animation:"matchday-fade 0.5s 0.25s both" }}>
        {teams.length === 1
          ? `Hoy juega ${matchFlag} ${mainTeam}`
          : `Hoy juegan ${teams.slice(0,-1).join(", ")} y ${teams[teams.length-1]}`
        }
      </div>

      {/* Match list */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", maxWidth:320, marginBottom:28, animation:"matchday-fade 0.5s 0.35s both" }}>
        {matches.map(m => {
          const daznUrl = `https://www.dazn.com/es-ES/search?query=${encodeURIComponent(`${m.home} ${m.away} FIFA World Cup 2026`)}`;
          return (
            <div key={m.id} style={{ background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.25)", borderRadius:12, padding:"10px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:13, fontWeight:600, color:"#4ade80" }}>{m.homeFlag} {m.home}</span>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", fontWeight:700 }}>VS</div>
                  {m.time && <div style={{ fontSize:10, color:"rgba(34,197,94,0.7)" }}>{m.time} h.España</div>}
                </div>
                <span style={{ fontSize:13, fontWeight:600, color:"#4ade80" }}>{m.away} {m.awayFlag}</span>
              </div>
              <a
                href={daznUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, background:"linear-gradient(135deg,#1a56db,#1e40af)", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"7px 12px", textDecoration:"none", width:"100%", boxSizing:"border-box", letterSpacing:0.3 }}
              >
                <span style={{ fontSize:15 }}>▶</span> Ver en DAZN
              </a>
            </div>
          );
        })}
      </div>

      <div style={{ animation:"matchday-fade 0.5s 0.45s both" }}>
        <div style={{ background:"linear-gradient(135deg,#14532d,#16a34a,#4ade80,#16a34a)", borderRadius:99, color:"#fff", fontSize:14, fontWeight:700, padding:"12px 32px", letterSpacing:1 }}>
          ¡A verlo! ⚽
        </div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", marginTop:8 }}>Toca para cerrar</div>
      </div>
    </div>
  );
}
