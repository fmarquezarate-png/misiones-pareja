# CLAUDE.md — Contexto y reglas del proyecto

> Documento maestro. Lo lee Claude al iniciar cualquier sesión.
> Mantenerlo corto y enlazar al detalle en `docs/`.

---

## 1. Qué es el proyecto

**Misiones de Pareja** — PWA de planificación semanal para parejas (React 18 + Vite 5 + Supabase + Netlify). Single page, sin router, datos compartidos por `coupleId`. Persistencia: blob JSON en `app_data.data` + dual-write a tablas normalizadas (Sprint G en curso).

- **Versión actual:** ver `src/constants.js → APP_VERSION`
- **Branch activo:** `claude/modest-heisenberg-zB9mn`
- **Doc detallado:** [`README.md`](./README.md), [`CHANGELOG.md`](./CHANGELOG.md)

---

## 2. Arquitectura crítica (no romper)

### Dónde vive el estado
Árbol de componentes:
```
AppWithAuth
└── CoupleMissions          ← TODO el estado de negocio vive aquí
    ├── HomeDashboard        ← solo props
    ├── ProfileModal         ← solo props
    ├── StatsView, CalendarView, ChatView, GastosView
```

**Regla de oro** (origen: bug `pushNudgeVisible` v3.8.8): si más de un componente toca un estado, vive en el ancestro común. `ProfileModal` NUNCA declara estado push — recibe `pushSupported`, `pushSubscribed`, `pushLoading`, `pushError`, `onPushToggle` como props desde `CoupleMissions`.

### Save model
- Blob completo en `app_data.data` con CAS (`save_app_data_cas` RPC, flag `cas_version_check`)
- Dual-write activo a `missions`, `goals`, `couple_settings`, `week_photos` (flag `dual_write_normalized`)
- Source-of-truth = blob hasta Sprint G-2 (flip de read)

### Realtime + race conditions
- `subscribeToUpdates` ignora updates remotos si `hasPendingSave()` devuelve true
- Si rompés este contrato, el partner pisa cambios sin guardar

### Tipos sutiles
- `completedAt`: puede ser `number` (Date.now()) o `string` (ISO). Manejar ambos siempre:
  ```js
  if (typeof m.completedAt === 'string') return m.completedAt.slice(0,10);
  if (typeof m.completedAt === 'number') return new Date(m.completedAt).toISOString().slice(0,10);
  ```

### Validación en bordes
- `importData` (supabase.js): valida `weeks` objeto + `missions` array
- `isValidAppData`: gate antes de cada save — no quitar

---

## 3. Reglas técnicas obligatorias

### Lint (no bypass)
```bash
npm run lint        # 0 errores requeridos
npm run build       # llama a eslint antes de vite build
```
Reglas activas en `eslint.config.js`:
- `no-undef: error` → atrapa variables fuera de scope (origen: bug push)
- `react-hooks/rules-of-hooks: error` → hooks deben estar antes de cualquier early return
- `react-hooks/exhaustive-deps: warn`

### Versionado
- Bump `APP_VERSION` en `src/constants.js` por cada lote
- **Entrada en `CHANGELOG.md` OBLIGATORIA** al mismo tiempo que el bump — no en sesión posterior
- El array `CHANGELOG` en `constants.js` y el archivo `CHANGELOG.md` deben estar sincronizados antes de cada `git push`
- Patch para fixes, minor para features

### Commits
- Prefijo: `fix:`, `feat:`, `refactor:`, `docs:`
- Incluir session ID al final
- Branch: `claude/<descripcion>-<sessionId>`

---

## 4. Equipo de agentes

El proyecto se trabaja por roles que dialogan en cada sesión. Cada agente tiene su propio `.md` con personalidad, conocimiento y forma de trabajo:

| Agente | Rol en una frase | Doc |
|--------|------------------|-----|
| **Coordinador** | Guardián del scope, dice NO temprano | [`docs/agents/coordinador.md`](./docs/agents/coordinador.md) |
| **Programador** | Pragmatismo con código real | [`docs/agents/programador.md`](./docs/agents/programador.md) |
| **Analista** | Voz incómoda, señala lo que nadie mira | [`docs/agents/analista.md`](./docs/agents/analista.md) |
| **Forense** | Detiene el ciclo "fix → deploy → no funciona" exigiendo datos crudos antes de actuar | [`docs/agents/forense.md`](./docs/agents/forense.md) |
| **Experto en Datos** | Guardián de la integridad SQL/RLS | [`docs/agents/experto-en-datos.md`](./docs/agents/experto-en-datos.md) |
| **UI/UX** | Filtro de "Marta en la línea 5" | [`docs/agents/ui-ux.md`](./docs/agents/ui-ux.md) |
| **Redactor** | Documenta cada cambio en CHANGELOG | [`docs/agents/redactor.md`](./docs/agents/redactor.md) |
| **Externo (Supabase)** | Operario SQL/RLS/Edge Functions en consola Supabase | [`docs/agents/externo-supabase.md`](./docs/agents/externo-supabase.md) |
| **Scanner** | Scan sistemático de bugs con agentes paralelos; triaje P0/P1/P2 | [`docs/agents/scanner.md`](./docs/agents/scanner.md) |

### Distribución de trabajo (regla de oro del Coordinador)
- **Equipo** (agentes Claude) resuelve la mayor cantidad posible
- **Externo** recibe solo lo que requiere consola Supabase (SQL, Edge Functions, logs)
- **Usuario** hace el mínimo, siempre no-técnico, siempre con instrucciones al detalle

### Cómo añadir un agente nuevo
1. Crear `docs/agents/<nombre>.md` siguiendo el template de [`docs/agents/README.md`](./docs/agents/README.md)
2. Añadir fila a la tabla de arriba
3. Si introduce nueva habilidad (skill), añadir bullet a su `.md` en sección "Habilidades"
4. Commit con `docs: add agent <nombre>` y mención en CHANGELOG

---

## 5. Regla de oro: todo error → medida preventiva permanente

Cada bug en producción se convierte en regla técnica o arquitectónica aquí. Lista histórica:

| Bug | Medida añadida |
|-----|----------------|
| `Can't find variable: pushNudgeVisible` | ESLint `no-undef: error` + regla de scope en sección 2 |
| Hooks tras early return en `DevBackfillPanel` | ESLint `react-hooks/rules-of-hooks: error` |
| `completedAt` rompía racha con timestamps | Manejo dual en sección 2 + ejemplo |
| `importData` aceptaba estructura corrupta | Validación de `missions` array en `supabase.js` |
| 4 versiones intentando fix push sin ver el error real | Agente Forense + Edge Functions con `?probe=1` y `?diagnose=1` que devuelven `{stage, error, name}` en JSON. Regla: si un bug persiste tras 2 intentos, llamar al Forense antes de deployar otro fix. |
| `CHANGELOG.md` desincronizado 8 versiones respecto a `constants.js` | Regla de versionado en sección 3: `CHANGELOG.md` es obligatorio en el mismo commit que el bump de `APP_VERSION`. El Redactor verifica antes de cada push. |
| `<ConfirmDialog />` declarado via `useConfirm()` pero nunca renderizado en JSX — `confirm()` invocaba el hook pero no mostraba UI. Los diálogos "¿Eliminar esta tarea?" y "¿Eliminar este logro?" ejecutaban el borrado sin confirmación visible desde v3.5+. | `useConfirm()` devuelve `{ confirm, ConfirmDialog }`. **`ConfirmDialog` debe renderizarse en el JSX del mismo componente** que llama al hook. ESLint `no-unused-vars` lo atrapa si se olvida. Ejemplo correcto: añadir `<ConfirmDialog />` al final del return del componente. |
| `read_from_normalized: true` con tabla `missions` congelada en backfill (20/05) → semanas posteriores al backfill aparecen vacías. El fallback de v3.8.24 (tabla con 0 filas) no cubre tabla con datos obsoletos. | `read_from_normalized` → **`false` permanente** hasta que exista sync servidor real. La tabla `missions` es analytics futura, no fuente de verdad. Documentado abajo en sección 7. |
| `saveWithCAS` corría en paralelo con `saveWithRetry` — aunque el CAS detectase conflicto, el save normal sobreescribía igualmente. El flag `cas_version_check: true` era decorativo. Confirmado por 2 misiones reales perdidas del blob (26/05/2026). | `saveWithCAS` debe ser el único save cuando CAS está activo — `saveWithRetry` solo corre en el `else` (flag off, versión null, o error de red). Control flow corregido en v3.9.6. Regla: nunca ejecutar dos paths de save en paralelo. |
| `goalRowToBlob` devolvía `row.id` (UUID de la tabla) en lugar de `row.blob_id` (nanoid) — con `read_from_normalized: true`, toda la vinculación misión↔meta se rompía silenciosamente (v4.0.0 a v4.0.2). Las barras de progreso y `hasGoal` en telemetría siempre devolvían falso. | `goalRowToBlob` debe mapear `id: row.blob_id ?? row.id`. Mismo patrón que `missionRowToBlob`. Regla: **cualquier función `*RowToBlob` debe usar `blob_id` como `id`**, no el UUID del DB. |
| `saveTimerRef.current = null` se limpiaba cuando el timer de 700ms disparaba, antes de que el `saveWithCAS`/`saveWithRetry` async terminase. `hasPendingSave()` devolvía `false` en esa ventana → realtime podía sobreescribir un save en vuelo. | Nuevo `isSavingRef.current = true` al inicio del callback; se limpia en cada `.then()` y `.catch()` de todos los paths de save. `hasPendingSave()` = `pendingSave \|\| !!saveTimerRef.current \|\| isSavingRef.current`. |
| `sendContextualPush` disparaba inmediatamente tras `patchWeek()`, 700ms antes de que el blob llegase a DB. Partner recibía la notificación, abría la app y veía datos desactualizados. | Todas las llamadas a `sendContextualPush` en mutaciones del blob tienen `setTimeout(..., 1500)` — cubre el debounce de 700ms más el tiempo de red del save. |
| v4.0.0 se lanzó sin verificar que v3.x funcionara correctamente en producción. Bugs acumulados de v4.0.0 a v4.0.3: `goalRowToBlob`, `saveTimerRef` race, `isValidAppData` goals, `handleImport` CAS, push timing, open redirect, SW hang, nudge dismiss. | **Regla de QA**: antes de cambiar cualquier flag de arquitectura (`read_from_normalized`, `dual_write_normalized`, `cas_version_check`), ejecutar el Scanner para verificar que los paths de lectura/escritura que usa el flag no tengan bugs activos. No flipear flags sin Scanner sign-off. |

---

## 6. Estado de la tabla `missions` — decisión arquitectónica (actualizado 26/05/2026)

La tabla `missions` tiene **dual-write activo desde v3.9.2** (23/05). El backfill del Sprint D (20/05) tenía 252 filas. Con el dual-write, cada nueva misión, borrado y cambio de status se propaga en tiempo real a la tabla.

**Estado actual (26/05) — Sprint G-2 COMPLETO:**
- `dual_write_normalized: true` — activo y cableado. `insertNormalizedMission` / `deleteNormalizedMission` / `updateNormalizedMissionStatus` se llaman desde App.jsx en cada mutación.
- `read_from_normalized: true` — **ACTIVO desde v4.0.0**. La tabla `missions` es fuente de verdad para lectura. Blob sigue siendo fuente de escritura (dual-write). Consistencia verificada: 222 tabla / 220 blob (2 extra = misiones recuperadas que el blob había perdido).
- Safety check permanente en `loadFromNormalized`: si tabla < 80% del blob → fallback automático al blob.

**Riesgo residual resuelto:** `saveWithCAS` es el único path de save cuando `cas_version_check: true` y la versión está cargada. La tabla `missions` actuó como red de seguridad el 25/05 cuando el blob perdió 2 misiones por race condition — esas misiones se recuperaron con el flip del flag.

**Riesgo principal del sistema:** el blob sigue siendo la fuente de escritura. Si un save corrupto pasa `isValidAppData()`, los datos se pierden. Snapshot automático activo (trigger `backup_app_data` en Supabase, corregido 26/05 para incluir `couple_id`).

---

## 7. Documentos referenciados

- [`README.md`](./README.md) — overview público, tech stack
- [`CHANGELOG.md`](./CHANGELOG.md) — historia versión por versión
- [`TAREAS_SQL_AGENTE_SUPABASE.md`](./TAREAS_SQL_AGENTE_SUPABASE.md) — backlog del Externo
- [`WORKSHOP_v4_INFORME_EJECUTIVO.md`](./WORKSHOP_v4_INFORME_EJECUTIVO.md) — visión de los 5 expertos (origen de los perfiles de agente)
- [`ANALISIS_TECNICO_2026-05-14.md`](./ANALISIS_TECNICO_2026-05-14.md) — auditoría técnica
- `docs/agents/*.md` — perfil por agente
