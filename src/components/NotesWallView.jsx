import { useState } from "react";
import { LOVE_NOTE_MAX, noteDateLabel } from "../lib/loveNote.js";
import { isMineEntry } from "../lib/identity.js";

// Muro de notitas (submenú Nosotros): historial de mensajitos de amor. Compose
// arriba + lista de burbujas con autor y fecha. La más reciente es la que se
// fija en el inicio.
export default function NotesWallView({ notes = [], myName, myPersonId, partnerName, onAdd, onDelete }) {
  const [text, setText] = useState("");
  const send = () => { const t = text.trim(); if (!t) return; onAdd?.(t); setText(""); };

  return (
    <div style={{ padding: "16px 16px 120px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--t-text,#f8f4ff)", fontFamily: "'Fraunces',serif" }}>💌 Notitas</div>
        <div style={{ fontSize: 12, color: "var(--t-text-dim,#6b5f88)", marginTop: 2 }}>La más reciente se fija en el inicio</div>
      </div>

      {/* Compose */}
      <div style={{
        padding: "12px 14px", borderRadius: 16, marginBottom: 20,
        background: "linear-gradient(135deg, rgba(244,114,182,0.12), rgba(232,121,249,0.09))",
        border: "1px solid rgba(244,114,182,0.28)",
      }}>
        <textarea
          value={text} onChange={e => setText(e.target.value)} maxLength={LOVE_NOTE_MAX}
          placeholder={`Una notita para ${partnerName || "tu pareja"}… 💜`}
          style={{
            width: "100%", minHeight: 60, resize: "none", boxSizing: "border-box", padding: "10px 12px",
            borderRadius: 12, fontFamily: "inherit", fontSize: 14, lineHeight: 1.4,
            color: "var(--t-text,#f0e8ff)", background: "rgba(0,0,0,0.18)", border: "1px solid rgba(244,114,182,0.3)",
          }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 11, color: "var(--t-text-dim,#6b5f88)" }}>{text.length}/{LOVE_NOTE_MAX}</span>
          <button onClick={send} disabled={!text.trim()} style={{
            padding: "7px 16px", borderRadius: 99, cursor: text.trim() ? "pointer" : "default", fontFamily: "inherit",
            fontSize: 12, fontWeight: 600, color: "#fff", border: "none",
            background: "linear-gradient(135deg,#f472b6,#e879f9)", opacity: text.trim() ? 1 : 0.5,
          }}>Enviar 💌</button>
        </div>
      </div>

      {/* Lista */}
      {notes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 20px", color: "var(--t-text-dim,#6b5f88)" }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>💌</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t-text-muted,#8b7fa8)", marginBottom: 6 }}>Aún no hay notitas</div>
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>Escribe la primera arriba.<br />Aparecerá aquí y en el inicio de tu pareja.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {notes.map(n => {
            const mine = isMineEntry(n, myName, myPersonId);
            return (
              <div key={n.id} style={{
                padding: "12px 14px", borderRadius: 14,
                background: mine ? "rgba(167,139,250,0.10)" : "rgba(244,114,182,0.10)",
                border: `1px solid ${mine ? "rgba(167,139,250,0.22)" : "rgba(244,114,182,0.22)"}`,
              }}>
                <div style={{ fontSize: 15, color: "var(--t-text,#f0e8ff)", lineHeight: 1.45, fontFamily: "'Fraunces',serif", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{n.text}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--t-text-dim,#6b5f88)" }}>
                    {mine ? "Tú" : (n.fromName || "Tu pareja")}{noteDateLabel(n.at) ? ` · ${noteDateLabel(n.at)}` : ""}
                  </span>
                  <button onClick={() => onDelete?.(n.id)} aria-label="Quitar notita" style={{
                    fontSize: 12, color: "var(--t-text-dim,#6b5f88)", background: "transparent", border: "none",
                    cursor: "pointer", fontFamily: "inherit", padding: "2px 6px",
                  }}>Quitar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
