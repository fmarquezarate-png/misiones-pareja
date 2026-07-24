// misi-chat — Supabase Edge Function (Deno)
//
// Chat de Misi dentro de la app, respondido directo por OpenAI (server-side,
// la API key nunca llega al navegador).
//
// Antes esto pasaba por Vento (cloud.vento.build) — se sacó porque el
// VENTO_API_KEY era un Bearer de sesión del navegador del usuario (no una
// API key de servicio), que rota cada semana y dejaba el chat roto en la
// app hasta que alguien pegaba un token nuevo a mano. La integración de
// Telegram sigue usando Vento aparte (no toca este archivo) — solo el chat
// in-app se movió a una API key estable que no expira.
//
// El historial de la conversación vive en localStorage en el cliente (no
// hay tabla en Supabase para esto) — el cliente manda los últimos mensajes
// junto con el mensaje nuevo, y acá se arma el array de mensajes para la
// Chat Completions API. Así Misi mantiene contexto dentro del hilo del
// dispositivo sin necesitar un thread server-side.
//
// Modo:
//   GET  ?probe=1  → ping de vida (sin secrets, sin llamar a OpenAI)
//   POST normal    → { coupleId, message, personName, history? } → { reply }
//
// Mientras OPENAI_API_KEY no esté seteada, responde con un mensaje de
// cortesía en vez de fallar — para que el chat en la app nunca se vea roto.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Content-Type': 'application/json',
};

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

// Cuántos mensajes previos del historial local se reenvían como contexto
// (además del mensaje nuevo). Suficiente para que Misi recuerde de qué se
// venía hablando sin inflar de más cada request.
const MAX_HISTORY_MESSAGES = 20;

const SYSTEM_PROMPT = `Sos Misi, la mascota-robot de "misiones pareja", una app donde una pareja organiza y se reparte misiones/tareas de la semana en un calendario compartido.

Tu personalidad: cálido, juguetón, un poco torpe-tierno (sos un robotito), y genuinamente del lado de la pareja que te habla — los alentás a coordinarse y cuidarse, nunca los sermoneás ni asumís quién "hizo menos". Hablás en español rioplatense/neutro, en primera persona, con energía positiva pero sin exagerar — frases cortas, algún emoji suelto (no en cada oración), sin relleno corporativo.

No tenés acceso en vivo a los datos reales de misiones/calendario de esta pareja — si te preguntan algo puntual de sus tareas que no sepas, decilo con naturalidad ("todavía no puedo ver el detalle de tus misiones, pero...") y ofrecé ayuda general (ideas para repartir tareas, ánimo, sugerencias, charla). Si te dicen su nombre o el de su pareja, usalo con cariño. Respuestas breves — pocas líneas, no ensayos.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  if (url.searchParams.get('probe') === '1') {
    return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString() }), { headers: corsHeaders });
  }

  try {
    const { coupleId, message, personName, history } = await req.json();
    if (!coupleId || !message) {
      return new Response(JSON.stringify({ error: 'coupleId y message requeridos' }), { status: 400, headers: corsHeaders });
    }

    const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';

    if (!OPENAI_KEY) {
      // Sin configurar todavía — respuesta de cortesía, no un error 500.
      return new Response(JSON.stringify({
        reply: `¡Hola ${personName || ""}! 👋 Todavía no me conectaron del todo con mi cerebro — pronto voy a poder responderte de verdad.`,
        stub: true,
      }), { headers: corsHeaders });
    }

    // Arma los mensajes previos (recortados) como contexto, en el formato
    // que ya usa el cliente: { who: "me" | "misi", text }.
    const priorMessages: { who?: string; text?: string }[] = Array.isArray(history) ? history : [];
    const trimmedHistory = priorMessages.slice(-MAX_HISTORY_MESSAGES).filter(m => typeof m?.text === 'string' && m.text.trim());

    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...trimmedHistory.map(m => ({
        role: m.who === 'me' ? 'user' : 'assistant',
        content: m.who === 'me' && personName ? `[${personName}] ${m.text}` : m.text,
      })),
      { role: 'user', content: personName ? `[${personName}] ${message}` : message },
    ];

    const aiRes = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: chatMessages,
        temperature: 0.8,
        max_tokens: 300,
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text().catch(() => '');
      return new Response(JSON.stringify({ error: `OpenAI respondió ${aiRes.status}: ${text.slice(0, 300)}` }), { status: 502, headers: corsHeaders });
    }

    const aiData = await aiRes.json().catch(() => null);
    const reply = (aiData as Record<string, unknown> | null)?.choices?.[0]?.message?.content;

    if (typeof reply !== 'string' || !reply.trim()) {
      return new Response(JSON.stringify({ error: 'Respuesta de OpenAI sin texto reconocible' }), { status: 502, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ reply: reply.trim(), conversationId: coupleId }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
