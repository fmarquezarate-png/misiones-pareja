# INFORME DE SESIÓN DE ANÁLISIS TÉCNICO
## Shared Calendar — Misiones Pareja
### Debate entre Expertos y Plan de Acción Final
**Fecha:** 14 de mayo de 2026 | **Versión analizada:** v3.3.5

---

# ACTO 1 — EL DEBATE

---

## RONDA 1: ¿Enviar `updated_at` en el upsert o no?

**G (Experto Git/Código):** Mi posición es clara: separación de responsabilidades. El cliente no debe gestionar timestamps del servidor. El reloj del móvil puede estar mal configurado, en zona horaria incorrecta, o manipulado. Si dejamos que el cliente envíe `updated_at`, confiamos en un dato que no controlamos. El upsert actual envía solo `{ id, data }` y deja que PostgreSQL gestione sus propios metadatos. Principio de mínimo privilegio.

**S (Experto Supabase):** Completamente de acuerdo en que el cliente NO debe enviar `updated_at`. Mi acusación va en dirección contraria: el problema es que `updated_at` tampoco se actualiza en el servidor. La columna tiene `DEFAULT now()` que funciona en INSERT, pero en UPDATE no hay ningún trigger BEFORE UPDATE. Resultado: `updated_at` siempre muestra la fecha de creación, nunca la última modificación. La columna está técnicamente rota para su propósito.

**G:** Eso es un punto válido. Asumí que `DEFAULT now()` cubría ambos casos. No es así en PostgreSQL puro — los defaults solo aplican a INSERT.

**M (Mediador) — VEREDICTO:** S tiene razón, G tenía una premisa incompleta. El principio de G (cliente no envía timestamps) es correcto y se mantiene. Pero falta el trigger BEFORE UPDATE en `app_data`. Sin él, `updated_at` es inútil. Solución: un trigger de una línea. Coste cero, impacto alto.

---

## RONDA 2: El falso save en App.jsx línea 862

**S:** Hay 2.445 backups sin `couple_id`. Una parte significativa viene de este fragmento:

```javascript
if (isRealData) await saveData(base, coupleId);
```

Se ejecuta en CADA carga de sesión aunque no haya cambiado nada. El flujo: usuario abre app → se carga dato de Supabase → se vuelve a guardar ese mismo dato → se crea backup. Es un loop de escritura innecesario con efectos reales en la BD.

**G:** Hay contexto que defiende esa línea. El propósito es garantizar que si hay una migración de schema (`seedVersion` cambió), el dato upgradado se persiste inmediatamente. Sin esa línea, el dato migrado podría perderse si el usuario cierra antes de hacer cualquier cambio.

**S:** La intención es válida, pero la condición es demasiado amplia. `isRealData` es `true` en el 99% de sesiones normales. El save debería ocurrir SOLO cuando `seedVersion` realmente cambió.

**M — VEREDICTO:** Ambos tienen razón en partes distintas. La corrección: añadir flag `didMigrate` que sea `true` solo cuando se detecta `seedVersion` antigua. El save se condicionaría a `if (isRealData && didMigrate)`. Elimina el 99% de saves espurios manteniendo la protección de migraciones.

---

## RONDA 3: La race condition Realtime vs debounce

**G:** Reconozco este bug. Es una stale closure clásica en React. El `saveTimerRef` captura `next` en el cierre del debounce de 700ms. Si durante esos 700ms llega un evento Realtime del partner, el handler llama a `setData(() => remoteData)` — reemplaza el estado completo. Luego el timer sube el dato local (pre-Realtime) a Supabase, sobreescribiendo los cambios del partner. Silencioso y destructivo.

**S:** ¿Por qué el handler Realtime usa `setData(() => remoteData)` en lugar de merge inteligente? Si usuario A completa una tarea y usuario B añade un evento al mismo tiempo, debería combinarse, no el último borra al primero.

**G:** Un merge profundo de JSON arbitrario es complejo. Sin IDs de operación (CRDTs), sin vector clocks, sin `lastModifiedBy` por entidad, es imposible hacerlo bien. La solución pragmática: al recibir Realtime, cancelar el timer del debounce antes de aplicar el dato remoto. `clearTimeout(saveTimerRef.current)`. El dato del partner "gana" y el cambio local pendiente se pierde — pero al menos no sobreescribes al partner.

**M — VEREDICTO:** G tiene la solución pragmática correcta. Merge completo es 3 semanas de ingeniería con riesgo de regresión alto. `clearTimeout` es 1 línea que resuelve el peor caso. La arquitectura de merge con CRDTs va al backlog de Fase 3.

---

## RONDA 4: RLS y seguridad

**S:** La política `USING: true` en `app_data` significa que cualquier usuario autenticado puede ejecutar `SELECT * FROM app_data` y ver todos los datos de todas las parejas. No necesita conocer el `couple_id` — `cm_select` con `USING: true` permite enumerar todos los `couple_id` del sistema. Con dos queries triviales, cualquier cuenta Google podría exfiltrar todos los datos de todas las parejas.

**G:** Contextualicemos el riesgo. Esta no es una app pública con miles de usuarios desconocidos. El vector de ataque requiere: conocer la app, crear cuenta Google específicamente para atacarla, saber ejecutar queries a Supabase. Hoy el riesgo real es bajo.

**S:** El riesgo no es solo el atacante deliberado. Con `USING: true`, un bug en el código del cliente — un `coupleId` undefined, un selector equivocado — puede hacer que la app lea o sobreescriba datos de otra pareja accidentalmente. El RLS mal configurado amplifica cualquier bug de código en una violación de datos.

**M — VEREDICTO:** S tiene razón tanto en el diagnóstico como en la urgencia. No es solo el atacante externo — un bug inocente del cliente puede causar corrupción cross-pareja. El SQL de corrección son 4 líneas. Coste: 5 minutos. No ejecutarlo sería negligencia técnica.

---

## RONDA 5: REPLICA IDENTITY

**S:** Este es potencialmente el bug más silencioso. Sin `REPLICA IDENTITY FULL`, los eventos UPDATE de Realtime solo incluyen la PK en `payload.new`, no las columnas modificadas. Para `app_data`, el payload podría llegar como `{ id: "uuid..." }` sin el campo `data`. El cliente hace `const newData = payload.new?.data` — si `data` es undefined, no llama a `onUpdate`. El partner no ve el cambio. Silenciosamente.

**G:** ¿Estás diciendo que el Realtime podría estar completamente roto en producción y no lo sabríamos?

**S:** Exactamente. No hay error, no hay warning. La pareja piensa que hay lag cuando en realidad los eventos llegan vacíos. Dos líneas de SQL lo corrigen:
```sql
ALTER TABLE app_data REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
```

**M — VEREDICTO:** Acción inmediata sin debate. Potencialmente explica quejas de "el calendario de mi pareja no se actualiza". Segunda prioridad en Fase 1.

---

# ACTO 2 — VEREDICTOS DEL MEDIADOR

| # | Tema | Ganador | Acción |
|---|------|---------|--------|
| V1 | `updated_at` en el payload | G (principio) + S (implementación) | No enviarlo; crear trigger BEFORE UPDATE |
| V2 | Falso save línea 862 | Ambos parcialmente | Añadir flag `didMigrate` |
| V3 | Race condition Realtime vs debounce | G | `clearTimeout` en handler Realtime |
| V4 | RLS roto | S | SQL de RLS correcto, PRIORIDAD 1 |
| V5 | REPLICA IDENTITY | S | Dos ALTER TABLE, hoy |

---

# ACTO 3 — PLAN DE ACCIÓN FINAL

---

## FASE 1 — HOY (30 minutos, solo SQL en Supabase)

### Paso 1.1 — Corregir RLS de `app_data` (CRÍTICO — seguridad)

```sql
DROP POLICY IF EXISTS "Acceso total autenticados app_data" ON app_data;

CREATE POLICY "app_data_select"
  ON app_data FOR SELECT TO authenticated
  USING (
    id IN (SELECT couple_id::text FROM couple_members WHERE user_id = auth.uid())
  );

CREATE POLICY "app_data_write"
  ON app_data FOR ALL TO authenticated
  USING (
    id IN (SELECT couple_id::text FROM couple_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    id IN (SELECT couple_id::text FROM couple_members WHERE user_id = auth.uid())
  );
```

### Paso 1.2 — Corregir RLS de `couple_members` (CRÍTICO — privacidad)

```sql
DROP POLICY IF EXISTS "cm_select" ON couple_members;

CREATE POLICY "cm_select"
  ON couple_members FOR SELECT TO authenticated
  USING (
    couple_id IN (SELECT couple_id FROM couple_members WHERE user_id = auth.uid())
  );
```

### Paso 1.3 — REPLICA IDENTITY FULL (CRÍTICO — Realtime funcional)

```sql
ALTER TABLE app_data REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
```

### Paso 1.4 — Trigger `updated_at` en `app_data` (IMPORTANTE)

```sql
DROP TRIGGER IF EXISTS set_app_data_updated_at ON app_data;
CREATE TRIGGER set_app_data_updated_at
  BEFORE UPDATE ON app_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### Paso 1.5 — Verificación

```sql
-- Confirmar políticas
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('app_data', 'couple_members')
ORDER BY tablename, policyname;

-- Confirmar REPLICA IDENTITY ('f' = FULL)
SELECT relname, relreplident FROM pg_class
WHERE relname IN ('app_data', 'messages');

-- Confirmar trigger
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'app_data';
```

---

## FASE 2 — ESTA SEMANA (cambios en el código)

### Cambio 2.1 — Cancelar debounce al recibir Realtime (resuelve race condition)

En el `useEffect` del Realtime en App.jsx, añadir `clearTimeout(saveTimerRef.current)` antes de `setData`:

```javascript
const channel = subscribeToUpdates(coupleId, remoteData => {
  if (remoteData) {
    clearTimeout(saveTimerRef.current); // ← AÑADIR ESTA LÍNEA
    if (notifSettingsRef.current?.partnerChanges && document.visibilityState!=="visible") {
      showNotif("📅 Shared Calendar", "Tu pareja actualizó el calendario", {tag:"partner-update"});
    }
    setData(() => remoteData);
  }
});
```

### Cambio 2.2 — Condicionar save post-carga solo a migraciones reales

En el useEffect de inicialización de App.jsx:

```javascript
// Añadir flag antes del bloque de migración
let didMigrate = false;
if (base) {
  if (!base.seedVersion || base.seedVersion < SEED_VERSION) {
    base = { ...SEED, settings: base.settings || SEED.settings,
             goals: base.goals || SEED.goals,
             weeks: { ...SEED.weeks, ...base.weeks },
             seedVersion: SEED_VERSION };
    didMigrate = true;
  }
}
// ...
if (isRealData && didMigrate) await saveData(base, coupleId); // ← solo si hubo migración
```

### Cambio 2.3 — Flush al pasar la app a background (iOS)

Añadir nuevo useEffect junto a los listeners de online/offline:

```javascript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden' && saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      if (dataRef.current && coupleId && isValidAppData(dataRef.current)) {
        saveWithRetry(dataRef.current, coupleId).catch(() => {});
      }
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [coupleId]);
```

Requiere añadir `const dataRef = useRef(data)` y sincronizarlo: `useEffect(() => { dataRef.current = data; }, [data])`.

### Cambio 2.4 — Restaurar verificación por `updated_at` en forcePush

Una vez que Fase 1 esté ejecutada (trigger activo), `updated_at` ya es fiable. Restaurar:

```javascript
// En forcePush, cambiar la verificación de weekCount por timestamp real:
const { data: row, error: readErr } = await supabase
  .from("app_data")
  .select("updated_at")
  .eq("id", coupleId)
  .single();
if (readErr || !row) throw new Error("Guardado pero sin confirmación: " + (readErr?.message || "sin datos"));
const savedAt = new Date(row.updated_at);
const diffSec = Math.round((Date.now() - savedAt.getTime()) / 1000);
const timeStr = savedAt.toLocaleTimeString("es-ES");
if (diffSec > 30) throw new Error(`updated_at tiene ${diffSec}s — el write no se aplicó. Posible RLS o sesión expirada.`);
showSyncMsg(`✅ Guardado · ${timeStr} (hace ${diffSec}s)`);
```

---

## FASE 3 — PRÓXIMAS 2 SEMANAS (mejoras estructurales)

| Prioridad | Mejora | Impacto | Esfuerzo |
|-----------|--------|---------|---------|
| 1 | Merge de estados Realtime (delta `payload.old` vs `payload.new`) | Alto | 3-5 días |
| 2 | Migrar `messages.couple_id` de `text` a `uuid` | Medio | 2 días |
| 3 | Limpiar 2.445 backups huérfanos | Bajo | 1 hora SQL |
| 4 | Índice compuesto `messages(couple_id, created_at DESC)` | Medio-performance | 30 min |
| 5 | Test integración Realtime (detectar payload vacío) | Alto a largo plazo | 3 días |
| 6 | Rate limiting en `joinCouple` | Bajo-Medio | 1 día |

---

# ACTO 4 — ESTADO ACTUAL DEL SISTEMA

| Componente | Estado Actual | Estado Objetivo | Fase |
|-----------|--------------|----------------|------|
| RLS `app_data` | 🔴 ROTO — acceso cross-pareja | Política por `couple_members` | FASE 1 |
| RLS `couple_members` | 🔴 ROTO — expone todos los couple_id | Solo tu propia pareja | FASE 1 |
| REPLICA IDENTITY `app_data` | 🔴 PROBABLEMENTE ROTO | FULL | FASE 1 |
| Trigger `updated_at` en `app_data` | 🔴 AUSENTE | BEFORE UPDATE funcional | FASE 1 |
| Race condition Realtime vs debounce | 🟡 BUG ACTIVO | clearTimeout en handler | FASE 2 |
| Falso save en carga (línea 862) | 🟡 BUG ACTIVO | Condicionado a `didMigrate` | FASE 2 |
| `visibilitychange` handler (iOS) | 🟡 AUSENTE | Flush al background | FASE 2 |
| Backup sin `couple_id` | 🟡 DEUDA TÉCNICA | No crear sin couple_id | FASE 2 |
| `messages.couple_id` como text | 🟡 DEUDA TÉCNICA | Migrar a uuid | FASE 3 |
| Merge de estados Realtime | 🟡 LIMITACIÓN CONOCIDA | Delta con REPLICA IDENTITY FULL | FASE 3 |
| Debounce 700ms | 🟢 CORRECTO | Mantener | — |
| Arquitectura offline-first | 🟢 CORRECTO | Mantener | — |
| Retry con backoff exponencial | 🟢 CORRECTO | Mantener | — |
| `updated_at` fuera del payload cliente | 🟢 CORRECTO | Mantener | — |

---

## Resumen para el usuario final

**¿Qué siente la pareja hoy?**
Los cambios de un partner a veces no aparecen en el móvil del otro. En iOS, si se cierra rápido, puede perderse un cambio. Al abrir la app hay un parpadeo ocasional.

**Tras Fase 1 (30 min de SQL):** Las actualizaciones del partner llegarán de forma fiable. Los datos de otras parejas estarán protegidos correctamente.

**Tras Fase 2 (código):** La app dejará de sobreescribir cambios del partner cuando ambos editan al mismo tiempo. En iOS guardará antes de cerrarse. El parpadeo de carga desaparecerá.

**Lo que ya funciona bien y no se toca:** diseño offline-first, backup en localStorage, debounce de 700ms, retry con backoff, arquitectura Supabase como fuente de verdad. Son decisiones técnicas sólidas.

---

*Documento generado el 14 de mayo de 2026. Análisis basado en v3.3.5 del repositorio y configuración Supabase del proyecto `txnsotchljquilfmdpdy`.*
