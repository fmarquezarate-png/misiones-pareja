# Plan Monolito Fase 2 — Extracción de componentes de App.jsx

> Generado: 2026-05-22
> Contexto: App.jsx tiene 2832 líneas. La Fase 1 ya extrajo vistas enteras (GoalsView, StatsView, GastosView, etc.). Esta fase extrae los componentes que siguen inline en App.jsx.

---

## Tabla de candidatos (orden MENOR → MAYOR riesgo)

| # | Componente | Líneas aprox | Nº props | Estado local propio | Riesgo | Notas |
|---|-----------|:---:|:---:|:---:|:---:|---|
| 1 | `WorkHoursCard` | 34 | 4 | 1 (`open`) | **Bajo** | Sin deps de módulo fuera de `S.*`. 100% autocontenido. |
| 2 | `ChatView` | 80 | 3 | 3 (`messages`, `input`, `sending`) | **Bajo** | Usa `loadMessages`, `subscribeToMessages`, `sendMessage`, `supabase`, `showNotif` — todos importables directamente. Sin `STATUS`, `CATEGORIES` ni estilos compartidos complejos. |
| 3 | `AddMissionForm` | 139 | 7 | 1 (`endMode`) | **Medio** | Depende de `CATEGORIES`, `CAT_MAP`, `catBadgeStyle`, `EmojiSelect`, `S.*`. Hay que decidir si exportar las constantes de módulo o duplicarlas. La lógica de `computeEnd`/`computeDur` es pura y portable. |
| 4 | `MissionCard` | 118 | 9 | 2 (`expanded`, `popping`) | **Medio** | Depende de `STATUS`, `STATUS_ORDER`, `CATEGORIES`, `CAT_MAP`, `getMCats`, `catBadgeStyle`, `badgeStyle`, `googleCalendarUrl`, `EmojiSelect`, `S.*`. Muchas deps de módulo, pero ninguna de estado global — solo props. |
| 5 | `CalendarView` | 238 | 10 | 6 | **Alto** | Depende de `getMissionDates` (función interna no exportada), `STATUS`, `STATUS_ORDER`, `CATEGORIES`, `CAT_MAP`, `getMCats`, `catBadgeStyle`, `badgeStyle`, `DEFAULT_COLORS`, `isoWeekKey`, `S.*`, y el hook `useConfirm` (alias `confirm`). Además inline-renderiza un mini-editor de misión completo. Candidata a subdividir antes de extraer. |
| 6 | `ProfileModal` | 302 | 12 | 16 | **Alto** | El componente más grande y con más estado propio. Maneja fotos (canvas), push, notificaciones, tema y fuente. Depende de `THEMES`, `FONTS`, `DEFAULT_COLORS`, `getUserPrefs`, `saveUserPrefs`, `S.*`. El push (4 props) es arquitectónicamente crítico (ver regla de scope en CLAUDE.md §2). No mover sin tests de regresión push. |

---

## Dependencias de módulo que deben resolverse antes de extraer

Antes de extraer cualquier componente que use estas constantes/funciones, hay que exportarlas desde un módulo compartido (o moverlas a `src/appConstants.js` que ya existe):

| Símbolo | Tipo | Usado por |
|---------|------|-----------|
| `STATUS`, `STATUS_ORDER` | const objeto/array | MissionCard, CalendarView |
| `CATEGORIES`, `CAT_MAP` | const array/objeto | AddMissionForm, MissionCard, CalendarView |
| `getMCats` | función | MissionCard, CalendarView |
| `catBadgeStyle`, `badgeStyle` | función de estilo | AddMissionForm, MissionCard, CalendarView |
| `DEFAULT_COLORS` | const objeto | ProfileModal, CalendarView |
| `getMissionDates` | función | CalendarView (no está en utils.js — hay que moverla) |
| `S` (objeto de estilos) | const objeto | Todos |
| `showNotif` | función | ChatView |
| `getUserPrefs`, `saveUserPrefs` | función | ProfileModal |

---

## Orden de extracción recomendado

### Sprint 1 — Bajo riesgo (sin bloqueos)
1. **`WorkHoursCard`** → `src/components/WorkHoursCard.jsx`
   - Solo necesita `S.*` (estilos inline — se pueden pasar como prop o copiar).
   - Verificar: `npm run lint && npm run test` — el scaffold Vitest ya da cobertura básica.

2. **`ChatView`** → `src/views/ChatView.jsx`
   - Mover imports de `loadMessages`, `subscribeToMessages`, `sendMessage`, `supabase`, `showNotif`.
   - `showNotif` es una función de módulo — extraerla a `src/lib/notif.js` antes de mover ChatView.

### Sprint 2 — Medio riesgo (requiere exportar constantes primero)
3. Exportar `STATUS`, `STATUS_ORDER`, `CATEGORIES`, `CAT_MAP`, `getMCats`, `catBadgeStyle`, `badgeStyle` desde `src/appConstants.js`.
4. **`AddMissionForm`** → `src/components/AddMissionForm.jsx`
5. **`MissionCard`** → `src/components/MissionCard.jsx`

### Sprint 3 — Alto riesgo (requiere subdivisión previa)
6. Mover `getMissionDates` a `src/utils.js` y exportarla.
7. Extraer el mini-editor inline de CalendarView como `CalendarMissionEditor.jsx`.
8. **`CalendarView`** → `src/views/CalendarView.jsx`
9. **`ProfileModal`** → `src/components/ProfileModal.jsx`
   - Precondición: pasar push props tal como están (no mover estado push al modal — ver CLAUDE.md §2).
   - Considerar subdividir: `ProfilePersonRow`, `ProfilePushSection`, `ProfileNotifSection`.

---

## Riesgo arquitectónico: ProfileModal y el estado push

La regla de scope (CLAUDE.md §2) prohíbe que `ProfileModal` declare estado push. Los 4 props push (`pushSupported`, `pushSubscribed`, `pushLoading`, `pushError`, `onPushToggle`) deben seguir viviendo en `CoupleMissions` y pasarse como props. Esta restricción no cambia con la extracción — solo hay que asegurarse de que el nuevo archivo no "esconda" un `useState` push adentro.
