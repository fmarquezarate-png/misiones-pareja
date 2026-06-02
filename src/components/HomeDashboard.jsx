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

function DayDetailSheet({ dateStr, missions, onClose, colors, onCycleStatus }) {
  const clr = colors || DEFAULT_COLORS;
  const items = missions.filter(m => m.date === dateStr);
  const [d] = [
    new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", { weekday:"long" }),
    new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", { day:"numeric", month:"long" }),
  ];
  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:90, cursor:"pointer" }} />
      <div onClick={e => e.stopPropagation()} style={{
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

function PersonStatsSheet({ name, photo, pct, clrAccent, stats, onClose, pendingMissions = [], onCycleStatus }) {
  const r = 54, circ = 2 * Math.PI * r;
  const ringColor = pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171";
  const initial = (name || "?").charAt(0).toUpperCase();

  const statusRows = [
    { label:"Completadas", icon:"✅", count: stats.done,       color:"#34d399" },
    { label:"En curso",    icon:"⚡", count: stats.inProgress, color:"#60a5fa" },
    { label:"ASAP",        icon:"🔥", count: stats.asap,       color:"#fb923c" },
    { label:"Pendientes",  icon:"⏳", count: stats.tbc,        color:"#94a3b8" },
  ];

  const shownPending = pendingMissions.slice(0, 5);
  const potentialPct = stats.total
    ? Math.min(100, Math.round((stats.done + shownPending.length) / stats.total * 100))
    : 0;

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:90, cursor:"pointer" }} />
      <div onClick={e => e.stopPropagation()} style={{
        position:"fixed", left:0, right:0, bottom:0, zIndex:100,
        background:"var(--t-card,rgba(8,5,18,0.98))",
        borderTop:"1px solid var(--t-card-border,rgba(167,139,250,0.3))",
        borderRadius:"20px 20px 0 0",
        padding:"16px 20px calc(32px + env(safe-area-inset-bottom))",
        maxHeight:"80vh", overflowY:"auto",
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ width:32, height:3, background:"rgba(128,128,128,0.3)", borderRadius:99, flex:1, margin:"0 auto" }} />
          <button onClick={onClose} style={{
            position:"absolute", right:16, top:14,
            background:"rgba(128,128,128,0.12)", border:"none", borderRadius:99,
            width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", color:"var(--t-text-muted,#8b7fa8)", fontSize:14, fontWeight:600,
            fontFamily:"inherit",
          }}>✕</button>
        </div>

        {/* Header: photo + ring side by side */}
        <div style={{ display:"flex", alignItems:"center", gap:20, marginBottom:20 }}>
          {/* Large ring + photo */}
          <div style={{ position:"relative", width:128, height:128, flexShrink:0 }}>
            <svg width={128} height={128} viewBox="0 0 128 128" style={{ position:"absolute", inset:0 }}>
              <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(128,128,128,0.12)" strokeWidth="8"/>
              <circle cx="64" cy="64" r={r} fill="none" stroke={ringColor} strokeWidth="8"
                strokeDasharray={`${pct * circ / 100} ${circ}`} strokeLinecap="round"
                transform="rotate(-90 64 64)" style={{ transition:"stroke-dasharray .6s ease" }}/>
            </svg>
            <div style={{
              position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
              width:96, height:96, borderRadius:99, overflow:"hidden",
              background: photo ? "transparent" : `linear-gradient(135deg,${clrAccent}cc,${clrAccent}66)`,
              border:"2px solid rgba(128,128,128,0.2)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:40, color:"#fff", fontWeight:700,
            }}>
              {photo ? <img src={photo} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt={name} /> : initial}
            </div>
          </div>

          {/* Name + score summary */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:20, fontWeight:700, color:"var(--t-text,#f8f4ff)", marginBottom:2 }}>{name}</div>
            <div style={{ fontSize:36, fontWeight:800, color:ringColor, lineHeight:1 }}>{pct}<span style={{ fontSize:16, fontWeight:600 }}>%</span></div>
            <div style={{ fontSize:11, color:"var(--t-text-muted,#8b7fa8)", marginTop:2 }}>
              {stats.done} de {stats.total} tareas · últimos 15 días
            </div>
            {stats.total === 0 && (
              <div style={{ fontSize:11, color:"var(--t-text-dim,#6b5f88)", marginTop:4, fontStyle:"italic" }}>
                Sin tareas asignadas aún
              </div>
            )}
          </div>
        </div>

        {/* Status breakdown */}
        <div style={{ ...W, marginBottom:14 }}>
          <div style={{ ...eyebrow, marginBottom:10 }}>Desglose de tareas</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {statusRows.map(row => (
              <div key={row.label} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:14, width:20 }}>{row.icon}</span>
                <span style={{ flex:1, fontSize:13, color:"var(--t-text,#f8f4ff)" }}>{row.label}</span>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:80, height:5, background:"rgba(128,128,128,0.15)", borderRadius:99, overflow:"hidden" }}>
                    <div style={{
                      height:"100%",
                      width: stats.total ? `${(row.count / stats.total) * 100}%` : "0%",
                      background: row.color, borderRadius:99,
                      transition:"width .5s ease",
                    }}/>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color: row.color, minWidth:18, textAlign:"right" }}>{row.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending actions */}
        {shownPending.length > 0 && (
          <div style={{ ...W, marginBottom:14 }}>
            <div style={{ ...eyebrow, marginBottom:8 }}>🎯 Acciones para subir tu %</div>
            {potentialPct > pct && (
              <div style={{
                background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)",
                borderRadius:9, padding:"7px 11px", marginBottom:10,
                display:"flex", alignItems:"center", gap:8,
              }}>
                <span style={{ fontSize:15 }}>📈</span>
                <span style={{ fontSize:12, color:"var(--t-text-muted,#8b7fa8)" }}>
                  {shownPending.length === pendingMissions.length ? "Completa todas" : `Completa estas ${shownPending.length}`} → {" "}
                </span>
                <span style={{ fontSize:14, fontWeight:700, color:"#34d399" }}>{potentialPct}%</span>
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {shownPending.map(mi => {
                const statusColor = mi.status === "ASAP" ? "#fb923c" : mi.status === "IN_PROGRESS" ? "#60a5fa" : "#94a3b8";
                return (
                  <div key={mi.id} onClick={() => onCycleStatus && onCycleStatus(mi.id)}
                    style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:9, cursor:"pointer",
                      background:"rgba(128,128,128,0.07)", border:"1px solid rgba(128,128,128,0.12)",
                      borderLeft:`3px solid ${clrAccent}` }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{mi.emoji || "🎯"}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12.5, fontWeight:500, color:"var(--t-text,#f0e8ff)",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{mi.title}</div>
                      {mi.date && (
                        <div style={{ fontSize:9.5, color:"var(--t-accent,#a78bfa)", marginTop:1 }}>
                          {mi.date}{mi.time ? ` · ${mi.time}` : ""}
                        </div>
                      )}
                    </div>
                    <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ fontSize:9.5, fontWeight:700, color:statusColor,
                        background:`${statusColor}22`, borderRadius:5, padding:"2px 5px" }}>{mi.status}</span>
                      <span style={{ fontSize:14, color:"var(--t-text-dim,#6b5f88)" }}>›</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {pendingMissions.length > 5 && (
              <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", textAlign:"center", padding:"6px 0 0" }}>
                y {pendingMissions.length - 5} más pendientes
              </div>
            )}
          </div>
        )}

        {shownPending.length === 0 && stats.total > 0 && (
          <div style={{ ...W, marginBottom:14, textAlign:"center", padding:"14px 16px" }}>
            <div style={{ fontSize:22, marginBottom:6 }}>🏆</div>
            <div style={{ fontSize:13, fontWeight:600, color:"#34d399", marginBottom:2 }}>¡Todo al día!</div>
            <div style={{ fontSize:11, color:"var(--t-text-muted,#8b7fa8)" }}>No hay tareas pendientes en los últimos 15 días</div>
          </div>
        )}

        {/* Note */}
        <div style={{ fontSize:10, color:"var(--t-text-dim,#6b5f88)", textAlign:"center", lineHeight:1.5 }}>
          El porcentaje incluye tareas de hoy hacia atrás (15 días).<br/>
          Las tareas con fecha futura no penalizan el score.
        </div>
      </div>
    </>
  );
}

function PersonRing({ name, photo, pct, clrAccent, onClick }) {
  const r = 26, circ = 2 * Math.PI * r;
  const ringColor = pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171";
  const initial   = (name || "?").charAt(0).toUpperCase();
  return (
    <div onClick={onClick} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:"pointer" }}>
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
  week, missions, goals: _goals = [], colors, p1, p2, photo, p1Photo, p2Photo,
  onMissionPatch: _onMissionPatch, onCycleStatus, onDeleteMission: _onDeleteMission,
  onOpenWrapped, hasWrappedAvailable,
  weeksData,
  pushSupported, pushSubscribed, onActivatePush,
}) {
  const clr = colors || DEFAULT_COLORS;
  const [daySheet, setDaySheet]     = useState(null);
  const [personSheet, setPersonSheet] = useState(null); // "p1" | "p2" | null

  const todayStr = fmtDate(new Date());

  const total = missions.length;
  const done  = missions.filter(m => m.status === "DONE").length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  // Per-person progress: last 15 days, excluding events and FUTURE-dated tasks
  const toWkey = d => {
    const t = new Date(d); t.setDate(d.getDate() + 4 - ((d.getDay()+6)%7));
    const j = new Date(t.getFullYear(),0,1);
    return `${t.getFullYear()}-W${String(Math.ceil(((t-j)/86400000+(j.getDay()+6)%7+1)/7)).padStart(2,"0")}`;
  };
  const cutoff14 = new Date(); cutoff14.setDate(cutoff14.getDate() - 14);
  const cutoffWkey = toWkey(cutoff14);
  const todayWkey  = toWkey(new Date());

  // Exclude future-dated tasks — can't be penalized for what hasn't happened yet
  const last15Ms = weeksData
    ? Object.entries(weeksData)
        .filter(([key]) => key >= cutoffWkey && key <= todayWkey)
        .flatMap(([,w]) => (w.missions || []).filter(m =>
          m.type !== "event" && (!m.date || m.date <= todayStr)
        ))
    : missions.filter(m => m.type !== "event" && (!m.date || m.date <= todayStr));

  const p1Ms = last15Ms.filter(m => m.who === "person1" || m.who === "together");
  const p2Ms = last15Ms.filter(m => m.who === "person2" || m.who === "together");

  const buildStats = ms => {
    const active = ms.filter(m => !m.completedLate);
    const done   = active.filter(m => m.status === "DONE").length;
    return {
      total:      active.length,
      done,
      inProgress: active.filter(m => m.status === "IN_PROGRESS").length,
      asap:       active.filter(m => m.status === "ASAP").length,
      tbc:        active.filter(m => m.status === "TBC").length,
      pct:        active.length ? Math.round(done / active.length * 100) : 0,
    };
  };

  const p1Stats = buildStats(p1Ms);
  const p2Stats = buildStats(p2Ms);
  const p1Pct   = p1Stats.pct;
  const p2Pct   = p2Stats.pct;

  const pendingOrder = { ASAP: 0, IN_PROGRESS: 1, TBC: 2 };
  const p1Pending = p1Ms
    .filter(m => !m.completedLate && m.status !== "DONE")
    .sort((a, b) => (pendingOrder[a.status] ?? 3) - (pendingOrder[b.status] ?? 3));
  const p2Pending = p2Ms
    .filter(m => !m.completedLate && m.status !== "DONE")
    .sort((a, b) => (pendingOrder[a.status] ?? 3) - (pendingOrder[b.status] ?? 3));

  const todayMs = missions.filter(m => m.date === todayStr);
  const asapMs  = missions.filter(m => m.status === "ASAP");

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
    for (const m of allMissions) {
      if (m.date && m.date < todayStr && m.status !== "DONE" && m.type !== "event") {
        seen.add(m.id); result.push(m);
      }
    }
    for (const m of missions) {
      if (m.carriedFrom && m.status !== "DONE" && !seen.has(m.id)) {
        seen.add(m.id); result.push(m);
      }
    }
    return result.sort((a,b) => (a.date||"0") < (b.date||"0") ? -1 : 1).slice(0, 3);
  })();


  const dayMissions = weeksData
    ? Object.values(weeksData).flatMap(w => (w.missions || []).map(m => ({ ...m })))
    : missions;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", minWidth:0 }}>

      {/* Wrapped banner */}
      {hasWrappedAvailable && (
        <button onClick={onOpenWrapped} style={{
          background:"linear-gradient(135deg, var(--t-p1-10,rgba(244,114,182,0.16)), var(--t-p2-10,rgba(167,139,250,0.16)))",
          border:"1px solid var(--t-p1-15,rgba(244,114,182,0.4))", borderRadius:14, padding:"11px 14px",
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
              background:"linear-gradient(90deg, var(--t-p1,#f472b6), var(--t-p2,#a78bfa))",
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

      {/* WeekStrip */}
      <WeekStrip missions={allMissions} onSelectDay={ds => setDaySheet(ds)} colors={colors} />
      <div style={{ fontSize:9.5, color:"var(--t-text-dim,#4a4166)", textAlign:"center", marginTop:-6 }}>Toca un día para ver sus actividades</div>

      {/* Row 1: Próximos | Atrasadas */}
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
                <stop offset="0%" stopColor={clr.person1}/>
                <stop offset="100%" stopColor={clr.person2}/>
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

      {/* Hoy */}
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

      {/* Person progress rings — clickable */}
      <div style={{ display:"flex", justifyContent:"center", gap:32, padding:"6px 0 2px" }}>
        <PersonRing
          name={p1} photo={p1Photo} pct={p1Pct} clrAccent={clr.person1}
          onClick={() => setPersonSheet("p1")}
        />
        <PersonRing
          name={p2} photo={p2Photo} pct={p2Pct} clrAccent={clr.person2}
          onClick={() => setPersonSheet("p2")}
        />
      </div>

      {/* Daily phrase */}
      <div style={{ textAlign:"center", padding:"2px 16px 4px" }}>
        <span style={{
          fontFamily:"'Fraunces', Georgia, serif",
          fontStyle:"italic", fontSize:15,
          color:"var(--t-text-muted,#8b7fa8)",
          lineHeight:1.5, letterSpacing:0.2,
        }}>"{PHRASES[parseInt(todayStr.replace(/-/g,"")) % PHRASES.length]}"</span>
      </div>

      {/* Push nudge widget — visible si push soportado, no suscrito y no descartado 3 veces */}
      {pushSupported && !pushSubscribed && (() => {
        const NUDGE_KEY = "mp_push_nudge_dismissed";
        const count = parseInt(localStorage.getItem(NUDGE_KEY) || "0", 10);
        if (count >= 3) return null;
        return (
          <div style={{ margin:"12px 16px 4px", background:"rgba(128,128,128,0.06)", border:"1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:22, flexShrink:0 }}>🔔</span>
            <div style={{ flex:1 }}>
              <div style={{ color:"var(--t-text,#f8f4ff)", fontSize:13, fontWeight:600, marginBottom:2 }}>Notificaciones en segundo plano</div>
              <div style={{ color:"var(--t-text-muted,#8b7fa8)", fontSize:12, lineHeight:1.4 }}>Entérate cuando tu pareja actualice algo</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
              <button onClick={onActivatePush} style={{ background:"var(--t-btn-grad,linear-gradient(135deg,#f472b6,#a78bfa))", border:"none", borderRadius:7, color:"#fff", padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit", whiteSpace:"nowrap" }}>Activar →</button>
              <button onClick={() => { localStorage.setItem(NUDGE_KEY, String(count + 1)); const el = document.activeElement; el?.blur(); }} style={{ background:"none", border:"none", color:"var(--t-text-muted,#8b7fa8)", cursor:"pointer", fontSize:11, fontFamily:"inherit", padding:"2px 0", textAlign:"center" }}>Ahora no</button>
            </div>
          </div>
        );
      })()}

      {/* Day detail sheet */}
      {daySheet && (
        <DayDetailSheet
          dateStr={daySheet} missions={dayMissions}
          onClose={() => setDaySheet(null)}
          p1={p1} p2={p2} colors={colors}
          onCycleStatus={(id) => { onCycleStatus && onCycleStatus(id); setDaySheet(null); }}
        />
      )}

      {/* Person stats sheet */}
      {personSheet === "p1" && (
        <PersonStatsSheet
          name={p1} photo={p1Photo} pct={p1Pct} clrAccent={clr.person1}
          stats={p1Stats} onClose={() => setPersonSheet(null)}
          pendingMissions={p1Pending} onCycleStatus={onCycleStatus}
        />
      )}
      {personSheet === "p2" && (
        <PersonStatsSheet
          name={p2} photo={p2Photo} pct={p2Pct} clrAccent={clr.person2}
          stats={p2Stats} onClose={() => setPersonSheet(null)}
          pendingMissions={p2Pending} onCycleStatus={onCycleStatus}
        />
      )}
    </div>
  );
}
