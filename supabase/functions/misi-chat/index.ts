// misi-chat — Supabase Edge Function (Deno)
//
// Puente entre el chat de Misi dentro de la app y el agente ya armado en
// Vento (cloud.vento.build). La API key/URL de Vento vive en secrets de
// Supabase — nunca llega al navegador.
//
// ⚠️ PENDIENTE DE CONFIGURAR (ver TAREAS_SQL_AGENTE_SUPABASE.md):
//   1. Confirmar la URL real del agente en el workspace de Vento del usuario
//      (patrón conocido: /api/agents/v1/{agent_name}/agent_input?message=...
//      — pero esa es la ruta de ejemplo LOCAL de Vento; cloud.vento.build
//      probablemente usa otro host/base y puede requerir un token).
//   2. Setear los secrets VENTO_AGENT_URL y VENTO_API_KEY (si aplica) en
//      Supabase Dashboard → Edge Functions → Secrets.
//   3. Deploy: `supabase functions deploy misi-chat`.
//
// Modo:
//   GET  ?probe=1  → ping de vida (sin secrets, sin llamar a Vento)
//   POST normal    → { coupleId, message, personName } → { reply }
//
// Mientras VENTO_AGENT_URL no esté seteada, responde con un mensaje de
// broma/placeholder en vez de fallar — para que el chat en la app nunca se
// vea roto durante el desarrollo.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Content-Type': 'application/json',
};

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

    const VENTO_AGENT_URL = Deno.env.get('VENTO_AGENT_URL') || '';
    const VENTO_API_KEY   = Deno.env.get('VENTO_API_KEY')   || '';

    if (!VENTO_AGENT_URL) {
      // Sin configurar todavía — respuesta de cortesía, no un error 500.
      return new Response(JSON.stringify({
        reply: `¡Hola ${personName || ""}! 👋 Todavía no me conectaron del todo con mi cerebro en Vento — pronto voy a poder responderte de verdad.`,
        stub: true,
      }), { headers: corsHeaders });
    }

    // TODO: ajustar el shape del request/response al contrato REAL del
    // agente en Vento una vez confirmado (puede que la clave del mensaje no
    // se llame "message", que la respuesta no venga en "reply", etc.)
    const ventoRes = await fetch(VENTO_AGENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(VENTO_API_KEY ? { Authorization: `Bearer ${VENTO_API_KEY}` } : {}),
      },
      body: JSON.stringify({ message, coupleId, personName }),
    });

    if (!ventoRes.ok) {
      const text = await ventoRes.text().catch(() => '');
      return new Response(JSON.stringify({ error: `Vento respondió ${ventoRes.status}: ${text.slice(0, 200)}` }), { status: 502, headers: corsHeaders });
    }

    const ventoData = await ventoRes.json().catch(() => null);
    // Vento podría devolver el texto en distintas claves según su contrato real —
    // se prueban las más probables antes de rendirse.
    const reply = ventoData?.reply ?? ventoData?.response ?? ventoData?.message ?? ventoData?.output ?? null;
    if (!reply) {
      return new Response(JSON.stringify({ error: 'Respuesta de Vento sin texto reconocible', raw: ventoData }), { status: 502, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ reply }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
