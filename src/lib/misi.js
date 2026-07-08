// Misi — cliente del chat con el agente. El historial vive en localStorage
// (por pareja, por dispositivo) — sin tabla nueva en Supabase para el MVP.
// El puente hacia Vento vive en la Edge Function misi-chat (server-side, la
// API key de Vento nunca llega al navegador).
import supabase from "../supabase.js";

const historyKey = coupleId => `misi-chat-${coupleId}`;

export function loadMisiHistory(coupleId) {
  try { return JSON.parse(localStorage.getItem(historyKey(coupleId)) || "[]"); } catch { return []; }
}

export function saveMisiHistory(coupleId, messages) {
  try { localStorage.setItem(historyKey(coupleId), JSON.stringify(messages.slice(-200))); } catch { /* modo privado */ }
}

// Envía un mensaje a Misi y devuelve su respuesta como texto.
// Lanza si la Edge Function falla — el caller decide el mensaje de fallback.
export async function askMisi({ coupleId, message, personName }) {
  const { data, error } = await supabase.functions.invoke("misi-chat", {
    body: { coupleId, message, personName },
  });
  if (error) {
    // error.message de supabase-js es genérico ("Edge Function returned a
    // non-2xx status code") — el detalle real (qué respondió Vento, qué
    // clave de la respuesta no se reconoció) viene en el body de la función,
    // accesible vía error.context (el Response crudo del fetch interno).
    let detail = null;
    try { detail = (await error.context?.json())?.error; } catch { /* body no era JSON */ }
    throw new Error(detail || error.message || "Misi no respondió");
  }
  if (!data?.reply) throw new Error("Respuesta vacía de Misi");
  return data.reply;
}
