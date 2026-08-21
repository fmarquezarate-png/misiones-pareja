import { useState } from "react";
import { LOVE_NOTE_MAX } from "../lib/loveNote.js";
import { isMineEntry } from "../lib/identity.js";

// Tarjeta de notita de amor. Muestra la notita actual y permite escribir una
// nueva (reemplaza). Sin notita, muestra solo un botón discreto para crear la
// primera. La autoría se decide por person-id (o nombre en notitas antiguas).
export default function LoveNote({ note, myName, myPersonId, partnerName, onSave, onClear }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const noteIsMine = note && isMineEntry(note, myName, myPersonId);

  const start = () => { setText(noteIsMine ? note.text : ""); setEditing(true); };
  const send = () => { const t = text.trim(); if (!t) return; onSave(t); setEditing(false); setText(""); };

  if (editing) {
    return (
      <div style={cardStyle}>
        <textarea
          value={text} onChange={e => setText(e.target.value)} maxLength={LOVE_NOTE_MAX} autoFocus
          placeholder={`Una notita para ${partnerName || "tu pareja"}… 💜`}
          style={{
            width: "100%", minHeight: 66, resize: "none", boxSizing: "border-box", padding: "10px 12px",
            borderRadius: 12, fontFamily: "inherit", fontSize: 14, lineHeight: 1.4,
            color: "var(--t-text,#f0e8ff)", background: "rgba(0,0,0,0.18)",
            border: "1px solid rgba(244,114,182,0.3)",
          }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 11, color: "var(--t-text-dim,#6b5f88)" }}>{text.length}/{LOVE_NOTE_MAX}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setEditing(false); setText(""); }} style={btnGhost}>Cancelar</button>
            <button onClick={send} disabled={!text.trim()} style={{ ...btnPrimary, opacity: text.trim() ? 1 : 0.5 }}>Enviar 💌</button>
          </div>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <button onClick={start} style={{
        ...cardStyle, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10,
        color: "var(--t-text-muted,#8b7fa8)", fontFamily: "inherit", fontSize: 13, width: "100%",
      }}>
        <span style={{ fontSize: 18 }}>💌</span> Dejar una notita para {partnerName || "tu pareja"}…
      </button>
    );
  }

  const mine = noteIsMine;
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>💌</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, color: "var(--t-text,#f0e8ff)", lineHeight: 1.45, fontFamily: "'Fraunces',serif", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{note.text}</div>
          <div style={{ fontSize: 11, color: "var(--t-text-dim,#6b5f88)", marginTop: 6 }}>
            {mine ? "Tu notita" : `— ${note.fromName || "tu pareja"}`}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        {mine && <button onClick={onClear} style={btnGhost}>Quitar</button>}
        <button onClick={start} style={btnGhost}>{mine ? "Cambiar" : "Responder 💜"}</button>
      </div>
    </div>
  );
}

const cardStyle = {
  margin: "0 0 4px", padding: "14px 16px", borderRadius: 16,
  background: "linear-gradient(135deg, rgba(244,114,182,0.14), rgba(232,121,249,0.10))",
  border: "1px solid rgba(244,114,182,0.3)",
};
const btnGhost = {
  padding: "6px 12px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12,
  color: "var(--t-text-muted,#8b7fa8)", background: "rgba(128,128,128,0.1)", border: "none",
};
const btnPrimary = {
  padding: "6px 14px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
  color: "#fff", border: "none", background: "linear-gradient(135deg,#f472b6,#e879f9)",
};
