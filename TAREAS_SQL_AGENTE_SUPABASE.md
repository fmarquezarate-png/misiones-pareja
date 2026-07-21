# Tareas SQL para el Agente Supabase
## Shared Calendar — Roadmap v3.5.0 → v4.0.3+

> **Para el agente:** Este documento contiene todas las migraciones SQL que debes ejecutar en el proyecto Supabase, organizadas por sprint. Ejecuta **una sección a la vez**, en el orden indicado. Cada sección incluye el contexto de por qué se hace, para que puedas tomar decisiones si algo falla.
>

---


> ⚠️ **Corrección (21/07/2026, verificado contra la DB real):** la columna de fecha de `app_data_backups` se llama **`backed_up_at`**, NO `created_at` como aparece en los SQL de ejemplo de este documento. El schema real es: `id bigint, data jsonb, backed_up_at timestamptz, identifier text, couple_id uuid`. Cualquier query/trigger nuevo debe usar `backed_up_at`.

## ✅ RESUELTO (v4.23.3, 08/07/2026) — Misi conectado al agente real de Vento

**Feature:** chat con Misi dentro de la app (burbuja flotante → panel de chat). Código en `src/components/MisiMascot.jsx`, `MisiChatPanel.jsx`, `supabase/functions/misi-chat/index.ts`.

**Historial de la conexión (para referencia futura, no repetir):**
1. `misi-chat` y `get-shared-view` desplegadas por primera vez (07/07/2026) — ambas fallaban con 404 real, ni siquiera existían en Supabase.
2. Secret `VENTO_API_KEY` configurado por el usuario (Bearer de sesión extraído de cloud.vento.build).
3. Primer intento de contrato (v4.23.0) fallaba con "sin texto reconocible" — causa real: `action_chat` es **asíncrono**, devuelve un `conversationId`, no el texto de la respuesta.
4. **Fix final (v4.23.3):** reescrita `misi-chat/index.ts` combinando el diagnóstico del usuario con una revisión propia:
   - `action_chat` se llama con `conversationId: coupleId` — le da a cada pareja un hilo estable (Misi recuerda contexto entre mensajes).
   - Polling a `action_messages` cada 2s, filtrando por remitente exacto (`m.from === 'misiones_assistant'`) **y por `timestamp >= sentAt`** — este último filtro es clave: sin él, una conversación con historial previo podía devolver por error una respuesta VIEJA en vez de esperar la nueva.
   - Timeout de 2 minutos con mensaje claro si Misi no responde a tiempo.
5. Desplegado (versión 5) vía Supabase MCP el 08/07/2026.

**Nota permanente sobre el token:** es un Bearer de sesión (no una API key dedicada) — vence ~7 días después de extraerlo. Si el chat vuelve a fallar con 401/403, hay que repetir la extracción (DevTools → `document.cookie.match(/session=([^;]+)/)?.[1]`, o un bookmarklet en iOS) y actualizar el secret `VENTO_API_KEY`.

---

## ✅ RESUELTO (v4.23.0, 07/07/2026) — Edge Function `get-shared-view` desplegada

**Feature:** Modo invitado de solo lectura (Perfil → Compartir → "Enlace de solo lectura"). Un familiar o cuidadora puede ver el plan de la semana sin necesitar cuenta, mediante un link `https://.../?guest=<coupleId>&token=<token>`.

**No era SQL — no hizo falta ninguna migración ni columna nueva.** El toggle y el token viven dentro del blob existente (`data.settings.shareEnabled` / `data.settings.shareToken`), igual que cualquier otro ajuste (tema, colores).

Desplegada vía Supabase MCP el 07/07/2026. Código en `supabase/functions/get-shared-view/index.ts`. Usa los mismos secrets que `send-push` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — no requirió secrets nuevos.

**Qué hace la función:** recibe `{ coupleId, token }` por POST, busca el `app_data` de esa pareja con el service role (bypass de RLS controlado — el filtrado de seguridad lo hace la función comparando `token` contra `data.settings.shareToken`, no la base), y devuelve una versión saneada del blob: solo `settings.person1/person2/colors` y `weeks` con las misiones **sin el campo `comments`** (notas privadas entre la pareja). Nunca expone chat, gastos, ánimo, plantillas ni actividad — solo lo necesario para "ver el plan".

**Verificar:**
```bash
curl "https://txnsotchljquilfmdpdy.supabase.co/functions/v1/get-shared-view?probe=1"
# Debe responder { "ok": true, "ts": "..." }
```

---

## 🔍 Verificación pendiente (v4.16.0, 02/07/2026) — Login con email + contraseña

**No es SQL, es una revisión de configuración en la consola:** Authentication → Providers → Email, en el dashboard de Supabase.

**Contexto:** se agregó login con email/contraseña como alternativa a Google (`signUpWithEmail`/`signInWithEmail` en `supabase.js`). El comportamiento del signup depende de un toggle que no se puede leer ni cambiar desde el código:

- **"Confirm email" ON** (default de Supabase): tras crear la cuenta, el usuario recibe un correo de confirmación y no puede iniciar sesión hasta hacer click en el link. El código ya maneja este caso (`data.session === null` → muestra "revisa tu correo").
- **"Confirm email" OFF**: la cuenta queda activa al instante, sin correo de por medio.

**Pedido al Externo:** confirmar cuál de los dos estados está activo en el proyecto, y si el SMTP por defecto de Supabase (rate-limited, puede tardar o caer en spam) es aceptable para el volumen esperado, o conviene configurar un proveedor SMTP propio (Resend, Postmark, etc.) desde Authentication → Settings → SMTP Settings.

---

## ✅ CRÍTICO — EJECUTADO (28/05/2026)

### P0 · Deshabilitar triggers de push en `app_data` — ✅ COMPLETADO (28/05)

**Síntoma en producción:** saves intermitentes fallan con statement timeout. Los cambios del usuario no persisten tras refresh.

**Causa raíz confirmada por Externo:** Los triggers `trg_push_on_app_data_update` y `trg_notify_push_on_app_data_update` llaman a `net.http_post` (hacia la Edge Function `send-push`) **dentro de la misma transacción** que `save_app_data_cas`. Aunque `pg_net` sea async, la ejecución del trigger extiende el tiempo que el `FOR UPDATE` lock está abierto. Si la Edge Function tarda más de unos millisegundos, la siguiente query de carga colisiona con el lock → statement timeout → 500 → el cliente no puede guardar ni cargar datos.

**La app ya envía push contextual desde el cliente** (con 1500ms delay post-save). Los triggers son redundantes y peligrosos en su posición actual.

```sql
-- Deshabilitar AMBOS triggers de push en app_data
ALTER TABLE public.app_data DISABLE TRIGGER trg_push_on_app_data_update;
ALTER TABLE public.app_data DISABLE TRIGGER trg_notify_push_on_app_data_update;

-- Verificar que quedaron deshabilitados
SELECT trigger_name, enabled
FROM information_schema.triggers
WHERE event_object_table = 'app_data'
  AND trigger_name ILIKE '%push%';
-- enabled debe ser 'NO' o 'DISABLED' para ambos

-- Verificar los triggers restantes (solo deben quedar snapshot y version)
SELECT trigger_name, event_manipulation, enabled
FROM information_schema.triggers
WHERE event_object_table = 'app_data'
ORDER BY trigger_name;
```

**Confirmado (28/05/2026):** `trg_push_on_app_data_update` → disabled, `trg_notify_push_on_app_data_update` → disabled. Triggers activos: `auto_backup_on_update`, `set_app_data_updated_at`, `trg_app_data_version`, `trg_snapshot_app_data`. `cas_version_check: true` activado en código (v4.1.4).

---
> **Regla de oro:** Todas las migraciones son **additive-only** (solo añaden, nunca borran). Nunca ejecutes un DROP TABLE salvo que la sección lo indique explícitamente y diga "SEGURO BORRAR".

---

## ✅ URGENTE — EJECUTADO (28/05/2026)

### P1 · Verificar y corregir RLS de `couple_members` para INSERT inicial — ✅ COMPLETADO (28/05)

**Síntoma:** Un usuario nuevo no puede crear pareja. El INSERT a `couples` puede pasar (tiene `owner_user_id: auth.uid()`) pero el INSERT a `couple_members` falla con RLS.

**Causa probable:** La policy de INSERT en `couple_members` usa `is_couple_member(couple_id)` como WITH CHECK. Pero `is_couple_member()` devuelve FALSE porque el usuario AÚN NO ES MIEMBRO (está intentando convertirse en el primer miembro). Resultado: el INSERT es rechazado por la misma condición que debería proteger la tabla.

**El mismo bug afecta `joinCouple`**: un usuario que quiere unirse tampoco puede insertar en `couple_members` si la policy usa `is_couple_member()`.

**Diagnosticar:**
```sql
-- Ver las políticas actuales de couple_members
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'couple_members';
```

**Si la policy de INSERT usa `is_couple_member()`, reemplazarla:**
```sql
-- La condición correcta para INSERT en couple_members es:
-- "solo puedes agregarte a ti mismo como miembro"
-- No se puede verificar membresía previa porque aún no existe.
DROP POLICY IF EXISTS "couple_members_insert_own" ON public.couple_members;
CREATE POLICY "couple_members_insert_own" ON public.couple_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
```

**Para prevenir que alguien agregue a un tercero** (la protección real):
```sql
-- Verificar que la policy SELECT sigue siendo correcta
-- (los usuarios solo deben ver las parejas de las que son miembro)
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'couple_members' AND cmd = 'SELECT';
```

**Confirmar al equipo:** resultado del SELECT de políticas antes y después del cambio.

---

## 🔴 URGENTE — Pendientes del scan 26/05/2026 (v4.0.5+)

### S-3 · Columna `carried_from_blob_id` en la tabla `missions` — ✅ EJECUTADO (26/05)

**Estado:** Confirmado por Externo. Columna `carried_from_blob_id text NULL` añadida a `missions`.

**Código actualizado en v4.0.8:**
- `insertNormalizedMission` en repo.js: escribe `carried_from_blob_id: m.carriedFrom ?? null`
- `missionRowToBlob` en supabase.js: lee `carriedFrom: row.carried_from_blob_id ?? null`

`syncCarryDone` vuelve a funcionar cuando `read_from_normalized: true`.

---

## 🔴 URGENTE — Pendientes del scan 26/05/2026 (v4.0.3)

### S-1 · Añadir columna `series_blob_id` a la tabla `missions` — ✅ COMPLETADO (28/05)

**Prioridad:** P1. Sin esta columna, el nanoid que agrupa misiones recurrentes no sobrevive el roundtrip por la tabla normalizada. Con `read_from_normalized: true`, las series aparecen como misiones independientes.

**Contexto:** El código (`insertNormalizedMission` en repo.js) ya escribe `series_blob_id: m.seriesId`. `missionRowToBlob` en supabase.js ya lee `row.series_blob_id`. Solo falta la columna en el esquema.

```sql
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS series_blob_id text;

-- Índice para búsquedas por serie
CREATE INDEX IF NOT EXISTS idx_missions_series_blob_id
  ON public.missions (series_blob_id)
  WHERE series_blob_id IS NOT NULL;
```

**Verificar después:**
```sql
SELECT series_blob_id, COUNT(*)
FROM missions
WHERE series_blob_id IS NOT NULL
GROUP BY series_blob_id
ORDER BY COUNT(*) DESC
LIMIT 10;
```

---

### S-2 · INSERT policy en tabla `events` para rol `authenticated` — ✅ YA EXISTE (26/05)

**Estado:** Verificado por Externo el 26/05/2026. La policy `events_insert_own` ya existe:
```
Policy: events_insert_own | Cmd: INSERT | Roles: authenticated | WITH CHECK: user_id = auth.uid()
```

**Causa real del problema:** La policy es correcta. El fallo de telemetría venía de `track.js` haciendo flush antes de que `setTrackContext` fuera llamado — `user_id` era `null` en el payload y la RLS lo rechazaba silenciosamente.

**Fix aplicado en v4.0.4:** `flush()` en `track.js` ahora espera 3s y reintenta si `userId` o `coupleId` son null, en lugar de enviar y fallar.

---

## 🔴 URGENTE — Ejecutar esta semana (del diagnóstico 23/05/2026)

### U-1 · Verificar y reforzar snapshot automático del blob — ✅ EJECUTADO (26/05)

**Estado:** Confirmado por Externo. Trigger `trg_snapshot_app_data` activo (BEFORE UPDATE ON app_data → `snapshot_app_data()`). El blob anterior se guarda en `app_data_backups` con UUID cast guard antes de cada save.

**⚠️ Deuda técnica BLOQUEANTE para E-1:** `trg_push_on_app_data_update` sigue activo en la tabla `app_data`. Coexiste con `trg_notify_push_on_app_data_update` — dos triggers apuntando a la misma función. Actualmente la app envía push desde el cliente (con 1500ms delay), por lo que el trigger duplicado no se nota. **Pero en cuanto se active E-1 (push server-side), el trigger duplicado causará dobles notificaciones sistemáticas.**

**Ejecutar ANTES de cualquier trabajo en E-1:**
```sql
-- Verificar estado actual de los dos triggers
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'app_data'
  AND trigger_name ILIKE '%push%';

-- Deshabilitar el trigger duplicado (no borrar — por si acaso)
ALTER TABLE public.app_data DISABLE TRIGGER trg_push_on_app_data_update;

-- Verificar que solo queda uno activo
SELECT trigger_name, enabled
FROM information_schema.triggers
WHERE event_object_table = 'app_data';
```

---

### U-1-original · (histórico)

> ⚠️ **ANTES DE EJECUTAR** — El script original tenía el mismo bug que `backup_app_data`: intenta insertar `OLD.id` (text) en `couple_id` (uuid) sin castear. El script correcto está abajo con el guard UUID. NO ejecutes el SQL del diagnóstico 23/05 sin esta corrección.

**Prioridad:** CRÍTICA. El blob en `app_data` es la única fuente de verdad. Un save inválido sin rollback posible destruye los datos de una pareja.

**Verificar primero:**
```sql
-- ¿Existe trigger que crea backups automáticos en cada UPDATE de app_data?
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'app_data';

-- ¿Cuántos backups hay y cuándo se crearon?
SELECT couple_id, COUNT(*), MIN(created_at), MAX(created_at)
FROM app_data_backups
GROUP BY couple_id;
```

**Si no existe trigger de backup automático**, crear uno (con UUID cast guard):
```sql
-- Trigger que inserta snapshot en app_data_backups antes de cada UPDATE
-- IMPORTANTE: app_data.id es text; app_data_backups.couple_id es uuid.
-- Usar guard de cast para evitar error 400 "column couple_id is of type uuid but expression is of type text"
CREATE OR REPLACE FUNCTION public.snapshot_app_data()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.app_data_backups (couple_id, data, created_at)
  VALUES (
    CASE WHEN OLD.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         THEN OLD.id::uuid ELSE NULL END,
    OLD.data,
    NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_app_data ON public.app_data;
CREATE TRIGGER trg_snapshot_app_data
  BEFORE UPDATE ON public.app_data
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_app_data();
```

**Retention policy — borrar backups con más de 30 días:**
```sql
-- Ejecutar manualmente o programar con pg_cron
DELETE FROM public.app_data_backups
WHERE created_at < NOW() - INTERVAL '30 days';
```

**Confirmar al equipo:** cuántos backups existen, si el trigger estaba activo antes del 23/05, y si los 30 backups existentes son del trigger o del backfill manual.

---

### U-2 · Resolver Security Definer Views restantes

**Prioridad:** ALTA. 2 vistas con SECURITY DEFINER siguen sin resolver tras el diagnóstico del 23/05.

```sql
-- Listar vistas con SECURITY DEFINER
SELECT schemaname, viewname, definition
FROM pg_views
WHERE definition ILIKE '%security_definer%'
  AND schemaname = 'public';
```

Para cada vista: evaluar si el SECURITY DEFINER es intencional (bypass RLS para vistas públicas) o accidental. Si es accidental, recrear sin SECURITY DEFINER.

---

### U-3 · Activar telemetría real en tabla `events`

**Prioridad:** ALTA. La tabla existe desde el 20/05 pero los datos son seed del backfill, no uso real.

**Verificar que el RLS permite INSERT desde usuarios autenticados:**
```sql
-- Ver políticas actuales en events
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'events';
```

**Query semanal de engagement (ejecutar manualmente o con pg_cron):**
```sql
-- Dashboard mínimo: últimos 7 días
SELECT
  name,
  COUNT(*) as count,
  COUNT(DISTINCT couple_id) as couples,
  MAX(ts) as last_seen
FROM public.events
WHERE ts > NOW() - INTERVAL '7 days'
GROUP BY name
ORDER BY count DESC;

-- Misiones completadas por semana
SELECT
  DATE_TRUNC('week', (props->>'ts')::timestamptz) as week,
  COUNT(*) as completadas,
  COUNT(DISTINCT couple_id) as couples
FROM public.events
WHERE name = 'mission_completed'
GROUP BY 1
ORDER BY 1 DESC
LIMIT 8;
```

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

## ✅ SPRINT D — COMPLETADO ✅

> **Contexto:** Este es el mayor cambio de schema del roadmap. Hoy toda la información de la pareja (misiones, metas, gastos, fotos, configuración) vive en un único blob JSON en `app_data.data`. Esto hace que cada cambio envíe ~200KB al servidor y que dos personas editando a la vez puedan pisarse. Las siguientes tablas normalizan el schema: cada entidad tiene su propia tabla, su propio RLS y sus propios índices.
>
> **Estrategia de migración:** Se usa **dual-write transitorio** — la app escribe en el blob Y en las tablas nuevas durante 2-3 semanas. Cuando la consistencia supera el 99.9%, se cambia la lectura a las tablas nuevas. Nunca se borra el blob hasta 30 días después.
>
> **IMPORTANTE:** No ejecutar este bloque hasta que el equipo de desarrollo confirme que el feature flag `dual_write_normalized` está listo en el código.

### Resultados del backfill (verificados)

| Pareja | Misiones | Metas | Settings |
|--------|----------|-------|----------|
| CRI-COCO | 32 ✅ | 0 ✅ | ✅ |
| FRANANA | 220 ✅ | 8 ✅ | ✅ |

**3 problemas resueltos durante el proceso:**
1. `app_data.id` era text, no uuid — filas legacy rompían el cast
2. 2 filas UUID en app_data sin pareja en couples — excluidas como orphans
3. IDs de misiones en formato nanoid (no UUID) — resuelto con columna `blob_id` + `gen_random_uuid()`

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

## 🔜 SPRINT E-1 — EJECUTAR TRAS DEPLOY DE EDGE FUNCTION

> **Contexto:** El Sprint E-0 y el código de la Edge Function `send-push` están listos (en `supabase/functions/send-push/index.ts`). Lo que falta es el trigger de Postgres que la dispara automáticamente cuando una pareja guarda cambios.
>
> **PREREQUISITO:** El owner debe desplegar la Edge Function con `supabase functions deploy send-push` y confirmar la URL antes de ejecutar este SQL. La URL tiene el formato: `https://TU_PROYECTO_ID.supabase.co/functions/v1/send-push`
>
> **NOTA para el agente:** Reemplazar `TU_PROYECTO` con el ID real del proyecto antes de ejecutar.

### E-1 · Trigger de notificación al partner cuando hay cambios

> **⛔ PREREQUISITO BLOQUEANTE:** Deshabilitar `trg_push_on_app_data_update` (ver U-1 arriba) ANTES de ejecutar este trigger. Si no, cada save generará dos notificaciones push al partner.

**Por qué:** Cuando una persona guarda cambios en `app_data`, el partner debe recibir un push. Este trigger detecta el UPDATE y llama a la Edge Function usando `pg_net` (extensión de Supabase para HTTP desde triggers).

> **Limitación conocida (post-v4.0.9):** el mensaje del trigger server-side es genérico ("Tu pareja actualizó algo ✨"). No puede ser contextual ("Francu añadió: 🎯 hacer la cama") porque el trigger no sabe qué acción específica ocurrió. Si se quiere mantener mensajes contextuales, el camino correcto es una tabla `push_queue` donde el cliente escribe el payload específico antes del save, y el trigger la vacía al dispararse. Evaluar en Sprint E-2.

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

### G-2 · Flip lectura blob → tablas normalizadas (Sprint G-2)

> **Estado:** 🟡 Dual-write cableado (v3.9.2) — pendiente: Externo añade 4 columnas + re-backfill + flip.
> **Flag:** `read_from_normalized: false` en `src/lib/flags.js` DEFAULTS.
> **Consistencia verificada:** ✅ FRANANA (225/220 — +5 post-backfill real) y CRI-COCO (32/32) — Externo 2026-05-22.

#### Estado de los 3 gaps

**Gap 3 — Código de lectura:** ✅ CERRADO (2026-05-23)
`loadFromNormalized(coupleId)` implementada en `supabase.js` y cableada en App.jsx. Incluye safety check: fallback al blob si la tabla está vacía O si tiene <80% de las misiones del blob.

**Gap 2 — Metadatos de semana:** ✅ NO BLOQUEA (2026-05-23)
`loadFromNormalized` usa el blob como skeleton de cada semana, preservando `label` y `epicGoal` directamente. La tabla `week_metadata` es útil para analytics futura pero no es requisito para el flip.

**Gap 1 — 4 columnas faltantes en `missions`:** 🔴 PENDIENTE EXTERNO

La tabla `missions` no tiene: `time`, `reminder`, `series_pattern`, `series_end_date`. El dual-write de v3.9.2 ya emite INSERTs por cada nueva misión — los inserts incluirán estos campos en cuanto las columnas existan.

```sql
-- Verificar columnas actuales de missions:
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'missions' ORDER BY ordinal_position;

-- Añadir las 4 columnas faltantes:
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS time            text,
  ADD COLUMN IF NOT EXISTS reminder        text,
  ADD COLUMN IF NOT EXISTS series_pattern  text,
  ADD COLUMN IF NOT EXISTS series_end_date date;

-- Verificación:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'missions' AND column_name IN ('time','reminder','series_pattern','series_end_date');
-- Debe devolver 4 filas
```

#### Qué sigue después de Gap 1 (secuencia)

1. Externo añade las 4 columnas → confirma al equipo
2. El equipo actualiza `insertNormalizedMission` en `repo.js` para incluir `time`, `reminder`, `series_pattern`, `series_end_date` en el payload del INSERT
3. Re-backfill desde blob para recuperar datos históricos (las filas actuales del backfill del 20/05 quedan con NULL en esos campos):

```sql
-- Re-backfill de los 4 campos desde el blob en las filas existentes
UPDATE public.missions m
SET
  time            = (src.raw_mission->>'time'),
  reminder        = (src.raw_mission->>'reminder'),
  series_pattern  = (src.raw_mission->>'seriesPattern'),
  series_end_date = NULLIF(src.raw_mission->>'seriesEndDate', '')::date
FROM (
  SELECT
    ad.id::uuid             AS couple_id,
    week_entry.key          AS week_key,
    mission_item.value      AS raw_mission
  FROM app_data ad,
    jsonb_each(ad.data->'weeks')                AS week_entry,
    jsonb_array_elements(week_entry.value->'missions') AS mission_item
) src
WHERE m.couple_id = src.couple_id
  AND m.week_key  = src.week_key
  AND m.blob_id   = (src.raw_mission->>'id');
```

4. Verificar consistencia: contar misiones en blob vs tabla. Si ratio > 95%, el flip es seguro.
5. El equipo cambia `read_from_normalized: false` → `true` en `src/lib/flags.js` DEFAULTS + redesploy.

#### Correcciones a las queries de consistencia (para referencia futura)

Las queries enviadas al Externo el 2026-05-22 tenían 2 bugs confirmados por el Externo:
1. **Cross join sin agrupación**: `LEFT JOIN LATERAL` sin `GROUP BY` correcto produce producto cartesiano (conteos inflados: 49500, 1024)
2. **Filtro nanoid incorrecto**: `AND (m2->>'id') ~ '^[0-9a-f-]{36}$'` excluye IDs del blob más recientes (nanoids válidos post-backfill) causando diferencia falsa

**Queries correctas que funcionaron (probadas por Externo):** usar las queries originales simples con `COUNT(*)` agrupado por `couple_id` sin el regex guard.

#### Activación del flip (cuando los gaps estén cerrados)

1. Confirmar que `missions` tiene `time`, `reminder`, `series_pattern`, `series_end_date` con datos
2. Confirmar que `week_metadata` existe y está backfilled
3. El equipo implementa `loadFromNormalized(coupleId)` en `supabase.js`
4. PR con el flag en `false` → test → cambiar a `true` → redesploy

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
| E-0a — UNIQUE constraints blob_id | Ejecutado 20 mayo | ✅ Verificado |
| E-0b — Resolución FKs goal_id/carried_from (100%) + series_id (0/5 legacy) | Ejecutado 20 mayo | ✅ Verificado |
| E-0c — RLS push_subscriptions verificada, cobertura completa | Ejecutado 20 mayo | ✅ Verificado |
| E-1 — Trigger push partner (trg_push_on_app_data_update) | Ejecutado 20 mayo | ✅ Verificado |
| SEC-1 — Revocar anon en `save_app_data_cas` | Ejecutado 21 mayo | ✅ `anon_can_execute = false` confirmado |
| SEC-2 — Vistas SECURITY DEFINER | 21 mayo | ✅ No existen en producción — sin riesgo activo |
| PERF-1 — 16 políticas RLS optimizadas `(SELECT auth.uid())` | Ejecutado 21 mayo | ✅ app_data, app_data_backups, couple_members, daily_load_cache, events, messages, push_subscriptions |
| PERF-2 — 5 índices FK creados | Ejecutado 21 mayo | ✅ app_data_backups, couple_members, events, messages, push_subscriptions |
| G-1 — RLS unificada `app_data` | Tras Sprint G | 🔮 Futuro (julio) |
| G-2 — Gap 3 (loadFromNormalized) | Cerrado v3.9.2 | ✅ Código listo + cableado |
| G-2 — Gap 2 (week_metadata) | No bloquea | ✅ loadFromNormalized usa blob skeleton |
| G-2 — Gap 1 (4 columnas missions) | Cerrado Externo 26/05 | ✅ time/reminder/series_pattern/series_end_date |
| G-2 — Dual-write misiones completo | Activado v3.9.5 | ✅ insert/delete/status + 4 campos nuevos |
| G-2 — Re-backfill 4 columnas | Ejecutado Externo 26/05 | ✅ 139 filas actualizadas |
| G-2 — Backup couple_id fix | Ejecutado Externo 26/05 | ✅ backup_app_data() usa NEW.id |
| G-2 — Misión huérfana 42a03092 | Pendiente Externo | 🔴 1 fila en tabla sin match en blob — eliminar antes del flip |
| G-2 — Flip read_from_normalized | Pendiente limpieza huérfana | ⏳ Verde en 2/3 parejas — espera DELETE huérfana |

---

## 🔵 P2 — Deuda técnica (próxima sesión disponible)

### P2-1 · Política de retención en `app_data_backups` — ✅ COMPLETADO (28/05) · 663 → 12 backups

**Síntoma:** La tabla crece indefinidamente con cada save. Con dual-write activo y 1500ms debounce, cada pareja genera ~80 backups por día de uso activo.

**Solución:** Mantener solo las últimas 50 filas por pareja. Ejecutar manualmente o con pg_cron cada semana.

```sql
-- Ver cuántas filas hay por pareja actualmente
SELECT couple_id::text, COUNT(*) as backups, MIN(created_at) as oldest, MAX(created_at) as newest
FROM app_data_backups
GROUP BY couple_id
ORDER BY COUNT(*) DESC;

-- Política de retención: mantener solo las últimas 50 por pareja
-- (esto borra las más antiguas)
DELETE FROM app_data_backups
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY couple_id ORDER BY created_at DESC) AS rn
    FROM app_data_backups
  ) ranked
  WHERE rn > 50
);

-- Verificar resultado
SELECT couple_id::text, COUNT(*) as backups_restantes
FROM app_data_backups
GROUP BY couple_id;
```

**Confirmar al equipo:** cuántas filas había antes y cuántas quedaron después.

---

## ⚠️ Reglas de oro para el agente SQL

1. **Nunca ejecutar DROP TABLE** salvo indicación explícita y marcada como "SEGURO BORRAR".
2. **Siempre verificar** con el SELECT de verificación incluido en cada sección antes de reportar éxito.
3. **Si algo falla**, reportar el error exacto al owner antes de continuar. No improvisar soluciones.
4. **Additive-only**: si una columna o tabla ya existe, `IF NOT EXISTS` la omite sin error. Eso es correcto.
5. **El orden importa**: D-1 (`is_couple_member`) debe ejecutarse antes que D-2, D-3, D-4, D-5.
6. **Sprint D no empieza** hasta que el owner confirme que el backup de C-1 está hecho y guardado.
