# CLAUDE.md — Reglas de oro para agentes en este repositorio

## Regla de oro: Todo error → medida preventiva permanente

Cada vez que ocurre un bug o error en producción, se añade aquí una regla
que impide que vuelva a suceder. Las reglas son técnicas (linters, hooks,
validaciones) o arquitectónicas (dónde vive cada cosa).

---

## Lint obligatorio — no saltarse jamás

```
npm run lint        # 0 errores requeridos
npm run build       # llama a lint antes de compilar
```

El build falla si hay errores de linting. Nunca usar `--no-verify` ni
`--max-errors` para bypass. Si el lint falla, arreglar el código.

**Reglas clave:**
- `no-undef: error` — variables indefinidas = bug de scope garantizado
- `react-hooks/rules-of-hooks: error` — hooks condicionales = crash en runtime
- `react-hooks/exhaustive-deps: warn` — deps faltantes en useEffect

---

## Arquitectura de componentes — dónde vive el estado

### Regla de scope de React (origen: bug "Can't find variable: pushNudgeVisible")

**EL ESTADO VIVE EN EL COMPONENTE QUE LO RENDERIZA O EN SU PADRE.**
Nunca declarar estado en un componente hijo si el padre también lo necesita.

Árbol de componentes principales:

```
AppWithAuth
└── CoupleMissions          ← estado global de la sesión
    ├── HomeDashboard        ← recibe props, no declara estado de negocio
    ├── ProfileModal         ← recibe props push*, no los declara internamente
    ├── StatsView
    ├── CalendarView
    ├── ChatView
    └── GastosView
```

**Estado que vive en `CoupleMissions` (no en hijos):**
- `pushSubscribed`, `pushLoading`, `pushError`, `pushNudgeVisible`
- `pushSupported`, `handlePushToggle`
- `pushSubscribedRef`, `pushNudgeDismissRef`
- `data`, `coupleId`, `savingState`, `syncError`

`ProfileModal` recibe push state como props:
`pushSupported`, `pushSubscribed`, `pushLoading`, `pushError`, `onPushToggle`

**Si necesitás añadir estado nuevo:** preguntate primero si más de un
componente lo necesita. Si sí → va en el ancestro común más cercano.

---

## Validaciones obligatorias

### importData (supabase.js)
Siempre validar estructura interna antes de resolver:
- `typeof parsed.weeks === "object"`
- Cada semana con `missions` debe tener `Array.isArray(missions) === true`

### completedAt (App.jsx)
`completedAt` puede ser `number` (Date.now()) o `string` (ISO). Al procesar
fechas, siempre manejar ambos:
```js
// ✅ correcto
if (typeof m.completedAt === 'string') return m.completedAt.slice(0,10);
if (typeof m.completedAt === 'number') return new Date(m.completedAt).toISOString().slice(0,10);

// ❌ incorrecto — rompe la racha de logros con timestamps numéricos
typeof m.completedAt === 'string' ? m.completedAt.slice(0,10) : null
```

---

## Versionado

- Cada lote de cambios bump a `APP_VERSION` en `src/constants.js`
- Añadir entrada en `CHANGELOG` con notas claras
- Formato: `MAJOR.MINOR.PATCH` — patch para fixes, minor para features

Versión actual: ver `src/constants.js`

---

## Commits

- Mensajes en inglés con prefijo: `fix:`, `feat:`, `refactor:`, `docs:`
- Incluir el ID de sesión de Claude al final del commit message
- Branch activo: `claude/debug-app-issues-rVPzI`
