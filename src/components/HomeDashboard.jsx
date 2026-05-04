import { T, homeHero, eyebrow } from "../styles.js";
import WeekStrip from "./WeekStrip.jsx";
import { badgeStyle } from "../styles.js";
import { DEFAULT_COLORS } from "../constants.js";

const W = { // compact widget base
  background: "var(--t-card,#1d1733)",
  border: "1px solid var(--t-card-border,rgba(167,139,250,0.18))",
  borderRadius: 12,
  padding: "10px 12px",
};

export default function HomeDashboard({
  week, missions, goals = [], colors, p1, p2, photo,
  onMissionPatch, onCycleStatus, onDeleteMission,
  onOpenWrapped, hasWrappedAvailable,
  weeksData,
}) {
  const clr = colors || DEFAULT_COLORS;
  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
  })();

  const total = missions.length;
  const done  = missions.filter(m => m.status === "DONE").length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  const todayMs  = missions.filter(m => m.date === todayStr);
  const asapMs   = missions.filter(m => m.status === "ASAP");
  const upcoming = missions
    .filter(m => m.date && m.date > todayStr && m.status !== "DONE")
    .sort((a,b) => a.date.localeCompare(b.date))[0];

  const activeGoal = goals.filter(g => g.active !== false)[0];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", minWidth:0 }}>

      {/* Wrapped banner */}
      {hasWrappedAvailable && (
        <button onClick={onOpenWrapped} style={{
          background:"linear-gradient(135deg,rgba(244,114,182,0.16),rgba(167,139,250,0.16))",
          border:"1px solid rgba(244,114,182,0.4)",
          borderRadius:14, padding:"11px 14px",
          display:"flex", alignItems:"center", gap:10, cursor:"pointer",
          fontFamily:"inherit", color:T.fg1, textAlign:"left", width:"100%", boxSizing:"border-box",
        }}>
          <span style={{fontSize:22}}>✨</span>
          <span style={{flex:1, minWidth:0}}>
            <span style={{display:"block", fontSize:13, fontWeight:600, color:"#fff"}}>Tu cierre de semana está listo</span>
            <span style={{display:"block", fontSize:11, color:T.muted}}>Toca para ver el resumen</span>
          </span>
          <span style={{color:T.pink, fontSize:18}}>›</span>
        </button>
      )}

      {/* Hero: semana + progreso */}
      <div style={homeHero}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{...eyebrow, color:T.purple, marginBottom:4, fontSize:9.5}}>
            Semana {week?.week || "—"} · {week?.label || ""}
          </div>
          <div style={{
            fontFamily: T.fontDisplay, fontStyle:"italic",
            fontSize:17, fontWeight:500, lineHeight:1.18,
            marginBottom:8, color:"var(--t-text,#f8f4ff)",
            overflow:"hidden", textOverflow:"ellipsis",
            display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical",
          }}>{week?.epicGoal || "Define el objetivo de la semana"}</div>
          <div style={{ height:5, background:"rgba(255,255,255,0.08)", borderRadius:99, overflow:"hidden", marginBottom:5 }}>
            <div style={{
              height:"100%", width:`${pct}%`,
              background:"linear-gradient(90deg,#f472b6,#a78bfa,#34d399)",
              borderRadius:99, transition:"width .6s ease",
            }}/>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", fontSize:10.5, color:"var(--t-text-muted,#8b7fa8)", fontWeight:600}}>
            <span>{done} / {total} hechas</span>
            <span style={{color:T.green}}>{pct}%</span>
          </div>
        </div>
        <div style={{
          width:52, height:52, borderRadius:99, flexShrink:0,
          background: photo ? "transparent" : `linear-gradient(135deg,${clr.person1},${clr.person2})`,
          backgroundImage: photo ? `url(${photo})` : undefined,
          backgroundSize:"cover", backgroundPosition:"center",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:26, border:"2px solid rgba(255,255,255,0.15)",
        }}>{!photo && "💞"}</div>
      </div>

      {/* Tira de días */}
      <WeekStrip missions={missions} />

      {/* Row 1: ASAP + Próximo */}
      <div style={{display:"flex", gap:8}}>
        <div style={{...W, flex:1, minWidth:0}}>
          <div style={{...eyebrow, fontSize:8.5, marginBottom:5}}>🔥 ASAP</div>
          <div style={{fontFamily:T.fontDisplay, fontSize:26, fontWeight:600, lineHeight:1, color:T.orange}}>{asapMs.length}</div>
          <div style={{fontSize:10, color:T.muted, marginTop:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
            {asapMs[0]?.title || "Sin urgentes"}
          </div>
        </div>
        <div style={{...W, flex:1, minWidth:0}}>
          <div style={{...eyebrow, fontSize:8.5, marginBottom:5}}>⏰ Próximo</div>
          {upcoming ? (
            <>
              <div style={{fontSize:12, fontWeight:600, color:"var(--t-text,#f8f4ff)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.3}}>
                {upcoming.emoji || "📅"} {upcoming.title}
              </div>
              <div style={{fontSize:10, color:T.blue, marginTop:3, fontWeight:500}}>
                {upcoming.date}{upcoming.time ? ` · ${upcoming.time}` : ""}
              </div>
            </>
          ) : (
            <div style={{fontSize:11, color:"var(--t-text-muted,#8b7fa8)", fontStyle:"italic", lineHeight:1.4}}>Nada próximo 🌿</div>
          )}
        </div>
      </div>

      {/* Row 2: Pulso semanal + Meta */}
      <div style={{display:"flex", gap:8}}>
        <div style={{...W, flex:1, minWidth:0}}>
          <div style={{...eyebrow, fontSize:8.5, marginBottom:5}}>📊 Pulso</div>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <svg width={38} height={38} viewBox="0 0 36 36" style={{flexShrink:0}}>
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
              <circle cx="18" cy="18" r="15" fill="none" stroke="url(#mp-pulse)" strokeWidth="4"
                strokeDasharray={`${pct} 100`} strokeLinecap="round" transform="rotate(-90 18 18)"/>
              <defs>
                <linearGradient id="mp-pulse">
                  <stop offset="0%" stopColor="#f472b6"/>
                  <stop offset="100%" stopColor="#34d399"/>
                </linearGradient>
              </defs>
            </svg>
            <div>
              <div style={{fontFamily:T.fontDisplay, fontSize:20, fontWeight:600, lineHeight:1}}>
                {pct}<small style={{fontSize:10}}>%</small>
              </div>
              <div style={{fontSize:9, color:"var(--t-text-muted,#8b7fa8)"}}>esta semana</div>
            </div>
          </div>
        </div>

        {activeGoal ? (
          <div style={{...W, flex:1, minWidth:0}}>
            <div style={{...eyebrow, fontSize:8.5, marginBottom:5}}>🏅 Meta</div>
            <div style={{fontSize:12, fontWeight:600, color:"var(--t-text,#f0e8ff)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.3}}>
              {activeGoal.emoji} {activeGoal.title}
            </div>
            <div style={{height:3, background:"rgba(255,255,255,0.08)", borderRadius:99, overflow:"hidden", margin:"6px 0 3px"}}>
              <div style={{
                height:"100%",
                width:`${Math.min(100,((activeGoal.progress||0)/Math.max(1,activeGoal.target||1))*100)}%`,
                background:T.green, borderRadius:99,
              }}/>
            </div>
            <div style={{fontSize:9.5, color:"var(--t-text-muted,#8b7fa8)"}}>
              {activeGoal.progress||0} / {activeGoal.target||"?"}
            </div>
          </div>
        ) : (
          /* No active goal: widen Pulso to fill the row — handled by flex:1 above */
          <div style={{...W, flex:1, minWidth:0, display:"flex", alignItems:"center", justifyContent:"center"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:20, marginBottom:4}}>🎯</div>
              <div style={{fontSize:10, color:T.muted, fontStyle:"italic"}}>Sin meta activa</div>
            </div>
          </div>
        )}
      </div>

      {/* Hoy — compact mission list */}
      <div style={{...W, borderRadius:12}}>
        <div style={{...eyebrow, fontSize:8.5, marginBottom:8}}>📋 Hoy</div>
        {todayMs.length === 0 ? (
          <div style={{fontSize:12, color:"var(--t-text-muted,#8b7fa8)", fontStyle:"italic"}}>Día libre 🌿</div>
        ) : (
          <div style={{display:"flex", flexDirection:"column", gap:6}}>
            {todayMs.map(m => {
              const whoColor = m.who === "person1" ? clr.person1 : m.who === "person2" ? clr.person2 : clr.together;
              return (
                <div key={m.id}
                  onClick={() => onCycleStatus && onCycleStatus(m.id)}
                  style={{
                    display:"flex", alignItems:"center", gap:8,
                    padding:"7px 10px", borderRadius:9, cursor:"pointer",
                    background:"rgba(255,255,255,0.03)",
                    border:`1px solid rgba(255,255,255,0.06)`,
                    borderLeft:`3px solid ${whoColor}`,
                  }}
                >
                  <span style={{fontSize:16, flexShrink:0}}>{m.emoji || "🎯"}</span>
                  <span style={{flex:1, minWidth:0, fontSize:12.5, fontWeight:500, color:m.status==="DONE"?"#6b5f88":"var(--t-text,#f0e8ff)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textDecoration:m.status==="DONE"?"line-through":"none"}}>
                    {m.title}
                  </span>
                  <span style={{...badgeStyle(m.status), flexShrink:0, fontSize:9.5, padding:"2px 6px"}}>
                    {m.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
