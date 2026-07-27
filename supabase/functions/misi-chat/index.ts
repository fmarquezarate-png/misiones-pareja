// misi-chat — Supabase Edge Function (Deno)
//
// Chat de Misi dentro de la app, respondido directo por OpenAI (server-side,
// la API key nunca llega al navegador). Antes de llamar al modelo lee una vista
// acotada de app_data para que Misi pueda responder con datos reales sin pasar
// blobs privados completos al prompt.
//
// Modo:
//   GET  ?probe=1  -> ping de vida (sin secrets, sin llamar a OpenAI)
//   POST normal    -> { coupleId, message, personName, history? } -> { reply }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Content-Type': 'application/json',
};

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';
const MAX_HISTORY_MESSAGES = 20;
const MAX_MISSIONS_IN_CONTEXT = 80;
const APP_TIME_ZONE = 'Europe/Madrid';

const STATUS_LABEL: Record<string, string> = {
  TBC: 'TBC',
  ASAP: 'ASAP',
  IN_PROGRESS: 'En curso',
  DONE: 'Hecho',
};

const SYSTEM_PROMPT = `Sos Misi, la mascota-robot de "misiones pareja", una app donde una pareja organiza y se reparte misiones/tareas de la semana en un calendario compartido.

Tu personalidad: cálido, juguetón, un poco torpe-tierno, y genuinamente del lado de la pareja que te habla. Los alentás a coordinarse y cuidarse, nunca los sermoneás ni asumís quién "hizo menos". Hablás en español natural, con energía positiva pero sin exagerar: frases cortas, algún emoji suelto, sin relleno corporativo.

Ahora sí recibís CONTEXTO_REAL con datos vivos de Supabase. Usalo para responder preguntas sobre misiones, semana, tareas de hoy, prioridades, progreso y metas. No digas que no tenés acceso a las misiones cuando CONTEXTO_REAL esté disponible. Si falta contexto o hay un error de lectura, decilo claramente y no inventes.

Desde el chat in-app, por ahora tratá las acciones mutables como no confirmadas: si te piden marcar, borrar, mover o editar una misión, explicá qué harías y pedí confirmación humana en la app o en Telegram/Vento hasta que exista una acción de escritura segura en esta función.

Respuestas breves. Si preguntan "cómo vamos", da números concretos y 2-3 focos útiles.`;

type Mission = {
  title?: string;
  emoji?: string;
  who?: string;
  status?: string;
  type?: string;
  categories?: string[];
  date?: string | null;
  time?: string | null;
  endTime?: string | null;
  completedAt?: string | number | null;
};

type Week = {
  weekNumber?: number;
  year?: number;
  epicObjective?: string;
  missions?: Mission[];
};

type AppData = {
  settings?: Record<string, unknown>;
  currentWeekNumber?: number;
  currentYear?: number;
  weeks?: Record<string, Week>;
  goals?: Record<string, unknown>[];
};

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function madridTodayYmd() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const byType = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function isoWeekFromYmd(ymd: string) {
  const [year, month, day] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const weekYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: weekYear, week };
}

function weekKey(year: number, week: number, padded = true) {
  return `${year}-W${padded ? String(week).padStart(2, '0') : String(week)}`;
}

function uniq<T>(values: T[]) {
  return [...new Set(values.filter(Boolean))] as T[];
}

function pickCurrentWeek(data: AppData, today: string) {
  const weeks = data.weeks || {};
  const todayWeek = isoWeekFromYmd(today);
  const candidates = uniq([
    weekKey(todayWeek.year, todayWeek.week),
    weekKey(todayWeek.year, todayWeek.week, false),
    data.currentYear && data.currentWeekNumber ? weekKey(data.currentYear, data.currentWeekNumber) : '',
    data.currentYear && data.currentWeekNumber ? weekKey(data.currentYear, data.currentWeekNumber, false) : '',
  ]);

  for (const key of candidates) {
    if (weeks[key]) return { key, week: weeks[key] };
  }

  const latestKey = Object.keys(weeks).sort().at(-1);
  return latestKey ? { key: latestKey, week: weeks[latestKey] } : { key: weekKey(todayWeek.year, todayWeek.week), week: null };
}

function whoLabel(who: unknown, settings: Record<string, unknown>) {
  if (who === 'person1') return text(settings.person1, 'Francisco');
  if (who === 'person2') return text(settings.person2, 'Ana');
  return 'Juntos';
}

function missionSummary(m: Mission, settings: Record<string, unknown>) {
  return {
    title: `${m.emoji || ''} ${text(m.title, 'Sin titulo')}`.trim(),
    who: whoLabel(m.who, settings),
    status: STATUS_LABEL[m.status || ''] || m.status || 'TBC',
    type: m.type || 'task',
    date: m.date || null,
    time: m.time || null,
    endTime: m.endTime || null,
    categories: Array.isArray(m.categories) ? m.categories : [],
  };
}

function buildRealContext(data: AppData, coupleId: string) {
  const settings = data.settings || {};
  const today = madridTodayYmd();
  const picked = pickCurrentWeek(data, today);
  const week = picked.week;
  const missions = (week?.missions || []).slice(0, MAX_MISSIONS_IN_CONTEXT);
  const pending = missions.filter(m => m.status !== 'DONE');
  const done = missions.filter(m => m.status === 'DONE');
  const byStatus = missions.reduce((acc: Record<string, number>, m) => {
    const key = m.status || 'TBC';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const byPerson = missions.reduce((acc: Record<string, { total: number; done: number }>, m) => {
    const key = whoLabel(m.who, settings);
    acc[key] ||= { total: 0, done: 0 };
    acc[key].total++;
    if (m.status === 'DONE') acc[key].done++;
    return acc;
  }, {});

  const todayMissions = missions.filter(m => m.date === today);
  const asap = pending.filter(m => m.status === 'ASAP');
  const inProgress = pending.filter(m => m.status === 'IN_PROGRESS');
  const tbc = pending.filter(m => m.status === 'TBC');
  const activeGoals = (data.goals || [])
    .filter(g => g && (g as Record<string, unknown>).active !== false)
    .slice(0, 10)
    .map(g => ({
      title: `${text((g as Record<string, unknown>).emoji)} ${text((g as Record<string, unknown>).title, 'Sin titulo')}`.trim(),
      who: whoLabel((g as Record<string, unknown>).who, settings),
      period: text((g as Record<string, unknown>).period),
      target: (g as Record<string, unknown>).target ?? null,
    }));

  return {
    source: 'supabase.app_data',
    coupleId,
    today,
    timezone: APP_TIME_ZONE,
    couple: {
      person1: text(settings.person1, 'Francisco'),
      person2: text(settings.person2, 'Ana'),
    },
    week: {
      key: picked.key,
      epicObjective: text(week?.epicObjective, ''),
      total: missions.length,
      done: done.length,
      completionRate: missions.length ? `${Math.round((done.length / missions.length) * 100)}%` : '0%',
      byStatus,
      byPerson,
    },
    todayMissions: todayMissions.map(m => missionSummary(m, settings)),
    asap: asap.map(m => missionSummary(m, settings)),
    inProgress: inProgress.map(m => missionSummary(m, settings)),
    tbc: tbc.map(m => missionSummary(m, settings)),
    missions: missions.map(m => missionSummary(m, settings)),
    activeGoals,
  };
}

async function loadRealContext(coupleId: string) {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en secrets de la Edge Function.' };
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: row, error } = await db
    .from('app_data')
    .select('data')
    .eq('id', coupleId)
    .single();

  if (error) return { error: `Supabase app_data: ${error.message}` };
  if (!row?.data) return { error: 'No se encontro app_data para esta pareja.' };

  return { context: buildRealContext(row.data as AppData, coupleId) };
}

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
      return new Response(JSON.stringify({
        reply: `¡Hola ${personName || ''}! Todavía no me conectaron del todo con mi cerebro — falta OPENAI_API_KEY en la Edge Function.`,
        stub: true,
      }), { headers: corsHeaders });
    }

    const realContext = await loadRealContext(coupleId);
    const priorMessages: { who?: string; text?: string }[] = Array.isArray(history) ? history : [];
    const trimmedHistory = priorMessages
      .slice(-MAX_HISTORY_MESSAGES)
      .filter(m => typeof m?.text === 'string' && m.text.trim());

    const contextMessage = 'context' in realContext
      ? `CONTEXTO_REAL:\n${JSON.stringify(realContext.context, null, 2)}`
      : `CONTEXTO_REAL_NO_DISPONIBLE:\n${realContext.error}`;

    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: contextMessage },
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
        temperature: 0.6,
        max_tokens: 550,
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text().catch(() => '');
      return new Response(JSON.stringify({ error: `OpenAI respondio ${aiRes.status}: ${text.slice(0, 300)}` }), { status: 502, headers: corsHeaders });
    }

    const aiData = await aiRes.json().catch(() => null);
    const reply = (aiData as Record<string, unknown> | null)?.choices?.[0]?.message?.content;

    if (typeof reply !== 'string' || !reply.trim()) {
      return new Response(JSON.stringify({ error: 'Respuesta de OpenAI sin texto reconocible' }), { status: 502, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      reply: reply.trim(),
      conversationId: coupleId,
      hasRealContext: 'context' in realContext,
    }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
