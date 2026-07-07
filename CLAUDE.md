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
- El array `CHANGELOG` en `src/data/changelogData.js` (movido fuera de `constants.js` en v4.17.1 para no cargarlo en el bundle inicial — ver sección 5) y el archivo `CHANGELOG.md` deben estar sincronizados antes de cada `git push`
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
| **Coordinador** | Guardián del scope, dice NO temprano, ejecuta el Protocolo de flip | [`docs/agents/coordinador.md`](./docs/agents/coordinador.md) |
| **Programador** | Pragmatismo con código real, no activa flags sin sign-off completo | [`docs/agents/programador.md`](./docs/agents/programador.md) |
| **Analista** | Voz incómoda con poder de veto técnico; audita paths antes de flip | [`docs/agents/analista.md`](./docs/agents/analista.md) |
| **Forense** | Diagnóstico por evidencia — reactivo y pre-deploy | [`docs/agents/forense.md`](./docs/agents/forense.md) |
| **Experto en Datos** | Guardián de la integridad SQL/RLS — audita triggers en cada lock | [`docs/agents/experto-en-datos.md`](./docs/agents/experto-en-datos.md) |
| **UI/UX** | Filtro de "Marta en la línea 5" | [`docs/agents/ui-ux.md`](./docs/agents/ui-ux.md) |
| **Redactor** | Documenta cada cambio en CHANGELOG | [`docs/agents/redactor.md`](./docs/agents/redactor.md) |
| **Externo (Supabase)** | Operario SQL/RLS/Edge Functions en consola Supabase | [`docs/agents/externo-supabase.md`](./docs/agents/externo-supabase.md) |
| **Scanner** | Scan sistemático de bugs con agentes paralelos; triaje P0/P1/P2 | [`docs/agents/scanner.md`](./docs/agents/scanner.md) |
| **QA** | Red de seguridad pre-deploy — checklists de regresión y contratos de comportamiento | [`docs/agents/qa.md`](./docs/agents/qa.md) |
| **DevOps** | Dueño del pipeline y paridad repo↔producción | [`docs/agents/devops.md`](./docs/agents/devops.md) |

### Distribución de trabajo (regla de oro del Coordinador)
- **Equipo** (agentes Claude) resuelve la mayor cantidad posible
- **Externo** recibe solo lo que requiere consola Supabase (SQL, Edge Functions, logs)
- **Usuario** hace el mínimo, siempre no-técnico, siempre con instrucciones al detalle

### Gate de deploy — NUNCA mergear a main si:
1. Hay tareas Externo marcadas como **PREREQUISITO BLOQUEANTE** sin confirmación escrita del Externo
2. El Scanner no ha hecho sign-off explícito del path de arquitectura que se activa
3. Hay un flag de arquitectura (`read_from_normalized`, `cas_version_check`, `dual_write_normalized`) que se flipea por primera vez sin verificación en staging

**El Coordinador es el único que puede levantar este gate.** Si no hay Coordinador activo, el gate no se levanta.

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
| `sendContextualPush` disparaba inmediatamente tras `patchWeek()`, 700ms antes de que el blob llegase a DB. Partner recibía la notificación, abría la app y veía datos desactualizados. Primer parche (v3.x): `setTimeout(..., 1500)` — frágil, asumía que el save siempre tarda <1.5s. | **Solución de raíz (v4.2.3):** cola post-save `afterSaveRef` + helper `runAfterSave(fn)`. El push se encola y se dispara en el bloque de éxito de `runSave`, justo tras confirmar el blob en DB. Nunca depende del reloj. Regla: **cualquier efecto que requiera que la pareja lea datos frescos (push, etc.) va en `runAfterSave`, jamás en `setTimeout`.** |
| v4.0.0 se lanzó sin verificar que v3.x funcionara correctamente en producción. Bugs acumulados de v4.0.0 a v4.0.3: `goalRowToBlob`, `saveTimerRef` race, `isValidAppData` goals, `handleImport` CAS, push timing, open redirect, SW hang, nudge dismiss. | **Regla de QA**: antes de cambiar cualquier flag de arquitectura (`read_from_normalized`, `dual_write_normalized`, `cas_version_check`), ejecutar el Scanner para verificar que los paths de lectura/escritura que usa el flag no tengan bugs activos. No flipear flags sin Scanner sign-off. |
| `pendingSave` stale closure en `subscribeToUpdates` — `() => pendingSave || ...` capturaba el valor inicial (false) del closure al montar el effect `[coupleId]`. Estado posterior nunca se reflejaba; la parte de guard por `pendingSave` nunca funcionó. | **Regla de closures**: cualquier estado React usado en un callback dentro de un `useEffect` con deps que no incluyen ese estado debe tener un `ref` espejo sincronizado via `useEffect([estado])`. En este proyecto: `pendingSaveRef`, `pushSubscribedRef`. Nunca leer estado directamente en closures de larga vida. |
| `compressAvatar` (ProfileModal) — `new Promise(resolve => ...)` sin `reject`. Si imagen corrupta o formato inválido, `img.onerror` nunca se llamaba y el Promise colgaba indefinidamente. | **Regla de Promises**: `new Promise` siempre recibe `(resolve, reject)`. Todos los handlers de error asíncronos (`img.onerror`, `reader.onerror`, `video.onerror`) deben llamar a `reject`. El caller debe usar `try/catch/finally`. |
| `getSession().then(resolve)` sin `.catch()` — error de red o CORS al iniciar dejaba la app congelada en pantalla `checking` sin ruta de salida. | Toda cadena Promise de inicialización de app lleva `.catch(err => handleFallback(err))` explícito. En `AppWithAuth`: `getSession().then(resolve).catch(() => resolve(null))`. |
| `save_app_data_cas` RPC retornaba 400 — la función SQL usaba `WHERE couple_id = ...` pero `app_data` usa `id` como PK (tipo text). El CAS era decorativo: `saveWithCAS` siempre fallaba con error y hacía fallback a `saveWithRetry`. Corregido por Externo 26/05. | Cualquier cambio al schema de `app_data` debe verificar los nombres exactos de columnas en las RPCs que la tocan (`save_app_data_cas`, `bump_app_data_version`). No asumir que el schema de diseño coincide con el schema real. |
| `doSaveWithRetry` dejaba `dataVersionRef` obsoleto tras guardar — el trigger DB incrementaba la versión, el cliente no lo sabía, el siguiente save CAS detectaba mismatch y descartaba los cambios del usuario silenciosamente. | Cualquier path de save que bypass CAS (saveWithRetry, importData, handleImport) debe recargar `dataVersionRef` con `loadDataWithVersion` después de guardar. Si la recarga falla, `dataVersionRef.current = null` → siguiente save usa doSaveWithRetry (seguro). |
| Edge Function `send-push` bloqueada por CORS — el SDK de Supabase JS añade `x-client-info` y `apikey` automáticamente en cada `supabase.functions.invoke()`. La función solo declaraba `authorization, content-type` en `Access-Control-Allow-Headers` → preflight `OPTIONS` fallaba → el `POST` nunca llegaba. Corregido por Externo 26/05. | **Regla para Edge Functions**: el header CORS de toda Edge Function que se llame desde el SDK de Supabase JS debe incluir al menos: `'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey'`. Sin `x-client-info` el cliente JS nunca podrá llamar a la función. |
| Triggers de push en `app_data` llamaban a `net.http_post` dentro de la transacción de `save_app_data_cas` (con `FOR UPDATE`). Si la Edge Function tardaba, el lock se extendía → la siguiente SELECT de carga colisionaba → statement timeout → 500 → saves y cargas fallaban intermitentemente. Confirmado en producción 26/05. | **Regla: nunca colocar `net.http_post` o cualquier I/O externo dentro de un trigger que corre en la misma transacción que un `FOR UPDATE` lock.** La solución es deshabilitar los triggers de push en `app_data` (la app ya envía push desde el cliente) y mover el push server-side a una tabla `push_queue` que se procesa fuera de la transacción principal. |
| Service Worker se quedaba en estado `waiting` hasta cerrar todas las pestañas — los usuarios veían "estamos en la última" mostrando v4.0.10 aunque Netlify hubiera deployado v4.0.11. En PWAs instaladas (iOS/Android/Chrome desktop), la pestaña nunca se cierra, así que el SW podía quedarse semanas en waiting. | **Regla de SW**: todo `sw.js` con `injectManifest` debe tener `self.skipWaiting()` en el evento `install` y un listener de mensaje `SKIP_WAITING`. Sin esto, `registerType: 'autoUpdate'` de vite-plugin-pwa no completa el ciclo de update. El listener `controllerchange` en `main.jsx` es necesario pero no suficiente — sin `skipWaiting()` el `controllerchange` nunca se dispara. |
| **Pérdida constante de datos (v4.2.0).** El realtime de la pareja actualizaba `data` pero NO `dataVersionRef` → el siguiente save CAS detectaba un conflicto FALSO (versión local desfasada) → y el cliente DESCARTABA el cambio del usuario haciendo `loadData()+setData(fresh)`. Cada edición posterior a un guardado de la pareja perdía el primer cambio. El RPC `save_app_data_cas` era correcto; el bug era 100% del cliente. | **Reglas de guardado (sección 8 nueva):** (1) `dataVersionRef` DEBE sincronizarse en TODO path que cambie nuestro conocimiento del estado remoto — realtime (`payload.new.version`), visibilitychange, tras cualquier save que bypasse CAS. (2) **Nunca descartar el cambio del usuario en un conflicto CAS** — recargar fresco y RE-APLICAR los mutadores no confirmados encima (rebase, `rebaseMutators`). (3) **Un solo escritor serializado** (`runSave` + `isSavingRef`) — jamás dos paths de save concurrentes. (4) **Los reducers de `update(fn)` DEBEN ser puros** — el rebase los re-ejecuta sobre datos frescos; cualquier efecto (`track`, dual-write, `alert`, push) va en el handler, fuera del reducer. |
| **Ediciones de eventos/tareas no persistían (v4.5.0).** `allDated` usaba `w.weekNumber` directamente; semanas pre-v4.x tienen `weekNumber: undefined` → `isoWeekKey(undefined, yr)` → clave `"2026-Wundefined"` → `patchMissionGlobal` no encontraba la semana → `return d` sin modificar el blob. Los cambios se mostraban localmente hasta el próximo realtime/reload. | `allDated` usa `w.weekNumber ?? parseInt(key.split("-W")[1])`. Además, `resolveWeekKey(d, hint, id)` en `patchMissionGlobal`/`cycleStatusGlobal`/`deleteMissionGlobal`: fast path con hint, scan completo como fallback. Ningún mutador global puede fallar silenciosamente por hint incorrecto. |
| **Agente reportó versión incorrecta de producción (03/06/2026).** Se dijo "producción tiene v4.2.0" cuando las fixes ya estaban mergeadas. Causa: el clone local no había hecho `git fetch`, así que `origin/main` era una foto del pasado. | **Regla DevOps obligatoria**: antes de reportar qué versión corre en producción o comparar ramas, SIEMPRE ejecutar `git fetch origin`. Sin fetch, `git log origin/main` muestra datos stale. Documentado también en `docs/agents/devops.md`. |
| **Pérdida de ediciones de fecha/hora/persona desde la vista de semana actual (v4.5.2, 03/06/2026).** `patchM` — el mutador de campos de la vista principal, el más usado — era el ÚNICO que no llamaba a `updateNormalizedMission`. Un 4º black hole de dual-write que NO estaba en la lista documentada. Con `read_from_normalized: true`, recargar leía la versión vieja de la tabla `missions` y la edición desaparecía. v4.5.0/v4.5.1 arreglaron el path de CalendarView, no este. | (1) `read_from_normalized` → **`false`** (blob como fuente de lectura, que sí tenía todos los datos). (2) `patchM` ahora hace dual-write. (3) **Regla: cualquier mutador que escriba al blob DEBE tener su `*NormalizedMission` correspondiente, sin excepción.** Antes de flipear `read_from_normalized` a true, auditar que los CUATRO paths (`patchM`, `patchMissionGlobal`, `patchAllFutureSeries`, `applyCarryOver`) sincronicen la tabla, y que el schema tenga TODAS las columnas (`endDate`/`endTime`/`goalId` faltan). |
| **Taps "fantasma" en calendario/semana (v4.15.1, 02/07/2026).** El pull-to-refresh (v4.13.0) se armaba con cualquier toque a scrollY 0 y crecía su spacer desde el primer píxel de movimiento. Un tap normal mueve el dedo 2-10px → el contenido se desplazaba EN MITAD del tap → el click aterrizaba en otro elemento. El usuario veía los sparkles (touch registrado) pero el evento no se abría. | **Regla de gestos táctiles**: cualquier handler global de touch que mute layout (spacers, transforms, scroll) DEBE tener una zona muerta (≥15px) que un tap normal nunca supere, y descartar el gesto si el movimiento dominante es de otro eje (conflicto con swipe horizontal de semanas). Nada se mueve en pantalla hasta que el gesto es inequívocamente deliberado. |
| **Apertura lenta en iOS (v4.17.1, 02/07/2026).** Dos problemas de bundling nunca auditados: (1) el array `CHANGELOG` completo (~100KB de texto, todo el historial desde v1.6.0) vivía en `constants.js`, importado eagerly por `SideMenu.jsx` (renderizado en cada pantalla) → se parseaba y ejecutaba en CADA apertura de la app aunque casi nadie abre "Ver cambios". (2) React/React-DOM/Supabase-JS (que casi nunca cambian) estaban mezclados en el mismo chunk que el código propio → cada deploy invalidaba TODO el bundle, forzando a re-descargar y re-parsear ~350KB de librerías sin cambios en cada actualización. | (1) `CHANGELOG` movido a `src/data/changelogData.js`, importado con `import()` dinámico solo cuando se abre el modal de changelog en `SideMenu.jsx`. (2) `vite.config.js` → `build.rollupOptions.output.manualChunks` separa `vendor-react` y `vendor-supabase` del chunk de la app. Resultado medido: el chunk de código propio bajó de 724KB a 273KB minificados. **Regla: cualquier dato estático grande (>10KB) que no se necesite en el primer render debe vivir en su propio módulo con `import()` dinámico, nunca en un archivo importado eagerly por un componente que se monta siempre (`SideMenu`, `Topbar`, etc.).** Antes de cerrar cualquier sprint, revisar `npm run build` por chunks >400KB sin explicación. |
| **Carga infinita en iOS (v4.20.2, 02/07/2026).** WKWebView (motor único de toda PWA en iPhone) puede dejar un `fetch()` colgado PARA SIEMPRE —ni resuelve ni rechaza— tras cold start o al volver de background. El arranque tenía `await`s de red sin timeout: uno colgado congelaba splash/skeletons indefinidamente. Peor aún: un save colgado dejaba `isSavingRef=true` para siempre → todos los saves posteriores encolados en silencio. Y `getMyCoupleId` devolvía `null` tanto para "sin pareja" como para "error de red" → un fallo de red borraba el auth-cache y mandaba a onboarding. Android/desktop no exhiben el cuelgue, por eso era exclusivo de iOS. | **Regla de red**: TODO `await` de red en paths de arranque, guardado o con spinner DEBE ir envuelto en `withTimeout(promise, ms, label)` (`utils.js`) con fallback no destructivo (cache local, login, reintento) — nunca esperar la red sin límite. **Regla de errores**: las funciones de datos distinguen "no existe" (null) de "error de red" (throw); un fallo de red JAMÁS toma decisiones destructivas (borrar cache, cambiar de pantalla, descartar datos). Failsafe absoluto en `index.html`: el splash se auto-retira a los 15s pase lo que pase. |
| **`WrappedModal` crasheaba con "Too many re-renders" (v4.19.1, 02/07/2026, bug preexistente no detectado hasta esta sesión).** `close()` —que llama `setFadeOut(true)`— se invocaba directamente en el cuerpo del render (`if (!hasContent) { close(); return null; }`) sin ningún guard que lo detuviera después de la primera vez. Se disparaba cada vez que `showWeekly` era true pero `computeWeekly(weeks)` devolvía `null` (semana previa sin misiones, o con datos que no calzaban con `prevKey`) — es decir, cualquier lunes en que la semana anterior no tuviera actividades registradas. El error tumbaba el árbol entero hacia el `ErrorBoundary`. Encontrado por casualidad durante testing de una feature no relacionada (el reloj del entorno de test marcaba lunes). | **Regla: nunca llamar una función que hace `setState` directamente en el cuerpo del render, ni siquiera detrás de un `if`.** Toda transición de estado condicionada por el resultado de un cálculo de render (`hasContent`, `isValid`, etc.) va en un `useEffect` con esa condición en el array de dependencias — el cuerpo del render solo debe leer estado y hacer `return`, nunca escribirlo. Este es el mismo bug de fondo que ya cubre la regla de hooks-antes-de-early-return (`DevBackfillPanel`, sección 2), pero para *efectos* en vez de para *hooks*. |
| **Dashboard mostraba "Persona 1"/"Persona 2" y 0 datos en un dispositivo con datos reales (v4.22.2, 07/07/2026).** En el efecto de carga de `CoupleMissions`, `loadData`/`loadFromNormalized` atrapan internamente CUALQUIER error (red, RLS, timeout) y devuelven `null` en vez de lanzar — así que `withTimeout(loadData(...), ...).catch(...)` nunca veía el error, solo `base=null`. Sin backup local usable (dispositivo nuevo, o iOS que borró `localStorage` por inactividad), el código caía a `base = {...SEED}` **sin mostrar ningún error** — el dashboard se renderizaba normal pero vacío, indistinguible de "no tienes datos". Peor: `runSave` solo valida `isValidAppData` (forma correcta), no si los datos son reales — el próximo guardado automático habría sobrescrito la fila real en Supabase con ese blob vacío. | **Regla ampliada de la fila de "Carga infinita en iOS" (v4.20.2):** un fallo de red al cargar datos tampoco puede tomar la decisión de "mostrar un dashboard vacío como si fuera nuevo". Si `loadData` falla y no hay backup local usable, se bloquea con la pantalla de error existente (`setError` + botón "Reintentar") en vez de dejar pasar un `SEED` vacío a `setData`. Si SÍ hay backup local (el fast path ya lo pintó), se mantiene ese dato tal cual — nunca degradarlo a `SEED` ni a la pantalla de error solo porque el refresh de fondo falló. Regla general: **cualquier fallback silencioso a datos "por defecto"/"vacíos" en un path de carga es, de hecho, una decisión destructiva disfrazada — debe bloquear con error visible, no continuar como si nada.** |

---

## 6. Estado de la tabla `missions` — decisión arquitectónica (actualizado 26/05/2026)

La tabla `missions` tiene **dual-write activo desde v3.9.2** (23/05). El backfill del Sprint D (20/05) tenía 252 filas. Con el dual-write, cada nueva misión, borrado y cambio de status se propaga en tiempo real a la tabla.

**Estado actual (03/06 — v4.5.2) — `read_from_normalized` REVERTIDO A FALSE:**
- `dual_write_normalized: true` — activo y cableado. Desde v4.5.2 los CUATRO mutadores de campos sincronizan la tabla: `patchM`, `patchMissionGlobal`, `patchAllFutureSeries`, `applyCarryOver` (antes `patchM` era un black hole no documentado).
- `read_from_normalized: **false**` — **el blob es la única fuente de lectura y escritura.** Se revirtió en v4.5.2 porque `patchM` no dual-escribía → ediciones de fecha/hora de la vista de semana desaparecían al recargar. Además la tabla carece de columnas `endDate`/`endTime`/`goalId`, así que no puede ser fuente completa.
- **Para reactivar `read_from_normalized: true` se requiere:** (1) los 4 mutadores dual-write verificados (hecho en v4.5.2), (2) schema con TODAS las columnas, (3) Scanner sign-off, (4) verificación en staging.
- Safety check permanente en `loadFromNormalized`: si tabla < 80% del blob → fallback automático al blob (solo relevante si se reactiva el flag).

**Riesgo residual resuelto:** `saveWithCAS` es el único path de save cuando `cas_version_check: true` y la versión está cargada. La tabla `missions` actuó como red de seguridad el 25/05 cuando el blob perdió 2 misiones por race condition — esas misiones se recuperaron con el flip del flag.

**Riesgo principal del sistema:** el blob sigue siendo la fuente de escritura. Si un save corrupto pasa `isValidAppData()`, los datos se pierden. Dos capas de backup activas desde 26/05:
- `trg_snapshot_app_data` (BEFORE UPDATE) → guarda estado anterior en `app_data_backups` antes de cada save
- `auto_backup_on_update` (AFTER UPDATE, preexistente) → segunda copia post-save

**Triggers de push en `app_data` — RESUELTO (28/05/2026):** `trg_push_on_app_data_update` y `trg_notify_push_on_app_data_update` deshabilitados por el Externo. `cas_version_check: true` desde v4.1.4. Triggers activos: `auto_backup_on_update`, `set_app_data_updated_at`, `trg_app_data_version`, `trg_snapshot_app_data`.

**⚠️ Black holes de dual-write (28/05/2026):** Tres paths de mutación escriben en blob pero NO sincronizan `missions`:
1. `patchMissionGlobal` — edición de campo en todas las ocurrencias de una misión recurrente
2. `patchAllFutureSeries` — edición de campos desde una fecha hacia adelante en serie recurrente
3. `applyCarryOver` — promoción de misiones no completadas a la semana siguiente

Mientras estos 3 paths no tengan su `updateNormalizedMission`, `read_from_normalized` debe permanecer en `false`. Activarlo causaría que estos cambios desaparezcan al recargar porque la tabla `missions` tiene la versión anterior.

**Push desde cliente — RESUELTO (v4.2.3):** ya no se usa `setTimeout(..., 1500)`. Las notificaciones se encolan con `runAfterSave(fn)` y se disparan en el bloque de éxito de `runSave`, tras confirmar el blob en DB. El push solo llega a la pareja cuando los datos frescos ya son legibles, sin depender del reloj ni de la velocidad de red. La alternativa server-side (tabla `push_queue` vaciada por trigger) sigue siendo válida a futuro pero ya no es necesaria para corregir el timing.

---

## 7. Documentos referenciados

- [`README.md`](./README.md) — overview público, tech stack
- [`CHANGELOG.md`](./CHANGELOG.md) — historia versión por versión
- [`TAREAS_SQL_AGENTE_SUPABASE.md`](./TAREAS_SQL_AGENTE_SUPABASE.md) — backlog del Externo
- [`WORKSHOP_v4_INFORME_EJECUTIVO.md`](./WORKSHOP_v4_INFORME_EJECUTIVO.md) — visión de los 5 expertos (origen de los perfiles de agente)
- [`WORKSHOP_v4_1_ESTADO_ACTUAL.md`](./WORKSHOP_v4_1_ESTADO_ACTUAL.md) — postmortem v4.0.x, revisión de roles, nuevos agentes QA/DevOps
- [`WORKSHOP_v4_2_VISION_2036.md`](./WORKSHOP_v4_2_VISION_2036.md) — visión 10 años por agente, patrones sistémicos
- [`WORKSHOP_v4_3_CONSOLIDADO_2026-05-28.md`](./WORKSHOP_v4_3_CONSOLIDADO_2026-05-28.md) — informe ejecutivo workshop live 28/05 con todos los agentes
- [`ANALISIS_TECNICO_2026-05-14.md`](./ANALISIS_TECNICO_2026-05-14.md) — auditoría técnica
- `docs/agents/*.md` — perfil por agente
