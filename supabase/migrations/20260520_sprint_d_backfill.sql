-- ═══════════════════════════════════════════════════════════════════════════════
-- BACKFILL Sprint D — Blob JSON → Tablas normalizadas
-- Ejecutar en Supabase SQL Editor (corre como postgres, bypassa RLS)
-- IDEMPOTENTE: ON CONFLICT DO NOTHING — se puede re-ejecutar sin duplicar datos
-- PREREQUISITO: D-1 a D-5 ejecutados (missions, goals, couple_settings, week_photos)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. MISSIONS ──────────────────────────────────────────────────────────────
-- Lee todas las semanas de cada pareja y expande missions[] en filas individuales

INSERT INTO public.missions (
  id, couple_id, week_key, week_number, year,
  title, emoji, who, status, type,
  categories, duration, date,
  goal_id, series_id, carried_from, carried_from_week,
  completed_at, completed_late, notes
)
SELECT
  (m->>'id')::uuid                                                        AS id,
  ad.id                                                                   AS couple_id,
  wk.key                                                                  AS week_key,
  COALESCE(
    (wk.val->>'weekNumber')::smallint,
    CASE WHEN wk.key ~ '-W\d+$'
         THEN split_part(wk.key, '-W', 2)::smallint ELSE 1 END
  )                                                                       AS week_number,
  COALESCE(
    (wk.val->>'year')::smallint,
    CASE WHEN wk.key ~ '^\d{4}-W'
         THEN split_part(wk.key, '-W', 1)::smallint
         ELSE extract(year from now())::smallint END
  )                                                                       AS year,
  COALESCE(m->>'title', '')                                               AS title,
  m->>'emoji'                                                             AS emoji,
  COALESCE(m->>'who', 'together')                                        AS who,
  COALESCE(m->>'status', 'TODO')                                         AS status,
  m->>'type'                                                              AS type,
  ARRAY(SELECT jsonb_array_elements_text(
    COALESCE(m->'categories', '[]'::jsonb)))                             AS categories,
  CASE WHEN (m->>'duration') ~ '^\d+$'
       THEN (m->>'duration')::integer ELSE NULL END                      AS duration,
  CASE WHEN (m->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
       THEN (m->>'date')::date ELSE NULL END                             AS date,
  CASE WHEN (m->>'goalId') ~ '^[0-9a-f-]{36}$'
       THEN (m->>'goalId')::uuid ELSE NULL END                           AS goal_id,
  CASE WHEN (m->>'seriesId') ~ '^[0-9a-f-]{36}$'
       THEN (m->>'seriesId')::uuid ELSE NULL END                         AS series_id,
  CASE WHEN (m->>'carriedFrom') ~ '^[0-9a-f-]{36}$'
       THEN (m->>'carriedFrom')::uuid ELSE NULL END                      AS carried_from,
  m->>'carriedFromWeek'                                                   AS carried_from_week,
  CASE WHEN (m->>'completedAt') ~ '^\d{4}-\d{2}-\d{2}'
       THEN (m->>'completedAt')::timestamptz ELSE NULL END               AS completed_at,
  COALESCE((m->>'completedLate')::boolean, false)                        AS completed_late,
  m->>'notes'                                                             AS notes
FROM public.app_data ad,
  jsonb_each(ad.data->'weeks') AS wk(key, val),
  jsonb_array_elements(wk.val->'missions') AS m
WHERE (m->>'id') IS NOT NULL
  AND (m->>'id') ~ '^[0-9a-f-]{36}$'
ON CONFLICT (id) DO NOTHING;


-- ─── 2. GOALS ─────────────────────────────────────────────────────────────────
-- Lee data.goals[] de cada pareja

INSERT INTO public.goals (
  id, couple_id, title, emoji, who, period,
  target, goal_type, active, start_date, deadline
)
SELECT
  (g->>'id')::uuid                                                        AS id,
  ad.id                                                                   AS couple_id,
  COALESCE(g->>'title', '')                                               AS title,
  g->>'emoji'                                                             AS emoji,
  COALESCE(g->>'who', 'together')                                        AS who,
  COALESCE(g->>'period', 'monthly')                                      AS period,
  COALESCE((g->>'target')::integer, 1)                                   AS target,
  COALESCE(g->>'goalType', 'min')                                        AS goal_type,
  COALESCE((g->>'active')::boolean, true)                                AS active,
  CASE WHEN (g->>'startDate') ~ '^\d{4}-\d{2}-\d{2}$'
       THEN (g->>'startDate')::date ELSE NULL END                        AS start_date,
  CASE WHEN (g->>'deadline') ~ '^\d{4}-\d{2}-\d{2}$'
       THEN (g->>'deadline')::date ELSE NULL END                         AS deadline
FROM public.app_data ad,
  jsonb_array_elements(COALESCE(ad.data->'goals', '[]'::jsonb)) AS g
WHERE (g->>'id') IS NOT NULL
  AND (g->>'id') ~ '^[0-9a-f-]{36}$'
ON CONFLICT (id) DO NOTHING;


-- ─── 3. COUPLE_SETTINGS ───────────────────────────────────────────────────────
-- Una fila por pareja con nombres, colores, tema y flags de notificaciones

INSERT INTO public.couple_settings (
  couple_id,
  person1_name, person2_name,
  color_person1, color_person2, color_together,
  theme, language,
  notif_chat, notif_partner, notif_events, notif_goals, notif_daily
)
SELECT
  ad.id                                                                   AS couple_id,
  COALESCE(ad.data->>'person1', 'Persona 1')                             AS person1_name,
  COALESCE(ad.data->>'person2', 'Persona 2')                             AS person2_name,
  COALESCE(ad.data->'colors'->>'person1',  '#a78bfa')                   AS color_person1,
  COALESCE(ad.data->'colors'->>'person2',  '#60a5fa')                   AS color_person2,
  COALESCE(ad.data->'colors'->>'together', '#34d399')                   AS color_together,
  COALESCE(ad.data->>'theme', 'galaxy')                                  AS theme,
  COALESCE(ad.data->>'language', ad.data->'settings'->>'language', 'es') AS language,
  COALESCE((ad.data->'settings'->'notifications'->>'chat')::boolean,           true)  AS notif_chat,
  COALESCE((ad.data->'settings'->'notifications'->>'partnerChanges')::boolean, true)  AS notif_partner,
  COALESCE((ad.data->'settings'->'notifications'->>'eventReminders')::boolean, true)  AS notif_events,
  COALESCE((ad.data->'settings'->'notifications'->>'goalDeadlines')::boolean,  true)  AS notif_goals,
  COALESCE((ad.data->'settings'->'notifications'->>'dailyBriefing')::boolean,  false) AS notif_daily
FROM public.app_data ad
ON CONFLICT (couple_id) DO NOTHING;


-- ─── 4. VERIFICACIÓN ──────────────────────────────────────────────────────────
-- Ejecutar después del backfill para confirmar los conteos

SELECT
  cs.couple_id,
  cs.person1_name || ' & ' || cs.person2_name  AS pareja,
  (SELECT count(*) FROM public.missions m WHERE m.couple_id = cs.couple_id) AS missions_db,
  (SELECT count(*) FROM public.goals   g WHERE g.couple_id = cs.couple_id) AS goals_db,
  -- Conteo en blob para comparar
  (SELECT count(*)
   FROM public.app_data ad,
     jsonb_each(ad.data->'weeks') AS wk,
     jsonb_array_elements(wk.val->'missions') AS m2
   WHERE ad.id = cs.couple_id
     AND (m2->>'id') ~ '^[0-9a-f-]{36}$')                               AS missions_blob,
  (SELECT count(*)
   FROM public.app_data ad,
     jsonb_array_elements(COALESCE(ad.data->'goals','[]'::jsonb)) AS g2
   WHERE ad.id = cs.couple_id
     AND (g2->>'id') ~ '^[0-9a-f-]{36}$')                               AS goals_blob
FROM public.couple_settings cs
ORDER BY cs.person1_name;
