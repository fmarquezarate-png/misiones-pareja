// ─── Version ──────────────────────────────────────────────────────────────────
export const APP_VERSION = "4.0.0";
export const LAST_UPDATE = "2026-05-26";

// Banner de mantenimiento — null = desactivado
// Para activar durante trabajos de riesgo, cambiar a objeto con title + body y redesplegar.
// Se revierte a null una vez completado el mantenimiento.
export const MAINTENANCE_WARNING = null;
/* Ejemplo de activación:
export const MAINTENANCE_WARNING = {
  title: "Estamos mejorando la app",
  body:  "Realizamos ajustes para hacerla más segura y estable. Te recomendamos no realizar cambios importantes — no podemos garantizar que se guarden correctamente en este momento.",
};
*/

// Clave pública VAPID — segura en el cliente (no es un secreto)
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
  ?? "BJ9sW-bV_xAzEeuppG1eVkCVelQZ-OwXzxBXUJJZCSxovuQ5H5nUYplZTcvWOXbHvk9sRRLeDla3zMUL8n0hjmI";
export const CHANGELOG = [
  { v:"4.0.0", date:"2026-05-26", notes:["Hito Sprint G-2: read_from_normalized: true — la app ahora lee misiones desde la tabla normalizada missions en lugar del blob. Backfill verificado: 222 filas en tabla vs 220 en blob. Las 2 extra son misiones reales preservadas en tabla tras un race condition del 25/05 — con el flip, se restauran automáticamente en la app.", "Beneficio inmediato: 2 misiones perdidas del blob (Hablar tranquilos W21 + Psico W25) reaparecen. La tabla missions es ahora fuente de verdad para lectura. El blob sigue siendo la fuente de escritura (dual-write activo)."] },
  { v:"3.9.6", date:"2026-05-26", notes:["Fix crítico CAS: saveWithCAS y saveWithRetry corrían en PARALELO — aunque CAS detectase conflicto, el saveWithRetry sobreescribía igualmente. Ahora saveWithRetry solo corre en el else (flag off, versión null, o error de red). En conflicto real: se re-descarga la versión del partner y se muestra toast. dataVersionRef inicializado a null (no 0) para evitar falsos conflictos antes de que la versión se cargue de DB.", "Bug confirmado en producción: 2 misiones del 25/05 estaban en la tabla missions pero no en el blob — race condition sin protección CAS funcional."] },
  { v:"3.9.5", date:"2026-05-26", notes:["Gap 1 cerrado por Externo: insertNormalizedMission ahora incluye time, reminder, series_pattern y series_end_date. reminder='none' se normaliza a null. Dual-write de misiones completo al 100%."] },
  { v:"3.9.4", date:"2026-05-26", notes:["Fix crítico de sincronización: re-fetch silencioso de Supabase al volver a la pestaña (visibilitychange → visible). Resuelve el problema de ver datos desactualizados en web cuando la pareja guardó cambios mientras la pestaña estaba en segundo plano. El canal Realtime no recupera eventos perdidos durante reconexión — este re-fetch es el safety net.", "dataVersionRef actualizado en el re-fetch para mantener el CAS coherente cuando se active."] },
  { v:"3.9.3", date:"2026-05-25", notes:["StatsView: toda la computación pesada (streak, catStats, bySt, series, donutSegments, insights) envuelta en useMemo([weeks,stWho,stRange,p1,p2,todayKey]) — elimina recálculos innecesarios en cada render.","GoalsView: celdas de historial cambiadas de <div onClick> a <button disabled={noData}> — accesibilidad por teclado y screen reader."] },
  { v:"3.9.2", date:"2026-05-23", notes:["G-2 prep: dual-write de misiones cableado en App.jsx. insertNormalizedMission (addMission), deleteNormalizedMission (delMission/deleteMissionGlobal) y updateNormalizedMissionStatus (cycleStatus/cycleStatusGlobal) son now fire-and-forget desde cada mutación. La tabla missions se actualiza en tiempo real al blob.","loadFromNormalized: safety check mejorado — fallback a blob si la tabla tiene <80% de las misiones del blob (tabla desactualizada), no solo si está vacía.","G-2 estado: Gap 3 cerrado (código existía), Gap 2 (week_metadata) no bloquea — loadFromNormalized usa blob skeleton para label/epicGoal. Pendiente: Externo añade 4 columnas (time/reminder/series_pattern/series_end_date) a missions, luego re-backfill y flip del flag read_from_normalized."] },
  { v:"3.9.1", date:"2026-05-23", notes:["Monolito Fase 2d completa: extraídos SideMenu.jsx y Topbar.jsx de App.jsx. Topbar posee internamente su estado de dropdowns (popOpen, settingsOpen). SideMenu posee el Changelog modal y la lista de navegación. Eliminado código muerto: modal ICS de rango de fechas (nunca se abría), downloadRangeICS, icsFrom/icsTo. App.jsx pasa de 1314 a 1101 líneas (objetivo ~1100 alcanzado)."] },
  { v:"3.9.0", date:"2026-05-23", notes:["Smart sync: el botón de sincronización ahora es único e inteligente — descarga desde Supabase, compara con datos locales y reporta el resultado claro ('Ya estás al día' / 'Sincronizado — N tareas nuevas'). Nunca sube datos cuando la conexión falla, eliminando el bug donde una sesión rota causaba pérdida de datos del partner.","Version update auto-reload: el botón 'Actualizar versión' ya activa la recarga inmediatamente al cambiar el service worker, sin necesidad de cerrar y reabrir la app. Se añadió listener controllerchange antes de postMessage SKIP_WAITING.","Toasts dismissibles: los toasts de error ahora se auto-descartan a los 7 segundos y tienen botón × para descartarlos manualmente.","Tutorial rediseñado: TutorialOverlay reemplaza las burbujas flotantes con flechas SVG hardcoded por un modal centrado profesional — backdrop oscuro, icono grande por paso, barra de progreso, botón Atrás y animación polished.","Monolito Fase 2d: extraídos HistoryView.jsx (~85 líneas) y PendingView.jsx (~155 líneas) de App.jsx. App.jsx pasa de 1597 a 1314 líneas (↓18%)."] },
  { v:"3.8.27", date:"2026-05-23", notes:["Push copy personalizado: los mensajes de notificación incluyen ahora el nombre del emisor — 'Ana añadió una tarea: 🎯 Título', 'Ana completó: ✅ Título'. Chat ya tenía el nombre. Pasa de 6/10 a ~8/10 de personalización.","CLAUDE.md: documentada la decisión oficial de missions como tabla de analytics futura (no fuente de verdad). Riesgo de blob sin versionado histórico documentado como riesgo crítico activo.","TAREAS_SQL: añadidas tareas urgentes U-1 (snapshot automático del blob), U-2 (Security Definer Views), U-3 (activar telemetría real)."] },
  { v:"3.8.26", date:"2026-05-23", notes:["Fix crítico: read_from_normalized revertido a false. La tabla missions está congelada en el backfill del 20/05 (252 filas, sin actualizaciones posteriores). Con el flag en true, loadFromNormalized() construía las semanas usando los datos del backfill y dejaba vacías todas las semanas posteriores al 20/05 (W21+) — incluyendo la semana actual. El blob (app_data) sigue siendo la única fuente de verdad real hasta que se implemente el dual-write del lado servidor."] },
  { v:"3.8.25", date:"2026-05-23", notes:["Monolito Fase 2c: ChatView → src/components/ChatView.jsx, CalendarView → src/components/CalendarView.jsx, ThemeInjector → src/components/ThemeInjector.jsx, MaintenanceBanner → src/components/MaintenanceBanner.jsx. Helpers puros (useSwipe, repairMisplacedMissions, applyCarryOver, syncCarryDone, getMissionDates, showNotif, scheduleReminders, dlBlob, fmtWeekRange) → src/lib/appUtils.js. App.jsx: 2193 → 1597 líneas (−596). Fix incluido: CalendarView ahora usa useConfirm() + <ConfirmDialog /> — antes llamaba window.confirm con callback que nunca se ejecutaba; el borrado y 'aplicar a futuras' ahora funcionan correctamente."] },
  { v:"3.8.24", date:"2026-05-23", notes:["Fix crítico: loadFromNormalized() ahora detecta cuando la tabla missions devuelve 0 filas pero el blob tiene misiones (RLS silencioso, tabla vacía o error sin código de error) y hace fallback al blob. Antes el fallback solo se activaba con errores explícitos de Supabase, causando que la app mostrara 0 misiones en instalaciones limpias de la PWA."] },
  { v:"3.8.23", date:"2026-05-23", notes:["Nombre de la app cambiado a 'Shared Calendar' en todos los entornos: manifest (name/short_name), index.html (title + apple-mobile-web-app-title), vite.config.js description.","Icono PWA generado: icon-192.png e icon-512.png reemplazados con el logo diseñado — dos círculos superpuestos (Venn) sobre fondo partido blanco/negro con intersección dorada (#C9A873). Visible en escritorio móvil al instalar la PWA."] },
  { v:"3.8.22", date:"2026-05-23", notes:["Push contextual: sendContextualPush() añadido a push.js — llama directamente a la Edge Function send-push con contexto específico. Disparos: nueva tarea ('Nueva tarea: 🎯 Título'), nuevo evento ('Nuevo evento: 📅 Título'), tarea completada ('Completada: ✅ Título'), chat ('Nombre: texto...'). Tarea para Externo: deshabilitar trigger trg_notify_push_on_app_data_update para evitar notificaciones dobles (el trigger genérico y el contextual). La columna user_id en push_subscriptions permite excluir al emisor en cada notificación.","PWA: nombre corregido de 'Shared Calendar' → 'Misiones de Pareja' en manifest y HTML (title, apple-mobile-web-app-title). Icono separado en purpose:any + purpose:maskable para mejor soporte Android adaptativo. Instrucción al usuario: reemplazar icon-192.png e icon-512.png en public/ con el logo diseñado (PNG cuadrado, fondo opaco)."] },
  { v:"3.8.21", date:"2026-05-23", notes:["Monolito Fase 2b: ProfileModal extraído de App.jsx a src/components/ProfileModal.jsx. getUserPrefs/saveUserPrefs movidos a src/lib/userPrefs.js. App.jsx −304 líneas adicionales (2492→2188). 0 errores ESLint.","Push notification fix: texto por defecto cambiado a ASCII puro 'Tu pareja hizo cambios en la app' en sw.js y Edge Function send-push — elimina posible rendering de secuencias \\uXXXX en dispositivos con problemas de encoding. Tarea para Externo: actualizar trigger SQL con el mismo texto."] },
  { v:"3.8.20", date:"2026-05-22", notes:["Monolito Fase 2a: WorkHoursCard, AddMissionForm y MissionCard extraídos de App.jsx a src/components/. App.jsx −341 líneas (2833→2492). Constantes duplicadas (STATUS, CATEGORIES, CAT_MAP, getMCats, DEFAULT_COLORS, S, badgeStyle, catBadgeStyle) eliminadas del monolito y reemplazadas por imports de constants.js y styles.js"] },
  { v:"3.8.19", date:"2026-05-22", notes:["Sprint G-2 ACTIVADO: flag read_from_normalized → true. La app lee missions+goals desde tablas normalizadas (Supabase); settings y metadatos de semana (label/epicGoal) siguen del blob. Consistencia verificada: FRANANA 220/220 misiones 8/8 metas, CRI-COCO 32/32 misiones 0/0 metas. Fallback automático a blob si las tablas fallan."] },
  { v:"3.8.18", date:"2026-05-22", notes:["Fix borde oscuro en tarjetas con categoría Casa en temas claros: el color de Casa usaba 'var(--t-accent,#a78bfa)' como string CSS — al interpolarse en '${color}30' generaba un valor inválido que el browser resolvía como currentColor (texto oscuro). Corregido a '#a78bfa' fijo. Misma corrección en GASTO_CATS (constants.js)"] },
  { v:"3.8.17", date:"2026-05-22", notes:["Sprint G-2 implementado: loadFromNormalized() en supabase.js lee missions+goals de tablas normalizadas y reconstruye el objeto data; settings y metadatos de semana (label/epicGoal) siguen del blob como fallback. App.jsx condiciona la carga con isEnabled('read_from_normalized')","Estrategia híbrida: si las tablas fallan → fallback automático a blob. El flag permanece en false hasta que el Externo ejecute el ALTER TABLE de columnas faltantes en missions (time/reminder/series_pattern/series_end_date)"] },
  { v:"3.8.16", date:"2026-05-22", notes:["Flag read_from_normalized:false añadido a DEFAULTS en flags.js — infraestructura Sprint G-2 lista, default seguro hasta que la implementación esté completa","Documentados 3 gaps que bloquean el flip: columnas faltantes en missions (time/reminder/seriesPattern/seriesEndDate), tabla week_metadata inexistente, loadFromNormalized() por implementar en supabase.js","TAREAS_SQL actualizado con DDL para cerrar los gaps y corrección de los 2 bugs en las queries de consistencia (cross join + filtro nanoid)"] },
  { v:"3.8.15", date:"2026-05-22", notes:["Props muertos eliminados: coupleId de ProfileModal, p1/p2 de ChatView (nunca se usaban en la firma del componente)","Copy de confirmación de borrado mejorado: diálogos ahora dicen 'Vas a eliminar esta tarea/logro/actividad' con descripción de irreversibilidad y botones 'Sí, eliminar' / 'Mejor no'","ConfirmModal API extendida: acepta confirmLabel y cancelLabel en el objeto de opciones — retrocompatible (los valores por defecto son los anteriores)"] },
  { v:"3.8.14", date:"2026-05-22", notes:["Banner de mantenimiento: MAINTENANCE_WARNING en constants.js activa MaintenanceBanner cuando se hacen cambios de riesgo — null=off, {title,body}=on. Deploy activa el aviso, revert lo apaga. position:fixed, amber, descartable por sesión","Props muertos eliminados del call site de CalendarView: settings, onDownloadICS, onDownloadPDF ya no se pasan (limpieza de Fase 1b incompleta)"] },
  { v:"3.8.13", date:"2026-05-21", notes:["Limpieza ESLint: 49 warnings → 0. Eliminadas importaciones muertas (signInWithGoogle, createCouple, joinCouple, generateInsights), constantes duplicadas post-extracción (GASTO_CATS, EMOJI_GROUPS, TABS, PERIOD_LABEL, PERIOD_EMOJI) y funciones locales redundantes (computeGoalProgress, computeGoalHistory, downloadFilteredPDF) de App.jsx","Fix bug silencioso: <ConfirmDialog /> ahora se renderiza en CoupleMissions — los diálogos '¿Eliminar esta tarea?' y '¿Eliminar este logro?' ya muestran UI (antes confirm() invocaba un hook sin render)","Deps de hooks intencionalmente acotados: eslint-disable-next-line añadido con justificación en subscribeToUpdates, useCallback update, ChatView useEffect","Destructurings limpiados: p1/p2 en DayDetailSheet y GoalPeriodDetail, coupleId en ProfileModal, p1/p2 en ChatView, onDownloadICS/onDownloadPDF/settings en CalendarView"] },
  { v:"3.8.12", date:"2026-05-21", notes:["Monolito Fase 1b: StatsView, GastosView, CatStatsCard, WeekDetailList extraídos a src/components/ — App.jsx −1023 líneas (de ~4050 a ~2967)","Fix push unicode: send-push Edge Function post-procesa JSON para revertir \\uXXXX → UTF-8 — emojis y tildes llegan correctos al dispositivo","dlBlob exportado a utils.js — elimina dependencia de App.jsx en StatsView","Preventiva CHANGELOG: regla de versionado sincronizado añadida a CLAUDE.md"] },
  { v:"3.8.11", date:"2026-05-21", notes:["Send-push v2.0 autodiagnóstico: modos ?probe=1 (ping) y ?diagnose=1 (metadata de secrets sin exponer valores). setVapidDetails movido dentro del handler con try/catch — el error real ahora aparece en el body JSON con {stage, error, name}, no en logs perdidos","Nuevo agente: Forense — exige datos crudos antes de deployar fixes. Activado tras 4 versiones (3.8.7→3.8.10) buscando bug push a ciegas","Regla preventiva: si bug persiste tras 2 intentos, Forense pausa el ciclo hasta confirmar diagnóstico con evidencia"] },
  { v:"3.8.10", date:"2026-05-21", notes:["Fix push re-subscribe: requestPermission() ya no se llama si el permiso ya está 'granted' — en iOS/Android esto abortaba silenciosamente la suscripción","Fix push error silencioso: DOMException con message vacío ya no pasa invisible — fallback a nombre del error + toast visible","Error de push en Settings ahora tiene diseño prominente (antes 11px invisible)"] },
  { v:"3.8.9", date:"2026-05-21", notes:["Fix E-3: nuevas VAPID keys generadas (par completo público+privado) — la private key faltaba en Supabase Secrets, causando HTTP 500 en send-push en cada invocación","VAPID_PUBLIC_KEY actualizada en constants.js — suscripciones previas inválidas limpiadas en Supabase","Las 3 suscripciones previas fueron eliminadas (creadas con clave pública sin par privado) — se recrean automáticamente al abrir la app"] },
  { v:"3.8.8", date:"2026-05-21", notes:["Fix M-1: racha de logros ya no se rompe cuando completedAt es número (timestamp) — convierte a ISO string antes de comparar","Fix M-4: importData valida estructura interna de missions — rechaza archivos con missions que no sean array","Fix M-5: toast de éxito ahora dura 4s (antes 2.5s) para dar tiempo a leer el mensaje","UX-1: feedback visual al ciclar estado de misión — toast breve muestra el nuevo estado"] },
  { v:"3.8.7", date:"2026-05-21", notes:["UX Push Pieza 1: nudge contextual post-Realtime — aparece 8s cuando el partner actualiza y push no está activo, se descarta por sesión","UX Push Pieza 2: widget silencioso en Home — último elemento, descartable hasta 3 veces con memoria en localStorage","UX Push Pieza 3: copy en ⚙️ ahora dice 'Tu pareja puede estar recibiendo notificaciones — vos no' para crear asimetría motivadora"] },
  { v:"3.8.6", date:"2026-05-21", notes:["Sprint G-1: cas_version_check activado — saves atómicos con Compare-And-Swap via RPC save_app_data_cas; conflictos de versión detectados y logueados en lugar de pisarse silenciosamente"] },
  { v:"3.8.5", date:"2026-05-21", notes:["Fix C-1: anillos Home ahora excluyen completedLate igual que Stats — mismo criterio, mismo número en ambas vistas","Fix C-2: series bisemanal legacy (sin seriesStartWeek) usaba pwn como fallback dando weeksDiff=1 siempre — corregido con prevSeriesIds para distinguir origen prevW vs prev2W"] },
  { v:"3.8.4", date:"2026-05-21", notes:["Fix crítico push: clave VAPID pública reemplazada — la anterior tenía 86 chars (inválida como punto EC P-256); la nueva tiene 87 chars y pasa validación de PushManager","applicationServerKey is not valid resuelto — subscripción push operativa"] },
  { v:"3.8.3", date:"2026-05-21", notes:["Fix self-notify: send-push excluye al emisor con excludeUserId + user_id en push_subscriptions","React caller retirado de subscribeToUpdates — arquitectura correcta: solo el trigger pg_net notifica","JWT desactivado en Edge Function — trigger E-1 operativo sin errores 401","Sprint E 100% completo en producción"] },
  { v:"3.8.2", date:"2026-05-21", notes:["Fix sistémico: eliminados 5 archivos de componentes huérfanos (StatsView, CalendarView, WorkHoursCard, AddMissionForm, MissionCard) que nunca se importaban — las versiones locales de App.jsx son las maestras","EmojiSelect migrado al archivo externo (con flechas de scroll en móvil) — ahora GoalsView y App.jsx usan la misma implementación","Versión 3.8.2"] },
  { v:"3.8.0", date:"2026-05-20", notes:["HITO Sprint H: Stats narrativos Wrapped activados — 5 insights generados por insights.js (racha, reparto de carga, tendencia, categoría estrella, alerta procrastinación)","Diseño Wrapped: valor grande en Fraunces, coloreado por sentimiento (positive/negative/curious/neutral), frase narrativa completa","Reemplaza el bloque de insights inline de v3.5+ por el sistema estructurado de insights.js","Flag stats_insights_enabled activado","Versión 3.8.0"] },
  { v:"3.7.0", date:"2026-05-20", notes:["HITO Sprint E: Web Push VAPID implementado — service worker con push/notificationclick, UI en Settings, Edge Function send-push lista para deploy","Infraestructura completa: push.js (subscribe/unsubscribe/getSubscription), sw.js con workbox injectManifest, SettingsModal con toggle de notificaciones","Para activar: generar VAPID keys, añadir VITE_VAPID_PUBLIC_KEY al .env, desplegar Edge Function, activar flag push_enabled","Versión 3.7.0"] },
  { v:"3.6.1", date:"2026-05-20", notes:["Fix: eventos fantasma — al cargar datos, repairMisplacedMissions() se ejecuta automáticamente y reubica misiones con 'date' mal asignada a semana incorrecta","Nuevo: botón × para eliminar tareas en pestaña Pendientes","Nuevo: botón × para eliminar logros en pestaña Logros","Versión 3.6.1"] },
  { v:"3.6.0", date:"2026-05-20", notes:["HITO: dual_write_normalized activado — cada save escribe en blob Y en tablas normalizadas simultáneamente","Backfill 100% verificado: 220 misiones + 8 metas (FRANANA), 32 misiones (CRI-COCO) — db=blob en todos los casos","repo.js actualizado para usar blob_id en búsquedas (IDs del app son nanoids, no UUIDs)","Versión 3.6.0"] },
  { v:"3.5.5", date:"2026-05-20", notes:["Sprint D SQL 100% completo: missions, goals, couple_settings, week_photos + helper is_couple_member — todas con RLS y triggers","Versión 3.5.5"] },
  { v:"3.5.4", date:"2026-05-20", notes:["Fix: pestaña Pendientes/Logros crasheaba con 'we.slice is not a function' — completedAt no siempre es string","Fix: Goals drill-down no abría — App.jsx tenía versiones locales antiguas de GoalForm/GoalCard/GoalsView que sobreescribían el import de views/GoalsView.jsx","Versión 3.5.4"] },
  { v:"3.5.3", date:"2026-05-20", notes:["Fix: APP_VERSION en constants.js estaba en 3.4.1 — la app mostraba versión incorrecta en UI y en la lógica de actualización","Versión 3.5.3"] },
  { v:"3.5.2", date:"2026-05-20", notes:["Panel DEV para migración Sprint D: DevBackfillPanel ejecuta y verifica el backfill de datos blob → tablas normalizadas","Funciones puras para Sprint H (Stats narrativos): loadBalance, consistencyStreak, topCategory, completionTrend, procrastinationAlert","Versión 3.5.2"] },
  { v:"3.5.1", date:"2026-05-20", notes:["Fix RPC save_app_data_cas: usaba WHERE couple_id en lugar de WHERE id — corregido","Versión 3.5.1"] },
  { v:"3.5.0", date:"2026-05-20", notes:["Telemetría real operativa (tabla events en Supabase con RLS)","Feature flags con 7 flags del roadmap (goals_drilldown_enabled activo)","Goals drill-down: bottom sheet/modal con microcopy comparativo y lista de misiones por período","Logros rediseñados como timeline emocional: hero cards + agrupación por día + filtros por persona y categoría","CAS (Compare-and-Swap) para guardado concurrente sin pérdida de datos","Dual-write prep: repo.js + backfill.js listos para Sprint D","Versión 3.5.0"] },
  { v:"3.4.11", date:"2026-05-20", notes:["Sprint D prep: loadDataWithVersion() en supabase.js lee data + version en paralelo","dataVersionRef en App.jsx almacena versión durante la sesión","Versión 3.4.11"] },
  { v:"3.4.10", date:"2026-05-20", notes:["Telemetría goal_drilldown_opened en GoalsView al abrir bottom sheet","Telemetría logros_tab_viewed en App.jsx al entrar a sub-tab Logros","Versión 3.4.10"] },
  { v:"3.4.9", date:"2026-05-20", notes:["repo.js: capa de acceso a datos con interface preparado para dual-write","track.js mejorado: warn claro cuando tabla events no existe, verifyTelemetry()","Telemetría mission_completed en cycleStatus con who, hasGoal, week","Versión 3.4.9"] },
  { v:"3.4.8", date:"2026-05-20", notes:["Migración SQL: tabla events con RLS (Sprint A)","Documento TAREAS_SQL_AGENTE_SUPABASE.md con todas las migraciones del roadmap","Versión 3.4.8"] },
  { v:"3.4.7", date:"2026-05-20", notes:["PillFilter: filtro por pills reutilizable (personas + categorías con contadores)","Logros rediseñados como timeline: hero cards Totales/Esta semana/Racha, agrupación por día","Fix dedup logros: solo por seriesId, no por title+who","Versión 3.4.7"] },
  { v:"3.4.6", date:"2026-05-20", notes:["GoalPeriodDetail: bottom sheet (móvil) / modal (desktop) para drill-down de metas","Microcopy comparativo vs período anterior","Versión 3.4.6"] },
  { v:"3.4.5", date:"2026-05-20", notes:["flags.js: sistema de feature flags con localStorage y 7 flags del roadmap","track.js: warn visible cuando tabla events no existe (42P01)","Versión 3.4.5"] },
  { v:"3.4.2", date:"2026-05-20", notes:["Fix iOS PWA: recarga automática cuando el Service Worker actualiza y toma control","Versión 3.4.2"] },
  { v:"3.4.1", date:"2026-05-18", notes:["Fix crítico iOS PWA: al actualizar el service worker, la app se recarga automáticamente para cargar los nuevos assets — antes el SW nuevo tomaba el control y borraba los chunks viejos con cleanupOutdatedCaches, dejando la app rota en iOS hasta reiniciar manualmente","Versión 3.4.1"] },
  { v:"3.4.0", date:"2026-05-18", notes:["Fix pérdida de datos: pagehide listener fuerza el guardado al cerrar tab en desktop (Chrome) — complementa el visibilitychange de iOS ya existente","Fix FOUC: todas las variables de CSS del tema (15 vars) se guardan en localStorage (mp_theme) y se aplican antes de que React monte — el tema ya no parpadea en el primer paint","ErrorBoundary global: si un componente revienta ya no sale pantalla en blanco — aparece una pantalla amigable con botón 'Recargar app' y los datos siguen seguros en Supabase","Indicador de guardado en topbar: punto pulsante lila mientras se guarda, verde que se desvanece al confirmar, rojo si hay error de red","Telemetría propia (sin terceros): tabla events en Supabase registra app_open y view_changed; falla silenciosamente si la tabla aún no existe","Versión 3.4.0"] },
  { v:"3.3.8", date:"2026-05-14", notes:["Tutorial rediseñado: ya no bloquea la pantalla — la app queda visible y activa debajo","Tutorial dinámico: navega automáticamente a cada sección mientras explica","Flechas doodle SVG apuntan a los elementos de la UI (anillos, botones, menú, ⚙️)","Burbuja de texto con fondo blanco semitransparente (88%) para leer sin perder el contexto visual","Versión 3.3.8"] },
  { v:"3.3.7", date:"2026-05-14", notes:["Home: toca el anillo de cada persona para ver su foto en grande con desglose completo — tareas completadas, en curso, ASAP y pendientes con barra visual","Fix score: las tareas con fecha futura ya no penalizan el porcentaje — solo cuentan tareas de hoy hacia atrás (últimos 15 días)","Versión 3.3.7"] },
  { v:"3.3.6", date:"2026-05-14", notes:["Fix race condition: al recibir actualización del partner vía Realtime se cancela el debounce pendiente — ya no sobreescribe los cambios del partner","Fix iOS: handler visibilitychange fuerza el save inmediatamente al pasar la app a background","Fix falso save: la carga inicial solo guarda a Supabase si hubo migración de schema (didMigrate)","Sync ⬆ Subir: verificación por timestamp real (updated_at) restaurada","Versión 3.3.6"] },
  { v:"3.3.5", date:"2026-05-13", notes:["Fix crítico: saveData upsert ya no envía updated_at — enviarlo causaba error 400 (PostgREST) y bloqueaba todos los guardados, perdiendo datos","Versión 3.3.5"] },
  { v:"3.3.4", date:"2026-05-13", notes:["Fix: saveData ahora usa .upsert() en lugar de INSERT/UPDATE separados — elimina el SELECT previo, más robusto y sin errores de duplicado; detecta bloqueos de RLS si Supabase no devuelve la fila guardada","Versión 3.3.4"] },
  { v:"3.3.3", date:"2026-05-13", notes:["Sync ⬆ Subir: verifica con timestamp real de Supabase — muestra '✅ Guardado · HH:MM:SS (hace Xs)' para confirmar que el UPDATE fue de este momento; si el timestamp tiene más de 30s de diferencia, avisa que el UPDATE no se aplicó (RLS o sesión)","Versión 3.3.3"] },
  { v:"3.3.2", date:"2026-05-13", notes:["Fix crítico: saveData ahora usa .select() tras UPDATE para detectar bloqueos silenciosos de RLS — antes count era null y el error pasaba desapercibido","Fix PWA: index.html, sw.js y version.json se sirven con Cache-Control no-store en Netlify — el browser siempre pide versión fresca y detecta actualizaciones correctamente","Fix PWA: version.json excluida del precache de Workbox con estrategia NetworkOnly — el service worker ya no la intercepta con versión vieja","Automatización: version.json se genera desde APP_VERSION en cada build (prebuild hook) — imposible que queden desincronizadas","Versión 3.3.2"] },
  { v:"3.3.1", date:"2026-05-13", notes:["Actualizar app: verifica la versión real del servidor antes de proceder — si el deploy aún no llegó, avisa 'Ya tienes la última versión, espera unos minutos'; si hay versión nueva, muestra 'Actualizando vX.X.X → vY.Y.Y'; si el service worker no tiene update, sugiere limpiar caché","Versión 3.3.1"] },
  { v:"3.3.0", date:"2026-05-13", notes:["Sync: botón ⬆ Subir datos a Supabase disponible en menú ⋯ y en pestaña Pendientes — fuerza un push de los datos locales al servidor","Sync: ⬆ Subir verifica realmente que el guardado funcionó (lee de vuelta y compara) — ya no hay falsos positivos de 'guardado' cuando RLS u otro error bloqueó silenciosamente","Sync: saveData detecta fallos silenciosos de RLS (count=0 tras UPDATE, inserted vacío tras INSERT) y lanza error explícito con detalle","Versión 3.3.0"] },
  { v:"3.2.1", date:"2026-05-11", notes:["Links de Interés: botón 🗑 eliminar ahora siempre visible junto a ✏️ editar (antes estaba oculto dentro del panel de credenciales — links sin credenciales no se podían borrar)","Metas: celdas del historial (semana/mes/año) son clickeables — toca una celda para ver la lista de actividades completadas en ese período; toca de nuevo para cerrar","Misiones: selector de meta filtra según quién hace la actividad — Persona 1 solo ve metas de Persona 1 o Juntos; Persona 2 solo ve sus metas o Juntos; Juntos ve todas. Aplica en formulario de creación, edición inline y edición desde calendario","Versión 3.2.1"] },
  { v:"3.2.0", date:"2026-05-07", notes:["Home: frase motivacional diaria debajo de los anillos — 500 frases originales en español, cursiva Fraunces, cambia cada día","Fix: anillos de persona ahora incluyen tareas sin fecha usando rango de semanas ISO (últimos 15 días), ya no marcan 100% incorrectamente","Fix: Logros deduplicados por seriesId + título/persona — sin repeticiones aunque la tarea exista en varias semanas","Fix: Logros sólo muestra tareas (excluye eventos explícitos)","Fix: tareas arrastradas (carry) ya no ocultan la original cuando la copia está marcada DONE","Fix: botón de filtros ahora visible en la pestaña Pendientes","Contraste global — todos los rgba(255,255,255,X) migrados a rgba(128,128,128,X·adj) para compatibilidad con temas claros en Stats, Goals, Calendar, OverflowMenu","Contraste: colores de texto hardcodeados (#6b5f88, #4a4166, #8b7fa8, #f0e8ff, etc.) migrados a CSS vars (--t-text, --t-text-muted, --t-text-dim)","Topbar Calendario: emoji 📅 eliminado del título (ya está en el favicon, no duplicar)","Versión 3.2.0"] },
  { v:"3.1.3", date:"2026-05-06", notes:["Fix: pestaña Gastos definitivamente arreglada — causa raíz era S.card con fondo hardcodeado #1d1733 (oscuro) + todos los rgba(255,255,255,X) invisibles en temas claros; migrado a var(--t-card) y rgba(128,128,128,X)","Fix: contraste Stats — etiquetas 'Semanas' y 'Misiones' en cajas KPI usaban #f8f4ff hardcodeado; migrado a var(--t-text)","Home: anillos de progreso de cada persona movidos debajo del widget 'Hoy' (no interrumpen la fila de widgets)","Home: ventana de cálculo de progreso cambiada a últimos 15 días (antes era la semana actual)","Pendientes: botón 'Refrescar' para sincronizar datos manualmente","Pendientes: dos sub-pestañas — 📋 Pendientes (tareas no hechas) y 🏆 Logros (todas las tareas DONE de todas las semanas)","Calendario: cuadrado rosa alrededor del día de hoy para mayor visibilidad","Renombrado 'Base de control' → 'Links de Interés' en menú, topbar y tutorial","Versión 3.1.3"] },
  { v:"3.1.2", date:"2026-05-06", notes:["Fix: pestaña Gastos en blanco en temas claros — inputs usaban colores hardcodeados dark-only; migrados a CSS vars (--t-input-bg, --t-text, --t-accent)","Fix: contrastes inputs — S.input/S.inputSm ahora usan var(--t-text) y var(--t-input-bg)","Fix: contraste lavanda — textDim #9a7acc →#6b4fa8 (~4.5:1 sobre #f5f0ff)","A5: Sync resiliente — saveWithRetry con backoff 2s/4s/8s + isValidAppData guard","B7: Toggle oscuro/claro en topbar (☀️/🌙) con memoria de preferencia","B5: Base de control — carpetas para agrupar links y cuentas con autocompletado","Home: fotos circulares de cada persona con anillo de progreso (verde ≥80%, amarillo ≥50%, rojo <50%)","Versión 3.1.2"] },
  { v:"3.1.1", date:"2026-05-05", notes:["Fix crítico: pantalla negra al cargar — dos useState (localThemeId/localFontId) estaban declarados después de un return condicional, violando Rules of Hooks; movidos al bloque inicial","Fix Service Worker: cleanupOutdatedCaches activo para evitar pantalla negra post-deploy","Versión 3.1.1"] },
  { v:"3.1.0", date:"2026-05-05", notes:["Nueva pestaña 'Base de control 🔗': guarda links (se abren en móvil sin errores PWA) y cuentas con usuario/contraseña copiable","Inicio: próximos 3 eventos + 3 tareas atrasadas (incluye arrastradas), tira de días con clic para ver detalle","Stats: exportar imagen con selección de secciones y colores del tema activo; horas de trabajo muestran promedio/semana","Corrección de contrastes en temas claros (fondos neutros, texto siempre visible)","Cambio de tema instantáneo sin necesidad de reabrir el modal","6 nuevas tipografías: Raleway, Montserrat, Merriweather, Quicksand, Josefin Sans, DM Serif Display","Favicon actualizado a 📅, logo MP visible en temas claros, fix flash de color al arrancar","Histórico: eliminados botones duplicados de Calendar/PDF","Versión 3.1.0"] },
  { v:"3.0.3", date:"2026-05-05", notes:["[incluido en 3.1.0]"] },
  { v:"3.0.2", date:"2026-05-04", notes:["Inicio rediseñado: widgets en columnas apiladas para móvil, sección Hoy compacta (toca para cambiar estado)","Semana: Timeline como vista por defecto, toggle renombrado a 'Lista detallada'","Versión 3.0.2"] },
  { v:"3.0.1", date:"2026-05-04", notes:["Fix: Timeline — eventos corridos un día y sin lunes (toISOString → formato local, elimina desfase UTC)","Fix: Filtros de persona/categoría ahora se aplican correctamente al pulsar 'Aplicar filtros'","Filtros multi-selección: combina p.ej. 'Persona 1 + Juntos' para ver todas las actividades en las que participas","Fix: cajas de widgets en Home ya no se desbordan fuera del ancho de la pantalla","Calendario: botón 'Volver a hoy' aparece al navegar a otro mes","Fix: pestaña Gastos ya no aparece en negro al abrirla","Versión 3.0.1"] },
  { v:"3.0.0", date:"2026-05-04", notes:["Rediseño UI mayor: dashboard editorial en Inicio con widgets compactos (ASAP urgentes, Próximo evento, Pulso semanal, Meta cercana, Misiones de hoy)","Logo MP-mark en topbar (dos círculos solapados con colores de pareja) reemplaza el emoji 💞","Vista Timeline en pestaña Semana: alterna entre lista clásica y riel cronológico por día (toggle ☰/⏱)","Tira de días L–D siempre visible en Home con Hoy resaltado en rosa","Filtros de persona y categoría unificados en drawer inferior con badge contador","Menú ⋯ en topbar: exportar .ics, imprimir PDF y actualizar app desde un único acceso","Toast visual para 'Actualizar versión': loading → éxito/error con botón Reintentar","Riel de color por persona (3px borde izq.) en cada tarjeta de misión","Animación pop del badge de estado al ciclarlo","Calendario: Hoy marcado con anillo rosa (antes era fondo relleno), barra de densidad por persona en footer de cada celda","Fix: el diálogo de impresión PDF ahora se cierra automáticamente al terminar o cancelar","Versión 3.0.0"] },
  { v:"2.5.0", date:"2026-04-26", notes:["Gastos: montos en tiempo real al dividir — muestra cuánto paga cada persona al mover el slider","Gastos: proyectos saldables — botón 'Marcar saldado' cierra el proyecto (🔒) sin borrar datos ni stats","Gastos: home de Gastos muestra solo proyectos separados en Activos / 🔒 Saldados","Gastos: 15 categorías (añadidas Supermercado, Tecnología, Cultura, Deporte, Mascotas, Regalos, Suscripciones)","Tutorial: paso nuevo para Gastos Compartidos","Fix: emoji 🧗 ya no se multiplica en el selector (clave de React corregida + duplicado eliminado)","Versión 2.5.0"] },
  { v:"2.4.1", date:"2026-04-26", notes:["Gastos: proyectos (ej. 'Viaje a Chile') — agrupa gastos por proyecto con balance propio y saldo acumulado","Gastos: división flexible — slider 0-100% con atajos rápidos (50/50, Solo tú, Solo yo, 70/30)","Gastos: fecha en campo propio con label (ya no queda cortada en móvil)","Gastos: pestaña Stats con gráfico de últimos 6 meses, desglose por categoría, totales y promedio mensual","Versión 2.4.1"] },
  { v:"2.4.0", date:"2026-04-25", notes:["Nueva pestaña 💸 Gastos Compartidos: registra gastos, divide a medias o gasto propio, 8 categorías, balance mensual automático (quién le debe a quién)","Histórico: foto ahora tiene dos botones — 📷 Tomar foto (cámara, Android+iOS) y 🖼️ Elegir de galería — Android ya puede sacar foto directamente","Perfil: botón 🔄 Actualizar app para forzar la carga de la última versión del PWA desde cualquier acceso","Versión 2.4.0"] },
  { v:"2.3.2", date:"2026-04-24", notes:["Tema por perfil: cada persona tiene su propio tema de color y fuente — cambiar el tuyo no afecta a tu pareja","Fechas de semana: debajo del número de semana aparece el rango de días (ej. 21–27 abr) y la fecha de hoy","Exportar a Google Calendar: selector de rango de fechas — ya no es solo por semana, elige desde/hasta y descarga todas las actividades del rango","Stats: compartir como imagen PNG de diseño visual (no como texto) — con barras por persona, categorías y balance","Análisis IA: todos los cálculos excluyen la semana actual (incompleta) para dar resultados más precisos y honestos","Versión 2.3.2"] },
  { v:"2.3.1", date:"2026-04-24", notes:["Inicio siempre muestra la semana real de hoy (no la semana que estés viendo en otras pestañas)","Colores del tema ahora se aplican en todos los rincones: histórico, modal de edición de calendario, menú de metas","Selector de fuente independiente del tema: elige entre 5 tipografías desde ⚙️ Mi Perfil","Sensibilidad del gesto deslizar corregida: ya no cambia de semana al hacer scroll vertical","Botones del top bar claros de la barra de estado iOS (safe area)","Versión 2.3.1"] },
  { v:"2.3.0", date:"2026-04-22", notes:["Gestos de deslizamiento: desliza ← → en la semana actual para cambiar de semana sin tocar botones","Recurrencia potente: nueva opción Bisemanal (cada 2 semanas) + fecha de fin de serie opcional + botón 'Aplicar a todas las futuras' en el editor de calendario","Modo offline: banner de aviso cuando no hay conexión, los cambios se guardan localmente y se sincronizan solos al reconectar","Resumen diario mejorado: ahora también se programa durante la sesión si abres la app antes de la hora configurada","Versión 2.3.0"] },
  { v:"2.2.4", date:"2026-04-22", notes:["Notificaciones push: recibe alertas de mensajes del chat, cambios de tu pareja y recordatorios de eventos aunque la app esté en segundo plano","Recordatorios de eventos: elige con cuánta antelación quieres que te avisemos (en el momento, 15 min, 30 min, 1 h o 1 día antes)","Resumen diario: notificación matutina con tus misiones del día y metas próximas a vencer","Gestión de notificaciones en ⚙️ Mi perfil — actívalas y personaliza cada tipo por separado","Versión 2.2.4"] },
  { v:"2.2.3", date:"2026-04-21", notes:["Arranque instantáneo: la app se muestra en <100ms en visitas repetidas (caché local de sesión + datos)","Aislamiento de parejas 100%: cada pareja tiene su propia clave de almacenamiento — imposible ver datos ajenos al cambiar de cuenta","Supabase carga en segundo plano sin bloquear la UI — si hay backup local, se muestra de inmediato","Versión 2.2.3"] },
  { v:"2.2.2", date:"2026-04-21", notes:["Tutorial interactivo para nuevos usuarios: repasa todas las pestañas con UX paso a paso al iniciar por primera vez","Opción 'Ver tutorial de nuevo' en ⚙️ Mi perfil (para cuando quieras refrescarlo)","Versión 2.2.2"] },
  { v:"2.2.1", date:"2026-04-21", notes:["Fix: horas de vuelo corregidas — duración se guardaba en minutos pero se mostraba como horas (×60 inflación)","Fix: tareas recurrentes en Pendientes — sólo aparece la instancia de la semana más reciente (sin duplicados)","Fix: foto de semana — lightbox ahora tiene botón ⬇ para descargar además del zoom","Fix: ICS export — duración en DTEND y descripción ahora correcta (minutos, no horas)","Versión 2.2.1"] },
  { v:"2.2.0", date:"2026-04-17", notes:["App renombrada a Shared Calendar (más abierta, menos de nicho)","5 nuevos temas claros: Rosa Pastel, Cielo Azul, Menta Fresca, Melocotón, Lavanda Suave","Chat integrado: mensajitos en tiempo real entre los miembros (pestaña 💬)","Zoom en móvil corregido: touch-action:manipulation en toda la app (Chrome + Safari)","Compartir botones de imagen eliminados (ocupaban espacio, poco uso)","Cerrar sesión ahora muestra selector de cuenta Google (no reconecta automáticamente)","Botón Compartir Stats al pie de la pestaña Stats (sensible a filtros activos)","Versión 2.2.0"] },
  { v:"2.1.1", date:"2026-04-17", notes:["Pendientes: sólo tareas (sin eventos), sin duplicados — tareas arrastradas muestran sólo su versión más reciente","Pendientes: badge 🔁/⚠️ indica cuántas semanas lleva arrastrada la tarea","Al marcar una tarea arrastrada como DONE desde pendientes: la original en la semana pasada se marca ⏰ Completada con retraso (no infla stats de esa semana)","Semana anterior: tareas completadas tarde muestran badge ⏰ en la tarjeta"] },
  { v:"2.1.0", date:"2026-04-17", notes:["Fix crítico: eventos multi-día ahora se muestran en TODOS sus días en el calendario","getMissionDates: tolera hora vacía (00:00 inicio, 23:59 fin) — multi-día garantizado","addMission: fuerza endTime='23:59' si hay endDate sin hora, time='00:00' si hay endDate sin hora inicio","Formulario: defecto automático 23:59 al seleccionar solo fecha fin","CalendarView: getMissionDates se llama una sola vez por misión (Map) — más rápido","Limpieza: eliminadas variables saving/savingError/saved ya no usadas"] },
  { v:"2.0.9", date:"2026-04-17", notes:["Calendario: columna única (detalle del día debajo, no al lado)","Tareas: sin campos de fecha/hora/duración (limpias)","Eventos: duración en minutos OR fecha+hora de fin (auto-calculado)","Menú: pestaña Pendientes con todas las tareas no-DONE de todas las semanas","Zoom móvil: fix real por CSS font-size≥16px en inputs (Safari iOS)","Stats AI v2.0: Deep Stats — Sincronía, Equidad en casa, Densidad de metas, Hábito ancla, Carga óptima, Ventana horaria","Código: dlBlob y getMissionDates movidos a nivel de módulo (sin duplicación)"] },
  { v:"2.0.8", date:"2026-04-17", notes:["Calendario: celdas responsivas (ResizeObserver, máximo espacio)", "Calendario: tareas multi-día ocupan todos los días según fecha+hora+duración","Calendario: compartir día / tarea / semana como imagen PNG (WhatsApp/descarga)","Calendario: editar participante al editar actividad inline","Nuevo usuario: pantalla en blanco (sin datos de ejemplo)","Top bar: emoji de pareja configurable (ajustes de perfil)","Tareas arrastradas: se marcan DONE en semana original con flag 'tarde' (no infla stats)","Stats AI: mínimo 5 misiones para considerar mejor/peor semana","Inicio: emoji de participante + tipo (tarea/evento) en cada fila de misiones","Filtros: secciones Participantes/Categorías diferenciadas + ordenar semana","Zoom móvil bloqueado (no queda pegado al hacer zoom in/out)","PWA: siempre carga versión más reciente (skipWaiting + networkFirst)"] },
  { v:"2.0.7", date:"2026-04-15", notes:["Emoji de pareja elegible desde Mi Perfil (24 opciones)", "Fix: menú lateral usa emoji elegido en vez de 💞 fijo","Fix: dropdown de tema en ProfileModal deja de cortarse (inline)","Fix: select de meta sin contraste blanco-sobre-blanco en Mac","Cursor: sin selección de texto accidental en escritorio","Stats: barras de semanas capeadas a 12 máximo","Nueva pestaña Pendientes en menú (todas las tareas no-DONE)","Inicio: layout 2 columnas en pantallas anchas (pendientes | eventos)","Compartir semana: imagen generada con Canvas + navigator.share/descarga"] },
  { v:"2.0.6", date:"2026-04-15", notes:["Fix: mensajes de sync (✓ al día / ⬆ subido / ⬇ actualizado / ⚠ error) ahora son toasts flotantes visibles siempre","Fix: error de Supabase también aparece como toast si no hay syncMsg activo","5 temas nuevos: Aurora Boreal (neon verde+magenta), Neón Tokyo (cyan+fucsia), Vino & Oro (burdeos+dorado), Mañana Clara (tema claro crema/blanco), Café Oscuro (chocolate+ámbar)","Sistema de colores de texto por tema (--t-text/muted/dim) — Mañana Clara tiene texto oscuro legible","Selector de tema cambiado de grid de tarjetas a dropdown desplegable con 10 temas listados","S.input, S.label, S.btnSecondary usan CSS vars de texto para adaptarse al tema claro"] },
  { v:"2.0.5", date:"2026-04-15", notes:["Menú lateral: pie siempre visible en móvil (solo versión + changelog, sin scroll)","Sincronización movida a ⚙️ dropdown (junto a Exportar/Importar/Cerrar sesión)","Sync muestra 'Sincronizando…' mientras está activo"] },
  { v:"2.0.4", date:"2026-04-15", notes:["Foto de pareja en home, menú lateral y perfil (crop circular 72px, JPEG)","Fotos individuales por persona en perfil (con previsualización de avatar)","5 temas visuales con fondos más saturados y contrastados","Tipografía propia por tema: Jakarta Sans / DM Sans / Nunito / Lato / Space Grotesk","Fuente se carga dinámicamente desde Google Fonts al cambiar tema","Hoja de ruta: v3.0 — modo individual + grupos de amigos (pendiente)"] },
  { v:"2.0.3", date:"2026-04-15", notes:["Rediseño UX: menú hamburguesa lateral con navegación","Página de inicio con resumen del día (hoy/mañana + semana)","Top bar persistente (☰ + 🏠 + ⚙️) adaptado a móvil/web","⚙️ abre dropdown: Mi perfil / Exportar / Importar / Cerrar sesión","ProfileModal: nombres, colores, fotos individuales y selector de tema","5 temas de color (Noche Violeta, Océano, Jardín, Atardecer, Obsidiana)","Versión y changelog movidos al pie del menú lateral"] },
  { v:"2.0.2", date:"2026-04-13", notes:["Stats: semana actual excluida de mejor/peor semana","Stats: botón ℹ en Participación por persona","Metas: campo 'Analizar desde' para ignorar períodos anteriores","Metas: historial muestra '–' para períodos sin datos","Objetivo épico integrado en cabecera de semana","Warning arrastrada muestra cuántas semanas lleva pendiente"] },
  { v:"2.0.1", date:"2026-04-13", notes:["Fix crítico: errores de Supabase ahora visibles en UI (antes silenciosos)","Import JSON sube datos a Supabase inmediatamente","Botón 🔄 sincroniza en ambas direcciones","localStorage por pareja (evita mezcla de datos entre usuarios)"] },
  { v:"2.0.0", date:"2026-04-08", notes:["Login con Google OAuth","Espacio privado por pareja con código compartido","Sincronización en tiempo real con Supabase Realtime","Backup automático en localStorage"] },
  { v:"1.9.3", date:"2026-04-06", notes:["P2: columna 'Sin fecha' eliminada, calendario vuelve a pantalla completa","Se mantiene edición inline de actividades desde el panel del día"] },
  { v:"1.9.2", date:"2026-04-05", notes:["Sin fecha: solo no-hechas, dedup por título+quién+emoji (semana más reciente)","Drag & drop corregido: onDragEnter + relatedTarget fix","Metas: ❌ en TODOS los períodos pasados no cumplidos","Stats: barras con escala absoluta 0-100%","Fecha de hoy bajo 'Semana X', botón nueva misión arriba"] },
  { v:"1.9.0", date:"2026-04-04", notes:["Fix guardado: debounce evita pérdidas de datos","Filtro de categoría global (persiste entre tabs)","Calendario: columna sin-fecha con drag & drop","Editar actividades directamente en calendario (sin salir)","Metas: períodos no cumplidos en rojo, cumplidos en verde"] },
  { v:"1.8.0", date:"2026-03-30", notes:["Categoría Viaje + multi-categoría por tarea/evento","Filtro global por persona persiste entre tabs","Metas: tipo Mínimo/Máximo","Countdown en segundos cuando queda <24h","Gráfico horas por categoría (trabajo en escala propia)","Filtro Esta semana en Historial","Meta enlazada: selector desplegable","Barras de progreso relativas","Insights más potentes"] },
  { v:"1.7.0", date:"2026-03-26", notes:["Filtro por persona en P1 y P2","Versión dorada con fecha y changelog","Editar estado desde P2","Tareas recurrentes (semanal/mensual)","Goals con countdown deadline","Stats rediseñado"] },
  { v:"1.6.0", date:"2026-03-25", notes:["Fix stats semanas futuras","Calendario navega a semana correcta","Distinción Tarea vs Evento","Distribuir eventos","Historial sin semanas futuras","Emojis con fondo en calendario"] },
];

// ─── Status ───────────────────────────────────────────────────────────────────
export const SEED_VERSION = 6;
export const STATUS_ORDER = ["TBC", "ASAP", "IN_PROGRESS", "DONE"];
export const STATUS = {
  TBC:         { label:"TBC",      icon:"⏳", color:"#94a3b8", bg:"rgba(148,163,184,0.12)", border:"rgba(148,163,184,0.3)" },
  ASAP:        { label:"ASAP",     icon:"🔥", color:"#fb923c", bg:"rgba(251,146,60,0.12)",  border:"rgba(251,146,60,0.3)"  },
  IN_PROGRESS: { label:"En curso", icon:"⚡", color:"#60a5fa", bg:"rgba(96,165,250,0.12)",  border:"rgba(96,165,250,0.3)"  },
  DONE:        { label:"Hecho",    icon:"✅", color:"#34d399", bg:"rgba(52,211,153,0.12)",  border:"rgba(52,211,153,0.3)"  },
};

// ─── Categories ───────────────────────────────────────────────────────────────
export const CATEGORIES = [
  { id:"pareja",  label:"Pareja",  icon:"💞", color:"#f472b6" },
  { id:"deporte", label:"Deporte", icon:"🏅", color:"#60a5fa" },
  { id:"casa",    label:"Casa",    icon:"🏠", color:"#a78bfa" },
  { id:"salud",   label:"Salud",   icon:"💊", color:"#34d399" },
  { id:"trabajo", label:"Trabajo", icon:"💼", color:"#fbbf24" },
  { id:"ocio",    label:"Ocio",    icon:"🎉", color:"#f97316" },
  { id:"social",  label:"Social",  icon:"🥂", color:"#e879f9" },
  { id:"viaje",   label:"Viaje",   icon:"✈️", color:"#38bdf8" },
];
export const getMCats = m => m.categories?.length ? m.categories : (m.category ? [m.category] : []);
export const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// ─── Emoji groups ─────────────────────────────────────────────────────────────
export const EMOJI_GROUPS = [
  { label:"🏅 Deporte", emojis:["🎾","🏓","🏸","⚽","🏀","🏊","🚴","🧘","🏋️","🤸","🏆","🎳","🛼","🥊","🏄","⛷️","🧗","🤽","🏇","🥋","🏐","🎽","🥅","🥌","🎿","🛹","🪂","⛳","🎱","🏒","🤺","🏹","🤾","🏃","🧗","🫀"] },
  { label:"🏠 Casa",    emojis:["🛒","🖼️","🔧","💡","🛁","🪴","🧹","🛋️","🪟","🏠","🔑","📦","🧺","🪣","🫧","🔩","🪑","🛏️","🚿","🧼","🧽","🪠","🔋","💻","🖨️"] },
  { label:"💆 Bienestar",emojis:["🧖","💆","🧴","💅","😴","🌿","🧠","❤️","💊","🩺","🛁","🫁","🦷","👁️","🩻","🧘","🫶","🌞","🌙","🍃","🌺","💐","🫧","🩹","🏃"] },
  { label:"✈️ Viajes",  emojis:["🚢","✈️","🏖️","🗺️","🧳","🌊","🏔️","🌍","🏛️","📸","🚂","🛵","🚗","⛺","🏕️","🗼","🗽","🎡","🏝️","🌄","🌅","🧭","🎫","🪪","🚀"] },
  { label:"🍕 Comida",  emojis:["🍕","🌮","🥗","🍷","🧁","🎂","🍣","☕","🥘","🍜","🫕","🥂","🍝","🥩","🍱","🥡","🍰","🫙","🧆","🥙","🍛","🥐","🧇","🍳","🫖","🍹"] },
  { label:"💌 Pareja",  emojis:["💞","💌","🫀","💍","🌹","🙊","🐼","🦋","🌸","🎁","🕯️","💫","🥰","😍","🫦","💋","🌷","💐","🎀","🩷","🧸","🫂","🌙","✨","🪷","💝"] },
  { label:"💻 Trabajo", emojis:["🤖","💸","📚","📝","💡","🔧","📊","🎯","🗂️","✉️","📱","🖥️","💼","🗃️","📋","🔍","📈","📉","🖊️","📌","📎","🗓️","⌚","💬","🤝","🏦"] },
  { label:"🎉 Ocio",    emojis:["🎉","🎬","🎸","🎮","🧩","🎲","🎨","🎵","🎤","🎪","🪄","🎭","🎠","🎯","🎳","🎻","🥁","🎹","🎺","🪗","🎷","📺","📷","🎧","🕹️","🃏"] },
  { label:"🌱 Natura",  emojis:["🌱","🌳","🌻","🍄","🦁","🐶","🐱","🐠","🦜","🦋","🐝","🐢","🌈","🌊","⛰️","🌋","🦅","🌿","🍀","🌺","🐉","🦊","🐧","🦔","🌙","⭐"] },
  { label:"🎓 Cultura", emojis:["🎓","📖","🖼️","🏛️","🎭","🎨","🎬","📽️","🎼","🎤","📰","✍️","🖋️","📜","🏺","🗿","🎑","🌐","🔭","🔬","🧪","🧬","💎","🪬","🎋","🪁"] },
];

// ─── Goal labels ──────────────────────────────────────────────────────────────
export const PERIOD_LABEL = { weekly:"Semanal", monthly:"Mensual", annual:"Anual" };
export const PERIOD_EMOJI = { weekly:"📅", monthly:"🗓️", annual:"🎊" };

// ─── Defaults & Seed ──────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = { person1: "Persona 1", person2: "Persona 2", colors: { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" }, notifications: { chat:true, partnerChanges:true, eventReminders:true, goalDeadlines:true, dailyBriefing:false, briefingTime:"08:00" } };
export const DEFAULT_COLORS   = { person1:"#f472b6", person2:"#a78bfa", together:"#34d399" };

export const mk = (id, emoji, title, status, completedAt=null) => ({
  id, emoji, title, status, createdAt: 1739059200000, completedAt,
  date: null, time: null, carriedFrom: null, carriedFromWeek: null,
  category: null, who: "together", duration: null, type: "task",
});

import { getWeekAndYear } from "./utils.js";
const { week: _seedWeek, year: _seedYear } = getWeekAndYear();
const _seedKey = `${_seedYear}-W${String(_seedWeek).padStart(2,"0")}`;

export const SEED = {
  seedVersion: SEED_VERSION,
  currentWeekNumber: _seedWeek, currentYear: _seedYear,
  settings: DEFAULT_SETTINGS,
  goals: [
    { id:"sg1", emoji:"🍽️", title:"Cenar juntos fuera de casa", who:"together", period:"monthly", target:2, active:true, createdAt:1739059200000 },
    { id:"sg2", emoji:"🏃", title:"Hacer deporte juntos", who:"together", period:"weekly", target:2, active:true, createdAt:1739059200000 },
    { id:"sg3", emoji:"🧘", title:"Día de relax sin pantallas", who:"together", period:"monthly", target:1, active:true, createdAt:1739059200000 },
  ],
  weeks: {
    [_seedKey]: {
      weekNumber: _seedWeek, year: _seedYear,
      epicObjective: "¡Empezar con buen pie! 🚀",
      createdAt: Date.now(),
      workHours: { person1:0, person2:0 },
      missions: [
        mk("s01","🎯","Añade aquí tu primera tarea","TBC"),
        mk("s02","📅","Crea un evento para esta semana","TBC"),
        {...mk("s03","🏃","Hacer deporte juntos","TBC"), who:"together"},
        {...mk("s04","🍳","Cocinar algo rico en casa","TBC"), who:"together"},
        mk("s05","🌿","Momento de desconexión y relax","TBC"),
      ],
    },
  },
};

// ─── Gasto categories ─────────────────────────────────────────────────────────
export const GASTO_CATS = [
  { id:"comida",      label:"Comida",       icon:"🍽️",  color:"#f97316" },
  { id:"super",       label:"Supermercado", icon:"🛒",  color:"#fb923c" },
  { id:"casa",        label:"Casa",         icon:"🏠",  color:"#a78bfa" },
  { id:"ocio",        label:"Ocio",         icon:"🎉",  color:"#e879f9" },
  { id:"transporte",  label:"Transporte",   icon:"🚗",  color:"#60a5fa" },
  { id:"salud",       label:"Salud",        icon:"💊",  color:"#34d399" },
  { id:"viaje",       label:"Viaje",        icon:"✈️",  color:"#38bdf8" },
  { id:"ropa",        label:"Ropa",         icon:"👕",  color:"#fbbf24" },
  { id:"tech",        label:"Tecnología",   icon:"💻",  color:"#818cf8" },
  { id:"cultura",     label:"Cultura",      icon:"🎭",  color:"#c084fc" },
  { id:"deporte",     label:"Deporte",      icon:"🏅",  color:"#4ade80" },
  { id:"mascotas",    label:"Mascotas",     icon:"🐾",  color:"#f472b6" },
  { id:"regalo",      label:"Regalos",      icon:"🎁",  color:"#f43f5e" },
  { id:"suscripcion", label:"Suscripciones",icon:"📺",  color:"#94a3b8" },
  { id:"otro",        label:"Otro",         icon:"📦",  color:"var(--t-text-muted,#8b7fa8)" },
];

// ─── Themes ───────────────────────────────────────────────────────────────────
export const _DT = { text:"#f8f4ff", textMuted:"#8b7fa8", textDim:"#4a4166" };
export const THEMES = [
  // ── Oscuros originales ────────────────────────────────────────────────────
  {
    id:"violet", name:"Noche Violeta", preview:["#f472b6","#a78bfa","#34d399"], dark:true, pair:"lavender",
    bg:"#080512",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(167,139,250,0.40) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(244,114,182,0.35) 0%,transparent 52%)",
    menuBg:"rgba(6,3,16,0.98)", topBarBg:"rgba(6,3,14,0.94)",
    card:"#130d2a", cardBorder:"rgba(167,139,250,0.18)",
    btnGrad:"linear-gradient(135deg,#f472b6,#a78bfa)",
    accent:"#a78bfa", accentSoft:"rgba(167,139,250,0.14)",
    fontBody:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", googleFonts:null,
    ..._DT,
  },
  {
    id:"ocean", name:"Océano Profundo", preview:["#22d3ee","#818cf8","#06b6d4"], dark:true, pair:"sky",
    bg:"#010c18",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(6,182,212,0.38) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(99,102,241,0.32) 0%,transparent 52%)",
    menuBg:"rgba(1,7,15,0.98)", topBarBg:"rgba(1,9,18,0.94)",
    card:"#071a2c", cardBorder:"rgba(6,182,212,0.18)",
    btnGrad:"linear-gradient(135deg,#06b6d4,#818cf8)",
    accent:"#22d3ee", accentSoft:"rgba(34,211,238,0.13)",
    fontBody:"'DM Sans',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap",
    ..._DT,
  },
  {
    id:"sage", name:"Jardín Botánico", preview:["#4ade80","#a3e635","#fbbf24"], dark:true, pair:"mint",
    bg:"#030c06",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(74,222,128,0.35) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(251,191,36,0.28) 0%,transparent 52%)",
    menuBg:"rgba(2,8,4,0.98)", topBarBg:"rgba(3,11,5,0.94)",
    card:"#08180d", cardBorder:"rgba(74,222,128,0.18)",
    btnGrad:"linear-gradient(135deg,#4ade80,#fbbf24)",
    accent:"#4ade80", accentSoft:"rgba(74,222,128,0.13)",
    fontBody:"'Nunito',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap",
    ..._DT,
  },
  {
    id:"sunset", name:"Atardecer", preview:["#fb923c","#f43f5e","#fbbf24"], dark:true, pair:"peach",
    bg:"#110507",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(251,146,60,0.38) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(244,63,94,0.32) 0%,transparent 52%)",
    menuBg:"rgba(14,4,6,0.98)", topBarBg:"rgba(14,5,7,0.94)",
    card:"#1e0b0e", cardBorder:"rgba(251,146,60,0.2)",
    btnGrad:"linear-gradient(135deg,#fb923c,#f43f5e)",
    accent:"#fb923c", accentSoft:"rgba(251,146,60,0.13)",
    fontBody:"'Lato','Helvetica Neue',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
    ..._DT,
  },
  {
    id:"obsidian", name:"Obsidiana", preview:["#e2e8f0","#94a3b8","#60a5fa"], dark:true, pair:"lavender",
    bg:"#050505",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(96,165,250,0.18) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(148,163,184,0.12) 0%,transparent 52%)",
    menuBg:"rgba(4,4,4,0.99)", topBarBg:"rgba(5,5,5,0.96)",
    card:"#101010", cardBorder:"rgba(148,163,184,0.14)",
    btnGrad:"linear-gradient(135deg,#94a3b8,#60a5fa)",
    accent:"#94a3b8", accentSoft:"rgba(148,163,184,0.1)",
    fontBody:"'Space Grotesk',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
    ..._DT,
  },
  // ── Nuevos: Fuera de la caja ──────────────────────────────────────────────
  {
    id:"aurora", name:"Aurora Boreal", preview:["#00ff88","#ff00cc","#00d4ff"], dark:true, pair:"mint",
    bg:"#030b10",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(0,255,136,0.45) 0%,transparent 50%),radial-gradient(ellipse at 105% -5%,rgba(255,0,204,0.40) 0%,transparent 50%)",
    menuBg:"rgba(2,7,12,0.98)", topBarBg:"rgba(3,9,14,0.95)",
    card:"#071520", cardBorder:"rgba(0,255,136,0.2)",
    btnGrad:"linear-gradient(135deg,#00ff88,#ff00cc)",
    accent:"#00ff88", accentSoft:"rgba(0,255,136,0.12)",
    fontBody:"'Space Grotesk',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
    ..._DT,
  },
  {
    id:"tokyo", name:"Neón Tokyo", preview:["#f0abfc","#22d3ee","#facc15"], dark:true, pair:"blush",
    bg:"#06010f",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(240,171,252,0.42) 0%,transparent 50%),radial-gradient(ellipse at 105% -5%,rgba(34,211,238,0.38) 0%,transparent 50%)",
    menuBg:"rgba(4,1,10,0.99)", topBarBg:"rgba(5,1,12,0.95)",
    card:"#110820", cardBorder:"rgba(240,171,252,0.2)",
    btnGrad:"linear-gradient(135deg,#d946ef,#22d3ee)",
    accent:"#f0abfc", accentSoft:"rgba(240,171,252,0.12)",
    fontBody:"'Space Grotesk',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
    ..._DT,
  },
  {
    id:"wine", name:"Vino & Oro", preview:["#be123c","#fbbf24","#f9a8d4"], dark:true, pair:"blush",
    bg:"#0e0208",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(190,18,60,0.45) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(251,191,36,0.35) 0%,transparent 52%)",
    menuBg:"rgba(10,2,7,0.99)", topBarBg:"rgba(12,2,8,0.95)",
    card:"#200614", cardBorder:"rgba(251,191,36,0.2)",
    btnGrad:"linear-gradient(135deg,#9f1239,#fbbf24)",
    accent:"#fbbf24", accentSoft:"rgba(251,191,36,0.12)",
    fontBody:"'Lato','Helvetica Neue',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
    ..._DT,
  },
  {
    id:"dawn", name:"Mañana Clara", preview:["#7c3aed","#f472b6","#10b981"], dark:false, pair:"violet",
    bg:"#f5f0ea",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(244,114,182,0.22) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(124,58,237,0.18) 0%,transparent 52%)",
    menuBg:"rgba(245,240,234,0.98)", topBarBg:"rgba(245,240,234,0.94)",
    card:"rgba(255,255,255,0.85)", cardBorder:"rgba(124,58,237,0.15)",
    btnGrad:"linear-gradient(135deg,#f472b6,#7c3aed)",
    accent:"#7c3aed", accentSoft:"rgba(124,58,237,0.1)",
    fontBody:"'Nunito',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap",
    text:"#1e0d3c", textMuted:"#5a4a7a", textDim:"#6e5c8a", error:"#c0392b",
  },
  // ── Temas claros ──────────────────────────────────────────────────────────
  {
    id:"blush", name:"Rosa Pastel", preview:["#e91e8c","#f472b6","#fb7185"], dark:false, pair:"tokyo",
    bg:"#fff0f5",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(233,30,140,0.12) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(251,113,133,0.10) 0%,transparent 52%)",
    menuBg:"rgba(255,240,245,0.98)", topBarBg:"rgba(255,240,245,0.94)",
    card:"rgba(255,255,255,0.9)", cardBorder:"rgba(233,30,140,0.15)",
    btnGrad:"linear-gradient(135deg,#e91e8c,#f472b6)",
    accent:"#e91e8c", accentSoft:"rgba(233,30,140,0.1)",
    fontBody:"'Nunito',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap",
    text:"#3d0028", textMuted:"#7a2d58", textDim:"#8c4472", error:"#b52042",
  },
  {
    id:"sky", name:"Cielo Azul", preview:["#0ea5e9","#38bdf8","#7dd3fc"], dark:false, pair:"ocean",
    bg:"#f0f8ff",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(14,165,233,0.12) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(56,189,248,0.10) 0%,transparent 52%)",
    menuBg:"rgba(240,248,255,0.98)", topBarBg:"rgba(240,248,255,0.94)",
    card:"rgba(255,255,255,0.9)", cardBorder:"rgba(14,165,233,0.15)",
    btnGrad:"linear-gradient(135deg,#0ea5e9,#38bdf8)",
    accent:"#0ea5e9", accentSoft:"rgba(14,165,233,0.1)",
    fontBody:"'DM Sans',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap",
    text:"#0c2a48", textMuted:"#1e5c96", textDim:"#2c6898", error:"#b52d20",
  },
  {
    id:"mint", name:"Menta Fresca", preview:["#059669","#10b981","#34d399"], dark:false, pair:"sage",
    bg:"#f0faf4",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(5,150,105,0.12) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(16,185,129,0.10) 0%,transparent 52%)",
    menuBg:"rgba(240,250,244,0.98)", topBarBg:"rgba(240,250,244,0.94)",
    card:"rgba(255,255,255,0.9)", cardBorder:"rgba(5,150,105,0.15)",
    btnGrad:"linear-gradient(135deg,#059669,#10b981)",
    accent:"#059669", accentSoft:"rgba(5,150,105,0.1)",
    fontBody:"'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", googleFonts:null,
    text:"#0a2e1e", textMuted:"#1a6040", textDim:"#1d7045", error:"#a52d14",
  },
  {
    id:"peach", name:"Melocotón", preview:["#ea7026","#f97316","#fb923c"], dark:false, pair:"sunset",
    bg:"#fff8f0",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(234,112,38,0.12) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(249,115,22,0.10) 0%,transparent 52%)",
    menuBg:"rgba(255,248,240,0.98)", topBarBg:"rgba(255,248,240,0.94)",
    card:"rgba(255,255,255,0.9)", cardBorder:"rgba(234,112,38,0.15)",
    btnGrad:"linear-gradient(135deg,#ea7026,#f97316)",
    accent:"#ea7026", accentSoft:"rgba(234,112,38,0.1)",
    fontBody:"'Lato','Helvetica Neue',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
    text:"#3d1500", textMuted:"#6e3010", textDim:"#7a3e12", error:"#a02010",
  },
  {
    id:"lavender", name:"Lavanda Suave", preview:["#7c3aed","#8b5cf6","#a78bfa"], dark:false, pair:"violet",
    bg:"#f5f0ff",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(124,58,237,0.12) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(139,92,246,0.10) 0%,transparent 52%)",
    menuBg:"rgba(245,240,255,0.98)", topBarBg:"rgba(245,240,255,0.94)",
    card:"rgba(255,255,255,0.9)", cardBorder:"rgba(124,58,237,0.15)",
    btnGrad:"linear-gradient(135deg,#7c3aed,#8b5cf6)",
    accent:"#7c3aed", accentSoft:"rgba(124,58,237,0.1)",
    fontBody:"'Space Grotesk',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
    text:"#1e0b4b", textMuted:"#5a3a8a", textDim:"#6b4fa8",
  },
  {
    id:"coffee", name:"Café Oscuro", preview:["#f59e0b","#92400e","#fde68a"], dark:true, pair:"peach",
    bg:"#0d0805",
    bgGrad:"radial-gradient(ellipse at -5% 105%,rgba(245,158,11,0.40) 0%,transparent 52%),radial-gradient(ellipse at 105% -5%,rgba(146,64,14,0.45) 0%,transparent 52%)",
    menuBg:"rgba(10,6,3,0.99)", topBarBg:"rgba(11,7,4,0.95)",
    card:"#1c1008", cardBorder:"rgba(245,158,11,0.2)",
    btnGrad:"linear-gradient(135deg,#92400e,#f59e0b)",
    accent:"#f59e0b", accentSoft:"rgba(245,158,11,0.12)",
    fontBody:"'Lato','Helvetica Neue',system-ui,sans-serif",
    googleFonts:"https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
    ..._DT,
  },
];

// ─── Fonts ────────────────────────────────────────────────────────────────────
export const FONTS = [
  { id:"auto",         name:"Automático (del tema)",  family:null, googleFonts:null },
  { id:"inter",        name:"Inter",                  family:"'Inter',system-ui,sans-serif",                googleFonts:"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
  { id:"poppins",      name:"Poppins",                family:"'Poppins',system-ui,sans-serif",              googleFonts:"https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" },
  { id:"playfair",     name:"Playfair Display",       family:"'Playfair Display',Georgia,serif",            googleFonts:"https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" },
  { id:"space",        name:"Space Grotesk",          family:"'Space Grotesk',system-ui,sans-serif",        googleFonts:"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" },
  { id:"raleway",      name:"Raleway",                family:"'Raleway',system-ui,sans-serif",              googleFonts:"https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap" },
  { id:"montserrat",   name:"Montserrat",             family:"'Montserrat',system-ui,sans-serif",           googleFonts:"https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" },
  { id:"merriweather", name:"Merriweather",           family:"'Merriweather',Georgia,serif",                googleFonts:"https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap" },
  { id:"quicksand",    name:"Quicksand",              family:"'Quicksand',system-ui,sans-serif",            googleFonts:"https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" },
  { id:"josefin",      name:"Josefin Sans",           family:"'Josefin Sans',system-ui,sans-serif",         googleFonts:"https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap" },
  { id:"dmserif",      name:"DM Serif Display",       family:"'DM Serif Display',Georgia,serif",            googleFonts:"https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap" },
];
