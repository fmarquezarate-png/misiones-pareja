// ─────────────────────────────────────────────────────────────────────────────
// HomeDashboard.jsx — v3.0.0
// Home repensado como dashboard editorial. Reemplaza el render de Home en
// App.jsx (las 2 columnas Pendientes | Eventos en mobile) por:
//   1. Hero editorial con objetivo de la semana + progress + foto
//   2. WeekStrip — días L–D + hoy resaltado (NO se pierde lo del v2.5)
//   3. Grid de widgets: ASAP / Próximo / Pulso / Meta cerca / Hoy
//   4. (Opcional) Hook de Wrapped semanal arriba si hay un cierre disponible
//
// Props (recibe del App):
//   - week:          objeto de la semana actual { week, year, label, ... }
//   - missions:      array de misiones de la semana actual
//   - goals:         array de metas
//   - colors:        DEFAULT_COLORS o custom
//   - p1, p2:        nombres
//   - photo:         base64/url del retrato de la semana (opcional)
//   - onMissionPatch, onCycleStatus, onDeleteMission: igual que en v2.5
//   - onOpenWrapped: () => void  (opcional, para mostrar el hook)
//   - hasWrappedAvailable: bool (true si la semana anterior tiene resumen)
// ─────────────────────────────────────────────────────────────────────────────
import { T, homeHero, widget, eyebrow } from "../styles.js";
import { STATUS } from "../constants.js";
import MissionCard from "./MissionCard.jsx";
import WeekStrip from "./WeekStrip.jsx";

export default function HomeDashboard({
  week, missions, goals = [], colors, p1, p2, photo,
  onMissionPatch, onCycleStatus, onDeleteMission,
  onOpenWrapped, hasWrappedAvailable,
  weeksData,
}) {
  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
  })();

  const total = missions.length;
  const done  = missions.filter(m => m.status === "DONE").length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  const todayMs = missions.filter(m => m.date === todayStr);
  const asapMs  = missions.filter(m => m.status === "ASAP");
  const upcoming = missions
    .filter(m => m.date && m.date > todayStr && m.status !== "DONE")
    .sort((a,b) => a.date.localeCompare(b.date))[0];

  const activeGoal = goals.filter(g => g.active !== false)[0];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Wrapped hook */}
      {hasWrappedAvailable && (
        <button onClick={onOpenWrapped} style={{
          background:"linear-gradient(135deg,rgba(244,114,182,0.16),rgba(167,139,250,0.16))",
          border:"1px solid rgba(244,114,182,0.4)",
          borderRadius:14, padding:"11px 14px",
          display:"flex", alignItems:"center", gap:10, cursor:"pointer",
          fontFamily:"inherit", color:T.fg1,
          textAlign:"left",
        }}>
          <span style={{fontSize:22}}>✨</span>
          <span style={{flex:1}}>
            <span style={{display:"block", fontSize:13, fontWeight:600, color:"#fff"}}>Tu cierre de semana está listo</span>
            <span style={{display:"block", fontSize:11, color:T.muted}}>Toca para ver el resumen</span>
          </span>
          <span style={{color:T.pink, fontSize:18}}>›</span>
        </button>
      )}

      {/* Hero */}
      <div style={homeHero}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{...eyebrow, color:T.purple, marginBottom:4, fontSize:9.5}}>
            Semana {week?.week || "—"} · {week?.label || ""}
          </div>
          <div style={{
            fontFamily: T.fontDisplay,
            fontStyle: "italic",
            fontSize: 18,
            fontWeight: 500,
            lineHeight: 1.18,
            marginBottom: 8,
            color: T.fg1,
          }}>{week?.epicGoal || "Define el objetivo de la semana"}</div>
          <div style={{
            height:5, background:"rgba(255,255,255,0.08)",
            borderRadius:99, overflow:"hidden", marginBottom:5,
          }}>
            <div style={{
              height:"100%",
              width: `${pct}%`,
              background: "linear-gradient(90deg, #f472b6, #a78bfa, #34d399)",
              borderRadius: 99, transition: "width .6s ease",
            }}/>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", fontSize:10.5, color:T.muted, fontWeight:600}}>
            <span>{done} / {total} hechas</span>
            <span style={{color:T.green}}>{pct}%</span>
          </div>
        </div>
        <div style={{
          width:56, height:56, borderRadius:99, flexShrink:0,
          background: photo ? "transparent" : `linear-gradient(135deg, ${colors?.person1 || T.pink}, ${colors?.person2 || T.purple})`,
          backgroundImage: photo ? `url(${photo})` : undefined,
          backgroundSize:"cover", backgroundPosition:"center",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:28,
          border: "2px solid rgba(255,255,255,0.15)",
        }}>{!photo && "💞"}</div>
      </div>

      <WeekStrip missions={missions} />

      {/* Widgets grid */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
        <div style={widget}>
          <div style={{...eyebrow, fontSize:9, marginBottom:6}}>🔥 ASAP</div>
          <div style={{fontFamily:T.fontDisplay, fontSize:24, fontWeight:600, lineHeight:1, marginBottom:3, color:T.orange}}>{asapMs.length}</div>
          <div style={{fontSize:10, color:T.muted, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
            {asapMs.slice(0,2).map(m => m.title).join(" · ") || "Sin urgentes"}
          </div>
        </div>
        <div style={widget}>
          <div style={{...eyebrow, fontSize:9, marginBottom:6}}>⏰ Próximo</div>
          {upcoming ? (
            <>
              <div style={{fontFamily:T.fontDisplay, fontSize:17, fontWeight:600, lineHeight:1.1, marginBottom:3, color:T.fg1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                {upcoming.emoji || "📅"} {upcoming.title}
              </div>
              <div style={{fontSize:10, color:T.blue, fontWeight:500}}>
                {upcoming.date} {upcoming.time ? `· ${upcoming.time}` : ""}
              </div>
            </>
          ) : (
            <div style={{fontSize:11.5, color:T.muted, fontStyle:"italic"}}>Nada agendado próximamente 🌿</div>
          )}
        </div>
        <div style={widget}>
          <div style={{...eyebrow, fontSize:9, marginBottom:6}}>📊 Pulso semanal</div>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <svg width={42} height={42} viewBox="0 0 36 36" style={{flexShrink:0}}>
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
              <div style={{fontFamily:T.fontDisplay, fontSize:22, fontWeight:600, lineHeight:1}}>
                {pct}<small style={{fontSize:11}}>%</small>
              </div>
              <div style={{fontSize:10, color:T.muted}}>de la semana</div>
            </div>
          </div>
        </div>
        {activeGoal && (
          <div style={widget}>
            <div style={{...eyebrow, fontSize:9, marginBottom:6}}>🏅 Meta cerca</div>
            <div style={{fontSize:12.5, fontWeight:600, color:T.fg2, marginBottom:5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
              {activeGoal.emoji} {activeGoal.title}
            </div>
            <div style={{height:4, background:"rgba(255,255,255,0.08)", borderRadius:99, overflow:"hidden", marginBottom:4}}>
              <div style={{
                height:"100%",
                width: `${Math.min(100, ((activeGoal.progress || 0) / Math.max(1, activeGoal.target || 1)) * 100)}%`,
                background: T.green, borderRadius: 99,
              }}/>
            </div>
            <div style={{fontSize:10, color:T.muted}}>
              {activeGoal.progress || 0} de {activeGoal.target || "?"}
            </div>
          </div>
        )}

        {/* Hoy — full width */}
        <div style={{...widget, gridColumn:"span 2"}}>
          <div style={{...eyebrow, fontSize:9, marginBottom:8}}>📋 Hoy</div>
          {todayMs.length === 0 ? (
            <div style={{fontSize:12, color:T.muted, fontStyle:"italic"}}>Día libre 🌿</div>
          ) : (
            <div style={{display:"flex", flexDirection:"column", gap:8, marginTop:4}}>
              {todayMs.map(m => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  p1={p1} p2={p2} colors={colors} goals={goals}
                  onCycleStatus={() => onCycleStatus && onCycleStatus(m.id)}
                  onPatch={(patch) => onMissionPatch && onMissionPatch(m.id, patch)}
                  onDelete={() => onDeleteMission && onDeleteMission(m.id)}
                  weeksData={weeksData}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
