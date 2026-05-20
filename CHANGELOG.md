# Changelog — Misiones de Pareja

Todas las versiones notables de este proyecto están documentadas aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Cada merge a la rama principal incrementa la versión de parche (x.y.**z**).
Los hitos de sprint incrementan la versión menor (x.**y**.0).

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
