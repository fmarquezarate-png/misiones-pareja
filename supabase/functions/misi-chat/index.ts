// misi-chat — Supabase Edge Function (Deno)
//
// Puente entre el chat de Misi dentro de la app y el agente real en Vento
// (cloud.vento.build, network "fmarquezarate", board "misiones_assistant",
// acción "action_chat" — contrato confirmado por el usuario vía
// VENTO_CLAUDE.md). El token de Vento vive en un secret de Supabase — nunca
// llega al navegador.
//
// ⚠️ Nota sobre el token: es un Bearer token extraído de la sesión del
// navegador del usuario en cloud.vento.build (no una API key de servicio
// dedicada) — puede expirar/rotar si la sesión de Vento se cierra. Si Vento
// responde 401/403, probablemente haya que pedirle al usuario un token nuevo.
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

// Endpoint fijo del board/acción — no es secreto, es parte de la API pública
// de Vento (solo el token de auth es sensible).
const VENTO_CHAT_URL = 'https://cloud.vento.build/api/core/v1/networks/fmarquezarate/boards/misiones_assistant/actions/action_chat';

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

    // action_chat no tiene un parámetro couple_id propio (la app sirve a
    // varias parejas con el mismo agente) — conversationId separa el hilo
    // por pareja, y el nombre de quien escribe se antepone al mensaje para
    // que Misi sepa a quién le está hablando.
    const contextualMessage = personName ? `[${personName}] ${message}` : message;

    const ventoRes = await fetch(VENTO_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VENTO_TOKEN}`,
      },
      body: JSON.stringify({ message: contextualMessage, conversationId: coupleId }),
    });

    if (!ventoRes.ok) {
      const text = await ventoRes.text().catch(() => '');
      return new Response(JSON.stringify({ error: `Vento respondió ${ventoRes.status}: ${text.slice(0, 200)}` }), { status: 502, headers: corsHeaders });
    }

    const ventoData = await ventoRes.json().catch(() => null);
    // Contrato de respuesta de action_chat no confirmado con un ejemplo real
    // todavía — se prueban las claves más probables (incluidas las propias
    // del modelo de "card value" de Vento) antes de rendirse y devolver el
    // raw completo para poder ajustar esto en el primer mensaje real.
    const reply = ventoData?.reply ?? ventoData?.response ?? ventoData?.message ?? ventoData?.output
      ?? ventoData?.result ?? ventoData?.value ?? (typeof ventoData === 'string' ? ventoData : null);
    if (!reply) {
      // El `raw` va DENTRO del mensaje de error (no en un campo aparte) para
      // que se vea directo en la burbuja de error del chat — así se puede
      // ajustar la clave correcta sin depender de acceso a los logs de Supabase.
      return new Response(JSON.stringify({ error: `Respuesta de Vento sin texto reconocible: ${JSON.stringify(ventoData).slice(0, 400)}` }), { status: 502, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ reply }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
