import { useState, useRef, useMemo } from "react";
import { trophyLayout, overflowCount, gratitudeParties, rotationToFace, RING_CAPACITY } from "../lib/trophy.js";
import { GRATITUDE_MAX } from "../lib/gratitude.js";
import { noteDateLabel } from "../lib/loveNote.js";
import { prefersReducedMotion, haptic } from "../utils.js";

// ── Geometría de la copa ────────────────────────────────────────────────────
const R = 92;               // radio del pedestal
const FACES = 12;           // caras del cilindro
const FACE_W = Math.ceil((2 * Math.PI * R) / FACES) + 2;
const PLINTH_H = 110;
const RING_Y = [-31, 0, 31]; // altura de cada anillo de placas
const STEP = 360 / RING_CAPACITY;

const GOLD = "linear-gradient(100deg,#6d4f0f 0%,#f3d074 18%,#fff7cf 34%,#e6b93f 52%,#8a6415 72%,#d9ab3c 88%,#7a5a12 100%)";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rad = (deg) => (deg * Math.PI) / 180;

// Pieza en el espacio 3D: caja centrada en el origen del grupo con su propia
// transformación. Todo hijo mantiene preserve-3d para poder anidar.
function Part({ w, h, t, style, children }) {
  return (
    <div style={{
      position: "absolute", left: "50%", top: "50%",
      width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2,
      transformStyle: "preserve-3d", transform: t, ...style,
    }}>{children}</div>
  );
}

// Sombreado según hacia dónde mira la cara (luz fija arriba-izquierda del mundo).
function shade(faceAngle, ry) {
  return clamp(0.5 + 0.5 * Math.cos(rad(faceAngle + ry + 28)), 0, 1);
}

export default function TrophyView({ gratitudes = [], myName, myPersonId, partnerName, onAdd }) {
  const [ry, setRy] = useState(-8);
  const [zoom, setZoom] = useState(null);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [reduce] = useState(() => prefersReducedMotion());
  const drag = useRef(null);
  const moved = useRef(0);

  const plaques = useMemo(() => trophyLayout(gratitudes), [gratitudes]);
  const extra = overflowCount(gratitudes);
  const parties = (g) => gratitudeParties(g, { myName, myPersonId, partnerName });

  // Arrastre horizontal = girar. Vertical se deja al scroll de la página
  // (touchAction pan-y) y el gesto se descarta si el movimiento dominante es
  // vertical: nada se mueve hasta que el gesto es inequívocamente horizontal.
  const onDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, ry, active: false };
    moved.current = 0;
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    moved.current = Math.max(moved.current, Math.abs(dx));
    if (!d.active) {
      if (Math.abs(dx) < 15 || Math.abs(dy) > Math.abs(dx)) return;
      d.active = true;
      setDragging(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    setRy(d.ry + dx * 0.55);
  };
  const onUp = () => { drag.current = null; setDragging(false); };

  const openPlaque = (p) => {
    if (moved.current > 10) return;      // fue un giro, no un toque
    haptic(12);
    setRy((cur) => rotationToFace(p.angle, cur));
    setZoom(p.g);
  };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onAdd?.(t);
    setText("");
    setComposing(false);
  };

  const spin = (dir) => setRy((cur) => cur + dir * STEP);

  return (
    <div style={{ padding: "12px 12px 120px" }}>
      <style>{`
        @keyframes tv-zoom { from { transform: scale(0.55); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes tv-fade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--t-text,#f8f4ff)", fontFamily: "'Fraunces',serif" }}>🏆 La Copa</div>
          <div style={{ fontSize: 12, color: "var(--t-text-dim,#6b5f88)", marginTop: 2 }}>
            {plaques.length ? "Cada agradecimiento, una placa. Gírala y toca una." : "Vuestros agradecimientos, grabados"}
          </div>
        </div>
        <button onClick={() => setComposing(c => !c)} style={{
          background: composing ? "rgba(244,114,182,0.15)" : "var(--t-accent-soft,rgba(167,139,250,0.14))",
          border: `1px solid ${composing ? "rgba(244,114,182,0.4)" : "rgba(167,139,250,0.35)"}`,
          borderRadius: 10, color: composing ? "#f472b6" : "var(--t-accent,#c4b8ff)",
          fontSize: 13, fontWeight: 600, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit",
        }}>{composing ? "✕ Cerrar" : "+ Gracias"}</button>
      </div>

      {/* Compose */}
      {composing && (
        <div style={{ background: "var(--t-card,#1d1733)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
          <textarea
            value={text} onChange={e => setText(e.target.value)} maxLength={GRATITUDE_MAX} autoFocus
            placeholder={`Agradezco que ${partnerName || "tu pareja"}…`}
            style={{
              width: "100%", minHeight: 64, resize: "none", boxSizing: "border-box", padding: "10px 12px",
              borderRadius: 10, fontFamily: "inherit", fontSize: 15, lineHeight: 1.4,
              color: "var(--t-text,#f0e8ff)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.2)",
            }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "var(--t-text-dim,#6b5f88)" }}>{text.length}/{GRATITUDE_MAX}</span>
            <button onClick={send} disabled={!text.trim()} style={{
              padding: "8px 16px", borderRadius: 99, cursor: text.trim() ? "pointer" : "default", fontFamily: "inherit",
              fontSize: 13, fontWeight: 600, color: "#3a2c05", border: "none", background: GOLD, opacity: text.trim() ? 1 : 0.5,
            }}>Grabar placa 🏆</button>
          </div>
        </div>
      )}

      {/* ── Escenario 3D ─────────────────────────────────────────────────── */}
      <div
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{
          position: "relative", height: 470, touchAction: "pan-y", userSelect: "none",
          WebkitUserSelect: "none", cursor: dragging ? "grabbing" : "grab",
          perspective: 1100, perspectiveOrigin: "50% 42%",
          borderRadius: 18, overflow: "hidden",
          background: "radial-gradient(120% 80% at 50% 22%, rgba(246,214,122,0.16), rgba(20,14,40,0) 62%), var(--t-card,#1d1733)",
          border: "1px solid rgba(167,139,250,0.18)",
        }}>
        {/* Grupo que gira */}
        <div style={{
          position: "absolute", left: "50%", top: 302, width: 0, height: 0,
          transformStyle: "preserve-3d",
          transform: `rotateX(-10deg) rotateY(${ry}deg)`,
          transition: dragging || reduce ? "none" : "transform 620ms cubic-bezier(.2,.8,.2,1)",
        }}>
          {/* ── Copa ────────────────────────────────────────────────────────
              Cuenco, cuello, nudo y pie son cuerpos de revolución: su silueta
              es idéntica desde cualquier ángulo, así que se contra-giran
              (billboard, rotateY(-ry)) en vez de modelarse. Es exacto y evita
              las "aletas" que dejaban los planos cruzados. Las asas SÍ giran
              con el conjunto, que es lo que hacen de verdad. */}
          {/* Asas: anillos abiertos, detrás del cuenco */}
          {[-1, 1].map(s => (
            <Part key={`h${s}`} w={54} h={72} t={`translateY(-236px) translateX(${s * 76}px)`}>
              <div style={{
                width: "100%", height: "100%", borderRadius: "50%", background: "transparent",
                border: "10px solid #c79b2c",
                borderTopColor: "#f3d074", borderBottomColor: "#8a6415",
                [s < 0 ? "borderRightColor" : "borderLeftColor"]: "transparent",
                boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
              }} />
            </Part>
          ))}
          {/* Cuenco + boca */}
          <Part w={144} h={106} t={`translateY(-234px) rotateY(${-ry}deg)`}>
            <div style={{
              width: "100%", height: "100%", background: GOLD,
              borderRadius: "4px 4px 46% 46% / 4px 4px 80% 80%",
              boxShadow: "inset 0 -16px 28px rgba(0,0,0,0.35)",
            }} />
            <div style={{
              position: "absolute", left: 0, right: 0, top: -10, height: 22, borderRadius: "50%",
              background: "radial-gradient(ellipse at 50% 30%, #4b360c, #241a06 78%)",
              border: "3px solid #edc85e", boxSizing: "border-box",
            }} />
          </Part>
          {/* Cuello */}
          <Part w={24} h={46} t={`translateY(-160px) rotateY(${-ry}deg)`}>
            <div style={{ width: "100%", height: "100%", background: GOLD, clipPath: "polygon(24% 0,76% 0,66% 100%,34% 100%)" }} />
          </Part>
          {/* Nudo */}
          <Part w={34} h={34} t={`translateY(-131px) rotateY(${-ry}deg)`}>
            <div style={{
              width: "100%", height: "100%", borderRadius: "50%",
              background: "radial-gradient(circle at 34% 30%, #fff7cf, #edc85e 38%, #b9922c 68%, #6d4f0f)",
            }} />
          </Part>
          {/* Pie */}
          <Part w={104} h={56} t={`translateY(-88px) rotateY(${-ry}deg)`}>
            <div style={{
              width: "100%", height: "100%", background: GOLD,
              clipPath: "polygon(31% 0,69% 0,100% 82%,100% 100%,0 100%,0 82%)",
            }} />
          </Part>

          {/* ── Pedestal: cilindro real de FACES caras ── */}
          {/* Tapa superior */}
          <Part w={(R + 12) * 2} h={(R + 12) * 2} t={`translateY(${-PLINTH_H / 2}px) rotateX(90deg)`}>
            <div style={{
              width: "100%", height: "100%", borderRadius: "50%",
              background: "radial-gradient(circle at 38% 32%, #3b2a4f, #221634 60%, #150e22)",
              boxShadow: "0 0 24px rgba(0,0,0,0.5)",
            }} />
          </Part>
          {/* Caras + molduras doradas arriba y abajo */}
          {Array.from({ length: FACES }, (_, i) => {
            const a = i * (360 / FACES);
            const l = shade(a, ry);
            const br = `brightness(${(0.62 + 0.8 * l).toFixed(3)})`;
            return (
              <Part key={`f${i}`} w={FACE_W} h={PLINTH_H} t={`rotateY(${a}deg) translateZ(${R}px)`}
                style={{ backfaceVisibility: "hidden" }}>
                <div style={{
                  width: "100%", height: "100%", filter: br,
                  background: "linear-gradient(180deg,#2b1d42,#1a1129 55%,#241738)",
                  borderTop: "7px solid #c79b2c", borderBottom: "7px solid #a8802133",
                  boxSizing: "border-box",
                }} />
              </Part>
            );
          })}
          {/* Tapa inferior (base ancha) */}
          <Part w={(R + 20) * 2} h={(R + 20) * 2} t={`translateY(${PLINTH_H / 2}px) rotateX(90deg)`}>
            <div style={{
              width: "100%", height: "100%", borderRadius: "50%",
              background: "radial-gradient(circle at 42% 38%, #2e2046, #1a1129 70%)",
              boxShadow: "0 0 40px rgba(0,0,0,0.6)",
            }} />
          </Part>

          {/* ── Placas ── */}
          {plaques.map((p) => {
            const l = shade(p.angle, ry);
            const front = l > 0.55;
            return (
              <Part key={p.g.id} w={64} h={22}
                t={`rotateY(${p.angle}deg) translateZ(${R + 7}px) translateY(${RING_Y[p.ring]}px)`}
                style={{ backfaceVisibility: "hidden" }}>
                <button
                  onClick={() => openPlaque(p)}
                  title={p.g.text}
                  style={{
                    width: "100%", height: "100%", padding: "0 3px", cursor: "pointer",
                    borderRadius: 2, border: "1px solid rgba(255,247,207,0.5)",
                    background: GOLD, color: "#3a2c05",
                    fontFamily: "inherit", fontSize: 7.5, fontWeight: 700, letterSpacing: 0,
                    lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    whiteSpace: "normal", wordBreak: "break-word",
                    filter: `brightness(${(0.5 + 0.7 * l).toFixed(3)})`,
                    boxShadow: front ? "0 2px 6px rgba(0,0,0,0.45)" : "none",
                  }}>{p.g.text}</button>
              </Part>
            );
          })}
        </div>

        {/* Estado vacío, superpuesto al pedestal desnudo */}
        {plaques.length === 0 && (
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 18, textAlign: "center",
            color: "var(--t-text-dim,#8b7bb0)", fontSize: 12.5, padding: "0 24px",
          }}>
            Todavía no hay ninguna placa. El primer «gracias» la estrena.
          </div>
        )}

        {/* Controles de giro */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, display: "flex", justifyContent: "center", gap: 10 }}>
          {[["◀", -1], ["▶", 1]].map(([icon, dir]) => (
            <button key={icon} onClick={() => spin(dir)} aria-label={dir < 0 ? "Girar a la izquierda" : "Girar a la derecha"}
              style={{
                width: 38, height: 38, borderRadius: "50%", cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,247,207,0.25)", color: "#f3d074",
                backdropFilter: "blur(6px)",
              }}>{icon}</button>
          ))}
        </div>
      </div>

      {extra > 0 && (
        <div style={{ fontSize: 11.5, color: "var(--t-text-dim,#6b5f88)", textAlign: "center", marginTop: 8 }}>
          La copa muestra las {plaques.length} más recientes · {extra} más en la lista
        </div>
      )}

      {/* ── Todas las placas ─────────────────────────────────────────────── */}
      {gratitudes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t-text-dim,#8b7bb0)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
            Todas las placas
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {gratitudes.map(g => {
              const { from, to, mine } = parties(g);
              return (
                <button key={g.id} onClick={() => { haptic(10); setZoom(g); }} style={{
                  textAlign: "left", cursor: "pointer", fontFamily: "inherit", width: "100%",
                  background: "var(--t-card,#1d1733)", border: "1px solid rgba(167,139,250,0.16)",
                  borderLeft: `3px solid ${mine ? "#f3d074" : "#f472b6"}`,
                  borderRadius: 10, padding: "9px 12px",
                }}>
                  <div style={{ fontSize: 13.5, color: "var(--t-text,#f0e8ff)", lineHeight: 1.35 }}>{g.text}</div>
                  <div style={{ fontSize: 10.5, color: "var(--t-text-dim,#6b5f88)", marginTop: 3 }}>
                    de {from} a {to}{noteDateLabel(g.at) ? ` · ${noteDateLabel(g.at)}` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Zoom a la placa ──────────────────────────────────────────────── */}
      {zoom && (() => {
        const { from, to } = parties(zoom);
        return (
          <div onClick={() => setZoom(null)} style={{
            position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24, background: "rgba(10,6,20,0.72)", backdropFilter: "blur(6px)",
            animation: reduce ? "none" : "tv-fade 180ms ease-out",
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: "100%", maxWidth: 340, borderRadius: 8, padding: "26px 22px 20px",
              background: GOLD, color: "#3a2c05", textAlign: "center",
              border: "2px solid rgba(255,247,207,0.65)",
              boxShadow: "0 22px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.5)",
              animation: reduce ? "none" : "tv-zoom 320ms cubic-bezier(.2,.9,.25,1)",
            }}>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", opacity: 0.65, marginBottom: 12 }}>Placa grabada</div>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 21, fontWeight: 700, lineHeight: 1.3 }}>{zoom.text}</div>
              <div style={{ height: 1, background: "rgba(58,44,5,0.3)", margin: "16px 30px 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 700 }}>de {from} a {to}</div>
              {noteDateLabel(zoom.at) && (
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{noteDateLabel(zoom.at)}</div>
              )}
              <button onClick={() => setZoom(null)} style={{
                marginTop: 18, padding: "8px 20px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 700, color: "#f3d074", background: "#2b1d42", border: "none",
              }}>Cerrar</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
