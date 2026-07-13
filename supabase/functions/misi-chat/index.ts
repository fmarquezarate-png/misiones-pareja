// misi-chat — Supabase Edge Function (Deno)
//
// Puente entre el chat de Misi dentro de la app y el agente real en Vento
// (cloud.vento.build, network "fmarquezarate", board "misiones_assistant").
// El token de Vento vive en un secret de Supabase — nunca llega al navegador.
//
// Vento es ASÍNCRONO: action_chat encola el mensaje y devuelve un
// conversationId — no la respuesta del agente. El texto real se pide por
// separado con polling a action_messages, filtrando por remitente exacto
// ("misiones_assistant") y por timestamp >= al momento del envío — así
// nunca se devuelve por error una respuesta VIEJA que ya estaba en el
// historial de la conversación (bug real de la primera versión con polling:
// tomaba "el último mensaje que no es mío", que podía ser una respuesta
// antigua si el agente todavía no había contestado la nueva).
//
// conversationId = coupleId a propósito: le da a cada pareja un hilo
// estable — Misi recuerda contexto entre mensajes en vez de arrancar una
// conversación nueva y vacía en cada turno.
//
// ⚠️ Nota sobre el token: Bearer de sesión del navegador del usuario en
// cloud.vento.build (no una API key de servicio dedicada) — puede
// expirar/rotar si esa sesión se cierra. Si Vento responde 401/403,
// probablemente haya que pedirle al usuario un token nuevo.
//
// Modo:
//   GET  ?probe=1  → ping de vida (sin secrets, sin llamar a Vento)
//   POST normal    → { coupleId, message, personName } → { reply }
//
// Mientras VENTO_API_KEY no esté seteada, responde con un mensaje de
// cortesía en vez de fallar — para que el chat en la app nunca se vea roto.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Content-Type': 'application/json',
};

// Endpoints fijos del board — no son secretos, son parte de la API pública
// de Vento (solo el token de auth es sensible).
const VENTO_BOARD = 'https://cloud.vento.build/api/core/v1/networks/fmarquezarate/boards/misiones_assistant/actions';
const VENTO_CHAT_URL = `${VENTO_BOARD}/action_chat`;
const VENTO_MESSAGES_URL = `${VENTO_BOARD}/action_messages`;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120000; // 2 minutos

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  if (url.searchParams.get('probe') === '1') {
    return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString() }), { headers: corsHeaders });
  }

  try {
    const { coupleId, message, personName } = await req.json();
    if (!coupleId || !message) {
      return new Response(JSON.stringify({ error: 'coupleId y message requeridos' }), { status: 400, headers: corsHeaders });
    }

    const VENTO_TOKEN = Deno.env.get('VENTO_API_KEY') || '';

    if (!VENTO_TOKEN) {
      // Sin configurar todavía — respuesta de cortesía, no un error 500.
      return new Response(JSON.stringify({
        reply: `¡Hola ${personName || ""}! 👋 Todavía no me conectaron del todo con mi cerebro en Vento — pronto voy a poder responderte de verdad.`,
        stub: true,
      }), { headers: corsHeaders });
    }

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VENTO_TOKEN}`,
    };

    // El nombre de quien escribe se antepone al mensaje para que Misi sepa
    // a quién le está hablando dentro del hilo compartido de la pareja.
    const contextualMessage = personName ? `[${personName}] ${message}` : message;
    const sentAt = Date.now();

    // 1) Encolar el mensaje — conversationId = coupleId (hilo estable por pareja).
    const sendRes = await fetch(VENTO_CHAT_URL, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ message: contextualMessage, conversationId: coupleId }),
    });

    if (!sendRes.ok) {
      const text = await sendRes.text().catch(() => '');
      return new Response(JSON.stringify({ error: `Vento respondió ${sendRes.status} al enviar: ${text.slice(0, 300)}` }), { status: 502, headers: corsHeaders });
    }

    const sendData = await sendRes.json().catch(() => null);
    const conversationId = (sendData as Record<string, unknown> | null)?.conversationId ?? coupleId;

    // 2) Poll a action_messages hasta encontrar una respuesta NUEVA del
    // agente — remitente exacto "misiones_assistant" y timestamp posterior
    // al envío, para no devolver por error un mensaje viejo ya visto antes.
    const deadline = sentAt + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

      try {
        const msgsRes = await fetch(VENTO_MESSAGES_URL, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ conversationId }),
        });
        if (!msgsRes.ok) continue; // hiccup de red — reintentar en el próximo ciclo

        const msgsData = await msgsRes.json().catch(() => null);
        const messages = (msgsData as Record<string, unknown> | null)?.messages as Record<string, unknown>[] | undefined ?? [];
        const agentReply = [...messages].reverse().find(
          m => m.from === 'misiones_assistant' && Number(m.timestamp || 0) >= sentAt
        );

        const text = agentReply?.content;
        if (typeof text === 'string' && text.trim()) {
          return new Response(JSON.stringify({ reply: text, conversationId }), { headers: corsHeaders });
        }
      } catch {
        // error de red/parseo en este ciclo — reintentar en el próximo
      }
    }

    return new Response(JSON.stringify({ error: 'Misi no respondió a tiempo (2 min) — probá de nuevo en un momento.' }), { status: 504, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
