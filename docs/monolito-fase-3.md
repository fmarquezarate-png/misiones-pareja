# Plan Monolito Fase 3 — Descomposición del estado de `CoupleMissions`

> Generado: 2026-08-23 (v5.20.0)
> Contexto: la Fase 1/2 extrajo las VISTAS y COMPONENTES (MissionCard, ProfileModal,
> ChatView, CalendarView, WorkHoursCard, ~72 componentes). Lo que queda del "monolito"
> NO es JSX: es el **cerebro con estado** de `CoupleMissions` en `App.jsx`.
>
> Métricas hoy: `App.jsx` ~2720 líneas · `CoupleMissions` con **61 useState, 40 useEffect,
> 23 useRef, 6 useCallback** (~130 hooks). `src/lib`: 30 módulos puros (creciendo).

---

## Principio rector

Dos técnicas, en este orden de preferencia por seguridad:

1. **Extraer lógica PURA a `src/lib/*.js`** (funciones deterministas + tests). Cero riesgo.
   Ya se hace de forma continua (v5.x: `decideSaveStep`, `computeStreakDelta`, `migrateBlob`,
   `photoStore`, `dataGuards`, `save`, `identity`…). **Seguir haciéndolo por defecto.**
2. **Extraer clusters de estado+efectos a custom hooks** (`useX`). Reduce el nº de hooks del
   componente sin cambiar comportamiento. Riesgo según el cluster (ver clasificación).

**Regla de oro (CLAUDE.md §2 + reglas de closures §5):** un hook extraído debe preservar
EXACTO el comportamiento de refs/closures. Cualquier estado que use un callback dentro de un
`useEffect` con deps que no lo incluyen necesita su `ref` espejo — no romper ese patrón al mover.

---

## Clasificación de los 40 efectos

### 🟥 NÚCLEO CRÍTICO — no tocar sin campaña dedicada + tests (≈8 efectos)
Es el corazón que protagonizó toda la saga de guardado/offline. Alto acoplamiento por refs
compartidos (`dataVersionRef`, `isSavingRef`, `unconfirmedRef`, `saveTimerRef`, `pendingSaveRef`…).

- Carga inicial (`loadLocalBackupAsync` + red + migraciones + offline short-circuit).
- Realtime (`subscribeToUpdates` + guard `hasPendingSave` + sync de versión).
- Guardado (`runSave` + `scheduleSave` + flush a background + retry al reconectar).
- `visibilitychange` (refresh + flush).
- Migración de fotos.

**Objetivo futuro (NO ahora):** encapsular en `useCoupleData(coupleId)` (carga+realtime+backup)
y `useSaveEngine(...)` (runSave+CAS+write-guard). Requiere: extraer primero TODA la decisión a
`lib/save.js` (empezado con `decideSaveStep`/`rebaseMutators`), suite de tests del state-machine,
y verificación en staging con la pareja real. Es el mayor riesgo del repo.

### 🟩 PERIFÉRICOS — extraíbles a hooks con riesgo BAJO (≈15–20 efectos)
Leen `data` y disparan timers/toasts/notifs, pero NO tocan el guardado/realtime/refs del núcleo.
Cada uno puede vivir en su propio hook con API mínima.

| Hook propuesto | Efecto(s) que absorbe | Notas |
|----------------|-----------------------|-------|
| `useOnlineStatus()` | online/offline listeners → `isOnline` | Trivial. Buen primer paso. |
| `useReminders(data, p1, p2)` | `scheduleReminders` de eventos | Ya usa helper de `appUtils`. |
| `useDateReminders(data, pushToast)` | cumpleaños/aniversario (toast hoy/mañana) | Autocontenido. |
| `useMoodSurvey(...)` | trigger de encuesta de ánimo 18:00 | Timers propios. |
| `useDailyBriefing(...)` | briefing diario | Timer propio. |
| `useSpecialDay(data)` | detección de día especial (tema/botón) | Solo lectura. |
| `useMatchDay()` | mundial / match day theme | Fetch propio, sin estado de negocio. |
| `useAppBadge(chatUnread)` | `setAppBadge`/`clearAppBadge` + título | Efecto de plataforma. |
| `useWrappedGate(...)` | gate del recap lunes/1º de mes | localStorage propio. |
| `usePushNudge(...)` | visibilidad del nudge de push | Estado UI propio. |
| `useMisiIdle(...)` | tiers de inactividad de Misi | Timers propios. |

Sacar estos ~10 hooks bajaría `CoupleMissions` de ~40 a ~10-15 efectos (los del núcleo + los
refs espejo), **sin tocar** el guardado. Es la mayor mejora de mantenibilidad por menor riesgo.

### 🟨 REFS ESPEJO — dejar donde están
`dataRef`, `pendingSaveRef`, `pushSubscribedRef`, `notifSettingsRef`, etc. son pequeños
`useEffect([estado])` que sincronizan un ref. Baratos y críticos para las reglas de closures.
Moverlos aporta poco y arriesga romper el patrón. **No prioritarios.**

---

## Orden recomendado (incremental, cada uno su release + tests)

1. **`useOnlineStatus`** — demostración del patrón, riesgo mínimo.
2. **`useDateReminders` + `useReminders`** — recordatorios, autocontenidos.
3. **`useMoodSurvey` + `useDailyBriefing`** — timers de notificación.
4. **`useSpecialDay` + `useMatchDay` + `useAppBadge` + `useWrappedGate`** — solo-lectura/plataforma.
5. **`usePushNudge` + `useMisiIdle`** — estado UI.
6. *(Campaña aparte, con red de tests y staging)* `useCoupleData` + `useSaveEngine` — el núcleo.

Regla de cierre por paso: `npm run lint && npm test && npm run build` verdes + verificación manual
de que el comportamiento no cambió (el hook extraído es un movimiento, no una reescritura).

---

## Veredicto

- **No es definitivo:** el cerebro se puede adelgazar mucho (≈40 → ≈10-15 efectos) con riesgo bajo.
- **No es urgente:** el monolito no causa bugs activos; su coste es de mantenibilidad.
- **El núcleo de guardado es lo último y lo más delicado** — solo con campaña dedicada, nunca en una
  ventana recién estabilizada sin motivo. Mientras, **seguir extrayendo lógica pura a `src/lib`** es
  la vía segura y continua de reducir el monolito (lo hacemos en cada sprint).
</content>
