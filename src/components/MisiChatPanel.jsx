import { useState, useEffect, useRef } from "react";
import { S } from "../styles.js";
import { uid } from "../utils.js";
import { loadMisiHistory, saveMisiHistory, askMisi } from "../lib/misi.js";

// Chat con Misi — historial local (localStorage por pareja/dispositivo, sin
// tabla nueva en Supabase). onThinking(bool) le avisa al padre para que la
// mascota cambie a la emoción "escribiendo" mientras espera la respuesta.
export default function MisiChatPanel({ coupleId, personName, onClose, onThinking }) {
  const [messages, setMessages] = useState(() => loadMisiHistory(coupleId));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { saveMisiHistory(coupleId, messages); }, [coupleId, messages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);
  useEffect(() => { onThinking?.(sending); }, [sending, onThinking]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const mine = { id: uid(), who: "me", text, ts: Date.now() };
    setMessages(m => [...m, mine]);
    setInput("");
    setSending(true);
    try {
      const reply = await askMisi({ coupleId, message: text, personName });
      setMessages(m => [...m, { id: uid(), who: "misi", text: reply, ts: Date.now() }]);
    } catch (e) {
      setMessages(m => [...m, { id: uid(), who: "misi", text: `😵 No pude responder: ${e.message}`, error: true, ts: Date.now() }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 2000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--t-menu-bg,#0f0a1e)", borderTop: "1px solid var(--t-card-border,rgba(167,139,250,0.15))", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, height: "78vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 17, color: "var(--t-text,#f8f4ff)" }}>Misi</div>
            <div style={{ fontSize: 11, color: "var(--t-text-dim,#6b5f88)" }}>{sending ? "escribiendo…" : "tu asistente"}</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, color: "var(--t-text-muted,#8b7fa8)", fontSize: 18, cursor: "pointer", padding: "4px 9px", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--t-text-dim,#4a4166)", fontSize: 13, padding: "40px 20px", lineHeight: 1.7 }}>
              🤖 ¡Hola! Preguntame por tus tareas, tu semana, o lo que necesites.
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.who === "me" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "82%", padding: "9px 13px", borderRadius: m.who === "me" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: m.who === "me" ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : m.error ? "rgba(244,63,94,0.1)" : "rgba(128,128,128,0.1)",
                border: `1px solid ${m.who === "me" ? "var(--t-card-border,rgba(167,139,250,0.3))" : m.error ? "rgba(244,63,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                fontSize: 14, color: "var(--t-text,#f0e8ff)", lineHeight: 1.5, whiteSpace: "pre-wrap",
              }}>{m.text}</div>
            </div>
          ))}
          {sending && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 13px", background: "rgba(128,128,128,0.1)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px 16px 16px 4px", width: "fit-content" }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: 99, background: "var(--t-text-muted,#8b7fa8)", animation: `misi-typing-dot 1.2s ease-in-out ${i * 0.15}s infinite` }} />)}
              <style>{`@keyframes misi-typing-dot { 0%,60%,100% { opacity:0.3; transform:scale(0.8); } 30% { opacity:1; transform:scale(1.1); } }`}</style>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Escribile a Misi…" autoComplete="off" style={{ ...S.input, flex: 1 }} />
          <button onClick={send} disabled={sending || !input.trim()} style={{ ...S.btnPrimary, padding: "10px 16px", flexShrink: 0, opacity: sending || !input.trim() ? 0.5 : 1 }}>➤</button>
        </div>
      </div>
    </div>
  );
}
