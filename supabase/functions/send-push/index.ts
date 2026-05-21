// send-push — Supabase Edge Function (Deno)
// Envía Web Push a todas las suscripciones activas de una pareja.
//
// Secrets requeridos en Supabase Dashboard → Settings → Edge Functions:
//   VAPID_PUBLIC_KEY   — clave pública VAPID
//   VAPID_PRIVATE_KEY  — clave privada VAPID
//   VAPID_CONTACT      — mailto: o URL del responsable (ej: mailto:admin@tudominio.com)
//
// Body JSON: { coupleId, title?, body?, tag?, url? }
// Responde: { sent: N, total: N }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_CONTACT     = Deno.env.get('VAPID_CONTACT') ?? 'mailto:admin@misiones-pareja.app';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { coupleId, excludeUserId, title = 'Misiones de Pareja', body = '✨ Tu pareja actualizó algo', tag = 'mp-push', url = '/' } = await req.json();
    if (!coupleId) return new Response('coupleId requerido', { status: 400, headers: corsHeaders });

    const db = createClient(SUPABASE_URL, SUPABASE_KEY);
    let query = db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('couple_id', coupleId)
      .eq('enabled', true);

    // Excluir al usuario que hizo el cambio — no notificarse a uno mismo
    if (excludeUserId) query = query.neq('user_id', excludeUserId);

    const { data: subs, error } = await query;

    if (error) return new Response(error.message, { status: 500, headers: corsHeaders });
    if (!subs?.length) return new Response(JSON.stringify({ sent: 0, total: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const payload = JSON.stringify({ title, body, tag, url });
    let sent = 0;

    await Promise.allSettled(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        await db.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq('id', sub.id);
        sent++;
      } catch (err: any) {
        // 410 Gone = suscripción expirada, deshabilitar permanentemente
        if (err.statusCode === 410) {
          await db.from('push_subscriptions').update({ enabled: false }).eq('id', sub.id);
        } else {
          await db.from('push_subscriptions').update({ last_failure_at: new Date().toISOString() }).eq('id', sub.id);
        }
      }
    }));

    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
});
