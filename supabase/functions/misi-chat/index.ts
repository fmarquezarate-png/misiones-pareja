// misi-chat — Supabase Edge Function (Deno)
//
// Puente entre el chat de Misi dentro de la app y el agente real en Vento
// (cloud.vento.build, network "fmarquezarate", board "misiones_assistant").
// El token de Vento vive en un secret de Supabase — nunca llega al navegador.
//
// ⚠️ Nota sobre el token: es un Bearer token extraído de la sesión del
// navegador del usuario en cloud.vento.build (no una API key de servicio
// dedicada) — puede expirar/rotar si la sesión de Vento se cierra. Si Vento
// responde 401/403, probablemente haya que pedirle al usuario un token nuevo.
//
// Vento es ASÍNCRONO: action_chat solo encola el mensaje y devuelve un
// conversationId — no la respuesta del agente. El texto real hay que
// pedirlo por separado, con polling a action_messages, hasta que aparezca
// un mensaje que no sea el propio (o hasta agotar el timeout).
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
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120000; // 2 minutos

function extractText(m: Record<string, unknown> | null | undefined): string | null {
  if (!m) return null;
  const v = m.content ?? m.text ?? m.message ?? m.value ?? m.reply ?? m.response ?? m.output;
  return typeof v === 'string' && v.trim() ? v : null;
}

// Vento podría envolver la lista de mensajes de distintas formas según la
// acción — se prueban las formas más probables antes de rendirse.
function extractMessages(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const obj = data as Record<string, unknown> | null;
  const candidate = obj?.messages ?? obj?.value ?? obj?.result ?? obj?.data;
  return Array.isArray(candidate) ? (candidate as Record<string, unknown>[]) : [];
}

function isFromUser(m: Record<string, unknown>): boolean {
  const role = String(m.role ?? m.sender ?? m.from ?? m.author ?? '').toLowerCase();
  return role === 'user' || role === 'me' || role === 'human';
}

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
    // a quién le está hablando (action_chat no distingue coupleId/persona).
    const contextualMessage = personName ? `[${personName}] ${message}` : message;

    // 1) Encolar el mensaje. SIN conversationId propio — Vento genera el
    // suyo; forzar coupleId ahí era inválido y probablemente la causa raíz
    // del "sin texto reconocible" (action_chat no devuelve el reply acá).
    const sendRes = await fetch(`${VENTO_BOARD}/action_chat`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ message: contextualMessage }),
    });

    if (!sendRes.ok) {
      const text = await sendRes.text().catch(() => '');
      return new Response(JSON.stringify({ error: `Vento respondió ${sendRes.status} al enviar: ${text.slice(0, 300)}` }), { status: 502, headers: corsHeaders });
    }

    const sendData = await sendRes.json().catch(() => null);

    // Caso feliz poco probable pero posible: a veces el agente responde
    // sincrónicamente y action_chat ya trae el texto — evita el polling.
    const immediateReply = extractText(sendData as Record<string, unknown>);
    if (immediateReply) {
      return new Response(JSON.stringify({ reply: immediateReply }), { headers: corsHeaders });
    }

    const obj = sendData as Record<string, unknown> | null;
    const conversationId = obj?.conversationId ?? obj?.conversation_id ?? obj?.id ?? obj?.conversation ?? null;
    if (!conversationId) {
      return new Response(JSON.stringify({ error: `No se pudo identificar la conversación tras enviar: ${JSON.stringify(sendData).slice(0, 300)}` }), { status: 502, headers: corsHeaders });
    }

    // 2) Poll a action_messages hasta encontrar la respuesta del agente
    // (un mensaje que no sea el nuestro) o agotar el timeout de 2 minutos.
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

      const msgsRes = await fetch(`${VENTO_BOARD}/action_messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ conversationId }),
      });
      if (!msgsRes.ok) continue; // hiccup de red — reintentar en el próximo ciclo

      const msgsData = await msgsRes.json().catch(() => null);
      const messages = extractMessages(msgsData);
      if (!messages.length) continue;

      const agentMsg = [...messages].reverse().find(m => !isFromUser(m));
      const text = extractText(agentMsg);
      if (text) {
        return new Response(JSON.stringify({ reply: text }), { headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ error: 'Misi tardó más de 2 minutos en responder — probá de nuevo en un momento.' }), { status: 504, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
