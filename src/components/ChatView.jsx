import { useState, useEffect, useRef } from "react";
import supabase, { loadMessages, sendMessage, subscribeToMessages } from "../supabase.js";
import { sendContextualPush } from "../lib/push.js";
import { showNotif } from "../lib/appUtils.js";
import { S } from "../styles.js";

export default function ChatView({ coupleId, personName, sessionUserId, chatNotifEnabled }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!coupleId) return;
    loadMessages(coupleId).then(setMessages);
    const ch = subscribeToMessages(coupleId, msg => {
      setMessages(prev => [...prev, msg]);
      if (chatNotifEnabled && msg.sender_name !== personName && document.visibilityState !== "visible") {
        showNotif(`💬 ${msg.sender_name}`, msg.content, { tag: `chat-${msg.id}` });
      }
    });
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const MAX_MSG = 2000;

  const send = async () => {
    const msgText = input.trim();
    if (!msgText || sending) return;
    if (msgText.length > MAX_MSG) return;
    setSending(true);
    try {
      await sendMessage(coupleId, personName, msgText);
      setInput("");
      // sendMessage is awaited — the message is already in DB at this point, safe to notify
      sendContextualPush(coupleId, { body: `${personName}: ${msgText.slice(0, 80)}`, tag: "mp-chat" }, sessionUserId);
    } catch (e) { console.warn("send err", e); }
    finally { setSending(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", maxHeight: 680 }}>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "4px 0 12px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--t-text-dim,#3d3360)", padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 14, fontStyle: "italic", lineHeight: 1.6 }}>Todavía no hay mensajes.<br />¡Empieza la conversación!</div>
          </div>
        )}
        {messages.map(m => {
          const isMe = m.sender_name === personName;
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
              {!isMe && <div style={{ fontSize: 10, color: "var(--t-text-dim,#4a4166)", marginBottom: 2, marginLeft: 4 }}>{m.sender_name}</div>}
              <div style={{
                maxWidth: "78%", background: isMe ? "var(--t-accent-soft,rgba(167,139,250,0.18))" : "rgba(128,128,128,0.10)",
                border: `1px solid ${isMe ? "var(--t-card-border,rgba(167,139,250,0.3))" : "rgba(255,255,255,0.1)"}`,
                borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                padding: "8px 12px", fontSize: 14, color: "var(--t-text,#f0e8ff)", lineHeight: 1.5,
              }}>
                {m.content}
              </div>
              <div style={{ fontSize: 10, color: "var(--t-text-dim,#3d3360)", marginTop: 2, marginLeft: 4, marginRight: 4 }}>
                {new Date(m.created_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ borderTop: "1px solid var(--t-card-border,rgba(167,139,250,0.1))", paddingTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value.slice(0, MAX_MSG))}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Escribe un mensaje..."
            style={{ ...S.input, width: "100%", boxSizing: "border-box" }}
            autoComplete="off"
          />
          {input.length > MAX_MSG * 0.8 && (
            <div style={{ position: "absolute", right: 6, bottom: -16, fontSize: 10, color: input.length >= MAX_MSG ? "#f87171" : "var(--t-text-dim,#3d3360)" }}>
              {input.length}/{MAX_MSG}
            </div>
          )}
        </div>
        <button onClick={send} disabled={sending || !input.trim() || input.length > MAX_MSG}
          style={{ ...S.btnPrimary, padding: "10px 16px", flexShrink: 0, minWidth: 44 }}>
          {sending ? "⏳" : "➤"}
        </button>
      </div>
    </div>
  );
}
