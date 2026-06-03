import { useMemo, useState } from "react";
import { DEFAULT_COLORS, CATEGORIES, getMCats } from "../constants.js";
import { getWeekAndYear, isoWeekKey } from "../utils.js";
import { weekStartDate, fmtWeekRange } from "../lib/appUtils.js";
import { PHRASES } from "../phrases.js";

const MONTH_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function pct(done, total) { return total > 0 ? Math.round((done / total) * 100) : 0; }

function pctColor(p) { return p >= 80 ? "#34d399" : p >= 50 ? "#fbbf24" : "#f472b6"; }

function computeWeekly(weeks) {
  const prevDate = new Date();
  prevDate.setDate(prevDate.getDate() - 7);
  const { week: pw, year: py } = getWeekAndYear(prevDate);
  const prevKey = isoWeekKey(pw, py);
  const w = weeks[prevKey];
  if (!w?.missions?.length) return null;
  const ms = w.missions;
  const total = ms.length;
  const done  = ms.filter(m => m.status === "DONE").length;
  const p1d   = ms.filter(m => m.who === "person1" && m.status === "DONE").length;
  const p1t   = ms.filter(m => m.who === "person1").length;
  const p2d   = ms.filter(m => m.who === "person2" && m.status === "DONE").length;
  const p2t   = ms.filter(m => m.who === "person2").length;
  const togd  = ms.filter(m => m.who === "together" && m.status === "DONE").length;
  const togt  = ms.filter(m => m.who === "together").length;
  const catCounts = {};
  ms.forEach(m => getMCats(m).forEach(c => { catCounts[c] = (catCounts[c]||0) + 1; }));
  const topCatId = Object.entries(catCounts).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const topCat = topCatId ? CATEGORIES.find(c => c.id === topCatId) : null;
  const phrase = PHRASES[Math.floor(Math.random() * Math.min(30, PHRASES.length))];
  const range = fmtWeekRange(pw, py);
  return { total, done, p: pct(done,total), p1d, p1t, p2d, p2t, togd, togt, topCat, phrase, range, weekNumber: pw, year: py };
}

function computeMonthly(weeks) {
  const today = new Date();
  // On the 1st, show stats for the just-ended month
  const targetMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
  const targetYear  = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
  const monthEntries = Object.entries(weeks).filter(([key]) => {
    const [yrStr, wnStr] = key.split("-W");
    const start = weekStartDate(parseInt(wnStr), parseInt(yrStr));
    return start.getMonth() === targetMonth && start.getFullYear() === targetYear;
  });
  if (!monthEntries.length) return null;
  const allMs = monthEntries.flatMap(([,w]) => w.missions || []);
  const total = allMs.length;
  const done  = allMs.filter(m => m.status === "DONE").length;
  const togd  = allMs.filter(m => m.who === "together" && m.status === "DONE").length;
  const bestEntry = monthEntries.reduce((best, [key, w]) => {
    const bd = (w.missions||[]).filter(m=>m.status==="DONE").length;
    const bt = (w.missions||[]).length;
    const p  = pct(bd,bt);
    return p > (best?.p||0) ? { key, p, wn: parseInt(key.split("-W")[1]) } : best;
  }, null);
  return { total, done, p: pct(done,total), togd, weeks: monthEntries.length, bestWeek: bestEntry, monthName: MONTH_ES[targetMonth], year: targetYear };
}

// ── Gate (initial prompt) ────────────────────────────────────────────────────

function Gate({ showWeekly, showMonthlyOption, p1Color, p2Color, onWeekly, onMonthly, onClose }) {
  const title  = showMonthlyOption ? "¡Nuevo mes! 🎉" : "¡Nueva semana! 🌟";
  const subtitle = showMonthlyOption
    ? "Podéis ver cómo os fue la semana o el mes completo."
    : "¿Queréis ver cómo os fue la semana?";

  return (
    <div style={{ textAlign: "center", padding: "0 28px", width: "100%", maxWidth: 360 }}>
      {/* Merged circles visual */}
      <div style={{
        position: "relative", width: 110, height: 64,
        isolation: "isolate",
        margin: "0 auto 28px",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: 64, height: 64, borderRadius: 99,
          background: p1Color, opacity: 0.85,
          boxShadow: `0 0 24px ${p1Color}55`,
        }} />
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 64, height: 64, borderRadius: 99,
          background: p2Color, opacity: 0.85,
          mixBlendMode: "screen",
          boxShadow: `0 0 24px ${p2Color}55`,
        }} />
      </div>

      <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: "'Fraunces', serif", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 32, lineHeight: 1.5 }}>
        {subtitle}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {showWeekly && (
          <button onClick={onWeekly} style={{
            background: "linear-gradient(135deg, rgba(167,139,250,0.25), rgba(244,114,182,0.2))",
            border: "1px solid rgba(167,139,250,0.4)",
            borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600,
            padding: "14px 20px", cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span>📋 Ver Wrapped Semanal</span>
            <span style={{ opacity: 0.5, fontSize: 18 }}>→</span>
          </button>
        )}
        {showMonthlyOption && (
          <button onClick={onMonthly} style={{
            background: "linear-gradient(135deg, rgba(52,211,153,0.2), rgba(96,165,250,0.18))",
            border: "1px solid rgba(52,211,153,0.35)",
            borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 600,
            padding: "14px 20px", cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span>📅 Ver Wrapped Mensual</span>
            <span style={{ opacity: 0.5, fontSize: 18 }}>→</span>
          </button>
        )}
        <button onClick={onClose} style={{
          background: "none", border: "none",
          color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer",
          padding: "10px 0", fontFamily: "inherit",
        }}>
          Entrar directamente →
        </button>
      </div>
    </div>
  );
}

// ── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({ icon, label, value, color }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12, padding: "10px 14px",
      display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: color || "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      </div>
    </div>
  );
}

// ── Weekly Stats View ────────────────────────────────────────────────────────

function WeeklyView({ d, p1, p2, colors, onClose }) {
  const clr = { ...DEFAULT_COLORS, ...colors };
  const p   = d.p;
  const color = pctColor(p);

  return (
    <div style={{ width: "100%", maxWidth: 380, padding: "0 20px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 6 }}>
          {d.range}
        </div>
        <div style={{ fontSize: 11, letterSpacing: 1.5, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 16 }}>
          WRAPPED SEMANAL
        </div>
        {/* Big % */}
        <div style={{
          fontSize: 88, fontWeight: 900, lineHeight: 1,
          color: color, fontFamily: "'Fraunces', serif",
          textShadow: `0 0 40px ${color}66`,
        }}>
          {p}%
        </div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
          completasteis esta semana
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
          {d.done} de {d.total} {d.total === 1 ? "misión" : "misiones"}
        </div>
      </div>

      {/* Person breakdown */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <StatPill icon="👤" label={p1 || "Persona 1"} value={`${d.p1d}/${d.p1t}`} color={clr.person1} />
        <StatPill icon="👤" label={p2 || "Persona 2"} value={`${d.p2d}/${d.p2t}`} color={clr.person2} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <StatPill icon="👫" label="Juntos" value={`${d.togd}/${d.togt}`} color={clr.together} />
        {d.topCat && (
          <StatPill icon={d.topCat.icon} label="Top categoría" value={d.topCat.label} />
        )}
      </div>

      {/* Emoji/status bar */}
      {p === 100 && (
        <div style={{
          background: "linear-gradient(135deg, rgba(52,211,153,0.2), rgba(52,211,153,0.08))",
          border: "1px solid rgba(52,211,153,0.35)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 10,
          textAlign: "center", color: "#34d399", fontSize: 14, fontWeight: 700,
        }}>
          🏆 ¡Semana perfecta! Increíbles.
        </div>
      )}

      {/* Phrase */}
      <div style={{
        borderRadius: 12, padding: "12px 16px", marginBottom: 24,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>frase de la semana</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontStyle: "italic", lineHeight: 1.6 }}>
          "{d.phrase}"
        </div>
      </div>

      <button onClick={onClose} style={{
        width: "100%", padding: "14px 0", borderRadius: 14,
        background: "linear-gradient(135deg, rgba(167,139,250,0.35), rgba(244,114,182,0.3))",
        border: "1px solid rgba(167,139,250,0.45)",
        color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        letterSpacing: 0.3,
      }}>
        ✨ ¡A por esta semana!
      </button>
    </div>
  );
}

// ── Monthly Stats View ───────────────────────────────────────────────────────

function MonthlyView({ d, colors, onClose }) {
  const clr = { ...DEFAULT_COLORS, ...colors };
  const color = pctColor(d.p);

  return (
    <div style={{ width: "100%", maxWidth: 380, padding: "0 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 6 }}>
          {d.monthName.toUpperCase()} {d.year}
        </div>
        <div style={{ fontSize: 11, letterSpacing: 1.5, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 16 }}>
          WRAPPED MENSUAL
        </div>
        <div style={{
          fontSize: 88, fontWeight: 900, lineHeight: 1,
          color: color, fontFamily: "'Fraunces', serif",
          textShadow: `0 0 40px ${color}66`,
        }}>
          {d.p}%
        </div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
          completasteis este mes
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
          {d.done} de {d.total} misiones · {d.weeks} {d.weeks === 1 ? "semana" : "semanas"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <StatPill icon="👫" label="Juntas hechas" value={`${d.togd}`} color={clr.together} />
        {d.bestWeek && (
          <StatPill icon="🏆" label="Mejor semana" value={`S${d.bestWeek.wn} — ${d.bestWeek.p}%`} color="#fbbf24" />
        )}
      </div>

      {d.p === 100 && (
        <div style={{
          background: "linear-gradient(135deg, rgba(52,211,153,0.2), rgba(52,211,153,0.08))",
          border: "1px solid rgba(52,211,153,0.35)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 10,
          textAlign: "center", color: "#34d399", fontSize: 14, fontWeight: 700,
        }}>
          🏆 ¡Mes perfecto! Histórico.
        </div>
      )}

      <div style={{
        borderRadius: 12, padding: "12px 16px", marginBottom: 24,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>el mes en perspectiva</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
          {d.p >= 75
            ? "Mes excelente. La constancia os define."
            : d.p >= 50
              ? "Buen mes. Hay margen y eso es energía para aprovechar."
              : "Mes con dificultades. El siguiente empieza hoy."}
        </div>
      </div>

      <button onClick={onClose} style={{
        width: "100%", padding: "14px 0", borderRadius: 14,
        background: "linear-gradient(135deg, rgba(52,211,153,0.3), rgba(96,165,250,0.25))",
        border: "1px solid rgba(52,211,153,0.4)",
        color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        letterSpacing: 0.3,
      }}>
        ✨ ¡A por {MONTH_ES[new Date().getMonth()]}!
      </button>
    </div>
  );
}

// ── Root component ───────────────────────────────────────────────────────────

export default function WrappedModal({ showWeekly, showMonthlyOption, weeks, p1, p2, colors, onClose }) {
  const clr  = { ...DEFAULT_COLORS, ...colors };
  const [view, setView] = useState(() => {
    // If only weekly (no monthly option and not 1st of month), go straight to it
    if (showWeekly && !showMonthlyOption) return "weekly";
    if (!showWeekly && showMonthlyOption) return "monthly";
    return "gate";
  });
  const [fadeOut, setFadeOut] = useState(false);

  const weekly  = useMemo(() => computeWeekly(weeks), [weeks]);
  const monthly = useMemo(() => showMonthlyOption ? computeMonthly(weeks) : null, [weeks, showMonthlyOption]);

  const close = () => {
    setFadeOut(true);
    setTimeout(onClose, 450);
  };

  const go = (v) => setView(v);

  const hasContent = (view === "weekly" && weekly) || (view === "monthly" && monthly) || view === "gate";
  if (!hasContent) { close(); return null; }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1800,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: `radial-gradient(ellipse at 30% 30%, ${clr.person1}22 0%, transparent 55%),
                   radial-gradient(ellipse at 70% 70%, ${clr.person2}22 0%, transparent 55%),
                   rgba(5, 3, 18, 0.96)`,
      backdropFilter: "blur(20px)",
      opacity: fadeOut ? 0 : 1,
      transition: "opacity 0.45s ease",
      overflowY: "auto",
      paddingTop: "env(safe-area-inset-top,0px)",
      paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 20px)",
    }}>
      <style>{`
        @keyframes wr-in {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{
        width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
        animation: "wr-in 0.45s cubic-bezier(0.22,1,0.36,1) both",
        padding: "20px 0 40px",
      }}>
        {view === "gate" && (
          <Gate
            showWeekly={showWeekly && !!weekly}
            showMonthlyOption={showMonthlyOption && !!monthly}
            p1Color={clr.person1} p2Color={clr.person2}
            onWeekly={() => go("weekly")}
            onMonthly={() => go("monthly")}
            onClose={close}
          />
        )}
        {view === "weekly" && weekly && (
          <WeeklyView d={weekly} p1={p1} p2={p2} colors={clr} onClose={close} />
        )}
        {view === "monthly" && monthly && (
          <MonthlyView d={monthly} colors={clr} onClose={close} />
        )}
      </div>
    </div>
  );
}
