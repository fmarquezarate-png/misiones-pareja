// "Dar un toque" (3.2): un aviso intencional a la pareja sobre una tarea. Es
// transitorio (solo push, no cambia el blob). El texto se arma aquí, puro y
// testeable.

export const NUDGE_INTENTS = [
  { id: "mine",   label: "¿Te encargas tú?",   emoji: "🙏" },
  { id: "remind", label: "Recuérdalo",         emoji: "⏰" },
  { id: "thanks", label: "¡Gracias por esto!", emoji: "💜" },
];

export function nudgeMessage(intent, senderName, mission) {
  const t = `${mission?.emoji || "🎯"} «${mission?.title || ""}»`;
  const who = senderName || "Tu pareja";
  switch (intent) {
    case "mine":   return `${who} pregunta: ¿te encargas de ${t}? 🙏`;
    case "thanks": return `${who} te agradece por ${t} 💜`;
    case "remind":
    default:       return `${who} te recuerda: ${t} ⏰`;
  }
}
