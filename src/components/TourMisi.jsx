// El tour de la app, con Misi como guía.
//
// Sustituye al TutorialOverlay de v1 (una tarjeta estática en mitad de la
// pantalla, con el contenido tapado detrás). Aquí Misi habla desde abajo y
// la app NAVEGA a cada sección, que se ve detrás, atenuada pero legible: el
// tour enseña la app de verdad, no una descripción.
//
// El guion vive en src/lib/tour.js (probado: cada paso apunta a una sección
// registrada, sin nombres ni números viejos).

import { useEffect, useRef, useState } from "react";
import { MisiCanvas, POSTER_BY_EMOTION } from "./MisiLiveLayer.jsx";
import { Z } from "../lib/zLayers.js";
import { prefersReducedMotion } from "../utils.js";

const TAM_MISI = 92;

export default function TourMisi({ pasos, paso, onSiguiente, onAtras, onSaltar, onTerminar, onCta, elevado = false }) {
  const s = pasos[paso];
  const videoRef = useRef(null);
  const [lista, setLista] = useState(false);
  const esPrimero = paso === 0, esUltimo = paso === pasos.length - 1;
  const reducir = prefersReducedMotion();

  // Teclado: → siguiente, ← atrás, Esc saltar.
  useEffect(() => {
    const onKey = e => {
      if (e.key === "ArrowRight") esUltimo ? onTerminar() : onSiguiente();
      else if (e.key === "ArrowLeft" && !esPrimero) onAtras();
      else if (e.key === "Escape") onSaltar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [esPrimero, esUltimo, onSiguiente, onAtras, onSaltar, onTerminar]);

  useEffect(() => { setLista(false); }, [s?.emocion]);

  if (!s) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Tour de la app, paso ${paso + 1} de ${pasos.length}: ${s.titulo}`}
      style={{ position: "fixed", inset: 0, zIndex: Z.SHEET, pointerEvents: "auto" }}>
      {/* Velo suave: la sección se sigue viendo detrás (es lo que se enseña). */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(6,4,18,0.42)" }} />

      <div style={{
        position: "absolute", left: 0, right: 0, margin: "0 auto", maxWidth: 520,
        bottom: `calc(${elevado ? 84 : 16}px + env(safe-area-inset-bottom))`, padding: "0 12px",
      }}>
        <div key={paso} style={{
          position: "relative", display: "flex", gap: 10, alignItems: "flex-end",
          animation: reducir ? undefined : "tut-pop 0.3s cubic-bezier(0.34,1.2,0.64,1) both",
        }}>
          {/* Misi, animada con su emoción de este paso */}
          <div aria-hidden style={{ width: TAM_MISI, height: TAM_MISI, flexShrink: 0, position: "relative", marginBottom: -4 }}>
            <img src={POSTER_BY_EMOTION[s.emocion] || POSTER_BY_EMOTION.alegre} alt="" draggable={false}
              // Mientras carga el vídeo (o con reducir-movimiento), su imagen fija
              // en medallón redondo, igual que la Misi de la esquina: la foto tiene
              // fondo blanco de estudio y en cuadrado parecía un pegote.
              style={{ position: "absolute", inset: 4, width: TAM_MISI - 8, height: TAM_MISI - 8, objectFit: "cover", borderRadius: "50%",
                border: "2px solid var(--t-card-border,rgba(167,139,250,0.4))", boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
                opacity: lista && !reducir ? 0 : 1, transition: "opacity 0.2s ease" }} />
            {!reducir && (
              <>
                <video ref={videoRef} muted playsInline style={{ display: "none" }} aria-hidden="true" />
                <MisiCanvas emotion={s.emocion} size={TAM_MISI} videoRef={videoRef} onFirstFrame={() => setLista(true)}
                  style={{ position: "absolute", inset: 0, opacity: lista ? 1 : 0, transition: "opacity 0.2s ease" }} />
              </>
            )}
          </div>

          {/* Bocadillo */}
          <div style={{
            flex: 1, minWidth: 0, position: "relative",
            background: "var(--t-card,#1d1733)", border: "1px solid var(--t-card-border,rgba(167,139,250,0.3))",
            borderRadius: "18px 18px 18px 6px", padding: "12px 14px 12px",
            boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
          }}>
            <button onClick={onSaltar} style={{
              position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer",
              fontSize: 11.5, color: "var(--t-text-dim,#8f84ad)", fontFamily: "inherit", padding: "4px 6px",
            }}>{esUltimo ? "" : "Saltar"}</button>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--t-text,#f8f4ff)", paddingRight: 44, lineHeight: 1.3 }}>{s.titulo}</div>
            <div style={{ fontSize: 13.5, color: "var(--t-text-muted,#b9b0d0)", lineHeight: 1.55, marginTop: 6 }}>{s.texto}</div>

            <div style={{ display: "flex", gap: 4, margin: "12px 0 10px" }} aria-hidden>
              {pasos.map((_, i) => (
                <span key={i} style={{ height: 4, width: i === paso ? 18 : 4, borderRadius: 99, transition: "width 0.3s",
                  background: i <= paso ? "var(--t-accent,#a78bfa)" : "rgba(167,139,250,0.2)", opacity: i < paso ? 0.55 : 1 }} />
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!esPrimero && (
                <button onClick={onAtras} style={{ padding: "9px 14px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5,
                  color: "var(--t-text-muted,#b9b0d0)", background: "transparent", border: "1px solid var(--t-card-border,rgba(167,139,250,0.25))" }}>←</button>
              )}
              {esUltimo && s.cta && (
                <button onClick={() => onCta(s.cta)} style={{ flex: 1, minWidth: 140, padding: "9px 12px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700,
                  color: "var(--t-accent,#c4b8ff)", background: "transparent", border: "1px solid rgba(167,139,250,0.5)" }}>{s.cta.texto}</button>
              )}
              <button onClick={esUltimo ? onTerminar : onSiguiente} style={{ flex: 1, minWidth: 110, padding: "9px 12px", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13.5, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                {esUltimo ? "¡A por ello!" : esPrimero ? "Vamos →" : "Siguiente →"}
              </button>
            </div>
            <div style={{ textAlign: "right", fontSize: 10.5, color: "var(--t-text-dim,#8f84ad)", marginTop: 6 }}>{paso + 1} de {pasos.length}</div>
          </div>
        </div>
      </div>
      <style>{`@keyframes tut-pop { from { opacity:0; transform:translateY(14px) scale(0.97); } to { opacity:1; transform:none; } }`}</style>
    </div>
  );
}
