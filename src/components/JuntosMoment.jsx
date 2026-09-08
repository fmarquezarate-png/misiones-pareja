import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function Spark({ angle, color, delay }) {
  return (
    <div style={{
      position: "absolute", left: "50%", top: "50%",
      width: 0, height: 0,
      transform: `rotate(${angle}deg)`,
      pointerEvents: "none",
    }}>
      <div style={{
        position: "absolute",
        width: 8, height: 8, borderRadius: 99,
        background: color,
        boxShadow: `0 0 8px ${color}`,
        transform: "translate(-4px, -4px)",
        animation: `jm-fly 0.75s ease-out ${delay}ms both`,
      }} />
    </div>
  );
}

export default function JuntosMoment({ mission, p1Name, p2Name, p1Color, p2Color, onDone }) {
  const [phase, setPhase] = useState(0);
  const [reduce] = useState(prefersReducedMotion);
  const timers = useRef([]);

  // Todos los timeouts en un sitio: el cierre por toque ya no crea uno suelto
  // que sobreviva al desmontaje y cierre la celebración siguiente.
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  useEffect(() => {
    if (reduce) {                       // sin coreografía: se ve y se va
      setPhase(3);
      later(() => setPhase(4), 2200);
      later(() => onDone?.(), 2700);
      return clearTimers;
    }
    later(() => setPhase(1), 40);       // circles slide in
    later(() => setPhase(2), 780);      // sparkle flash
    later(() => setPhase(3), 1040);     // text appears
    later(() => setPhase(4), 2500);     // fade out
    later(() => onDone?.(), 3000);
    return clearTimers;
  }, [onDone, reduce]);

  const label = mission.type === "event" ? "Evento" : "Tarea";
  const circleOff = phase >= 1 ? 18 : 95;

  const dismiss = () => { clearTimers(); setPhase(4); later(() => onDone?.(), 500); };

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        // Fondo OPACO en vez de `backdrop-filter: blur(16px)`: el blur a
        // pantalla completa se recalcula en cada frame mientras los círculos se
        // mueven — es uno de los costes de compositor más caros en iOS y aquí
        // no aporta nada (detrás hay un velo casi opaco).
        background: "#0a0518",
        opacity: phase < 4 ? 1 : 0,
        transition: "opacity 0.5s ease",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <style>{`
        @keyframes jm-fly {
          0%   { opacity: 1;   transform: translate(-4px,-4px) translateX(0); }
          70%  { opacity: 0.8; }
          100% { opacity: 0;   transform: translate(-4px,-4px) translateX(68px); }
        }
        @keyframes jm-flash {
          0%   { opacity: 0;    transform: translate(-50%,-50%) scale(0.2); }
          35%  { opacity: 0.90; transform: translate(-50%,-50%) scale(1.25); }
          100% { opacity: 0;    transform: translate(-50%,-50%) scale(0.95); }
        }
        @keyframes jm-text {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes jm-emoji {
          0%   { transform: scale(0) rotate(-18deg); }
          65%  { transform: scale(1.3) rotate(6deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
      `}</style>

      {/* Circles — isolation:isolate so screen blend applies between them, not to the page */}
      <div style={{
        position: "relative", width: 186, height: 100,
        isolation: "isolate",
        marginBottom: 24,
      }}>
        {/* Person 1 */}
        <div style={{
          position: "absolute", top: 10, left: "50%",
          width: 80, height: 80, borderRadius: 99,
          background: p1Color,
          opacity: 0.88,
          transform: `translateX(calc(-50% - ${circleOff}px))`,
          transition: reduce ? "none" : "transform 0.88s cubic-bezier(0.34,1.28,0.64,1)",
          willChange: "transform",
          boxShadow: `0 0 32px ${p1Color}66`,
        }} />
        {/* Person 2 — mix-blend-mode:screen blends with p1 at the intersection zone */}
        <div style={{
          position: "absolute", top: 10, left: "50%",
          width: 80, height: 80, borderRadius: 99,
          background: p2Color,
          opacity: 0.88,
          transform: `translateX(calc(-50% + ${circleOff}px))`,
          transition: reduce ? "none" : "transform 0.88s cubic-bezier(0.34,1.28,0.64,1)",
          willChange: "transform",
          mixBlendMode: "screen",
          boxShadow: `0 0 32px ${p2Color}66`,
        }} />
        {/* Flash burst at center on merge */}
        {phase >= 2 && !reduce && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            width: 52, height: 52, borderRadius: 99,
            background: "rgba(255,255,255,0.92)",
            animation: "jm-flash 0.55s ease-out forwards",
          }} />
        )}
        {/* Sparkle particles */}
        {phase >= 2 && !reduce && ANGLES.map((angle, i) => (
          <Spark key={angle} angle={angle}
            color={i % 2 === 0 ? p1Color : p2Color}
            delay={i * 28}
          />
        ))}
      </div>

      {/* Mission info */}
      {phase >= 3 && (
        <div style={{ textAlign: "center", padding: "0 36px", animation: reduce ? "none" : "jm-text 0.45s ease-out forwards" }}>
          <div style={{ fontSize: 46, animation: reduce ? "none" : "jm-emoji 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>
            {mission.emoji || "🎯"}
          </div>
          <div style={{
            fontSize: 24, fontWeight: 800, color: "#fff", marginTop: 10,
            fontFamily: "'Fraunces', serif", lineHeight: 1.2, letterSpacing: -0.3,
          }}>
            ¡{label} Completada!
          </div>
          <div style={{
            fontSize: 15, color: "rgba(255,255,255,0.62)", marginTop: 8,
            fontWeight: 400, maxWidth: 270, lineHeight: 1.5, margin: "8px auto 0",
          }}>
            {mission.title}
          </div>
          <div style={{
            marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.32)",
            letterSpacing: 1.8, textTransform: "uppercase", fontWeight: 600,
          }}>
            {p1Name} × {p2Name}
          </div>
          <div style={{ marginTop: 20, fontSize: 11, color: "rgba(255,255,255,0.22)", letterSpacing: 0.5 }}>
            toca para cerrar
          </div>
        </div>
      )}
    </div>
  );
}
