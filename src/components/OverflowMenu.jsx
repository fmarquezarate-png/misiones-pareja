import { useEffect, useRef } from "react";

export default function OverflowMenu({ open, onClose, items = [], anchor = "top-right" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const pos = anchor === "top-right"
    ? { top: 54, right: 14 }
    : { top: 54, left: 14 };

  return (
    <div
      ref={ref}
      style={{
        position:"absolute", ...pos,
        background:"var(--t-menu-bg,rgba(8,5,18,0.98))",
        border:"1px solid rgba(167,139,250,0.3)",
        borderRadius:12, padding:6,
        zIndex:80, minWidth:220,
        boxShadow:"0 14px 40px rgba(0,0,0,0.5)",
        transformOrigin: anchor === "top-right" ? "top right" : "top left",
        transform: open ? "scale(1)" : "scale(0.92)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition:"transform .15s, opacity .15s",
      }}
    >
      {items.map((it, i) => {
        if (it.divider) {
          return <hr key={i} style={{ border:"none", height:1, background:"rgba(167,139,250,0.12)", margin:"4px 0" }} />;
        }
        return (
          <button
            key={i}
            onClick={() => { onClose(); it.onClick?.(); }}
            disabled={it.disabled}
            style={{
              display:"flex", alignItems:"center", gap:10, width:"100%",
              background:"none", border:"none",
              color: it.danger ? "#f472b6" : "var(--t-text,#f0e8ff)",
              padding:"9px 11px", fontSize:13,
              fontFamily:"inherit", borderRadius:8,
              cursor: it.disabled ? "not-allowed" : "pointer",
              opacity: it.disabled ? 0.5 : 1,
              textAlign:"left",
            }}
            onMouseEnter={e => { if (!it.disabled) e.currentTarget.style.background = "rgba(167,139,250,0.12)"; }}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >
            {it.icon && <span style={{ fontSize:15, width:18, textAlign:"center" }}>{it.icon}</span>}
            <span style={{ flex:1 }}>{it.label}</span>
            {it.badge && (
              <span style={{
                fontSize:9, letterSpacing:1, fontWeight:700,
                color:"#a78bfa", background:"rgba(167,139,250,0.15)",
                border:"1px solid rgba(167,139,250,0.3)",
                padding:"1px 6px", borderRadius:99,
              }}>{it.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function OverflowButton({ onClick, ...rest }) {
  return (
    <button
      onClick={onClick}
      style={{
        width:34, height:34, borderRadius:99,
        background:"rgba(128,128,128,0.08)",
        border:"1px solid rgba(167,139,250,0.18)",
        color:"var(--t-text,#f0e8ff)", fontSize:16, fontWeight:700,
        cursor:"pointer", fontFamily:"inherit",
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        lineHeight:0.5,
      }}
      title="Más acciones"
      {...rest}
    >⋯</button>
  );
}
