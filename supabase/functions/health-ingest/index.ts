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

const FN_VERSION = '2026-09-28';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, x-health-key',
  'Content-Type': 'application/json',
};

// ── Rangos de cordura ───────────────────────────────────────────────────────
// Un dato fuera de estos márgenes no es un dato: es un sensor loco, una
// importación mal hecha o dos relojes sumando a la vez. Se descarta y se
// APUNTA en `health_rejects` — un descarte silencioso es indistinguible de un
// parser roto.
const RANGOS: Record<string, [number, number]> = {
  step_count: [0, 100_000],
  active_energy: [0, 15_000],
  basal_energy_burned: [0, 15_000],
  apple_exercise_time: [0, 1_440],
  apple_stand_hour: [0, 24],
  heart_rate: [25, 230],
  resting_heart_rate: [25, 150],
  walking_heart_rate_average: [25, 200],
  heart_rate_variability: [1, 500],
  respiratory_rate: [4, 60],
  blood_oxygen_saturation: [50, 100],
  weight_body_mass: [20, 400],
  body_fat_percentage: [1, 70],
  vo2_max: [10, 90],
  distance_walking_running: [0, 300],
  flights_climbed: [0, 2_000],
  sleep_asleep: [0, 16],
  sleep_in_bed: [0, 20],
  sleep_deep: [0, 8],
  sleep_rem: [0, 8],
  sleep_core: [0, 14],
  sleep_awake: [0, 8],
  mindful_minutes: [0, 600],
};

// Métricas que son un TOTAL del día. Si llegan dos veces en el mismo envío
// (iPhone + Apple Watch contando lo mismo), sumarlas duplicaría los pasos:
// se queda el mayor. El resto son medias/instantáneas y se promedian.
const ACUMULADAS = new Set([
  'step_count', 'active_energy', 'basal_energy_burned', 'apple_exercise_time',
  'distance_walking_running', 'flights_climbed', 'mindful_minutes',
  'sleep_asleep', 'sleep_in_bed', 'sleep_deep', 'sleep_rem', 'sleep_core', 'sleep_awake',
]);

// ── Fechas ──────────────────────────────────────────────────────────────────
// Health Auto Export manda dos formatos según el campo:
//   "2026-09-28 00:00:00 +0200"   (la mayoría)
//   "2026-09-28T00:00:00Z"        (ISO en algunos)
// El DÍA que interesa es el LOCAL del teléfono ("¿anduve 10.000 hoy?" es una
// pregunta de calendario, no de UTC), y en ambos formatos son los 10 primeros
// caracteres. Nada de `new Date(...)` para eso: convertir a UTC y volver es
// justamente como se pierde un día en husos negativos.
function diaLocal(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s.trim());
  return m ? m[1] : null;
}

function instante(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  // "2026-09-28 10:00:00 +0200" → "2026-09-28T10:00:00+02:00"
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s*([+-]\d{2}):?(\d{2})?$/.exec(t);
  if (m) return `${m[1]}T${m[2]}${m[3]}:${m[4] ?? '00'}`;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

type Fila = { day: string; metric: string; value: number; unit: string | null; source: string | null };

// ── Aplanado ────────────────────────────────────────────────────────────────
// Convierte el árbol de Health Auto Export en filas planas. El sueño es el
// caso raro: no trae `qty`, trae tramos (asleep / inBed / deep / rem / core)
// en MINUTOS. Se guardan en horas, que es como se leen.
function aplanar(metrics: any[]): Fila[] {
  const out: Fila[] = [];
  for (const m of metrics ?? []) {
    const nombre = String(m?.name ?? '').trim();
    if (!nombre) continue;
    const unidad = m?.units ? String(m.units) : null;

    for (const d of m?.data ?? []) {
      const source = d?.source ? String(d.source) : null;

      if (nombre === 'sleep_analysis') {
        // El día de una noche es el del DESPERTAR (sleepEnd): dormirse a las
        // 02:00 del martes es la noche del martes, no la del lunes.
        const day = diaLocal(d?.sleepEnd) ?? diaLocal(d?.date) ?? diaLocal(d?.sleepStart);
        if (!day) continue;
        const tramos: Array<[string, unknown]> = [
          ['sleep_asleep', d?.asleep], ['sleep_in_bed', d?.inBed],
          ['sleep_deep', d?.deep], ['sleep_rem', d?.rem],
          ['sleep_core', d?.core], ['sleep_awake', d?.awake],
        ];
        for (const [metric, v] of tramos) {
          const n = num(v);
          if (n === null) continue;    // la fuente no lo publica: no se inventa
          // Health Auto Export manda minutos; > 24 solo puede ser eso.
          out.push({ day, metric, value: n > 24 ? n / 60 : n, unit: 'h', source });
        }
        continue;
      }

      const day = diaLocal(d?.date);
      const value = num(d?.qty);
      if (!day || value === null) continue;
      out.push({ day, metric: nombre, value, unit: unidad, source });
    }
  }
  return out;
}

// ── Limpieza ────────────────────────────────────────────────────────────────
// Dos cosas, y las dos importan:
//  (a) Fusionar lo que llega repetido para el mismo día y métrica. El caso
//      real: el iPhone y el Apple Watch cuentan los mismos pasos. Sumarlos
//      daría el doble → en los totales se coge el MAYOR, en las medidas
//      instantáneas (pulso) se promedia.
//  (b) Tirar lo imposible, dejando constancia de qué y por qué.
function limpiar(filas: Fila[]) {
  const acc = new Map<string, { f: Fila; n: number; suma: number; max: number }>();
  const rechazos: Array<{ day: string; metric: string; value: number; reason: string }> = [];

  for (const f of filas) {
    const r = RANGOS[f.metric];
    if (r && (f.value < r[0] || f.value > r[1])) {
      rechazos.push({ day: f.day, metric: f.metric, value: f.value, reason: `fuera de rango [${r[0]}, ${r[1]}]` });
      continue;
    }
    const k = `${f.day}|${f.metric}`;
    const prev = acc.get(k);
    if (!prev) acc.set(k, { f, n: 1, suma: f.value, max: f.value });
    else {
      prev.n += 1;
      prev.suma += f.value;
      prev.max = Math.max(prev.max, f.value);
      if (!prev.f.source) prev.f.source = f.source;
    }
  }

  const filasLimpias = [...acc.values()].map(({ f, n, suma, max }) => ({
    ...f,
    value: n === 1 ? f.value : (ACUMULADAS.has(f.metric) ? max : suma / n),
  }));
  return { filasLimpias, rechazos };
}

function aplanarEntrenos(workouts: any[]) {
  const out = [];
  for (const w of workouts ?? []) {
    const start_at = instante(w?.start);
    if (!start_at) continue;
    const end_at = instante(w?.end);
    const mins = start_at && end_at
      ? (new Date(end_at).getTime() - new Date(start_at).getTime()) / 60000
      : num(w?.duration);
    const km = num(w?.distance?.qty ?? w?.distance);
    out.push({
      start_at, end_at,
      name: String(w?.name ?? 'Entreno'),
      minutes: mins !== null && mins >= 0 && mins < 1440 ? mins : null,
      kcal: num(w?.activeEnergyBurned?.qty ?? w?.activeEnergy?.qty ?? w?.activeEnergyBurned),
      distance_km: km !== null && km >= 0 && km < 500 ? km : null,
      avg_hr: num(w?.avgHeartRate?.qty ?? w?.averageHeartRate?.qty),
      source: w?.source ? String(w.source) : null,
    });
  }
  // Mismo entreno reenviado = misma clave natural; nos quedamos con el último.
  const porClave = new Map(out.map(w => [`${w.start_at}|${w.name}`, w]));
  return [...porClave.values()];
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = new URL(req.url);

  // Ping de vida: sirve para comprobar el despliegue sin mandar datos.
  if (url.searchParams.get('probe') === '1') {
    return new Response(JSON.stringify({ ok: true, fn: 'health-ingest', version: FN_VERSION }), { headers: cors });
  }

  const token = url.searchParams.get('k') ?? req.headers.get('x-health-key') ?? '';
  if (!token) {
    return new Response(JSON.stringify({ error: 'falta_token', ayuda: 'Añade ?k=TU_TOKEN al final de la URL' }), { status: 401, headers: cors });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: tk } = await db
    .from('health_tokens')
    .select('token, user_id, couple_id, revoked')
    .eq('token', token)
    .maybeSingle();

  if (!tk || tk.revoked) {
    return new Response(JSON.stringify({ error: 'token_invalido' }), { status: 401, headers: cors });
  }

  const crudo = await req.text();
  let payload: any = null;
  try { payload = JSON.parse(crudo); } catch {
    return new Response(JSON.stringify({ error: 'json_invalido' }), { status: 400, headers: cors });
  }

  // 1. El crudo PRIMERO, antes de interpretar nada. Si el parser falla, el
  //    envío sigue aquí y se reprocesa; nunca se pierde por un fallo mío.
  const { data: raw } = await db.from('health_raw').insert({
    user_id: tk.user_id, couple_id: tk.couple_id, bytes: crudo.length, payload,
  }).select('id').maybeSingle();

  try {
    const d = payload?.data ?? payload ?? {};
    const { filasLimpias, rechazos } = limpiar(aplanar(d.metrics ?? []));
    const entrenos = aplanarEntrenos(d.workouts ?? []);

    if (filasLimpias.length) {
      // upsert sobre (couple_id, user_id, day, metric): reenviar el mismo día
      // ACTUALIZA, no duplica. Aquí es donde muere el problema de duplicados.
      const { error } = await db.from('health_daily').upsert(
        filasLimpias.map(f => ({
          couple_id: tk.couple_id, user_id: tk.user_id,
          day: f.day, metric: f.metric, value: f.value,
          unit: f.unit, source: f.source, updated_at: new Date().toISOString(),
        })),
        { onConflict: 'couple_id,user_id,day,metric' },
      );
      if (error) throw new Error('health_daily: ' + error.message);
    }

    if (entrenos.length) {
      const { error } = await db.from('health_workouts').upsert(
        entrenos.map(w => ({ couple_id: tk.couple_id, user_id: tk.user_id, ...w, updated_at: new Date().toISOString() })),
        { onConflict: 'couple_id,user_id,start_at,name' },
      );
      if (error) throw new Error('health_workouts: ' + error.message);
    }

    if (rechazos.length) {
      await db.from('health_rejects').insert(
        rechazos.slice(0, 200).map(r => ({ user_id: tk.user_id, ...r })),
      );
    }

    const resumen = { metricas: filasLimpias.length, entrenos: entrenos.length, descartados: rechazos.length };
    await db.from('health_raw').update({ parsed: resumen }).eq('id', raw?.id ?? -1);
    await db.from('health_tokens').update({ last_seen_at: new Date().toISOString(), last_error: null }).eq('token', token);

    return new Response(JSON.stringify({ ok: true, ...resumen }), { headers: cors });
  } catch (e) {
    // El crudo YA está guardado, así que esto no pierde datos: solo avisa.
    const msg = String((e as Error).message);
    await db.from('health_tokens').update({ last_seen_at: new Date().toISOString(), last_error: msg }).eq('token', token);
    return new Response(JSON.stringify({ ok: false, error: msg, guardado_crudo: true }), { status: 200, headers: cors });
  }
});
