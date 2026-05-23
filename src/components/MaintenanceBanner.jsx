import { useState } from "react";

export default function MaintenanceBanner({ warning }) {
  const [dismissed, setDismissed] = useState(
    sessionStorage.getItem("mp_maint_dismissed") === "1"
  );
  if (!warning || dismissed) return null;
  const dismiss = () => { sessionStorage.setItem("mp_maint_dismissed", "1"); setDismissed(true); };
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 600,
      background: "linear-gradient(90deg,#78350f,#92400e)",
      borderBottom: "1px solid rgba(251,191,36,0.35)",
      paddingTop: "calc(10px + env(safe-area-inset-top))", paddingBottom: 10,
      paddingLeft: 16, paddingRight: 12,
      display: "flex", alignItems: "flex-start", gap: 10,
      fontFamily: "var(--t-font-body,system-ui)", boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
    }}>
      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>🔧</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#fef3c7", marginBottom: 3 }}>
          {warning.title}
        </div>
        <div style={{ fontSize: 12, color: "rgba(254,243,199,0.8)", lineHeight: 1.5 }}>
          {warning.body}
        </div>
      </div>
      <button onClick={dismiss} aria-label="Cerrar aviso"
        style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, cursor: "pointer", color: "#fef3c7", fontSize: 16, width: 28, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
        ×
      </button>
    </div>
  );
}
