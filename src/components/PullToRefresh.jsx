import { useRef, useState } from "react";

// Pull-to-refresh para PWA: arrastrar hacia abajo desde el tope de la página
// dispara onRefresh (smartSync). Solo se arma cuando window.scrollY está en 0.
//
// ZONA MUERTA obligatoria (bug v4.15.0): un tap normal mueve el dedo 2-10px;
// si el spacer crece durante ese movimiento, todo el contenido se desplaza en
// mitad del tap y el click aterriza en otro elemento ("touch detectado en otro
// lado"). Nada se mueve hasta superar DEAD_ZONE px de arrastre vertical
// deliberado. Los gestos horizontales (swipe de cambio de semana) se descartan.
const THRESHOLD = 64;
const DEAD_ZONE = 18;

export default function PullToRefresh({ onRefresh, refreshing, children }) {
  const [pull, setPull] = useState(0);
  const startYRef  = useRef(null);
  const startXRef  = useRef(null);
  const engagedRef = useRef(false); // true solo tras superar la zona muerta
  const firedRef   = useRef(false);

  const onTouchStart = e => {
    if (window.scrollY > 2) { startYRef.current = null; return; }
    startYRef.current = e.touches[0].clientY;
    startXRef.current = e.touches[0].clientX;
    engagedRef.current = false;
    firedRef.current = false;
  };
  const onTouchMove = e => {
    if (startYRef.current === null || firedRef.current) return;
    const dy = e.touches[0].clientY - startYRef.current;
    const dx = e.touches[0].clientX - startXRef.current;
    if (!engagedRef.current) {
      // Gesto inválido: hacia arriba, con scroll, u horizontal (swipe de semana)
      if (dy <= 0 || window.scrollY > 2 || Math.abs(dx) > Math.abs(dy)) { startYRef.current = null; return; }
      if (dy < DEAD_ZONE) return; // podría ser un tap — no mover NADA todavía
      engagedRef.current = true;
    }
    setPull(Math.min(Math.max(0, (dy - DEAD_ZONE)) * 0.38, 90)); // resistencia progresiva
  };
  const onTouchEnd = () => {
    if (engagedRef.current && pull >= THRESHOLD && !firedRef.current) { firedRef.current = true; onRefresh?.(); }
    setPull(0);
    startYRef.current = null;
    engagedRef.current = false;
  };

  const shown = refreshing ? THRESHOLD * 0.75 : pull;
  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <style>{`@keyframes mp-ptr-spin { to { transform: rotate(360deg); } }`}</style>
      <div aria-hidden="true" style={{ height: shown, transition: pull === 0 ? "height 0.25s ease" : "none", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: "var(--t-card,#1d1733)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.3))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, color: pull >= THRESHOLD || refreshing ? "var(--t-accent,#a78bfa)" : "var(--t-text-muted,#8b7fa8)",
          transform: refreshing ? "none" : `rotate(${shown * 3.2}deg)`,
          opacity: Math.min(shown / (THRESHOLD * 0.6), 1),
          animation: refreshing ? "mp-ptr-spin 0.9s linear infinite" : "none",
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
        }}>↻</div>
      </div>
      {children}
    </div>
  );
}
