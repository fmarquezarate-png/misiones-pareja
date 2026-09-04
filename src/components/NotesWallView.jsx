import { useState } from "react";
import { LOVE_NOTE_MAX, noteDateLabel } from "../lib/loveNote.js";
import { isMineEntry } from "../lib/identity.js";
import { PIN_COLORS, noteVisual, pinHex } from "../lib/corkboard.js";

// Letra manuscrita: en iOS/macOS existen de serie (cero coste de red); en el
// resto cae a cursive genérica. Se ve "escrito a mano" sin descargar nada.
const HAND = "'Bradley Hand','Noteworthy','Marker Felt','Segoe Script','Comic Sans MS',cursive";

// Chincheta: cabeza con brillo + sombra proyectada. Puro CSS, sin imágenes.
function Pin({ color, size = 22 }) {
  const hex = pinHex(color);
  return (
    <span aria-hidden="true" style={{
      position: "absolute", top: -size * 0.22, left: "50%", marginLeft: -size / 2,
      width: size, height: size, borderRadius: "50%",
      background: `radial-gradient(circle at 32% 28%, #fff9 0 12%, ${hex} 45%, ${hex} 60%, rgba(0,0,0,0.45) 100%)`,
      boxShadow: `0 3px 5px rgba(0,0,0,0.45), inset -1px -2px 3px rgba(0,0,0,0.35)`,
      zIndex: 2,
    }}>
      {/* aguja: pequeña sombra bajo la cabeza */}
      <span style={{
        position: "absolute", top: size * 0.72, left: "50%", marginLeft: -1.5,
        width: 3, height: size * 0.34, borderRadius: 2,
        background: "linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0))",
      }} />
    </span>
  );
}

// Muro de notitas como pizarra de corcho: cada nota es un post-it pinchado.
export default function NotesWallView({ notes = [], myName, myPersonId, partnerName, onAdd, onDelete }) {
  const [text, setText] = useState("");
  const [pin, setPin] = useState("red");
  const [composing, setComposing] = useState(false);

  const send = () => { const t = text.trim(); if (!t) return; onAdd?.(t, pin); setText(""); setComposing(false); };

  return (
    <div style={{ padding: "12px 12px 120px" }}>
      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "0 2px" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--t-text,#f8f4ff)", fontFamily: "'Fraunces',serif" }}>📌 Notitas</div>
          <div style={{ fontSize: 12, color: "var(--t-text-dim,#6b5f88)", marginTop: 2 }}>La más reciente se fija en el inicio</div>
        </div>
        <button onClick={() => setComposing(c => !c)} style={{
          background: composing ? "rgba(244,114,182,0.15)" : "var(--t-accent-soft,rgba(167,139,250,0.14))",
          border: `1px solid ${composing ? "rgba(244,114,182,0.4)" : "rgba(167,139,250,0.35)"}`,
          borderRadius: 10, color: composing ? "#f472b6" : "var(--t-accent,#c4b8ff)",
          fontSize: 13, fontWeight: 600, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit",
        }}>{composing ? "✕ Cerrar" : "+ Nota"}</button>
      </div>

      {/* Compose */}
      {composing && (
        <div style={{
          background: "var(--t-card,#1d1733)", border: "1px solid rgba(167,139,250,0.25)",
          borderRadius: 14, padding: "12px 14px", marginBottom: 14,
        }}>
          <textarea
            value={text} onChange={e => setText(e.target.value)} maxLength={LOVE_NOTE_MAX} autoFocus
            placeholder={`Una notita para ${partnerName || "tu pareja"}… 💜`}
            style={{
              width: "100%", minHeight: 74, resize: "none", boxSizing: "border-box", padding: "10px 12px",
              borderRadius: 10, fontFamily: HAND, fontSize: 18, lineHeight: 1.35,
              color: "#3a3020", background: "#fff7a0", border: "1px solid rgba(0,0,0,0.12)",
            }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--t-text-dim,#6b5f88)" }}>Chincheta</span>
            <div style={{ display: "flex", gap: 8, flex: 1 }}>
              {PIN_COLORS.map(p => (
                <button key={p.id} onClick={() => setPin(p.id)} aria-label={`Chincheta ${p.label}`} title={p.label}
                  style={{
                    width: 26, height: 26, borderRadius: "50%", cursor: "pointer", padding: 0,
                    background: `radial-gradient(circle at 32% 28%, #fff9 0 14%, ${p.hex} 50%)`,
                    border: pin === p.id ? "2px solid var(--t-text,#f0e8ff)" : "2px solid transparent",
                    boxShadow: pin === p.id ? `0 0 0 2px ${p.hex}66` : "0 1px 3px rgba(0,0,0,0.4)",
                  }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: "var(--t-text-dim,#6b5f88)" }}>{text.length}/{LOVE_NOTE_MAX}</span>
            <button onClick={send} disabled={!text.trim()} style={{
              padding: "8px 16px", borderRadius: 99, cursor: text.trim() ? "pointer" : "default", fontFamily: "inherit",
              fontSize: 13, fontWeight: 600, color: "#fff", border: "none",
              background: "linear-gradient(135deg,#f472b6,#e879f9)", opacity: text.trim() ? 1 : 0.5,
            }}>Pinchar 📌</button>
          </div>
        </div>
      )}

      {/* Pizarra de corcho */}
      <div style={{
        position: "relative",
        borderRadius: 14,
        padding: notes.length ? "26px 14px 18px" : "40px 14px",
        // Marco de madera
        border: "10px solid #6b4b2a",
        boxShadow: "inset 0 0 26px rgba(0,0,0,0.42), 0 6px 18px rgba(0,0,0,0.35)",
        // Textura de corcho: moteado a cuatro escalas con periodos primos entre
        // sí — así el patrón no se lee como una cuadrícula regular.
        backgroundColor: "#c69a63",
        backgroundImage: `
          radial-gradient(rgba(88,56,24,0.26) 1.1px, transparent 1.6px),
          radial-gradient(rgba(255,235,200,0.22) 0.9px, transparent 1.4px),
          radial-gradient(rgba(122,82,38,0.18) 1.7px, transparent 2.3px),
          radial-gradient(rgba(70,44,18,0.12) 2.6px, transparent 3.4px),
          radial-gradient(circle at 22% 18%, rgba(255,224,180,0.18), transparent 55%),
          radial-gradient(circle at 78% 72%, rgba(96,62,26,0.20), transparent 60%)`,
        backgroundSize: "11px 11px, 17px 17px, 23px 23px, 37px 37px, 100% 100%, 100% 100%",
        backgroundPosition: "0 0, 5px 7px, 11px 3px, 19px 13px, 0 0, 0 0",
      }}>
        {notes.length === 0 ? (
          <div style={{ textAlign: "center", color: "#5b3f22" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>📌</div>
            <div style={{ fontFamily: HAND, fontSize: 20, fontWeight: 600 }}>El corcho está vacío</div>
            <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>Pincha la primera nota con «+ Nota»</div>
          </div>
        ) : (
          <div style={{ columnCount: 2, columnGap: 14 }}>
            {notes.map(n => {
              const v = noteVisual(n.id);
              const mine = isMineEntry(n, myName, myPersonId);
              return (
                <div key={n.id} style={{
                  breakInside: "avoid", WebkitColumnBreakInside: "avoid",
                  display: "inline-block", width: "100%", marginBottom: 20,
                  position: "relative", paddingTop: 8,
                }}>
                  <div style={{
                    position: "relative",
                    transform: `rotate(${v.rotation}deg)`,
                    background: `linear-gradient(160deg, ${v.paper}, ${v.paper} 72%, rgba(0,0,0,0.06))`,
                    padding: "18px 12px 10px",
                    borderRadius: 2,
                    boxShadow: "0 6px 10px rgba(0,0,0,0.32), 0 1px 2px rgba(0,0,0,0.28)",
                    minHeight: 96,
                  }}>
                    <Pin color={n.pinColor} />
                    <div style={{
                      fontFamily: HAND, fontSize: 17, lineHeight: 1.32, color: "#3a3020",
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>{n.text}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 6 }}>
                      <span style={{ fontSize: 10.5, color: "rgba(58,48,32,0.65)", fontFamily: HAND, fontWeight: 600 }}>
                        {mine ? "Tú" : (n.fromName || "Tu pareja")}{noteDateLabel(n.at) ? ` · ${noteDateLabel(n.at)}` : ""}
                      </span>
                      <button onClick={() => onDelete?.(n.id)} aria-label="Quitar nota" title="Quitar"
                        style={{
                          background: "rgba(0,0,0,0.06)", border: "none", borderRadius: 99,
                          width: 24, height: 24, cursor: "pointer", fontFamily: "inherit",
                          fontSize: 11, color: "rgba(58,48,32,0.6)", flexShrink: 0, padding: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>✕</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
