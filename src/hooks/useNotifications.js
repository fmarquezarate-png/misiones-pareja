// ─── Hook y helpers de notificaciones push ───────────────────────────────────
import { useRef, useCallback } from "react";

/**
 * Muestra una notificación del sistema si el permiso está concedido.
 */
export function showNotif(title, body, opts = {}) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try { new Notification(title, { icon: "/icon-192.png", badge: "/icon-192.png", body, ...opts }); }
  catch { /* entorno no soportado */ }
}

/**
 * Hook que gestiona los timers de recordatorio de eventos.
 * Devuelve { scheduleReminders, clearReminders }.
 */
export function useNotifications() {
  const timers = useRef([]);

  const clearReminders = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const scheduleReminders = useCallback((data, p1, p2) => {
    clearReminders();
    if (!data?.settings?.notifications?.eventReminders) return;
    const OFFSETS = {
      ontime:  0,
      "15min": 15 * 60e3,
      "30min": 30 * 60e3,
      "1h":    60 * 60e3,
      "1day":  24 * 3600e3,
    };
    const now = Date.now();
    Object.values(data.weeks || {}).flatMap(w => w.missions || []).forEach(m => {
      if (m.type !== "event" || !m.date || !m.time || !m.reminder || m.reminder === "none") return;
      const offset = OFFSETS[m.reminder];
      if (offset === undefined) return;
      const fireAt = new Date(`${m.date}T${m.time}:00`).getTime() - offset;
      if (fireAt <= now) return;
      const who   = m.who === "person1" ? p1 : m.who === "person2" ? p2 : "Juntos";
      const label = { ontime: "¡Ahora!", "15min": "En 15 min", "30min": "En 30 min", "1h": "En 1 hora", "1day": "Mañana" }[m.reminder] || "";
      timers.current.push(
        setTimeout(() => showNotif(`${m.emoji} ${m.title}`, `${label} · ${who}`, { tag: `rem-${m.id}` }), fireAt - now)
      );
    });
  }, [clearReminders]);

  return { scheduleReminders, clearReminders };
}
