import { useState, useEffect } from "react";
import { S } from "../styles.js";
import { DEFAULT_COLORS } from "../constants.js";

// ─── GoalPeriodDetail ─────────────────────────────────────────────────────────
// Bottom sheet en móvil / modal centrado en desktop
// Props: { h, goal, p1, p2, colors, prevH, onClose }
export default function GoalPeriodDetail({ h, goal, colors, prevH, onClose }) {
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const clr = colors || DEFAULT_COLORS;

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    // Trigger entrance animation on next frame
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const missions = h.missions || [];
  const isMax = goal.goalType === "max";
  const met = isMax ? h.count <= goal.target : h.count >= goal.target;

  // Microcopy
  let microcopy = null;
  let microcopyColor = "#8b7fa8";
  if (!h.isPast) {
    microcopy = "Período en curso";
    microcopyColor = "#8b7fa8";
  } else if (prevH && !prevH.noData) {
    if (h.count > prevH.count) {
      microcopy = `↑ ${h.count - prevH.count} más que el período anterior`;
      microcopyColor = "#34d399";
    } else if (h.count < prevH.count) {
      microcopy = `↓ ${prevH.count - h.count} menos que el período anterior`;
      microcopyColor = "#f472b6";
    } else {
      microcopy = "Igual que el período anterior";
      microcopyColor = "#8b7fa8";
    }
  }

  // Progress bar
  const pct = goal.target > 0 ? Math.min((h.count / goal.target) * 100, 100) : 0;
  const barColor = met
    ? "linear-gradient(90deg,#34d399,#60a5fa)"
    : isMax && h.count > goal.target
      ? "linear-gradient(90deg,#f472b6,#fb923c)"
      : "linear-gradient(90deg,rgba(167,139,250,0.8),rgba(167,139,250,0.5))";
  const countColor = met ? "#34d399" : isMax && h.count > goal.target ? "#f472b6" : "var(--t-text,#f0e8ff)";

  // Panel styles
  const overlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 1000,
    display: "flex",
    alignItems: isMobile ? "flex-end" : "center",
    justifyContent: "center",
  };

  const panelBaseStyle = {
    background: "var(--t-card,#1d1733)",
    zIndex: 1001,
    boxShadow: "0 -4px 32px rgba(0,0,0,0.4)",
    transition: "opacity 0.22s ease, transform 0.28s cubic-bezier(0.34,1.3,0.64,1)",
    fontFamily: "inherit",
    overflowY: "auto",
    maxHeight: isMobile ? "85vh" : "80vh",
  };

  const panelMobileStyle = {
    ...panelBaseStyle,
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: "20px 20px 0 0",
    padding: "16px 18px 28px",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(40px)",
  };

  const panelDesktopStyle = {
    ...panelBaseStyle,
    position: "relative",
    borderRadius: 16,
    padding: "22px 24px",
    width: "min(480px, 92vw)",
    border: "1px solid rgba(167,139,250,0.22)",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(16px)",
  };

  const panelStyle = isMobile ? panelMobileStyle : panelDesktopStyle;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>

        {/* Handle bar — mobile only */}
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <div style={{ width: 40, height: 4, borderRadius: 99, background: "rgba(128,128,128,0.25)" }} />
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>{goal.emoji}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t-text,#f0e8ff)", lineHeight: 1.3 }}>{goal.title}</div>
              <div style={{ fontSize: 12, color: "var(--t-text-dim,#6b5f88)", marginTop: 2 }}>{h.label}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t-text-dim,#4a4166)", fontSize: 20, lineHeight: 1, padding: "2px 4px", flexShrink: 0, marginLeft: 8 }}
            onMouseEnter={e => e.currentTarget.style.color = "#a78bfa"}
            onMouseLeave={e => e.currentTarget.style.color = "#4a4166"}
          >×</button>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: "var(--t-text-muted,#8b7fa8)" }}>Actividades</span>
            <span style={{ color: countColor, fontWeight: 600 }}>
              {h.count} / {goal.target} {isMax ? "(máx.)" : ""}
            </span>
          </div>
          <div style={{ background: "rgba(128,128,128,0.10)", borderRadius: 99, height: 7, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 99, transition: "width 0.5s" }} />
          </div>
        </div>

        {/* Microcopy */}
        {microcopy && (
          <div style={{ fontSize: 11, color: microcopyColor, marginBottom: 14, fontStyle: "italic" }}>
            {microcopy}
          </div>
        )}

        {/* Mission list */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--t-text-dim,#4a4166)", fontWeight: 600, marginBottom: 8 }}>
            Actividades del período
          </div>
          {missions.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--t-text-dim,#6b5f88)", fontStyle: "italic", padding: "8px 0" }}>
              Sin actividades registradas este período
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {missions.map(m => {
                const mc = m.who === "person1" ? clr.person1 : m.who === "person2" ? clr.person2 : clr.together;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 8,
                      background: "rgba(128,128,128,0.04)",
                      border: "1px solid rgba(128,128,128,0.08)",
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{m.emoji || "🎯"}</span>
                    <span style={{ flex: 1, fontSize: 12, color: "var(--t-text,#f0e8ff)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</span>
                    {m.date && (
                      <span style={{ fontSize: 10, color: "var(--t-text-dim,#6b5f88)", flexShrink: 0 }}>{m.date}</span>
                    )}
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: mc, flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button onClick={onClose} style={{ ...S.btnSecondary, minWidth: 100 }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
