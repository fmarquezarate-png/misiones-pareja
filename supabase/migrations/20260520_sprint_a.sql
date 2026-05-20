-- Sprint A: Tabla de telemetría real
-- Aplicar desde el Supabase SQL Editor o via Supabase CLI:
--   supabase db push
-- IMPORTANTE: Ejecutar ANTES de desplegar la v3.5.0

create table if not exists public.events (
  id          bigserial primary key,
  couple_id   uuid references public.couples(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  name        text not null,
  props       jsonb not null default '{}',
  user_agent  text,
  ts          timestamptz not null default now()
);

create index if not exists events_couple_id_idx on public.events (couple_id, ts desc);
create index if not exists events_name_idx on public.events (name);

alter table public.events enable row level security;

-- Solo el miembro de la pareja puede insertar/leer sus propios eventos
create policy if not exists "events_insert_own" on public.events
  for insert to authenticated
  with check (user_id = auth.uid());

create policy if not exists "events_select_own" on public.events
  for select to authenticated
  using (couple_id in (select couple_id from public.couple_members where user_id = auth.uid()));
