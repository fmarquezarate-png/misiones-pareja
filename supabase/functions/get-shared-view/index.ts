// get-shared-view — Supabase Edge Function (Deno)
//
// Sirve una foto de solo lectura del plan de una pareja a un tercero (familiar,
// cuidadora) SIN que necesite iniciar sesión. No usa RLS de anon — el filtrado
// de seguridad ocurre acá, comparando el token contra el guardado en el blob.
//
// Modo:
//   GET ?probe=1  → ping de vida (sin secrets, sin DB)
//   POST normal   → { coupleId, token } → devuelve una versión saneada del blob
//                    (sin comentarios/notas privadas, sin chat/gastos/ánimo)
//                    SOLO si data.settings.shareEnabled && data.settings.shareToken === token
//
// Secrets requeridos (ya existen — mismos que usa send-push):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Content-Type': 'application/json',
};

// Solo lo necesario para "ver el plan" — nunca comentarios (notas privadas
// entre la pareja), nunca chat/gastos/ánimo/plantillas/actividad.
function sanitizeMission(m: Record<string, unknown>) {
  const { comments: _comments, ...rest } = m;
  return rest;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  if (url.searchParams.get('probe') === '1') {
    return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString() }), { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const { coupleId, token } = await req.json();

    if (!coupleId || !token) {
      return new Response(JSON.stringify({ error: 'coupleId y token requeridos' }), { status: 400, headers: corsHeaders });
    }

    const db = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: row, error } = await db
      .from('app_data')
      .select('data')
      .eq('id', coupleId)
      .single();

    if (error || !row?.data) {
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: corsHeaders });
    }

    const blob = row.data as Record<string, unknown>;
    const settings = (blob.settings || {}) as Record<string, unknown>;

    if (!settings.shareEnabled || settings.shareToken !== token) {
      return new Response(JSON.stringify({ error: 'link_invalido_o_revocado' }), { status: 403, headers: corsHeaders });
    }

    const weeksIn = (blob.weeks || {}) as Record<string, { missions?: Record<string, unknown>[] }>;
    const weeksOut: Record<string, unknown> = {};
    for (const [key, w] of Object.entries(weeksIn)) {
      weeksOut[key] = { ...w, missions: (w.missions || []).map(sanitizeMission) };
    }

    return new Response(JSON.stringify({
      settings: {
        person1: settings.person1, person2: settings.person2,
        colors: settings.colors, coupleEmoji: settings.coupleEmoji,
      },
      weeks: weeksOut,
      currentWeekNumber: blob.currentWeekNumber,
      currentYear: blob.currentYear,
    }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
