# Tareas SQL para el Agente Supabase
## Misiones de Pareja — Roadmap v3.5.0 → v4.0.0

> **Para el agente:** Este documento contiene todas las migraciones SQL que debes ejecutar en el proyecto Supabase de Misiones de Pareja, organizadas por sprint. Ejecuta **una sección a la vez**, en el orden indicado. Cada sección incluye el contexto de por qué se hace, para que puedas tomar decisiones si algo falla.
>
> **Regla de oro:** Todas las migraciones son **additive-only** (solo añaden, nunca borran). Nunca ejecutes un DROP TABLE salvo que la sección lo indique explícitamente y diga "SEGURO BORRAR".

---

## ✅ SPRINT A — YA EJECUTADO (no repetir)

### Tabla `events` (telemetría real)
**Estado:** Ejecutado el 20 de mayo de 2026. No volver a ejecutar.

**Por qué existe:** La app usaba `new Notification()` con `setTimeout` en memoria — si el usuario cerraba la pestaña, los recordatorios morían. La tabla `events` permite registrar lo que hace cada pareja (qué vistas visita, qué errores encuentra, cuántas misiones completa) para tomar decisiones basadas en datos reales en lugar de suposiciones.

---

## 🔜 SPRINT C — EJECUTAR ANTES DEL 27 DE MAYO

> **Contexto:** Este es el "punto de no retorno" del roadmap. Antes de normalizar el schema en el Sprint D, necesitamos estas tres cosas: (1) un backup verificado, (2) la columna `version` en `app_data` para evitar race conditions, y (3) la tabla `push_subscriptions` para el Sprint E. Son cambios seguros — solo añaden columnas y tablas nuevas, sin tocar los datos existentes.

### C-1 · Backup de seguridad (acción manual, no SQL)

**Por qué:** La tabla `app_data` contiene el blob JSON con todas las misiones, gastos, metas y configuración de cada pareja. Antes de tocar el schema, el owner debe exportar una copia.

**Instrucción para el owner (no para el agente SQL):**
1. Ir a Supabase → Table Editor → `app_data`
2. Exportar como CSV o JSON
3. Guardar en al menos 2 sitios (disco local + Drive/Dropbox)
4. Confirmar al equipo que el backup está hecho antes de ejecutar C-2

---

### C-2 · Columna `version` en `app_data` con trigger CAS

**Por qué:** Hoy la app guarda el blob completo en cada cambio. Si dos personas editan a la vez, el último `upsert` gana y el otro pierde sus cambios silenciosamente. La columna `version` implementa **compare-and-swap (CAS)**: el cliente lee la versión actual, guarda su cambio solo si la versión no cambió mientras tanto, y en caso de conflicto hace merge en lugar de sobrescribir.

**Cuándo ejecutar:** Después de confirmar que el backup de C-1 está hecho.

```sql
-- C-2: Columna version + trigger CAS en app_data
-- Prerequisito: backup de app_data confirmado por el owner

alter table public.app_data
  add column if not exists version bigint not null default 0;

-- Trigger: incrementa version en cada UPDATE automáticamente
create or replace function public.bump_app_data_version()
returns trigger language plpgsql as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists trg_app_data_version on public.app_data;
create trigger trg_app_data_version
  before update on public.app_data
  for each row execute function public.bump_app_data_version();

-- RPC para save con CAS: solo actualiza si la versión coincide
-- Devuelve la fila actualizada (con nueva version) o null si hubo conflicto
create or replace function public.save_app_data_cas(
  p_couple_id uuid,
  p_data      jsonb,
  p_version   bigint
)
returns public.app_data
language plpgsql security definer as $$
declare
  v_row public.app_data;
begin
  update public.app_data
  set data = p_data, updated_at = now()
  where id = p_couple_id
    and version = p_version
  returning * into v_row;

  return v_row; -- NULL si version no coincidió (conflicto)
end;
$$;
```

**Verificación tras ejecutar:**
```sql
-- Debe mostrar la columna version en app_data
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'app_data' and column_name = 'version';

-- Debe mostrar el trigger
select trigger_name from information_schema.triggers
where event_object_table = 'app_data';
```

---

### C-3 · Tabla `push_subscriptions`

**Por qué:** El Sprint E implementará notificaciones push reales (Web Push API con VAPID). Cuando un usuario da permiso en el navegador, el browser entrega un `endpoint` + claves `p256dh`/`auth` que deben guardarse en Supabase para que el servidor pueda enviarle pushes después. Esta tabla los almacena con RLS estricta — solo el propio usuario puede ver/editar sus suscripciones.

**Cuándo ejecutar:** Puede ejecutarse junto con C-2 o en cualquier momento antes del Sprint E.

```sql
-- C-3: Tabla push_subscriptions para notificaciones Web Push
create table if not exists public.push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  couple_id        uuid not null references public.couples(id) on delete cascade,
  endpoint         text not null,
  p256dh           text not null,
  auth             text not null,
  platform         text,                       -- 'ios' | 'android' | 'web'
  enabled          boolean not null default true,
  failure_count    smallint not null default 0,
  last_success_at  timestamptz,
  last_failure_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists push_subs_couple_active
  on public.push_subscriptions (couple_id)
  where enabled = true;

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own" on public.push_subscriptions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and couple_id in (
      select couple_id from public.couple_members where user_id = auth.uid()
    )
  );

drop policy if exists "push_update_own" on public.push_subscriptions;
create policy "push_update_own" on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own" on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());

-- Trigger updated_at automático
create or replace function public.bump_push_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_push_updated_at on public.push_subscriptions;
create trigger trg_push_updated_at
  before update on public.push_subscriptions
  for each row execute function public.bump_push_updated_at();
```

**Verificación tras ejecutar:**
```sql
select table_name from information_schema.tables
where table_name = 'push_subscriptions';
-- Debe devolver 1 fila
```

---

## 🔮 SPRINT D — EJECUTAR DESPUÉS DEL 10 DE JUNIO

> **Contexto:** Este es el mayor cambio de schema del roadmap. Hoy toda la información de la pareja (misiones, metas, gastos, fotos, configuración) vive en un único blob JSON en `app_data.data`. Esto hace que cada cambio envíe ~200KB al servidor y que dos personas editando a la vez puedan pisarse. Las siguientes tablas normalizan el schema: cada entidad tiene su propia tabla, su propio RLS y sus propios índices.
>
> **Estrategia de migración:** Se usa **dual-write transitorio** — la app escribe en el blob Y en las tablas nuevas durante 2-3 semanas. Cuando la consistencia supera el 99.9%, se cambia la lectura a las tablas nuevas. Nunca se borra el blob hasta 30 días después.
>
> **IMPORTANTE:** No ejecutar este bloque hasta que el equipo de desarrollo confirme que el feature flag `dual_write_normalized` está listo en el código.

### D-1 · Función helper de seguridad RLS

```sql
-- D-1: Helper is_couple_member — centraliza la verificación RLS
-- Todas las tablas normalizadas usarán esta función en sus policies
create or replace function public.is_couple_member(p_couple_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = p_couple_id
      and user_id = auth.uid()
  );
$$;
```

---

### D-2 · Tabla `missions` (misiones normalizadas)

**Por qué:** Hoy las misiones viven dentro del blob `data.weeks[key].missions[]`. Eso significa que guardar una sola misión requiere enviar todas las misiones de todas las semanas. Con esta tabla, cada misión es una fila independiente — se puede actualizar una sola misión con un `UPDATE` de 1 KB en lugar de un `UPSERT` de 200 KB.

```sql
-- D-2: Tabla missions normalizada
create table if not exists public.missions (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  week_key      text not null,      -- formato '2026-W20'
  week_number   smallint not null,
  year          smallint not null,
  title         text not null,
  emoji         text,
  who           text not null,      -- 'person1' | 'person2' | 'together'
  status        text not null default 'TODO',  -- 'TODO' | 'IN_PROGRESS' | 'DONE'
  type          text,               -- 'task' | 'event'
  categories    text[],
  duration      integer,            -- minutos
  date          date,               -- para eventos con fecha
  goal_id       uuid,               -- referencia a goals(id), nullable
  series_id     uuid,               -- para misiones recurrentes
  carried_from  uuid,               -- id de la misión original si fue arrastrada
  carried_from_week text,
  completed_at  timestamptz,
  completed_late boolean default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists missions_couple_week on public.missions (couple_id, week_key);
create index if not exists missions_couple_status on public.missions (couple_id, status);
create index if not exists missions_series on public.missions (series_id) where series_id is not null;

alter table public.missions enable row level security;

drop policy if exists "missions_all_own" on public.missions;
create policy "missions_all_own" on public.missions
  for all to authenticated
  using (is_couple_member(couple_id))
  with check (is_couple_member(couple_id));

create or replace function public.bump_missions_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_missions_updated_at on public.missions;
create trigger trg_missions_updated_at
  before update on public.missions
  for each row execute function public.bump_missions_updated_at();
```

---

### D-3 · Tabla `goals` (metas normalizadas)

**Por qué:** Igual que con missions — hoy las metas viven en `data.goals[]` dentro del blob. Normalizarlas permite consultas eficientes ("¿cuántas metas activas tiene esta pareja?") y actualizaciones individuales sin reenviar todo el blob.

```sql
-- D-3: Tabla goals normalizada
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  title       text not null,
  emoji       text,
  who         text not null,    -- 'person1' | 'person2' | 'together'
  period      text not null,    -- 'weekly' | 'monthly' | 'annual'
  target      integer not null default 1,
  goal_type   text not null default 'min',  -- 'min' | 'max'
  active      boolean not null default true,
  start_date  date,
  deadline    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists goals_couple_active on public.goals (couple_id) where active = true;

alter table public.goals enable row level security;

drop policy if exists "goals_all_own" on public.goals;
create policy "goals_all_own" on public.goals
  for all to authenticated
  using (is_couple_member(couple_id))
  with check (is_couple_member(couple_id));

create or replace function public.bump_goals_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_goals_updated_at on public.goals;
create trigger trg_goals_updated_at
  before update on public.goals
  for each row execute function public.bump_goals_updated_at();
```

---

### D-4 · Tabla `couple_settings` (configuración normalizada)

**Por qué:** Hoy la configuración (nombres, colores, idioma, notificaciones, tema) vive dentro del blob. Tenerla en su propia tabla permite leerla sin descargar todo el blob, y actualizarla sin riesgo de pisar otras partes del estado.

```sql
-- D-4: Tabla couple_settings normalizada
create table if not exists public.couple_settings (
  couple_id       uuid primary key references public.couples(id) on delete cascade,
  person1_name    text not null default 'Persona 1',
  person2_name    text not null default 'Persona 2',
  color_person1   text not null default '#a78bfa',
  color_person2   text not null default '#60a5fa',
  color_together  text not null default '#34d399',
  theme           text not null default 'galaxy',
  language        text not null default 'es',
  notif_chat      boolean not null default true,
  notif_partner   boolean not null default true,
  notif_events    boolean not null default true,
  notif_goals     boolean not null default true,
  notif_daily     boolean not null default false,
  updated_at      timestamptz not null default now()
);

alter table public.couple_settings enable row level security;

drop policy if exists "settings_all_own" on public.couple_settings;
create policy "settings_all_own" on public.couple_settings
  for all to authenticated
  using (is_couple_member(couple_id))
  with check (is_couple_member(couple_id));

create or replace function public.bump_settings_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_settings_updated_at on public.couple_settings;
create trigger trg_settings_updated_at
  before update on public.couple_settings
  for each row execute function public.bump_settings_updated_at();
```

---

### D-5 · Tabla `week_photos` (fotos de semana)

**Por qué:** Las fotos semanales se guardan hoy como base64 dentro del blob — un blob de 10 MB por semana cuando hay fotos. Con esta tabla + Storage bucket, las fotos van a Supabase Storage y en el blob solo queda la URL.

```sql
-- D-5: Tabla week_photos
create table if not exists public.week_photos (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  week_key    text not null,
  storage_path text not null,   -- ruta en Supabase Storage bucket 'couple-assets'
  created_at  timestamptz not null default now(),
  unique (couple_id, week_key)
);

alter table public.week_photos enable row level security;

drop policy if exists "photos_all_own" on public.week_photos;
create policy "photos_all_own" on public.week_photos
  for all to authenticated
  using (is_couple_member(couple_id))
  with check (is_couple_member(couple_id));
```

**Acción adicional (interfaz Supabase, no SQL):**
Crear bucket `couple-assets` en Storage → Buckets → New bucket:
- Name: `couple-assets`
- Public: NO (privado)
- File size limit: 5 MB

---

### D-6 · Tabla `expenses` (gastos — APLAZADO A v4.1)

> **Estado:** Aplazado. La telemetría de Sprint A confirmó que la pareja no registra gastos habitualmente. Esta tabla se creará cuando el Sprint G de Gastos v2 sea aprobado.

```sql
-- D-6: APLAZADO — no ejecutar hasta aprobación del Sprint G de Gastos v2
-- Se incluye aquí solo como referencia del diseño

-- create table if not exists public.expenses ( ... );
-- Ver WORKSHOP_v4_INFORME_EJECUTIVO.md sección Tema 3 para el schema completo
```

---

## 🔜 SPRINT E-0 — CONSOLIDACIÓN SPRINT D (ejecutar ahora)

> **Contexto:** Tres tareas de deuda técnica detectadas tras verificar el backfill del Sprint D. Son correcciones de schema — no tocan datos, solo añaden constraints y resuelven FKs que quedaron NULL durante el backfill por el incompatibilidad nanoid/uuid.
>
> **Prerequisito:** El backfill Sprint D debe estar verificado al 100% (FRANANA 220/220, CRI-COCO 32/32). ✅

---

### E-0a · UNIQUE constraints formales en blob_id (missions + goals)

**Por qué:** El backfill del Sprint D creó índices parciales únicos `WHERE blob_id IS NOT NULL`. Son funcionalmente equivalentes a constraints formales para proteger contra race conditions, pero los constraints son más explícitos, visibles en herramientas y ORMs. Se reemplaza el índice parcial por el constraint formal, eliminando el índice redundante.

**Paso 1 — Verificar duplicados (OBLIGATORIO antes de continuar):**

```sql
-- Si alguna de estas queries devuelve filas, reportar al owner antes de continuar
SELECT couple_id, blob_id, COUNT(*) as n
FROM missions 
WHERE blob_id IS NOT NULL 
GROUP BY couple_id, blob_id 
HAVING COUNT(*) > 1;

SELECT couple_id, blob_id, COUNT(*) as n
FROM goals 
WHERE blob_id IS NOT NULL 
GROUP BY couple_id, blob_id 
HAVING COUNT(*) > 1;

-- Ver nombres reales de los índices existentes sobre blob_id
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('missions', 'goals')
  AND indexdef ILIKE '%blob_id%';
```

**Paso 2 — Aplicar solo si no hay duplicados:**

```sql
-- Reemplazar los nombres de índice con los reales del paso 1
-- Ejemplo típico del backfill Sprint D:
DROP INDEX IF EXISTS missions_couple_blob_uniq;
DROP INDEX IF EXISTS goals_couple_blob_uniq;

-- Constraints formales (NULL ≠ NULL en Postgres → múltiples NULLs permitidos, igual que el índice parcial)
ALTER TABLE missions
  ADD CONSTRAINT missions_couple_blob_unique
  UNIQUE (couple_id, blob_id);

ALTER TABLE goals
  ADD CONSTRAINT goals_couple_blob_unique
  UNIQUE (couple_id, blob_id);
```

**Verificación:**
```sql
SELECT conname, contype
FROM pg_constraint
WHERE conrelid IN ('missions'::regclass, 'goals'::regclass)
  AND conname LIKE '%blob%';
-- Debe devolver 2 filas con contype = 'u'
```

---

### E-0b · Resolución de FKs internas en missions (goal_id, series_id, carried_from)

**Por qué:** Durante el backfill del Sprint D, los campos `goal_id`, `series_id` y `carried_from` quedaron en NULL porque el regex guard excluyó nanoids de columnas uuid. Hoy esos campos son inútiles. Esta migración los resuelve en una sola pasada: añade columnas texto transitorias, las puebla desde el blob, resuelve a UUIDs y borra las columnas transitorias.

**Estrategia (propuesta del owner — resolución en misma migración, sin deuda permanente):**
- `series_id` y `carried_from`: self-joins en `missions` via `blob_id`
- `goal_id`: cross-join con `goals` via `blob_id`
- Las tres columnas `_blob_id` de tránsito se añaden y borran en la misma migración

```sql
-- E-0b: Resolución de FKs en missions — una sola migración limpia

-- Paso 1: Columnas de tránsito (texto, transitorias)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS goal_blob_id text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS series_blob_id text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS carried_from_blob_id text;

-- Paso 2: Poblar columnas de tránsito desde el blob
-- (re-lee el blob para obtener los nanoids que el backfill no pudo guardar como uuid)
UPDATE missions m
SET
  goal_blob_id         = (raw_mission->>'goalId'),
  series_blob_id       = (raw_mission->>'seriesId'),
  carried_from_blob_id = (raw_mission->>'carriedFrom')
FROM (
  SELECT
    ad.id::uuid           AS couple_id,
    week_entry.key        AS week_key,
    mission_item.value    AS raw_mission
  FROM app_data ad,
    jsonb_each(ad.data->'weeks')            AS week_entry,
    jsonb_array_elements(week_entry.value->'missions') AS mission_item
) src
WHERE m.couple_id = src.couple_id
  AND m.week_key  = src.week_key
  AND m.blob_id   = (src.raw_mission->>'id');

-- Paso 3: Resolver goal_id (missions → goals)
UPDATE missions m
SET goal_id = g.id
FROM goals g
WHERE g.blob_id   = m.goal_blob_id
  AND g.couple_id = m.couple_id
  AND m.goal_blob_id IS NOT NULL
  AND m.goal_id IS NULL;

-- Paso 4: Resolver series_id (self-join missions)
UPDATE missions m1
SET series_id = m2.id
FROM missions m2
WHERE m2.blob_id   = m1.series_blob_id
  AND m2.couple_id = m1.couple_id
  AND m1.series_blob_id IS NOT NULL
  AND m1.series_id IS NULL;

-- Paso 5: Resolver carried_from (self-join missions)
UPDATE missions m1
SET carried_from = m2.id
FROM missions m2
WHERE m2.blob_id         = m1.carried_from_blob_id
  AND m2.couple_id       = m1.couple_id
  AND m1.carried_from_blob_id IS NOT NULL
  AND m1.carried_from IS NULL;

-- Paso 6: Verificación — reportar al owner antes de borrar columnas
SELECT
  'goal_id'      AS fk,
  COUNT(*) FILTER (WHERE goal_blob_id IS NOT NULL AND goal_id IS NOT NULL)     AS resueltos,
  COUNT(*) FILTER (WHERE goal_blob_id IS NOT NULL AND goal_id IS NULL)         AS sin_resolver
FROM missions
UNION ALL
SELECT
  'series_id',
  COUNT(*) FILTER (WHERE series_blob_id IS NOT NULL AND series_id IS NOT NULL),
  COUNT(*) FILTER (WHERE series_blob_id IS NOT NULL AND series_id IS NULL)
FROM missions
UNION ALL
SELECT
  'carried_from',
  COUNT(*) FILTER (WHERE carried_from_blob_id IS NOT NULL AND carried_from IS NOT NULL),
  COUNT(*) FILTER (WHERE carried_from_blob_id IS NOT NULL AND carried_from IS NULL)
FROM missions;
```

**Paso 7 — Solo ejecutar si la verificación es satisfactoria:**
```sql
-- Borrar columnas de tránsito (schema limpio, sin deuda)
ALTER TABLE missions DROP COLUMN IF EXISTS goal_blob_id;
ALTER TABLE missions DROP COLUMN IF EXISTS series_blob_id;
ALTER TABLE missions DROP COLUMN IF EXISTS carried_from_blob_id;
```

---

### E-0c · Verificar y reforzar RLS en push_subscriptions

**Por qué:** La tabla `push_subscriptions` tiene políticas existentes (push_select_own, push_insert_own, push_update_own, push_delete_own) creadas en C-3. Hay que verificar que el rol `anon` no puede ejecutar nada y que `service_role` puede acceder para el Edge Function que enviará pushes.

```sql
-- Ver estado actual de las políticas
SELECT polname, polcmd, polroles::text
FROM pg_policy
WHERE polrelid = 'public.push_subscriptions'::regclass
ORDER BY polcmd;

-- Verificar que RLS está habilitado
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'push_subscriptions';
-- relrowsecurity debe ser true

-- Confirmar que anon no tiene ningún permiso
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'push_subscriptions'
  AND grantee = 'anon';
-- Debe devolver 0 filas

-- Si hay grants a anon, revocarlos:
-- REVOKE ALL ON public.push_subscriptions FROM anon;
```

**Si las policies existentes son correctas, no hay nada que cambiar.** Reportar el resultado del SELECT de pg_policy al owner para confirmar.

---

## 🔮 SPRINT E — EJECUTAR DESPUÉS DEL 17 DE JUNIO

> **Contexto:** El Sprint E implementa las notificaciones push reales. La tabla `push_subscriptions` (C-3) ya existe. Lo que necesitamos aquí son los triggers de Postgres que disparan la Edge Function `send-push` automáticamente cuando ocurren eventos importantes.
>
> **IMPORTANTE:** No ejecutar hasta que la Edge Function `send-push` esté desplegada en Supabase y el equipo de desarrollo confirme su URL.

### E-1 · Trigger de notificación al partner cuando hay cambios

**Por qué:** Cuando una persona guarda cambios en `app_data`, el partner debe recibir un push. Este trigger detecta el UPDATE y llama a la Edge Function usando `pg_net` (extensión de Supabase para HTTP desde triggers).

```sql
-- E-1: Trigger push al partner en cambios de app_data
-- PREREQUISITO: Edge Function 'send-push' desplegada y URL confirmada

-- Habilitar extensión pg_net si no está activa (Supabase la tiene por defecto)
-- create extension if not exists pg_net;

create or replace function public.notify_partner_on_save()
returns trigger language plpgsql security definer as $$
declare
  v_edge_url text := 'https://TU_PROYECTO.supabase.co/functions/v1/send-push';
  v_service_key text := current_setting('app.supabase_service_key', true);
begin
  -- Solo notificar si data cambió realmente
  if old.data = new.data then return new; end if;

  perform net.http_post(
    url := v_edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'coupleId', new.couple_id,
      'title', 'Misiones de Pareja',
      'body', 'Tu pareja actualizó algo ✨',
      'tag', 'partner-update'
    )
  );

  return new;
end;
$$;

-- NOTA: Reemplazar 'TU_PROYECTO' con el ID real del proyecto Supabase
-- antes de ejecutar este trigger
drop trigger if exists trg_notify_partner_save on public.app_data;
create trigger trg_notify_partner_save
  after update on public.app_data
  for each row execute function public.notify_partner_on_save();
```

---

## 🔮 SPRINT G — EJECUTAR DESPUÉS DEL 1 DE JULIO

> **Contexto:** El Sprint G es el "bulletproof save" — asegura que nunca se pierda trabajo, ni con conexión mala ni con dos personas editando a la vez. La columna `version` (C-2) ya existe. Lo que falta es la limpieza de las RLS policies para que no haya inconsistencias entre SELECT y UPDATE.

### G-1 · Unificar RLS de app_data con policy for all

**Por qué:** Hoy `app_data` puede tener policies separadas para SELECT, INSERT y UPDATE con condiciones ligeramente distintas. Esto crea casos donde el usuario puede leer algo que no puede editar, o viceversa. Una sola policy `for all` elimina esa clase de bugs permanentemente.

```sql
-- G-1: Unificar RLS de app_data
-- Primero ver las policies actuales:
select polname, polcmd from pg_policy
where polrelid = 'public.app_data'::regclass;

-- Luego reemplazar todas por una sola:
-- (ajustar los nombres reales según lo que devuelva la query anterior)
drop policy if exists "app_data_select" on public.app_data;
drop policy if exists "app_data_insert" on public.app_data;
drop policy if exists "app_data_update" on public.app_data;
drop policy if exists "Users can read their own couple data" on public.app_data;
drop policy if exists "Users can update their own couple data" on public.app_data;
drop policy if exists "Users can insert their own couple data" on public.app_data;

drop policy if exists "app_data_all_own" on public.app_data;
create policy "app_data_all_own" on public.app_data
  for all to authenticated
  using (is_couple_member(couple_id))
  with check (is_couple_member(couple_id));
```

**IMPORTANTE:** Antes de ejecutar el DROP de policies, ejecutar primero el SELECT para ver los nombres reales de las policies actuales y ajustar los DROP según corresponda.

---

## 📋 Resumen de ejecución

| Sección | Cuándo | Estado |
|---|---|---|
| Sprint A — `events` | Ejecutado 20 mayo | ✅ Listo |
| C-1 — Backup manual | Esta semana | ✅ Confirmado 20 mayo (5 parejas, 2,1 MB) |
| C-2 — `version` + CAS en `app_data` | Esta semana (tras backup) | ✅ Ejecutado + fix PK aplicado |
| C-3 — `push_subscriptions` | Esta semana | ✅ Ejecutado y verificado |
| D-1 — Helper `is_couple_member` | Ejecutado 20 mayo | ✅ Verificado |
| D-2 — `missions` normalizada | Ejecutado 20 mayo | ✅ Verificado |
| D-3 — `goals` normalizada | Ejecutado 20 mayo | ✅ Verificado |
| D-4 — `couple_settings` | Ejecutado 20 mayo | ✅ Verificado |
| D-5 — `week_photos` | Ejecutado 20 mayo | ✅ Verificado |
| D-6 — `expenses` | APLAZADO a v4.1 | ❌ Aplazado |
| E-0a — UNIQUE constraints blob_id | Ahora | 🔜 Pendiente |
| E-0b — Resolución FKs goal_id/series_id/carried_from | Hoy | 🔜 Pendiente |
| E-0c — Verificar RLS push_subscriptions | Antes de Sprint E | 🔜 Pendiente |
| E-1 — Trigger push partner | Tras deploy Edge Function | 🔮 Futuro |
| G-1 — RLS unificada `app_data` | Tras Sprint G | 🔮 Futuro |

---

## ⚠️ Reglas de oro para el agente SQL

1. **Nunca ejecutar DROP TABLE** salvo indicación explícita y marcada como "SEGURO BORRAR".
2. **Siempre verificar** con el SELECT de verificación incluido en cada sección antes de reportar éxito.
3. **Si algo falla**, reportar el error exacto al owner antes de continuar. No improvisar soluciones.
4. **Additive-only**: si una columna o tabla ya existe, `IF NOT EXISTS` la omite sin error. Eso es correcto.
5. **El orden importa**: D-1 (`is_couple_member`) debe ejecutarse antes que D-2, D-3, D-4, D-5.
6. **Sprint D no empieza** hasta que el owner confirme que el backup de C-1 está hecho y guardado.
