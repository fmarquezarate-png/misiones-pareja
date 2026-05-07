import { useState } from "react";
import { T, homeHero } from "../styles.js";
const eyebrow = { fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"var(--t-text-dim,#6b5f88)", fontWeight:700 };
import { badgeStyle } from "../styles.js";
import { DEFAULT_COLORS } from "../constants.js";
import { PHRASES } from "../phrases.js";
import WeekStrip from "./WeekStrip.jsx";

const W = {
  background: "var(--t-card,#1d1733)",
  border: "1px solid var(--t-card-border,rgba(167,139,250,0.18))",
  borderRadius: 12,
  padding: "10px 12px",
};

const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

function DayDetailSheet({ dateStr, missions, onClose, p1, p2, colors, onCycleStatus }) {
  const clr = colors || DEFAULT_COLORS;
  const items = missions.filter(m => m.date === dateStr);
  const [d, m, y] = [
    new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", { weekday:"long" }),
    new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", { day:"numeric", month:"long" }),
  ];
  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:90 }} />
      <div style={{
        position:"fixed", left:0, right:0, bottom:0, zIndex:100,
        background:"var(--t-card,rgba(8,5,18,0.98))",
        borderTop:"1px solid var(--t-card-border,rgba(167,139,250,0.3))",
        borderRadius:"18px 18px 0 0",
        padding:"16px 18px calc(28px + env(safe-area-inset-bottom))",
        maxHeight:"70vh", overflowY:"auto",
      }}>
        <div style={{ width:32, height:3, background:"rgba(128,128,128,0.3)", borderRadius:99, margin:"0 auto 14px" }} />
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--t-text,#f8f4ff)", textTransform:"capitalize" }}>{d}</div>
          <div style={{ fontSize:11, color:"var(--t-text-muted,#8b7fa8)" }}>{m}</div>
        </div>
        {items.length === 0 ? (
          <div style={{ fontSize:13, color:"var(--t-text-muted,#8b7fa8)", fontStyle:"italic", textAlign:"center", padding:"20px 0" }}>Día libre 🌿</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {items.map(mi => {
              const whoColor = mi.who==="person1"?clr.person1:mi.who==="person2"?clr.person2:clr.together;
              return (
                <div key={mi.id} onClick={() => onCycleStatus && onCycleStatus(mi.id)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 11px", borderRadius:10, cursor:"pointer",
                    background:"rgba(128,128,128,0.07)", border:"1px solid rgba(128,128,128,0.14)", borderLeft:`3px solid ${whoColor}` }}>
                  <span style={{ fontSize:18 }}>{mi.emoji||"🎯"}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:mi.status==="DONE"?"var(--t-text-dim,#6b5f88)":"var(--t-text,#f0e8ff)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                      textDecoration:mi.status==="DONE"?"line-through":"none" }}>{mi.title}</div>
                    {mi.time && <div style={{ fontSize:10, color:"var(--t-accent,#a78bfa)", marginTop:1 }}>{mi.time}</div>}
                  </div>
                  <span style={{ ...badgeStyle(mi.status), flexShrink:0, fontSize:9.5, padding:"2px 6px" }}>{mi.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function PersonRing({ name, photo, pct, clrAccent }) {
  const r = 26, circ = 2 * Math.PI * r;
  const ringColor = pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171";
  const initial   = (name || "?").charAt(0).toUpperCase();
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <div style={{ position:"relative", width:68, height:68 }}>
        <svg width={68} height={68} viewBox="0 0 68 68" style={{ position:"absolute", inset:0 }}>
          <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(128,128,128,0.12)" strokeWidth="5"/>
          <circle cx="34" cy="34" r={r} fill="none" stroke={ringColor} strokeWidth="5"
            strokeDasharray={`${pct * circ / 100} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 34 34)" style={{ transition:"stroke-dasharray .6s ease" }}/>
        </svg>
        <div style={{
          position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
          width:48, height:48, borderRadius:99, overflow:"hidden",
          background: photo ? "transparent" : `linear-gradient(135deg,${clrAccent}cc,${clrAccent}66)`,
          border:"2px solid rgba(128,128,128,0.18)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:22, color:"#fff", fontWeight:700, userSelect:"none",
        }}>
          {photo ? <img src={photo} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt={name} /> : initial}
        </div>
      </div>
      <div style={{ fontSize:12, fontWeight:600, color:"var(--t-text,#f8f4ff)" }}>{name}</div>
      <div style={{ fontSize:10, fontWeight:700, color:ringColor }}>{pct}%</div>
    </div>
  );
}

export default function HomeDashboard({
  week, missions, goals = [], colors, p1, p2, photo, p1Photo, p2Photo,
  onMissionPatch, onCycleStatus, onDeleteMission,
  onOpenWrapped, hasWrappedAvailable,
  weeksData,
}) {
  const clr = colors || DEFAULT_COLORS;
  const [daySheet, setDaySheet] = useState(null);

  const todayStr = fmtDate(new Date());

  const total = missions.length;
  const done  = missions.filter(m => m.status === "DONE").length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  // Per-person progress: all tasks (dated or not) from weeks spanning last 15 days
  const toWkey = d => {
    const t = new Date(d); t.setDate(d.getDate() + 4 - ((d.getDay()+6)%7));
    const j = new Date(t.getFullYear(),0,1);
    return `${t.getFullYear()}-W${String(Math.ceil(((t-j)/86400000+(j.getDay()+6)%7+1)/7)).padStart(2,"0")}`;
  };
  const cutoff14 = new Date(); cutoff14.setDate(cutoff14.getDate() - 14);
  const cutoffWkey = toWkey(cutoff14);
  const todayWkey  = toWkey(new Date());
  const last15Ms = weeksData
    ? Object.entries(weeksData)
        .filter(([key]) => key >= cutoffWkey && key <= todayWkey)
        .flatMap(([,w]) => (w.missions || []).filter(m => m.type !== "event"))
    : missions.filter(m => m.type !== "event");
  const p1Ms  = last15Ms.filter(m => m.who === "person1" || m.who === "together");
  const p2Ms  = last15Ms.filter(m => m.who === "person2" || m.who === "together");
  const p1Pct = p1Ms.length  ? Math.round(p1Ms.filter(m => m.status === "DONE").length  / p1Ms.length  * 100) : 0;
  const p2Pct = p2Ms.length  ? Math.round(p2Ms.filter(m => m.status === "DONE").length  / p2Ms.length  * 100) : 0;

  const todayMs = missions.filter(m => m.date === todayStr);
  const asapMs  = missions.filter(m => m.status === "ASAP");

  // All missions across weeks for upcoming + overdue
  const allMissions = weeksData
    ? Object.values(weeksData).flatMap(w => (w.missions || []).map(m => ({ ...m, weekNumber: w.weekNumber, year: w.year })))
    : missions;

  const upcoming3 = allMissions
    .filter(m => m.date && m.date >= todayStr && m.status !== "DONE")
    .sort((a, b) => (a.date + (a.time||"")) > (b.date + (b.time||"")) ? 1 : -1)
    .slice(0, 3);

  const overdue3 = (() => {
    const seen = new Set();
    const result = [];
    // 1. Tasks with explicit past dates
    for (const m of allMissions) {
      if (m.date && m.date < todayStr && m.status !== "DONE" && m.type !== "event") {
        seen.add(m.id); result.push(m);
      }
    }
    // 2. Carried (arrastradas) tasks not done — in current week missions
    for (const m of missions) {
      if (m.carriedFrom && m.status !== "DONE" && !seen.has(m.id)) {
        seen.add(m.id); result.push(m);
      }
    }
    return result.sort((a,b) => (a.date||"0") < (b.date||"0") ? -1 : 1).slice(0, 3);
  })();

  const activeGoal = goals.filter(g => g.active !== false)[0];

  const handleDayClick = (ds) => {
    // Collect missions for that day from weeksData
    setDaySheet(ds);
  };

  // Missions for the day detail sheet
  const dayMissions = weeksData
    ? Object.values(weeksData).flatMap(w => (w.missions || []).map(m => ({ ...m })))
    : missions;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", minWidth:0 }}>

      {/* Wrapped banner */}
      {hasWrappedAvailable && (
        <button onClick={onOpenWrapped} style={{
          background:"linear-gradient(135deg,rgba(244,114,182,0.16),rgba(167,139,250,0.16))",
          border:"1px solid rgba(244,114,182,0.4)", borderRadius:14, padding:"11px 14px",
          display:"flex", alignItems:"center", gap:10, cursor:"pointer",
          fontFamily:"inherit", color:"var(--t-text,#f8f4ff)", textAlign:"left", width:"100%", boxSizing:"border-box",
        }}>
          <span style={{fontSize:22}}>✨</span>
          <span style={{flex:1, minWidth:0}}>
            <span style={{display:"block", fontSize:13, fontWeight:600}}>Tu cierre de semana está listo</span>
            <span style={{display:"block", fontSize:11, color:"var(--t-text-muted,#8b7fa8)"}}>Toca para ver el resumen</span>
          </span>
          <span style={{color:T.pink, fontSize:18}}>›</span>
        </button>
      )}

      {/* Hero */}
      <div style={homeHero}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{...eyebrow, color:"var(--t-accent,#a78bfa)", marginBottom:4, fontSize:9.5}}>
            Semana {week?.week || "—"} · {week?.label || ""}
          </div>
          <div style={{
            fontFamily: T.fontDisplay, fontStyle:"italic", fontSize:17, fontWeight:500,
            lineHeight:1.18, marginBottom:8, color:"var(--t-text,#f8f4ff)",
            overflow:"hidden", textOverflow:"ellipsis",
            display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical",
          }}>{week?.epicGoal || "Define el objetivo de la semana"}</div>
          <div style={{ height:5, background:"rgba(128,128,128,0.12)", borderRadius:99, overflow:"hidden", marginBottom:5 }}>
            <div style={{ height:"100%", width:`${pct}%`,
              background:"linear-gradient(90deg,#f472b6,#a78bfa,#34d399)",
              borderRadius:99, transition:"width .6s ease" }}/>
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

      {/* WeekStrip with day click */}
      <WeekStrip missions={allMissions} onSelectDay={handleDayClick} />
      <div style={{ fontSize:9.5, color:"var(--t-text-dim,#4a4166)", textAlign:"center", marginTop:-6 }}>Toca un día para ver sus actividades</div>

      {/* Row 1: Próximos eventos | Tareas atrasadas */}
      <div style={{display:"flex", gap:8}}>
        <div style={{...W, flex:1, minWidth:0}}>
          <div style={{...eyebrow, fontSize:8.5, marginBottom:6}}>⏰ Próximos</div>
          {upcoming3.length === 0 ? (
            <div style={{fontSize:11, color:"var(--t-text-muted,#8b7fa8)", fontStyle:"italic"}}>Nada agendado 🌿</div>
          ) : upcoming3.map(m => (
            <div key={m.id} style={{ marginBottom:6, paddingBottom:6, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <div style={{fontSize:11.5, fontWeight:600, color:"var(--t-text,#f8f4ff)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                {m.emoji||"📅"} {m.title}
              </div>
              <div style={{fontSize:9.5, color:"var(--t-accent,#60a5fa)", marginTop:1}}>
                {m.date}{m.time ? ` · ${m.time}` : ""}
              </div>
            </div>
          ))}
        </div>
        <div style={{...W, flex:1, minWidth:0}}>
          <div style={{...eyebrow, fontSize:8.5, marginBottom:6}}>📌 Atrasadas</div>
          {overdue3.length === 0 ? (
            <div style={{fontSize:11, color:T.green, fontStyle:"italic"}}>¡Al día! 🎉</div>
          ) : overdue3.map(m => (
            <div key={m.id} style={{ marginBottom:6, paddingBottom:6, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <div style={{fontSize:11.5, fontWeight:600, color:"var(--t-error,#f87171)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                {m.emoji||"🎯"} {m.title}
              </div>
              <div style={{fontSize:9.5, color:"var(--t-text-dim,#6b5f88)", marginTop:1}}>{m.date}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2: Pulso | ASAP */}
      <div style={{display:"flex", gap:8}}>
        <div style={{...W, flex:1, minWidth:0}}>
          <div style={{...eyebrow, fontSize:8.5, marginBottom:5}}>📊 Pulso</div>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <svg width={38} height={38} viewBox="0 0 36 36" style={{flexShrink:0}}>
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth="4"/>
              <circle cx="18" cy="18" r="15" fill="none" stroke="url(#hd-pulse)" strokeWidth="4"
                strokeDasharray={`${pct} 100`} strokeLinecap="round" transform="rotate(-90 18 18)"/>
              <defs><linearGradient id="hd-pulse">
                <stop offset="0%" stopColor="#f472b6"/>
                <stop offset="100%" stopColor="#34d399"/>
              </linearGradient></defs>
            </svg>
            <div>
              <div style={{fontFamily:T.fontDisplay, fontSize:20, fontWeight:600, lineHeight:1, color:"var(--t-text,#f8f4ff)"}}>
                {pct}<small style={{fontSize:10}}>%</small>
              </div>
              <div style={{fontSize:9, color:"var(--t-text-muted,#8b7fa8)"}}>esta semana</div>
            </div>
          </div>
        </div>
        <div style={{...W, flex:1, minWidth:0}}>
          <div style={{...eyebrow, fontSize:8.5, marginBottom:5}}>🔥 ASAP</div>
          <div style={{fontFamily:T.fontDisplay, fontSize:26, fontWeight:600, lineHeight:1, color:T.orange, marginBottom:3}}>{asapMs.length}</div>
          <div style={{fontSize:10, color:"var(--t-text-muted,#8b7fa8)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
            {asapMs[0]?.title || "Sin urgentes"}
          </div>
        </div>
      </div>

      {/* Hoy — compact tap-to-cycle list */}
      <div style={{...W, borderRadius:12}}>
        <div style={{...eyebrow, fontSize:8.5, marginBottom:8}}>📋 Hoy</div>
        {todayMs.length === 0 ? (
          <div style={{fontSize:12, color:"var(--t-text-muted,#8b7fa8)", fontStyle:"italic"}}>Día libre 🌿</div>
        ) : (
          <div style={{display:"flex", flexDirection:"column", gap:6}}>
            {todayMs.map(m => {
              const whoColor = m.who==="person1"?clr.person1:m.who==="person2"?clr.person2:clr.together;
              return (
                <div key={m.id} onClick={() => onCycleStatus && onCycleStatus(m.id)}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", borderRadius:9, cursor:"pointer",
                    background:"rgba(128,128,128,0.07)", border:"1px solid rgba(128,128,128,0.14)", borderLeft:`3px solid ${whoColor}` }}>
                  <span style={{fontSize:16, flexShrink:0}}>{m.emoji||"🎯"}</span>
                  <span style={{flex:1, minWidth:0, fontSize:12.5, fontWeight:500,
                    color:m.status==="DONE"?"var(--t-text-dim,#6b5f88)":"var(--t-text,#f0e8ff)",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    textDecoration:m.status==="DONE"?"line-through":"none"}}>
                    {m.title}
                  </span>
                  <span style={{...badgeStyle(m.status), flexShrink:0, fontSize:9.5, padding:"2px 6px"}}>{m.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Person progress rings — last 15 days */}
      <div style={{ display:"flex", justifyContent:"center", gap:32, padding:"6px 0 2px" }}>
        <PersonRing name={p1} photo={p1Photo} pct={p1Pct} clrAccent={clr.person1} />
        <PersonRing name={p2} photo={p2Photo} pct={p2Pct} clrAccent={clr.person2} />
      </div>

      {/* Daily phrase */}
      <div style={{ textAlign:"center", padding:"2px 16px 4px" }}>
        <span style={{
          fontFamily:"'Fraunces', Georgia, serif",
          fontStyle:"italic",
          fontSize:15,
          color:"var(--t-text-muted,#8b7fa8)",
          lineHeight:1.5,
          letterSpacing:0.2,
        }}>"{PHRASES[parseInt(todayStr.replace(/-/g,"")) % PHRASES.length]}"</span>
      </div>

      {/* Day detail bottom sheet */}
      {daySheet && (
        <DayDetailSheet
          dateStr={daySheet}
          missions={dayMissions}
          onClose={() => setDaySheet(null)}
          p1={p1} p2={p2} colors={colors}
          onCycleStatus={(id) => {
            onCycleStatus && onCycleStatus(id);
            setDaySheet(null);
          }}
        />
      )}
    </div>
  );
}
