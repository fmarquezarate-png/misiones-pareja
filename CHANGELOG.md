# Changelog — Shared Calendar

Todas las versiones notables de este proyecto están documentadas aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Cada merge a la rama principal incrementa la versión de parche (x.y.**z**).
Los hitos de sprint incrementan la versión menor (x.**y**.0).

---

## [4.0.4] — 2026-05-26 · Fix telemetría + series_blob_id completo

### Bugs corregidos

- **Telemetría completamente muerta desde v3.4.0** — `track.js` hacía flush con `user_id: null` antes de que `setTrackContext()` fuera llamado. La RLS de la tabla `events` (`WITH CHECK: user_id = auth.uid()`) rechazaba silenciosamente cada INSERT. Confirmado por Externo: la policy `events_insert_own` era correcta desde siempre. El problema era el cliente. Fix: `flush()` ahora comprueba `if (!userId || !coupleId)` y reintenta en 3s en lugar de enviar y perder los eventos. **La telemetría real está operativa desde esta versión.**
- **S-1 completo (Externo):** columna `series_blob_id text NULL` añadida a `missions`. `insertNormalizedMission` ya la escribe (v4.0.2) y `missionRowToBlob` ya la lee (v4.0.2). El roundtrip completo de series recurrentes por la tabla normalizada ya está disponible.

---

## [4.0.3] — 2026-05-26 · Scan completo: 9 bugs de raíz (datos, push, seguridad)

### Bugs corregidos (raíz)

- **`goalRowToBlob` UUID vs nanoid** — devolvía `row.id` (UUID del DB) en lugar de `row.blob_id` (nanoid del blob). Con `read_from_normalized: true`, toda vinculación misión↔meta se rompía: el campo `goalId` de una misión (nanoid) nunca coincidía con el `id` de la meta cargada (UUID). Las barras de progreso de metas, el drill-down y la telemetría `mission_completed.hasGoal` devolvían siempre falso.
- **Race condition en save in-flight** — `saveTimerRef.current = null` (v4.0.2) se limpiaba cuando el timer de 700ms disparaba, pero el `saveWithCAS`/`saveWithRetry` async seguía corriendo. `hasPendingSave()` devolvía `false` en esa ventana, permitiendo a realtime sobreescribir el save en vuelo. Nuevo `isSavingRef.current = true` mientras dura la operación; se limpia en cada `.then()` y `.catch()`.
- **`isValidAppData` no validaba goals** — un array corrupto (`goals: "string"`) pasaba la validación y crasheaba en `.map()` en GoalsView y StatsView.
- **`handleImport` no recargaba versión CAS** — tras importar un backup, `dataVersionRef` quedaba en el valor pre-import. El siguiente guardado enviaba la versión incorrecta al RPC y obtenía un conflicto falso.
- **`sendContextualPush` prematuro** — las llamadas en `addMission` y `cycleStatus` disparaban el push inmediatamente tras `patchWeek()`, 700ms antes de que el blob se guardara en DB. El partner recibía la notificación, abría la app y veía datos desactualizados. Ahora retraso de 1500ms.
- **Open redirect en service worker** — `clients.openWindow(targetUrl)` aceptaba URLs externas del payload del push sin validación. Un payload comprometido podía abrir `https://sitio-malicioso.com`. Ahora solo se permiten URLs relativas o del mismo origen.
- **`getCurrentSubscription()` podía colgarse** — `navigator.serviceWorker.ready` nunca rechaza si el SW falla; el Promise colgaba indefinidamente bloqueando el estado del toggle de push. Añadido timeout de 5 segundos.
- **`unsubscribePush` error silencioso** — el `.delete()` de Supabase no chequeaba errores; si fallaba (RLS, red), la suscripción quedaba huérfana en DB con `enabled: true`. Ahora se loguea el error con `console.warn`.
- **`notifGranted` no se actualizaba mid-session** — si el usuario concedía/denegaba permiso desde el diálogo del navegador sin recargar, el estado React no cambiaba. Los recordatorios y briefing podían estar activos/inactivos sin reflejar el permiso real. Añadido listener `permissionchange`.
- **Push nudge dismiss solo en memoria** — `pushNudgeDismissRef` era un `useRef(false)`; al recargar la app, el dismiss se perdía y el nudge reaparecía. Ahora persiste en `localStorage` con clave `mp-push-nudge-dismissed`.

---

## [4.0.2] — 2026-05-26 · Bug scan: realtime, CAS, VAPID, series

### Bugs corregidos (raíz)

- **Realtime guard nunca activo** — `subscribeToUpdates` recibía `{hasPendingSave: () => ...}` (objeto) en lugar de una función directa. `typeof hasPendingSave === 'function'` devolvía `false` siempre, el guard se ignoraba y actualizaciones del partner pisaban cambios locales no guardados. Corregido pasando la función directamente: `() => pendingSave || !!saveTimerRef.current`.
- **`saveTimerRef` sucia tras el timer** — cuando el `setTimeout` de 700ms disparaba, `saveTimerRef.current` seguía apuntando al ID expirado. `hasPendingSave()` devolvía `true` incorrectamente y bloqueaba actualizaciones realtime posteriores durante toda la sesión. Añadido `saveTimerRef.current = null` al inicio del callback.
- **`dataVersionRef` obsoleta en conflicto CAS** — si `loadDataWithVersion` fallaba durante la resolución de un conflicto, el `.catch(() => {})` silencioso dejaba la versión antigua en el ref. El siguiente save enviaba la versión incorrecta al RPC. Ahora el catch setea `dataVersionRef.current = null` para que el próximo save use `saveWithRetry` como fallback seguro.
- **VAPID fallback incorrecto** — la clave pública hardcodeada era `BJ9sW…` (par viejo, sin clave privada en Supabase). Las notificaciones fallaban silenciosamente en entornos sin `VITE_VAPID_PUBLIC_KEY`. Actualizada al par activo `BCoIIBd…`.
- **`seriesId` perdido en roundtrip normalized** — `missionRowToBlob` leía `row.series_id` (columna inexistente); `insertNormalizedMission` no escribía el nanoid de serie. Corregido: escribe `series_blob_id: m.seriesId` y lee `row.series_blob_id`. **Pendiente Externo:** `ALTER TABLE missions ADD COLUMN series_blob_id text;` para que el roundtrip complete.

---

## [4.0.1] — 2026-05-26 · Fix crítico loadData

### Bugs corregidos
- **`loadData` devolvía `null` en cada carga** — `supabase.rpc().catch()` lanzaba `TypeError` porque `@supabase/postgrest-js` recientes implementan `PromiseLike` (solo `.then()`) en lugar de `Promise` completo. El `try-catch` exterior capturaba el error y la función retornaba `null`, impidiendo que la app cargara datos.
- **Causa raíz**: llamadas a `should_reload_from_db` (404 — sin GRANT EXECUTE a rol `authenticated`) y `mark_cache_loaded` (mismo problema). Ambas son optimizaciones opcionales de caché; su ausencia no afecta la correctitud del flujo de carga.
- **Pendiente Externo** (no bloqueante): `GRANT EXECUTE ON FUNCTION should_reload_from_db(uuid), mark_cache_loaded(uuid) TO authenticated;` para reactivar la optimización de caché.

### Bugs identificados — requieren Externo
- **Trigger `backup_app_data` (400/500):** intenta insertar `NEW.id` (`text`) en `app_data_backups.couple_id` (`uuid`) sin castear → error de tipo en cada save. Fix: castear con `CASE WHEN NEW.id ~ uuid_regex THEN NEW.id::uuid ELSE NULL END`. Ver instrucciones abajo.
- **Timeout en `trg_push_on_app_data_update` (500):** `net.http_post` bloquea la transacción — considerar timeout explícito o modo async.

---

## [4.0.0] — 2026-05-26 · Hito Sprint G-2: lectura desde tabla normalizada

### Hito arquitectónico
- **`read_from_normalized: true`** — la app lee misiones desde la tabla `missions` (Supabase) en lugar del blob JSON. Cierre del Sprint G-2, iniciado en v3.9.2 con el dual-write. El blob sigue siendo la fuente de escritura; la tabla es ahora fuente de verdad para lectura.
- **Consistencia verificada (26/05):** 222 filas en tabla vs 220 en blob. Las 2 filas extra son misiones reales ("Hablar tranquilos" W21 + "Psico" W25) que el blob perdió el 25/05 por race condition (bug CAS, corregido en v3.9.6). Con el flip, **se restauran automáticamente** en la app.
- Safety check activo en `loadFromNormalized`: si la tabla tiene <80% de las misiones del blob, hace fallback al blob automáticamente. Protección permanente contra tablas desactualizadas.

### Prerequisitos completados (Externo, 26/05)
- Gap 1: columnas `time`, `reminder`, `series_pattern`, `series_end_date` añadidas a `missions`
- Re-backfill de 4 columnas en 139 filas históricas
- Limpieza de 7 filas huérfanas del backfill (misiones eliminadas entre 20/05 y 23/05)
- Backfill de 9 misiones faltantes (creadas entre backfill y dual-write, 20/05–23/05)
- `backup_app_data()` corregida para incluir `couple_id`

---

## [3.9.6] — 2026-05-26 · Fix crítico CAS: protección real contra sobrescritura

### Bug fix (crítico — pérdida de datos confirmada)
- **`saveWithCAS` ahora es el único path de save** cuando `cas_version_check: true` y la versión está cargada. Antes, `saveWithCAS` y `saveWithRetry` corrían en **paralelo** — aunque el CAS detectase un conflicto real, el `saveWithRetry` sobreescribía igualmente. El flag `cas_version_check: true` era decorativo. Bug confirmado el 25/05: la tabla `missions` preservó 2 misiones que el blob perdió por este race condition.
- **`dataVersionRef` inicializado a `null`** (antes `0`) para evitar falsos conflictos durante el arranque, antes de que `loadDataWithVersion` resuelva. Si la versión no está cargada, el save cae al path `saveWithRetry` como fallback seguro.
- **Conflict handler**: en conflicto real (partner guardó primero), se re-descarga su versión, se actualiza `dataVersionRef`, y se muestra un toast avisando al usuario que sus últimos cambios no se guardaron.

---

## [3.9.5] — 2026-05-26 · Gap 1 cerrado: dual-write de misiones completo

### Arquitectura
- **`insertNormalizedMission` actualizado** — ahora incluye `time`, `reminder`, `series_pattern` y `series_end_date` en el INSERT a la tabla `missions`. Gap 1 del Sprint G-2 cerrado por Externo (26/05). El dual-write de misiones está completo al 100%. `reminder="none"` se normaliza a `null` en la tabla.
- Pendiente Externo: re-backfill de las 4 columnas en las 252 filas históricas + verificación de consistencia antes del flip de `read_from_normalized`.

---

## [3.9.4] — 2026-05-26 · Fix crítico: re-sync al volver a la pestaña

### Bug fix (crítico)
- **Re-fetch silencioso al recuperar foco** — cuando `visibilityState` cambia a `visible` y no hay un guardado pendiente, la app hace un `loadData` silencioso para traer los datos más recientes de Supabase. Esto resuelve el caso donde el canal Realtime perdió eventos mientras la pestaña estaba en background (el WebSocket puede desconectarse y al reconectarse solo recibe eventos futuros, nunca los perdidos). Antes: si tu pareja guardaba cambios con la pestaña web en segundo plano, podías volver y ver datos de hace 20 minutos sin saberlo.
- **`dataVersionRef` actualizado en el re-fetch** — mantiene el CAS coherente de cara a la activación futura del flag `cas_version_check`.

---

## [3.9.3] — 2026-05-25 · Perf StatsView + accesibilidad GoalsView

### Performance
- **StatsView memoización** — toda la computación pesada (streak, catStats, bySt, series, donutSegments, insights) envuelta en `useMemo([weeks,stWho,stRange,p1,p2,todayKey])`. Elimina recálculos innecesarios en cada render no relacionado con stats.

### Accesibilidad
- **GoalsView historial**: celdas de historial cambiadas de `<div onClick>` a `<button disabled={noData}>` — activables por teclado (Tab/Enter/Space) y correctamente anunciadas por screen readers.

---

## [3.9.2] — 2026-05-23 · G-2 prep: dual-write de misiones cableado

### Arquitectura
- **Dual-write de misiones activado** en el flujo de mutaciones de App.jsx. Tres funciones nuevas en `repo.js`:
  - `insertNormalizedMission` — disparado en `addMission`, crea la fila en `missions` en tiempo real.
  - `deleteNormalizedMission` — disparado en `delMission` y `deleteMissionGlobal`.
  - `updateNormalizedMissionStatus` — disparado en `cycleStatus` y `cycleStatusGlobal`.
  - Todas son fire-and-forget: el blob sigue siendo fuente de verdad; los errores se loguean via `track("dual_write_error")`.
- **`loadFromNormalized` safety mejorado** — además de detectar tabla vacía, ahora hace fallback al blob si la tabla tiene <80% de las misiones del blob (tabla desactualizada por baja cobertura del dual-write histórico).

### Estado G-2
- Gap 3 (código `loadFromNormalized`): ✅ cerrado — existía desde sesión anterior, ya estaba cableado en App.jsx.
- Gap 2 (`week_metadata`): ya no bloquea — `loadFromNormalized` preserva `label`/`epicGoal` del blob como skeleton de cada semana.
- Gap 1 (4 columnas en tabla `missions`): pendiente Externo — añadir `time`, `reminder`, `series_pattern`, `series_end_date`. Hasta entonces el INSERT omite esos campos (null default).
- **Próximo paso**: Externo añade columnas → actualizamos INSERT → re-backfill desde blob → verificamos consistencia → flip `read_from_normalized: true`.

---

## [3.9.1] — 2026-05-23 · Monolito Fase 2d completa (SideMenu + Topbar)

### Arquitectura
- **`SideMenu.jsx`** extraído de App.jsx — contiene el backdrop, el panel deslizante, los ítems de navegación y el **Changelog modal** (que solo se abre desde aquí). Posee su propio estado `showChangelog`.
- **`Topbar.jsx`** extraído de App.jsx — posee internamente `popOpen` y `settingsOpen`, eliminando 2 `useState` de App.jsx.
- **Código muerto eliminado**: modal ICS de rango de fechas (`{icsModal && ...}`), función `downloadRangeICS`, y estados `icsModal`/`icsFrom`/`icsTo`. El botón que abría el modal nunca existió en el overflow menu.
- **App.jsx**: 1314 → 1101 líneas (objetivo ~1100 alcanzado, −16% adicional).

---

## [3.9.0] — 2026-05-23 · Smart sync + UX fixes + Tutorial + Monolito Fase 2d

### Corregido
- **Smart sync** — reemplaza los botones "Subir datos" / "Bajar datos" con un único botón inteligente `Sincronizar datos`. Descarga desde Supabase, compara contenido y reporta claramente: `"✓ Ya estás al día"` / `"⬇ Sincronizado — 3 tareas nuevas"`. El bug crítico anterior: cuando `loadData()` devolvía `null` (error de red o RLS), la app subía los datos locales pisando los del partner. Ahora en ese caso muestra `"⚠ Sin conexión — datos sin modificar"` y **nunca sube**.
- **Actualización de versión sin cerrar la app** — el botón "Actualizar versión" ya registra el listener `controllerchange` antes de enviar `SKIP_WAITING` al service worker. La recarga ocurre inmediatamente cuando el nuevo SW activa, sin necesidad de cerrar y reabrir la app.
- **Toast "Ya tienes la última versión" pegado** — los toasts de tipo `error` ahora se auto-descartan a los 7 segundos y tienen botón `×` para cerrarlos manualmente.

### Mejorado
- **Tutorial rediseñado (UX/UI)** — `TutorialOverlay` pasa de burbujas flotantes con flechas SVG hardcoded (posicionadas en píxeles fijos, rotas en pantallas pequeñas) a un modal centrado profesional: backdrop oscuro con blur, icono grande por paso, barra de progreso en la parte superior, botón `← Atrás` para retroceder, y animación de entrada pulida. 10 pasos, diseño coherente con el resto de la app.

### Arquitectura
- **Monolito Fase 2d** — extraídos `HistoryView.jsx` (~85 líneas) y `PendingView.jsx` (~155 líneas) de `App.jsx`. `App.jsx` pasa de 1597 a 1314 líneas (↓18%). `PendingView` gestiona ahora su propio estado de filtros de logros y su propio `useConfirm`.

---

## [3.8.27] — 2026-05-23 · Push personalizado + documentación arquitectónica

### Mejorado
- **Push copy personalizado** — mensajes incluyen el nombre del emisor: `"Ana añadió una tarea: 🎯 Título"`, `"Ana completó: ✅ Título"`. Chat ya tenía el nombre desde v3.8.22. Personalización sube de 6/10 a ~8/10.

### Documentado
- **`CLAUDE.md`** — decisión oficial: tabla `missions` es analytics futura, no fuente de verdad. `read_from_normalized: false` permanente hasta sync servidor. Riesgo blob sin versionado histórico registrado como riesgo crítico activo del sistema.
- **`TAREAS_SQL_AGENTE_SUPABASE.md`** — añadidas tareas urgentes: U-1 (snapshot automático + retention policy del blob), U-2 (Security Definer Views restantes), U-3 (activar telemetría real + queries de engagement).

---

## [3.8.26] — 2026-05-23 · Fix crítico: revertir read_from_normalized

### Corregido
- **`read_from_normalized` → `false`**: La tabla `missions` está congelada en el backfill del 20/05 (252 filas, sin actualizaciones). Con el flag en `true`, `loadFromNormalized()` construía las semanas usando datos del backfill y dejaba **vacías todas las semanas posteriores al 20/05** (W21+), incluyendo la semana actual. El fallback de v3.8.24 solo cubría el caso de tabla completamente vacía (0 filas), no el caso de tabla con datos obsoletos. El blob (`app_data`) sigue siendo la única fuente de verdad real hasta que se implemente sync del lado servidor.

### Diagnóstico (Forense)
- No existe trigger DB que parsee el blob y escriba en `missions` — el dual-write servidor nunca se implementó
- Las 252 filas son solo el backfill del Sprint D (20/05)
- `read_from_normalized: true` causaba datos aparentemente vacíos en semanas recientes para usuarios con RLS activo

---

## [3.8.25] — 2026-05-23 · Monolito Fase 2c — −596 líneas de App.jsx

### Extraído
- **`src/components/ChatView.jsx`** — vista de chat con Supabase realtime
- **`src/components/CalendarView.jsx`** — calendario mensual con drag-drop y edición inline
- **`src/components/ThemeInjector.jsx`** — inyección de CSS custom properties + Google Fonts
- **`src/components/MaintenanceBanner.jsx`** — banner de mantenimiento descartable
- **`src/lib/appUtils.js`** — helpers puros: `useSwipe`, `repairMisplacedMissions`, `applyCarryOver`, `syncCarryDone`, `getMissionDates`, `showNotif`, `scheduleReminders`, `dlBlob`, `fmtWeekRange`, `weekStartDate`, `fmtShortDate`

### Corregido (incluido en extracción)
- **CalendarView — confirm() no ejecutaba callbacks**: los botones "Eliminar" y "Aplicar a todas las futuras" en el modal de edición del calendario llamaban a `window.confirm(msg, callback)`, pero la API nativa no soporta callbacks — la acción nunca se ejecutaba. Corregido usando `useConfirm()` + `<ConfirmDialog />`.

### Métricas
- App.jsx: **2193 → 1597 líneas** (−596 líneas en Fase 2c, −1236 total vs. inicio del sprint)

---

## [3.8.24] — 2026-05-23 · Fix crítico: datos vacíos al instalar PWA

### Corregido
- **`loadFromNormalized` — fallback silencioso faltante**: si la tabla `missions` devolvía 0 filas sin error (ej. RLS deniega silenciosamente, tabla aún no poblada, o nueva instalación sin localStorage), la app construía semanas con arrays de misiones vacíos y los datos del blob quedaban ocultos. El fallback al blob solo se activaba con errores explícitos de Supabase. Ahora: si `missionRows.length === 0` pero el blob contiene misiones, se registra un warning y se usa el blob como fuente de verdad.

---

## [3.8.23] — 2026-05-23 · Nombre "Shared Calendar" + ícono PWA

### Cambiado
- **Nombre de la app → "Shared Calendar"** en todos los entornos: `manifest.name`, `manifest.short_name` ("Shared Cal"), `<title>`, `apple-mobile-web-app-title`, y descripción del manifest.
- **Ícono PWA generado**: `icon-192.png` e `icon-512.png` reemplazados con el logo diseñado por el usuario — dos círculos superpuestos (Venn diagram) sobre fondo partido blanco/negro, intersección dorada (`#C9A873`). Visible en escritorio móvil al instalar la PWA.

---

## [3.8.22] — 2026-05-23 · Push contextual + PWA nombre e ícono

### Añadido
- **Push notificaciones contextuales** — `sendContextualPush()` en `push.js` llama directamente a la Edge Function con texto específico según el evento:
  - Nueva tarea → `"Nueva tarea: 🎯 Título de la tarea"`
  - Nuevo evento → `"Nuevo evento: 📅 Nombre del evento"`
  - Tarea completada → `"Completada: ✅ Título de la tarea"`
  - Chat → `"Nombre: primeros 80 chars del mensaje"`
- El emisor queda excluido automáticamente de la notificación (usa `user_id` en `push_subscriptions`).
- Texto neutro — no dice "tu pareja" para mantener apertura y funcionar para cualquier tipo de pareja.

### Corregido
- **PWA nombre**: `"Shared Calendar"` → `"Misiones de Pareja"` en manifest, `<title>`, `apple-mobile-web-app-title`
- **Ícono adaptativo Android**: separado en `purpose: "any"` + `purpose: "maskable"` (antes combinado, lo que causaba problemas en algunos launchers)

### Pendiente Externo
- Deshabilitar el trigger `trg_notify_push_on_app_data_update` en Supabase para evitar doble notificación (el genérico del trigger + el contextual del código): `ALTER TABLE public.app_data DISABLE TRIGGER trg_notify_push_on_app_data_update;`

### Pendiente usuario
- Reemplazar `/public/icon-192.png` (192×192 px) e `/public/icon-512.png` (512×512 px) con el logo diseñado. PNG cuadrado con fondo opaco (no transparente), sin redondeo — el sistema operativo aplica el recorte.

---

## [3.8.21] — 2026-05-23 · Monolito Fase 2b: ProfileModal + push notification fix

### Refactorizado
- **`ProfileModal`** → `src/components/ProfileModal.jsx` (tema, foto de pareja, notificaciones, sección push)
- **`getUserPrefs` / `saveUserPrefs`** → `src/lib/userPrefs.js` (compartido entre `CoupleMissions` y `ProfileModal`)
- **App.jsx**: 2492 → 2188 líneas (−304 adicionales; total acumulado desde inicio Fase 2: −645 líneas)

### Corregido
- **Push notification texto roto**: texto por defecto cambiado a ASCII puro `'Tu pareja hizo cambios en la app'` en `sw.js` y Edge Function `send-push` — elimina posible rendering de escape sequences `\uXXXX` en dispositivos con problemas de encoding.

### Pendiente Externo
- Actualizar trigger SQL `trg_notify_push_on_app_data_update`: cambiar campo `body` de `'Tu pareja actualizó algo ✨'` a `'Tu pareja hizo cambios en la app'` para mantener consistencia con los defaults del código.

---

## [3.8.20] — 2026-05-22 · Monolito Fase 2a: WorkHoursCard + AddMissionForm + MissionCard

### Refactor
- **`WorkHoursCard`** → `src/components/WorkHoursCard.jsx`
- **`AddMissionForm`** → `src/components/AddMissionForm.jsx`
- **`MissionCard`** → `src/components/MissionCard.jsx`
- Constantes duplicadas eliminadas de App.jsx: `STATUS`, `CATEGORIES`, `CAT_MAP`, `getMCats`, `DEFAULT_COLORS`, `S`, `badgeStyle`, `catBadgeStyle` — reemplazadas por imports de `constants.js` y `styles.js`.
- `googleCalendarUrl` local eliminada (ya existía en `utils.js`).
- App.jsx: **2833 → 2492 líneas** (−341).

### Pendiente Fase 2b
ProfileModal, ChatView, CalendarView siguen en App.jsx (mayor complejidad).

---

## [3.8.19] — 2026-05-22 · Sprint G-2 ACTIVADO: lectura desde tablas normalizadas

### Cambiado
- **`read_from_normalized: true`** — la app ya lee `missions` y `goals` desde las tablas normalizadas de Supabase en lugar del blob JSON.
- Settings de pareja y metadatos de semana (`label`, `epicGoal`) siguen leyendo del blob (fuente híbrida).
- Fallback automático a blob completo si cualquier query a tablas falla.

### Verificación previa (Externo)
| Pareja | Misiones blob/db | Metas blob/db |
|--------|-----------------|---------------|
| FRANANA | 220 / 220 ✅ | 8 / 8 ✅ |
| CRI-COCO | 32 / 32 ✅ | 0 / 0 ✅ |

---

## [3.8.18] — 2026-05-22 · Fix borde oscuro tarjetas Casa en temas claros

### Corregido
- **Borde oscuro en tarjetas con categoría "Casa" en temas claros** (Lavanda, Blush, Cielo, etc.): el color de la categoría Casa usaba `"var(--t-accent,#a78bfa)"` como string literal. Al interpolarse en la expresión `${firstCat.color}30` para calcular `cardBorder`, generaba `"var(--t-accent,#a78bfa)30"` — un valor CSS inválido. El browser resolvía `border-color` como `currentColor` (el color de texto del tema, ej. `#1e0b4b`), produciendo un borde negro/navy prominente. Corregido a `"#a78bfa"` fijo.
- Misma corrección en `GASTO_CATS` (`constants.js`) donde "Casa" tenía el mismo problema.

### Alcance
Solo afectaba a tarjetas con "Casa" como primera (o única) categoría, en estado distinto de DONE/arrastrada/evento, y únicamente en temas claros donde `currentColor` es oscuro.

---

## [3.8.17] — 2026-05-22 · Sprint G-2: loadFromNormalized implementado

### Añadido
- **`loadFromNormalized(coupleId)`** en `supabase.js`: lee `missions` + `goals` de tablas normalizadas y reconstruye el objeto `data` que espera la app. Settings y metadatos de semana (`label`, `epicGoal`) siguen del blob como fuente.
- **Estrategia híbrida con fallback automático**: si las tablas fallan (error de red o schema incompleto), se devuelve el blob sin interrumpir la app.
- **Activación condicional en App.jsx**: tanto la carga inicial como `forceSync` usan `isEnabled("read_from_normalized")` para decidir entre `loadFromNormalized` y `loadData`.

### Estado del flag
`read_from_normalized: false` (default seguro). Para activar el flip, el Externo debe primero ejecutar el DDL de columnas faltantes en `missions` (ver `TAREAS_SQL_AGENTE_SUPABASE.md` sección G-2).

### Rollback
```js
window.__mpFlags.setFlag('read_from_normalized', false); location.reload();
```
(ejecutar en cada dispositivo de la pareja)

---

## [3.8.16] — 2026-05-22 · Sprint G-2 infraestructura + análisis de gaps

### Añadido
- **Flag `read_from_normalized: false`** en `src/lib/flags.js` DEFAULTS — infraestructura Sprint G-2 creada con default seguro. No activa ningún cambio de comportamiento hasta que la implementación esté completa.

### Documentado
- **3 gaps que bloquean el flip** identificados: columnas faltantes en `missions` (`time`, `reminder`, `seriesPattern`, `seriesEndDate`), tabla `week_metadata` inexistente, `loadFromNormalized()` por implementar en `supabase.js`
- DDL para cerrar los gaps añadido a `TAREAS_SQL_AGENTE_SUPABASE.md` (sección G-2)
- Corrección de 2 bugs en queries de consistencia: cross join sin agrupación correcta + filtro regex nanoid incorrecto

---

## [3.8.15] — 2026-05-22 · Props muertos + copy de confirmación de borrado

### Corregido
- **Props muertos eliminados**: `coupleId` de `ProfileModal` y `p1`/`p2` de `ChatView` ya no se pasan desde el call site — la firma de ambos componentes nunca los usaba
- **Copy de confirmación de borrado mejorado**: los diálogos de eliminar tarea, logro y actividad ahora muestran "Vas a eliminar esta tarea/logro/actividad" con descripción de irreversibilidad ("Esta acción no se puede deshacer") en lugar del genérico "¿Eliminar...?"
- **Botones de confirmación mejorados**: `ConfirmModal` ahora acepta `confirmLabel` y `cancelLabel` en las opciones — los diálogos de borrado usan "Sí, eliminar" / "Mejor no". La API es retrocompatible (valores por defecto: "Confirmar" / "Cancelar")

---

## [3.8.14] — 2026-05-22 · Banner de mantenimiento + limpieza CalendarView

### Añadido
- **`MAINTENANCE_WARNING`** en `constants.js`: constante que activa un banner de aviso cuando se hacen cambios de riesgo. `null` = desactivado (por defecto). Para activar durante mantenimientos, cambiar a `{ title, body }` y redesplegar — se revierte a `null` al terminar. El banner es `position:fixed`, ambar/marrón, descartable por sesión (sessionStorage).
- **`MaintenanceBanner`** componente en `App.jsx`: se renderiza encima de `CoupleMissions` con safe-area-inset-top y botón ×

### Corregido
- **Props muertos en `CalendarView`**: el call site seguía pasando `settings={data.settings}`, `onDownloadICS={...}` y `onDownloadPDF={...}` aunque la firma del componente ya no los aceptaba (limpieza de Fase 1b incompleta). Eliminados.

---

## [3.8.13] — 2026-05-21 · Limpieza ESLint: 49 warnings → 0

### Corregido
- **Bug silencioso `<ConfirmDialog />`**: el hook `useConfirm()` en `CoupleMissions` declaraba `ConfirmDialog` pero nunca lo renderizaba. Los diálogos "¿Eliminar esta tarea?" y "¿Eliminar este logro?" invocaban la función pero no mostraban UI. Fijado añadiendo `<ConfirmDialog />` al JSX de `CoupleMissions`.

### Refactorización
- **App.jsx**: eliminadas importaciones muertas post-extracción de Fase 1b (`signInWithGoogle`, `createCouple`, `joinCouple`, `generateInsights`), constantes duplicadas (`GASTO_CATS`, `EMOJI_GROUPS`, `TABS`, `PERIOD_LABEL`, `PERIOD_EMOJI`), funciones locales redundantes (`computeGoalProgress`, `computeGoalHistory`, `downloadFilteredPDF`) y variables no usadas (`carried`, `sortedWeeks`, `allUndated`)
- **Destructurings limpiados**: `p1`/`p2` en `DayDetailSheet` y `GoalPeriodDetail`; `coupleId` en `ProfileModal`; `p1`/`p2` en `ChatView`; `onDownloadICS`/`onDownloadPDF`/`settings` en `CalendarView`
- **Otros archivos**: `CATEGORIES` en `insights.js`, `ROW_BG` en `LinksView.jsx`, `STATUS_ORDER`/`STATUS`/`badgeStyle` en `GoalsView.jsx`, `totalDuration`/`maxH` en `StatsView.jsx`, `goals` en `HomeDashboard.jsx`
- **Deps de hooks**: `eslint-disable-next-line react-hooks/exhaustive-deps` añadido con justificación en los efectos que son intencionalmente acotados (subscribeToUpdates, update useCallback, ChatView subscribeToMessages)
- **`no-useless-assignment`**: `let current = 0` → `let current` en `goalHelpers.js` y `utils.js`
- **ESLint resultado**: 0 errores, 0 warnings

---

## [3.8.12] — 2026-05-21 · Monolito Fase 1b + Fix push unicode

**Hito:** App.jsx pasa de ~4050 a ~2967 líneas (−1023). Se extraen 4 componentes a `src/components/`. El fix push unicode asegura que emojis y tildes lleguen correctamente al dispositivo.

### Añadido
- **`src/components/StatsView.jsx`** (509 líneas): vista completa de estadísticas con filtros, insights Wrapped, Deep Stats v2.0, donut, barras semanales, participación por persona, exportación PNG
- **`src/components/GastosView.jsx`** (~450 líneas): gestor de gastos con proyectos, balance mensual, stats de 6 meses, formularios de gasto y proyecto
- **`src/components/CatStatsCard.jsx`**: tarjeta de categorías (actividades / horas), extraída de App.jsx
- **`src/components/WeekDetailList.jsx`**: acordeón de detalle por semana, extraído de App.jsx
- **`utils.js → dlBlob`**: función de descarga de blobs ahora exportada desde utils.js en lugar de vivir solo en App.jsx

### Corregido
- **Push unicode**: `send-push` Edge Function post-procesa el JSON para convertir `\uXXXX` → UTF-8. Los emojis (✨) y caracteres acentuados (ó) ya llegan correctos al dispositivo (antes aparecían como `✨ Tu pareja actualizó algo`)

### Refactorización
- App.jsx: −1023 líneas. Solo importa los 4 componentes, no los define inline
- `PROJECT_EMOJIS` y `_SM` movidos a sus archivos de componente correspondientes

---

## [3.8.11] — 2026-05-21 · Forense + send-push autodiagnóstico

**Hito:** se detiene el ciclo de fixes ciegos. Tras 4 versiones (3.8.7→3.8.10) intentando arreglar push sin ver el error real, se introduce el agente Forense y las herramientas de diagnóstico en la Edge Function.

### Añadido
- **send-push v2.0 — modos de autodiagnóstico**:
  - `GET ?probe=1` → ping de vida sin secrets ni DB, confirma que la función está desplegada
  - `GET ?diagnose=1` → metadata estructural de cada secret (length/prefix/suffix/hasWhitespace/hasNewline) + ejecuta `setVapidDetails` y reporta OK o FAILED con nombre y mensaje del error; **nunca devuelve el valor crudo**
  - `setVapidDetails` movido dentro del handler con try/catch propio → el error real aparece en el body JSON `{stage, error, name}` en lugar de perderse en logs internos de Deno
- **Agente Forense** (`docs/agents/forense.md`): exige datos crudos antes de deployar cualquier fix. Activado cuando un bug persiste tras 2 intentos sin evidencia real del error.

### Medida preventiva añadida a CLAUDE.md
> Si un bug persiste tras 2 intentos de fix, llamar al Forense antes de deployar otro cambio. El Forense pausa el ciclo hasta confirmar el diagnóstico con evidencia.

### Diagnóstico definitivo (obtenido vía `?diagnose=1`)
Causas raíz reales del fallo push en producción:
1. **Trigger ausente en producción** — `trg_notify_push_on_app_data_update` no se había aplicado en la base de datos real (solo existía en el roadmap SQL)
2. **`VAPID_CONTACT` sin prefijo `mailto:`** — el secret estaba configurado sin el esquema requerido por `web-push`; `setVapidDetails` lanzaba excepción silenciosa que los logs no exponían

Corrección: ambos son fixes externos (Supabase SQL + Supabase Secrets). El código ya tenía el fallback correcto `'mailto:admin@misiones-pareja.app'`.

---

## [3.8.10] — 2026-05-21 · Fix push — re-subscribe y errores silenciosos

### Corregido
- **Re-subscribe silencioso en iOS/Android**: `requestPermission()` ya no se llama si el permiso ya está `'granted'` — en móvil esto abortaba silenciosamente la suscripción al volver a activar push desde Settings
- **DOMException con message vacío**: errores de push con `message` vacío ya no pasan invisibles — fallback a `err.name` + toast visible con el mensaje real
- **Diseño de error push en Settings**: el bloque de error pasaba desapercibido (11px, color tenue); ahora tiene diseño prominente legible

---

## [3.8.9] — 2026-05-21 · Fix E-3 — nuevas VAPID keys

### Corregido
- **HTTP 500 en send-push**: la clave privada VAPID faltaba en Supabase Secrets — `web-push` fallaba en cada invocación con error interno sin body visible
- **VAPID_PUBLIC_KEY actualizada** en `constants.js` — el par anterior (pública sin privada) era inválido; las suscripciones previas fueron eliminadas de Supabase (creadas con clave huérfana) y se recrean automáticamente al abrir la app

---

## [3.8.8] — 2026-05-21 · Fixes M-1/M-4/M-5/UX-1

### Corregido
- **M-1 — Racha de logros**: `completedAt` numérico (timestamp ms) ya no rompe la racha — se convierte a ISO string antes de comparar fechas
- **M-4 — importData**: valida que `missions` dentro de cada semana sea un array — rechaza archivos con estructura corrupta en lugar de aceptarlos silenciosamente
- **M-5 — Toast de éxito**: duración aumentada de 2.5s a 4s — tiempo suficiente para leer el mensaje antes de que desaparezca

### Mejorado
- **UX-1 — Feedback al ciclar estado**: toast breve muestra el nuevo estado al pulsar el badge de una misión (TBC → ASAP → EN CURSO → HECHO)

---

## [3.8.7] — 2026-05-21 · UX Push — nudge contextual + widget Home

### Añadido
- **Nudge contextual post-Realtime**: aparece 8 segundos cuando el partner actualiza datos y el usuario no tiene push activo; se descarta por sesión (no vuelve a aparecer hasta recargar)
- **Widget silencioso en Home**: último elemento de la pantalla principal, descartable hasta 3 veces con memoria en `localStorage`
- **Copy asimétrico en Settings**: el texto ahora dice "Tu pareja puede estar recibiendo notificaciones — vos no" para crear la motivación correcta

---

## [3.8.6] — 2026-05-21 · Sprint G-1 — CAS activado

### Activado
- `cas_version_check: true` en `flags.js` — saves atómicos via RPC `save_app_data_cas`; conflictos de versión se detectan y loguean en lugar de pisarse silenciosamente

---

## [3.8.5] — 2026-05-21 · Fixes C-1/C-2 — anillos y series

### Corregido
- **C-1 — Anillos en Home**: excluyen `completedLate` igual que Stats — mismo criterio, mismo número en ambas vistas (antes el anillo inflaba el % contando tareas tardías)
- **C-2 — Series bisemanales legacy**: series sin `seriesStartWeek` usaban `pwn` como fallback, dando `weeksDiff=1` siempre; corregido con `prevSeriesIds` para distinguir origen `prevW` vs `prev2W`

---

## [3.8.4] — 2026-05-21 · Fix crítico — VAPID public key inválida

### Corregido
- **`applicationServerKey is not valid`**: la clave VAPID pública anterior tenía 86 caracteres (inválida como punto EC P-256 en base64url); la nueva tiene 87 chars y pasa la validación de `PushManager`
- Suscripción push operativa — el error bloqueaba la llamada a `pushManager.subscribe()` antes de llegar al servidor

---

## [3.8.3] — 2026-05-21 · Sprint E — Push completo en producción

### Corregido
- **Self-notify bug** (detectado por Analista): `send-push` notificaba a toda la pareja incluyendo quien guardó. Fix: `send-push` acepta `excludeUserId` y filtra `.neq('user_id', excludeUserId)`; `push.js` guarda `user_id` al suscribir.
- **React caller en lado incorrecto**: el invoke a `send-push` estaba en `subscribeToUpdates` (receptor), causaba doble notificación con el trigger de Postgres. Retirado — el trigger E-1 es el mecanismo correcto.
- **JWT bloqueaba trigger E-1**: 23 errores 401 en producción. Resuelto con redeploy `verify_jwt: false` (el trigger usa `SUPABASE_SERVICE_ROLE_KEY` internamente).

### Estado producción tras este sprint
- Edge Function `send-push` v2 · ACTIVE · `verify_jwt: false` ✅
- Trigger `trg_push_on_app_data_update` operativo ✅
- `push_subscriptions` con columna `user_id` + RLS ✅
- Pendiente: primer dispositivo que active notificaciones en ⚙️

---

## [3.8.2] — 2026-05-21 · Fix sistémico — Componentes duplicados eliminados

**Causa raíz identificada y solucionada:** App.jsx tenía 5 funciones locales con el mismo nombre que archivos externos en `views/` y `components/`. Los archivos externos eran código muerto — nunca se importaban, por lo que la versión local siempre ganaba. Esto causó que ediciones a los archivos externos no tuvieran efecto (como ocurrió con StatsView en v3.8.0).

### Eliminados (código muerto)
- `src/views/StatsView.jsx` — la versión local en App.jsx es master (tiene export PNG, insights, Wrapped)
- `src/views/CalendarView.jsx` — la versión local es master (tiene ResizeObserver, multi-day bars, series)
- `src/components/WorkHoursCard.jsx` — equivalente a la versión local
- `src/components/AddMissionForm.jsx` — la versión local es master (tiene endMode, reminder, biweekly)
- `src/components/MissionCard.jsx` — la versión local es master (tiene theming CSS vars, series, completedLate)

### Mejorado
- `EmojiSelect`: se importa ahora desde `components/EmojiSelect.jsx` (versión con flechas ‹ › de scroll para móvil). La versión local de 19 líneas en App.jsx fue eliminada. Ahora GoalsView y App.jsx usan exactamente el mismo componente.

### Sprint E — Bloqueante #2 resuelto (2026-05-21)
- **Push caller activo**: `supabase.js → subscribeToUpdates()` ahora invoca `send-push` (fire-and-forget) cuando llega una actualización del partner via Realtime. Sprint E **100% operativo**.

### Medida preventiva
Cualquier componente que tenga su propio archivo debe importarse — nunca duplicarse inline en App.jsx. Ver patrón en `GoalsView.jsx` como referencia.

---

## [3.8.0] — 2026-05-20 · Hito Sprint H — Stats narrativos Wrapped

**Hito:** la pestaña Stats muestra ahora un resumen narrativo estilo Wrapped con los insights más relevantes de la pareja — generados por `insights.js` y coloreados por sentimiento.

### Activado
- `stats_insights_enabled: true` en `flags.js`
- `generateInsights(weeks, p1, p2)` de `src/lib/insights.js` — devuelve hasta 5 insights ordenados por impacto (negativo → positivo → curioso → neutro)

### Nuevo: diseño Wrapped
Cada insight muestra:
- **Valor grande** (Fraunces serif): ej. `+12%`, `6 semanas`, `🧘 Bienestar`
- **Label** en small caps coloreado por sentimiento
- **Frase narrativa** completa — no solo un número sino el contexto
- Animación `fadeInUp` escalonada por tarjeta

### Sentimientos y colores
| Sentimiento | Color | Ejemplo |
|---|---|---|
| `positive` | verde `#34d399` | Racha de 4 semanas perfectas |
| `negative` | rosa `#f472b6` | 3 misiones arrastrando >2 semanas |
| `curious` | azul `#60a5fa` | Categoría estrella del mes |
| `neutral`  | púrpura `#a78bfa` | Tendencia estable al 68% |

### Técnico
- Reemplaza el bloque inline de insights hardcodeados de `StatsView.jsx` (v3.5+)
- `insights.js` usa `weeks` raw (no filtrado por persona/rango) para cálculos históricos correctos

---

## [3.8.1] — 2026-05-20

### Corregido
- **Stats — insights no aparecían**: la función `StatsView` estaba definida localmente en
  App.jsx (versión más completa con export PNG, umbrales altos) y aplastaba el import de
  `views/StatsView.jsx`. Los cambios de v3.8.0 se aplicaron en el archivo incorrecto.
- **Umbrales altos sin datos suficientes**: si la pareja tiene <3 semanas completadas o
  <5 misiones/semana, los insights inline no se generaban y la sección no aparecía.
  Ahora se usa `generateInsights()` de `insights.js` como fallback (umbrales menores).

### Mejorado
- **Diseño Wrapped** aplicado ahora sí en el StatsView real: tarjetas con fondo coloreado
  por sentimiento, valor hero en Fraunces para los insights de `insights.js`, y título +
  botón de navegación para los insights inline detallados.
- **Formulario de eventos** (fecha/hora inicio y fin): inputs agrupados en card con fondo
  sutil, proporción flexible (fecha ocupa más espacio que hora), `minHeight: 40px` y
  `fontSize: 14` — mejor experiencia táctil en iOS.

---

## [3.7.0] — 2026-05-20 · Hito Sprint E — Web Push VAPID

**Hito:** infraestructura completa de notificaciones push. Falta únicamente activar las VAPID keys y desplegar la Edge Function para que sea funcional en producción.

### Añadido
- `src/sw.js`: service worker custom con `injectManifest` (workbox). Maneja evento `push`
  (muestra notificación del sistema) y `notificationclick` (abre/foca la app). Mantiene
  el caching de Google Fonts y NetworkOnly para version.json.
- `src/lib/push.js`: librería de cliente — `subscribePush`, `unsubscribePush`,
  `getCurrentSubscription`, `isPushSupported`, `getPermissionStatus`. Guarda suscripción
  en `push_subscriptions` vía Supabase con upsert por `endpoint`.
- `supabase/functions/send-push/index.ts`: Edge Function Deno lista para deploy.
  Recibe `{ coupleId, title, body, tag, url }`, envía push a todas las suscripciones
  activas de la pareja, gestiona errores 410 (suscripción expirada → disabled).
- `src/components/SettingsModal.jsx`: sección "Notificaciones push" detrás del flag
  `push_enabled`. Muestra estado actual, botón Activar/Desactivar, mensajes de error.
- `.env.example`: documentación de variables de entorno requeridas.

### Modificado
- `vite.config.js`: migrado de `GenerateSW` a `InjectManifest` para permitir push handlers.

### Estado en producción
- ✅ VAPID keys generadas y configuradas en Supabase Secrets
- ✅ Edge Function `send-push` desplegada y activa
- ✅ Extensión `pg_net` habilitada
- ✅ Trigger `trg_push_on_app_data_update` activo en `app_data`
- ✅ Flag `push_enabled: true`
- ✅ Clave pública VAPID en `constants.js` (fallback hardcodeado — es pública, no es secreto)

---

## [3.6.1] — 2026-05-20

### Corregido
- **Eventos fantasma** (`repairMisplacedMissions` automático): al arrancar la app, si una misión
  tiene campo `date` que apunta a una semana distinta a donde está almacenada, se mueve
  automáticamente a la semana correcta. Antes solo ocurría al pulsar "📅 Distribuir eventos".
  El evento "psico" (y similares) dejará de aparecer en Home pero no en la vista de semana.

### Añadido
- **Eliminar en Pendientes**: botón `×` en cada card de la pestaña Pendientes, con confirmación.
- **Eliminar en Logros**: botón `×` en cada card de la pestaña Logros, con confirmación.

---

## [3.6.0] — 2026-05-20 · Hito Sprint D completo

**Hito:** dual_write normalizado activo — el blob y las tablas normalizadas se escriben en paralelo.

### Activado
- `dual_write_normalized: true` en `src/lib/flags.js`
  — cada save escribe en `app_data` (blob) + `missions`/`goals`/`couple_settings`

### Corregido
- `repo.js`: búsquedas cambiadas de `.eq("id", nanoid)` a `.eq("blob_id", nanoid)`
  — los IDs del app son nanoids cortos (`uid()`), no UUIDs; las tablas normalizadas
    usan UUID como PK y almacenan el nanoid en `blob_id`
- `upsertGoal`: patrón SELECT→UPDATE/INSERT en lugar de upsert con onConflict:"id"
  (que fallaba con nanoids al castear a uuid)

### Infraestructura
- Backfill verificado al 100%: FRANANA 220/220 misiones · 8/8 goals; CRI-COCO 32/32
- SQL agent resolvió 3 hallazgos críticos: fila legacy 'couple-missions', orphan UUIDs,
  IDs en formato nanoid → generó UUIDs y guardó nanoid en `blob_id`

---

## [3.5.5] — 2026-05-20

### Infraestructura (SQL agent)
- Sprint D SQL 100% completo — 5 tablas normalizadas listas en Supabase:
  - `public.missions` (D-2): 21 cols, FK cascada, 3 índices, RLS, trigger updated_at
  - `public.goals` (D-3): índice parcial `active=true`, RLS, trigger updated_at
  - `public.couple_settings` (D-4): PK = couple_id (1 fila/pareja), RLS, trigger updated_at
  - `public.week_photos` (D-5): constraint `unique(couple_id, week_key)`, RLS
  - Helper `is_couple_member()` (D-1): security definer, stable, base de todas las RLS
- `TAREAS_SQL_AGENTE_SUPABASE.md`: D-4 y D-5 marcados ✅

---

## [3.5.4] — 2026-05-20

### Corregido
- **Crash pestaña Pendientes** (`we.slice is not a function`): `m.completedAt` puede ser un
  objeto no-string (valor truthy que no tiene `.slice`). La optional chain `?.` no protege contra
  esto — protege solo contra null/undefined. Fix: `typeof m.completedAt === 'string'` antes de
  llamar `.slice(0,10)` en los dos lugares de App.jsx donde se usa.
- **Goal drill-down nunca abría**: App.jsx tenía copias locales antiguas de `GoalForm`, `GoalCard`
  y `GoalsView` (sin drill-down ni `GoalPeriodDetail`). Estas funciones locales aplastaban el
  import de `src/views/GoalsView.jsx`. Fix: eliminar el bloque completo (~200 líneas) y añadir
  el import correcto al top de App.jsx.

---

## [3.5.3] — 2026-05-20

### Corregido
- `constants.js`: `APP_VERSION` estaba en `"3.4.1"` — jamás se actualizó al avanzar sprints
  — la app mostraba v3.4.1 en UI y en la lógica de "ya tienes la última versión"
  — corregido a `"3.5.2"` con `LAST_UPDATE = "2026-05-20"` y CHANGELOG interno completo
  — el prebuild hook (`gen-version.js`) ya lee `constants.js` → ambos ficheros siempre en sync

---

## [3.5.2] — 2026-05-20

### Añadido
- `src/components/DevBackfillPanel.jsx`: panel DEV-only (fixed bottom-right) para ejecutar
  y verificar el backfill blob → tablas normalizadas (Sprint D)
  — estados: idle → running → done → verifying → verified → error
  — botones: "▶ Ejecutar backfill" + "🔍 Verificar consistencia"
- `src/lib/insights.js`: 6 funciones puras para Sprint H (Stats narrativos tipo Wrapped)
  — `loadBalance`, `consistencyStreak`, `topCategory`, `completionTrend`,
    `procrastinationAlert`, `generateInsights`
  — cada función devuelve `{ value, label, sentiment, detail }`
  — activadas desde StatsView.jsx detrás del flag `stats_insights_enabled`

### Modificado
- `src/App.jsx`: import + render de `<DevBackfillPanel>` (solo en DEV, con guard)

---

## [3.5.1] — 2026-05-20

### Corregido
- `save_app_data_cas`: RPC usaba `WHERE couple_id = p_couple_id` pero la PK de `app_data` es `id`
  — corregido a `WHERE id = p_couple_id`
- Backup C-1 confirmado: 5 parejas, 2,1 MB, guardado en 2 sitios

---

## [3.5.0] — 2026-05-20 · Hito Sprint B + Sprint A completo

**Hito:** telemetría real operativa, Goals drill-down, Logros timeline emocional,
feature flags, CAS wiring y base de Sprint D lista.

### Añadido
- `src/lib/backfill.js`: script de migración one-shot blob → tablas normalizadas (Sprint D)
- `src/lib/repo.js`: dual-write real para missions, goals y settings detrás de `dual_write_normalized`
- `src/lib/flags.js`: sistema de feature flags con 7 flags del roadmap v4.0

### Infraestructura
- CAS plumbing: `loadDataWithVersion()` + `dataVersionRef` + pre-check en save
- `saveWithCAS()` en repo.js conectado al RPC `save_app_data_cas` de Supabase
- Documento `TAREAS_SQL_AGENTE_SUPABASE.md` con todas las migraciones del roadmap

---

## [3.4.11] — 2026-05-20

### Añadido
- Sprint D prep: `loadDataWithVersion()` en supabase.js lee `data + version` en paralelo
- `dataVersionRef` en App.jsx almacena versión durante la sesión
- CAS pre-check en debounced save (no-op con `cas_version_check=false`)
- Imports de `isEnabled` y `saveWithCAS` en App.jsx

---

## [3.4.10] — 2026-05-20

### Añadido
- Telemetría `goal_drilldown_opened` en GoalsView.jsx al abrir bottom sheet
- Telemetría `logros_tab_viewed` en App.jsx al entrar a sub-tab Logros
- Import de `track` en GoalsView.jsx

---

## [3.4.9] — 2026-05-20

### Añadido
- `src/lib/repo.js` stub: capa de acceso a datos con interface preparado para dual-write
- `src/lib/track.js` mejorado: warn claro cuando tabla `events` no existe, verifyTelemetry()
- Telemetría `mission_completed` en cycleStatus y cycleStatusGlobal (con who, hasGoal, week)
- Telemetría `logros_tab_viewed` en botón de sub-tab

### Corregido
- `isValidAppData`: ya no falla silenciosamente — console.error + track + toast visible

---

## [3.4.8] — 2026-05-20

### Añadido
- `supabase/migrations/20260520_sprint_a.sql`: DDL tabla `events` con RLS, idempotente
- Documento SQL completo `TAREAS_SQL_AGENTE_SUPABASE.md` para agente Supabase (sprints C→G)

---

## [3.4.7] — 2026-05-20

### Añadido
- `src/components/PillFilter.jsx`: filtro por pills reutilizable (personas + categorías con contadores)
- Logros reframe como timeline emocional: hero cards (Totales / Esta semana / Racha)
- Agrupación de logros por día con animación `fadeInUp` escalonada
- Filtro local de Logros con `logrosPeopleFilter` + `logrosCatFilter` (independiente del filtro global)
- `@keyframes fadeInUp` añadido al bloque `<style>` global

### Corregido
- Dedup de logros: eliminado el colapso por `title+who` que eliminaba logros legítimos distintos
- Solo se deduplicó por `seriesId` (misiones recurrentes)

---

## [3.4.6] — 2026-05-20

### Añadido
- `src/components/GoalPeriodDetail.jsx`: bottom sheet (móvil) / modal (desktop) para drill-down de metas
- Microcopy comparativo: "↑ 3 más que el período anterior" / "↓ 1 menos" / "Igual" / "Período en curso"
- Animación de entrada con `requestAnimationFrame` + `useState(false)` → `setVisible(true)`
- Lista readonly de misiones DONE del período seleccionado

### Modificado
- `src/utils.js`: `computeGoalHistory` acepta segundo parámetro `{ includeMissions: true }`
  — embebe misiones DONE de cada período en el objeto de history (retrocompatible)
- `src/views/GoalsView.jsx`: wiring de `GoalPeriodDetail`, elimina `getPeriodMissions` (ya innecesaria)

---

## [3.4.5] — 2026-05-20

### Añadido
- `src/lib/track.js`: warn visible cuando tabla `events` no existe (42P01), solo una vez
- `src/lib/flags.js`: sistema de feature flags con localStorage + 7 flags del roadmap
  - `goals_drilldown_enabled: true` activado
  - Resto en `false` hasta cada sprint correspondiente
  - `window.__mpFlags` expuesto para debugging en consola

---

## [3.4.4] — 2026-05-20

### Corregido
- Migración SQL: `CREATE POLICY IF NOT EXISTS` no es sintaxis válida en PostgreSQL
  — reemplazado por `DROP POLICY IF EXISTS` + `CREATE POLICY`

---

## [3.4.3] — 2026-05-20

### Añadido
- `WORKSHOP_v4_INFORME_EJECUTIVO.md`: informe ejecutivo completo del Workshop v4.0.0
  — 10 secciones, 5 expertos, roadmap v3.5→v4.0, 7 garantías irrompibles

---

## [3.4.2] — 2026-05-20

### Corregido
- iOS PWA: la página se recarga automáticamente cuando el Service Worker actualiza y toma control
  — evita que módulos JS eliminados causen fallos de carga en PWA instaladas en iOS

---

## [3.4.1] — 2026-05-14 · Línea base

Versión de producción antes del Workshop v4.0.0.
Ver historial de git para cambios anteriores.
