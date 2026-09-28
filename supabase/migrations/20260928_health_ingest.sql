-- ═══════════════════════════════════════════════════════════════════════════
-- SALUD — ingesta desde Health Auto Export (iPhone)  ·  28/09/2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POR QUÉ ASÍ
--
-- 1. NADA de esto va al blob `app_data.data`. Son series temporales que crecen
--    todos los días; meterlas en el blob repetiría el incidente de los 4MB
--    (v5.14.0): cada guardado reescribiría un año de pasos. Tablas propias.
--
-- 2. La limpieza es DECLARATIVA. Health Auto Export reenvía ventanas que se
--    solapan constantemente (el día de hoy cambia cada hora, y al reinstalar
--    manda meses atrás). En vez de "detectar duplicados", la clave primaria
--    natural (persona + día + métrica) hace que reenviar sea IDEMPOTENTE:
--    el mismo dato dos veces es un UPDATE, no una fila nueva.
--
-- 3. `health_raw` guarda el envío tal cual ANTES de interpretarlo. Si mañana
--    descubro que el parser se equivocó en un campo, los datos siguen ahí y
--    se reprocesan. Nunca se pierde un envío por un fallo de interpretación.
--
-- Escribe solo la Edge Function `health-ingest` (con service role). La app
-- únicamente LEE, y solo lo de su propia pareja.

-- ── Quién soy (helper para las políticas) ───────────────────────────────────
create or replace function public.my_couple_id()
returns text language sql stable security definer set search_path = public as $$
  select couple_id from public.couple_members where user_id = auth.uid() limit 1;
$$;

-- ── Tokens: un secreto por persona, revocable ───────────────────────────────
-- Health Auto Export no sabe autenticarse contra Supabase, así que la URL
-- lleva un token. Va en una tabla (y no derivado de un secreto) para poder
-- revocar el de una persona sin tocar el de la otra ni redesplegar nada.
create table if not exists public.health_tokens (
  token        text primary key,
  couple_id    text not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text,
  revoked      boolean not null default false,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  last_error   text
);

-- ── Zona de aterrizaje: el envío crudo ──────────────────────────────────────
create table if not exists public.health_raw (
  id          bigserial primary key,
  user_id     uuid,
  couple_id   text,
  received_at timestamptz not null default now(),
  bytes       integer,
  payload     jsonb not null,
  parsed      jsonb          -- {metrics, workouts, rejected} del parser
);
create index if not exists health_raw_recent on public.health_raw (received_at desc);

-- ── Lo limpio: una fila por persona/día/métrica ─────────────────────────────
-- La PK es la que hace el trabajo: reenviar el mismo día no duplica nada.
create table if not exists public.health_daily (
  couple_id  text not null,
  user_id    uuid not null,
  day        date not null,
  metric     text not null,
  value      double precision not null,
  unit       text,
  source     text,
  updated_at timestamptz not null default now(),
  primary key (couple_id, user_id, day, metric)
);
create index if not exists health_daily_lookup on public.health_daily (couple_id, user_id, day desc);

-- ── Entrenos ────────────────────────────────────────────────────────────────
-- Clave natural = persona + instante de inicio. Reenviar el mismo entreno
-- actualiza; dos entrenos distintos el mismo día conviven sin problema.
create table if not exists public.health_workouts (
  couple_id   text not null,
  user_id     uuid not null,
  start_at    timestamptz not null,
  end_at      timestamptz,
  name        text not null,
  minutes     double precision,
  kcal        double precision,
  distance_km double precision,
  avg_hr      double precision,
  source      text,
  updated_at  timestamptz not null default now(),
  primary key (couple_id, user_id, start_at, name)
);
create index if not exists health_workouts_lookup on public.health_workouts (couple_id, user_id, start_at desc);

-- ── Lo que se descartó y por qué ────────────────────────────────────────────
-- Un dato imposible (300.000 pasos, pulso de 400) se tira, PERO se apunta.
-- Un descarte silencioso es indistinguible de un parser roto.
create table if not exists public.health_rejects (
  id      bigserial primary key,
  user_id uuid,
  day     date,
  metric  text,
  value   double precision,
  reason  text,
  at      timestamptz not null default now()
);
create index if not exists health_rejects_recent on public.health_rejects (at desc);

-- ── RLS: la app solo LEE, y solo lo de su pareja ────────────────────────────
alter table public.health_tokens   enable row level security;
alter table public.health_raw      enable row level security;
alter table public.health_daily    enable row level security;
alter table public.health_workouts enable row level security;
alter table public.health_rejects  enable row level security;

drop policy if exists health_daily_read on public.health_daily;
create policy health_daily_read on public.health_daily
  for select using (couple_id = public.my_couple_id());

drop policy if exists health_workouts_read on public.health_workouts;
create policy health_workouts_read on public.health_workouts
  for select using (couple_id = public.my_couple_id());

-- `health_tokens` y `health_raw` NO tienen política de lectura a propósito:
-- contienen el secreto y el volcado íntegro de Salud. Solo el service role
-- (la Edge Function) los toca. La app no los necesita jamás.

-- ── Retención ───────────────────────────────────────────────────────────────
-- El crudo solo sirve para reprocesar un fallo reciente: 14 días sobran y
-- evitan que la tabla engorde sin control.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin perform cron.unschedule('health_raw_retention'); exception when others then null; end;
    perform cron.schedule(
      'health_raw_retention', '30 4 * * *',
      $job$delete from public.health_raw where received_at < now() - interval '14 days';$job$
    );
    begin perform cron.unschedule('health_rejects_retention'); exception when others then null; end;
    perform cron.schedule(
      'health_rejects_retention', '40 4 * * *',
      $job$delete from public.health_rejects where at < now() - interval '60 days';$job$
    );
  end if;
end $$;
