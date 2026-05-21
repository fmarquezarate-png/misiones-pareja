import { useState, useCallback, useEffect } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);

  const dismiss = useCallback(() => setToast(null), []);

  const push = useCallback((t) => {
    setToast(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (toast.kind === "success") {
      const id = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(id);
    }
  }, [toast]);

  return { toast, push, dismiss };
}

const palette = {
  loading: { color: "#a78bfa", border: "rgba(167,139,250,0.5)" },
  success: { color: "#34d399", border: "rgba(52,211,153,0.5)" },
  error:   { color: "#fb923c", border: "rgba(251,146,60,0.5)"  },
};

export default function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const p = palette[toast.kind] || palette.loading;

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(20,12,38,0.96)",
      border: `1px solid ${p.border}`,
      color: p.color,
      padding: "11px 16px",
      borderRadius: 12,
      fontSize: 13,
      fontWeight: 600,
      fontFamily: "inherit",
      display: "flex",
      alignItems: "center",
      gap: 10,
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      boxShadow: "0 14px 40px rgba(0,0,0,0.5)",
      zIndex: 1000,
      maxWidth: "calc(100vw - 32px)",
      animation: "mp-toast-in 0.25s ease-out",
    }}>
      <style>{`
        @keyframes mp-toast-in {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes mp-toast-spin {
          from { transform: rotate(0); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {toast.kind === "loading" && (
        <span style={{ display:"inline-block", animation:"mp-toast-spin 1.4s linear infinite" }}>↻</span>
      )}
      <span>{toast.text || (toast.kind==="loading" ? "Cargando…" : toast.kind==="success" ? "✓ Hecho" : "⚠ Error")}</span>

      {toast.kind === "error" && toast.onRetry && (
        <button onClick={() => { toast.onRetry(); }} style={{
          background: "rgba(251,146,60,0.18)",
          border: "1px solid rgba(251,146,60,0.4)",
          color: "#fb923c",
          fontSize: 11,
          padding: "4px 10px",
          borderRadius: 7,
          fontWeight: 700,
          fontFamily: "inherit",
          marginLeft: 4,
          cursor: "pointer",
        }}>Reintentar</button>
      )}

      {toast.kind === "success" && (
        <button onClick={onDismiss} aria-label="Cerrar" style={{
          background:"none", border:"none", color: p.color, opacity:0.6, cursor:"pointer", fontSize:16, padding:0, marginLeft:4, lineHeight:1, fontFamily:"inherit",
        }}>×</button>
      )}
    </div>
  );
}
