import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const coupleId = window.__mpCoupleId ?? null;
    window.__mpTrack?.("app_error", {
      message: error?.message?.slice(0, 200),
      stack: error?.stack?.slice(0, 500),
      couple_id: coupleId,
    });
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          background: "var(--t-bg, #0a0714)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          padding: "24px",
          color: "var(--t-text, #f8f4ff)",
          textAlign: "center",
          gap: 16,
        }}>
          <span style={{ fontSize: 48 }}>⚠️</span>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Algo salió mal</h2>
          <p style={{ fontSize: 14, color: "var(--t-text-muted, #8b7fa8)", maxWidth: 320, margin: 0, lineHeight: 1.5 }}>
            La aplicación encontró un error inesperado. Tus datos están seguros en Supabase.
          </p>
          {this.state.error?.message && (
            <code style={{ fontSize: 11, background: "rgba(255,255,255,0.05)", padding: "6px 12px", borderRadius: 8, color: "var(--t-error, #f87171)", maxWidth: 400, wordBreak: "break-word" }}>
              {this.state.error.message}
            </code>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "var(--t-btn-grad, linear-gradient(135deg,#7c3aed,#a78bfa))",
              border: "none",
              borderRadius: 12,
              color: "#fff",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 600,
              padding: "12px 28px",
              cursor: "pointer",
              marginTop: 8,
            }}>
            Recargar app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
