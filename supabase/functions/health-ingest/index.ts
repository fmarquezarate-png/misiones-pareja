// health-ingest — recibe los datos de Salud desde Health Auto Export (iPhone).
//
// CÓMO LLEGA
//   POST https://<proyecto>.supabase.co/functions/v1/health-ingest?k=<token>
//   Cuerpo: { "data": { "metrics": [...], "workouts": [...] } }
//
// El token de la URL identifica a la PERSONA. Health Auto Export no sabe
// autenticarse contra Supabase (no hay login, no hay JWT que renovar), así que
// la puerta es un secreto largo y revocable guardado en `health_tokens`.
// Por eso esta función se despliega con --no-verify-jwt: su autenticación es
// propia, no la de Supabase.
//
// LO QUE HACE, EN ORDEN — y el orden importa:
//   1. Guarda el envío CRUDO. Pase lo que pase después, el dato no se pierde:
//      si el parser resulta estar mal, se reprocesa desde aquí.
//   2. Aplana métricas y entrenos a filas.
//   3. LIMPIA (ver `limpiar`): fusiona duplicados del mismo día y descarta
//      imposibles, apuntando cada descarte.
//   4. Sube con upsert sobre la clave natural → reenviar es idempotente.
//
// Responde un resumen en JSON, que es lo que Health Auto Export enseña en su
// pantalla de automatizaciones: sirve como confirmación de que llegó.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
// Interpretación y limpieza: módulo puro compartido con los tests de la app.
import { aplanarConAvisos, limpiar, aplanarEntrenos, sanearPayload, sinRecientes, ventanaPico } from './parse.js';

const FN_VERSION = '2026-09-29a';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, x-health-key',
  'Content-Type': 'application/json',
};

// ── Presupuesto de almacenamiento ───────────────────────────────────────────
// Medido con el primer envío real (28/09/2026): ~16 filas por persona y día.
//   · health_daily   ~1,8 MB al AÑO → no se limpia NUNCA. Es el historial del
//     que se recalcula la mascota: borrarlo la haría retroceder.
//   · health_raw     ~20 KB por envío × 48 envíos/día ≈ 0,9 MB/día. SIN
//     limpieza son ~340 MB al año, y el plan gratuito de Supabase tiene 500.
//     Esta es la tabla que puede tumbar la base de datos.
//
// La limpieza la hace ESTA función, en cada envío, y no solo un pg_cron: si
// la extensión no está activada, el cron simplemente no existe y nadie se
// entera hasta que la base de datos se llena. Aquí no depende de nada.
// Medido el 28/09: 1,3 MB (21 meses) se procesó bien; 4,1 MB (5 años,
// ~30.000 filas) se guardó en crudo y la función murió antes de terminar —
// casi seguro el límite de CPU de las Edge Functions. Morir en silencio es lo
// peor: Health Auto Export no se entera y parece que funcionó. Por encima de
// 2,5 MB se rechaza EN EL MOMENTO, con un mensaje que dice cómo trocearlo.
const MAX_BYTES = 2_500_000;
// Subir en tandas: una sola sentencia con miles de filas puede pasarse del
// statement_timeout (el incidente de los 4 MB de app_data, v5.14.0).
const TANDA = 500;
// UNA sola retención (antes había tres cifras distintas repartidas): el crudo
// solo sirve para reprocesar un fallo reciente.
const RETENCION = { rawDias: 7, rejectsDias: 60 };
// Cuota por persona: la automatización manda ~2-4 envíos/hora (dos
// automatizaciones, cada hora). 60/hora deja un margen enorme y corta a quien
// intente llenar la base de datos: cada envío crudo puede pesar 2,5 MB.
const CUOTA_ENVIOS_HORA = 60;
// Las importaciones desde la app NO tocan los últimos días: los sigue
// escribiendo la automatización y un archivo antiguo (exportado a las 09:00)
// pisaba con valores menores los pasos de un día que aún estaba en curso.
const DIAS_PROTEGIDOS = 2;

async function autolimpieza(db: any) {
  const hace = (dias: number) => new Date(Date.now() - dias * 864e5).toISOString();
  // Borrar por fecha es barato: hay índice por received_at / at.
  await db.from('health_raw').delete().lt('received_at', hace(RETENCION.rawDias));
  await db.from('health_rejects').delete().lt('at', hace(RETENCION.rejectsDias));
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = new URL(req.url);

  // Ping de vida: sirve para comprobar el despliegue sin mandar datos.
  if (url.searchParams.get('probe') === '1') {
    return new Response(JSON.stringify({ ok: true, fn: 'health-ingest', version: FN_VERSION }), { headers: cors });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // ── ¿Quién manda esto? Dos puertas, un mismo destino ──────────────────────
  //  · Health Auto Export (automático, cada hora): token en la URL (?k=…).
  //  · La app (importar un archivo): la SESIÓN de quien está conectado. Así
  //    el historial completo va del teléfono a Supabase sin pasar por ningún
  //    sitio intermedio — el 28/09 acabó en el repositorio público porque no
  //    había otra forma de hacerlo llegar.
  // En los dos casos los datos se guardan a nombre de ESA persona: nadie
  // puede subir datos en nombre de su pareja.
  const token = url.searchParams.get('k') ?? req.headers.get('x-health-key') ?? '';
  let tk: { user_id: string; couple_id: string } | null = null;

  if (token) {
    const { data } = await db.from('health_tokens')
      .select('token, user_id, couple_id, revoked').eq('token', token).maybeSingle();
    if (!data || data.revoked) {
      return new Response(JSON.stringify({ error: 'token_invalido' }), { status: 401, headers: cors });
    }
    tk = data;
  } else {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    // La clave anónima también es un JWT válido, pero no es un usuario:
    // getUser la rechaza, así que no sirve para colarse.
    const { data: u } = jwt ? await db.auth.getUser(jwt) : { data: null };
    const userId = u?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'falta_token', ayuda: 'Añade ?k=TU_TOKEN al final de la URL' }), { status: 401, headers: cors });
    }
    const { data: cm } = await db.from('couple_members')
      .select('couple_id').eq('user_id', userId).maybeSingle();
    if (!cm?.couple_id) {
      return new Response(JSON.stringify({ error: 'sin_pareja' }), { status: 403, headers: cors });
    }
    tk = { user_id: userId, couple_id: cm.couple_id };
  }

  // El tamaño declarado se comprueba ANTES de leer el cuerpo: leerlo entero
  // para después rechazarlo ya había gastado la memoria y la CPU.
  const declarado = Number(req.headers.get('content-length') || 0);
  const demasiado = () => new Response(JSON.stringify({
    error: 'envio_demasiado_grande',
    ayuda: 'Demasiado grande para una sola vez. Exporta de año en año (por ejemplo, 2024 entero, luego 2025) y vuelve a enviar.',
  }), { status: 413, headers: cors });
  if (declarado > MAX_BYTES) return demasiado();

  // Cuota por persona (solo importa donde se guarda el crudo: la ruta del token).
  if (token) {
    const desde = new Date(Date.now() - 3600e3).toISOString();
    const { count } = await db.from('health_raw').select('id', { count: 'exact', head: true })
      .eq('user_id', tk.user_id).gte('received_at', desde);
    if ((count ?? 0) >= CUOTA_ENVIOS_HORA) {
      return new Response(JSON.stringify({ error: 'demasiadas_peticiones', ayuda: 'Demasiados envíos en la última hora.' }), { status: 429, headers: cors });
    }
  }

  const crudo = await req.text();
  // Tope de tamaño: un envío de 99 días pesa ~250 KB. 8 MB solo puede ser un
  // rango enorme por error (años enteros) — mejor pedir que se trocee que
  // meter de golpe un bloque que infle la base de datos.
  if (crudo.length > MAX_BYTES) return demasiado();
  let payload: any = null;
  try { payload = JSON.parse(crudo); } catch {
    return new Response(JSON.stringify({ error: 'json_invalido' }), { status: 400, headers: cors });
  }

  // 1. El crudo PRIMERO (ruta automática), pero SANEADO: sin actividad sexual,
  //    ciclo, rutas GPS ni pulso segundo a segundo. Antes se guardaba íntegro y
  //    se filtraba después: durante 7 días esos datos vivían en la base de datos.
  //    Las importaciones desde la app no guardan crudo: el archivo lo tiene la
  //    persona y así no se puede llenar la tabla desde una sesión.
  let rawId: number | null = null;
  let crudoGuardado = false;
  if (token) {
    const { data: raw, error: errRaw } = await db.from('health_raw').insert({
      user_id: tk.user_id, couple_id: tk.couple_id, bytes: crudo.length, payload: sanearPayload(payload),
    }).select('id').maybeSingle();
    if (errRaw) console.error('health_raw:', errRaw.message);   // no se afirma "guardado" si no lo está
    else { rawId = raw?.id ?? null; crudoGuardado = rawId !== null; }
  }

  try {
    const d = payload?.data ?? payload ?? {};
    const hoy = new Date().toISOString().slice(0, 10);
    const { filas: planas, avisos } = aplanarConAvisos(d.metrics ?? [], { hoy });
    let { filasLimpias, rechazos } = limpiar(planas);
    let entrenos = aplanarEntrenos(d.workouts ?? []);
    if (!token) {
      // Importación desde la app: los días recientes son de la automatización.
      const corte = new Date(Date.now() - DIAS_PROTEGIDOS * 864e5).toISOString().slice(0, 10);
      const antes = filasLimpias.length;
      filasLimpias = sinRecientes(filasLimpias, corte);
      entrenos = entrenos.filter(w => w.start_at.slice(0, 10) < corte);
      if (antes - filasLimpias.length) avisos.dias_recientes_protegidos = antes - filasLimpias.length;
    }

    if (filasLimpias.length) {
      // upsert sobre (couple_id, user_id, day, metric): reenviar el mismo día
      // ACTUALIZA, no duplica. Aquí es donde muere el problema de duplicados.
      const ahora = new Date().toISOString();
      const filas = filasLimpias.map(f => ({
        couple_id: tk.couple_id, user_id: tk.user_id,
        day: f.day, metric: f.metric, value: f.value,
        unit: f.unit, source: f.source, updated_at: ahora,
      }));
      // Franja del pico de pulso (solo envíos automáticos: una importación no
      // sabe a qué hora pasó nada). Se lee el máximo guardado ANTES del upsert.
      if (token) {
        for (const f of filasLimpias.filter(x => x.metric === 'heart_rate_max')) {
          const { data: previo } = await db.from('health_daily').select('value, updated_at')
            .eq('user_id', tk.user_id).eq('day', f.day).eq('metric', 'heart_rate_max').maybeSingle();
          const v = ventanaPico(previo, f.value, Date.now() / 1000);
          if (!v) continue;
          const base = { couple_id: tk.couple_id, user_id: tk.user_id, day: f.day, unit: 's', source: 'health-ingest', updated_at: ahora };
          filas.push({ ...base, metric: 'hr_pico_hasta', value: v.hasta });
          if (v.desde !== null) filas.push({ ...base, metric: 'hr_pico_desde', value: v.desde });
        }
      }
      for (let i = 0; i < filas.length; i += TANDA) {
        const { error } = await db.from('health_daily').upsert(
          filas.slice(i, i + TANDA),
          { onConflict: 'couple_id,user_id,day,metric' },
        );
        if (error) throw new Error(`health_daily (tanda ${i / TANDA + 1}): ${error.message}`);
      }
    }

    if (entrenos.length) {
      const ahora = new Date().toISOString();
      const filas = entrenos.map(w => ({ couple_id: tk.couple_id, user_id: tk.user_id, ...w, updated_at: ahora }));
      for (let i = 0; i < filas.length; i += TANDA) {
        const { error } = await db.from('health_workouts').upsert(
          filas.slice(i, i + TANDA),
          { onConflict: 'couple_id,user_id,start_at,name' },
        );
        if (error) throw new Error(`health_workouts (tanda ${i / TANDA + 1}): ${error.message}`);
      }
    }

    if (rechazos.length) {
      await db.from('health_rejects').insert(
        rechazos.slice(0, 200).map(r => ({ user_id: tk.user_id, ...r })),
      );
    }

    const resumen = { metricas: filasLimpias.length, entrenos: entrenos.length, descartados: rechazos.length, ignorados: avisos };
    if (rawId !== null) await db.from('health_raw').update({ parsed: resumen }).eq('id', rawId);
    if (token) await db.from('health_tokens').update({ last_seen_at: new Date().toISOString(), last_error: null }).eq('token', token);

    return new Response(JSON.stringify({ ok: true, ...resumen }), { headers: cors });
  } catch (e) {
    const msg = String((e as Error).message);
    console.error('health-ingest:', msg);
    if (token) await db.from('health_tokens').update({ last_seen_at: new Date().toISOString(), last_error: msg }).eq('token', token);
    // 500 de verdad (antes 200 con ok:false): Health Auto Export lo cuenta como
    // fallo y reintenta. `guardado_crudo` solo se afirma si realmente se guardó.
    return new Response(JSON.stringify({ ok: false, error: 'error_guardando', detalle: msg, guardado_crudo: crudoGuardado }), { status: 500, headers: cors });
  } finally {
    // La limpieza va SIEMPRE, también tras un fallo: si no, un envío que
    // falla repetidamente dejaba crecer la tabla.
    try { await autolimpieza(db); } catch (e) { console.error('autolimpieza:', (e as Error).message); }
  }
});
