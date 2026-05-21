-- Sprint E: Web Push VAPID — Tabla push_subscriptions
-- Ejecutada manualmente en Supabase Dashboard el 2026-05-21
-- Verificada en producción: columnas + RLS activas

create table if not exists public.push_subscriptions (
  id               bigserial primary key,
  couple_id        uuid not null references public.couples(id) on delete cascade,
  endpoint         text not null unique,
  p256dh           text not null,
  auth             text not null,
  platform         text,
  enabled          boolean not null default true,
  failure_count    integer not null default 0,
  last_success_at  timestamptz,
  last_failure_at  timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists push_subscriptions_couple_id_idx
  on public.push_subscriptions(couple_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subs_own" on public.push_subscriptions
  for all to authenticated
  using (couple_id in (
    select couple_id from public.couple_members where user_id = auth.uid()
  ))
  with check (couple_id in (
    select couple_id from public.couple_members where user_id = auth.uid()
  ));
