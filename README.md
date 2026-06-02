# Misiones de Pareja

> PWA de planificación semanal para parejas. Organizad misiones, metas y actividades juntos — en tiempo real, desde cualquier dispositivo.

---

## ¿Qué es?

Misiones de Pareja es una Progressive Web App diseñada para que dos personas gestionen conjuntamente sus objetivos semanales, eventos, metas y estadísticas. Funciona como un tablero compartido donde cada tarea puede asignarse a una persona o a los dos, con seguimiento de estado, categorías, historial y análisis de tendencias.

Acceso por código de pareja — sin email, sin contraseña. Instalable en iOS, Android y escritorio.

---

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 18 (hooks, sin router) |
| Build | Vite 5 + `@vitejs/plugin-react` |
| PWA | `vite-plugin-pwa` (service worker, offline, instalable) |
| Auth | Supabase Auth (email + magic link) |
| Persistencia | Supabase — blob JSON en `app_data` + tablas normalizadas (`missions`, `goals`, `couple_settings`) |
| Guardado | CAS (Compare-And-Swap) con rebase-on-conflict — nunca se pierden datos en edición concurrente |
| Push | Web Push API + Edge Function `send-push` en Supabase |
| Despliegue | Netlify (deploy automático desde `main`) |
| CI | GitHub Actions — lint + test + build en cada push y PR |
| Tests | Vitest |

**Dependencias de producción:**
- `react` / `react-dom` ^18.2
- `@supabase/supabase-js` ^2.39

---

## Estructura del proyecto

```
misiones-pareja/
├── src/
│   ├── App.jsx                  # Orquestador principal, estado global de negocio
│   ├── main.jsx                 # Punto de entrada React + service worker
│   ├── supabase.js              # Cliente Supabase: auth, carga, guardado, realtime
│   ├── components/              # Componentes UI reutilizables
│   │   ├── MissionCard.jsx
│   │   ├── AddMissionForm.jsx
│   │   ├── StatsView.jsx
│   │   ├── CalendarView.jsx
│   │   ├── HistoryView.jsx
│   │   ├── ProfileModal.jsx
│   │   └── ...
│   ├── views/                   # Vistas de sección completas
│   │   └── GoalsView.jsx
│   ├── lib/                     # Lógica pura y servicios
│   │   ├── appUtils.js          # carry-over, repair, scheduling
│   │   ├── flags.js             # Feature flags con overrides por localStorage
│   │   ├── repo.js              # Operaciones normalizadas (missions, goals)
│   │   ├── save.js              # rebaseMutators — merge de cambios concurrentes
│   │   ├── validation.js        # isValidAppData — gate de integridad
│   │   ├── push.js              # sendContextualPush
│   │   └── track.js             # Telemetría de eventos
│   ├── helpers/                 # Helpers de dominio
│   │   ├── carryHelpers.js
│   │   ├── dateHelpers.js
│   │   └── goalHelpers.js
│   ├── hooks/
│   │   └── useNotifications.js
│   ├── constants.js             # APP_VERSION, CHANGELOG, VAPID_PUBLIC_KEY
│   ├── utils.js                 # ISO week, isoWeekKey, uid, getWeekAndYear
│   └── __tests__/               # Tests unitarios e integración (Vitest)
│       ├── save.test.js
│       ├── save-integration.test.js
│       └── utils.test.js
├── public/
│   ├── sw.js                    # Service worker (vite-plugin-pwa + skipWaiting)
│   └── version.json             # Versión para detección de updates
├── index.html
├── vite.config.js
├── netlify.toml
└── package.json
```

---

## Features — v4.2.1

### Semana actual
- Objetivo épico editable de la semana
- Misiones con estado ciclable: `TBC → ASAP → En curso → Hecho`
- Multi-categoría (Pareja, Deporte, Casa, Salud, Trabajo, Ocio, Social, Viaje)
- Asignación por persona: Persona 1 / Persona 2 / Juntos
- Tipos: Tarea o Evento (con fecha / hora / duración / reminder)
- Series recurrentes: Semanal / Quincenal / Mensual con fecha de fin
- Carry-over automático de misiones pendientes a la semana siguiente
- Filtro global por persona (persiste entre tabs)

### Historial
- Semanas pasadas con progreso visual y foto de recuerdo
- Exportar a PDF por rango

### Calendario
- Vista mensual con emojis por día
- Ciclar estado de misiones desde el día
- Exportar a Google Calendar (.ics)

### Metas
- Periodicidad: Semanal / Mensual / Anual
- Tipo: Mínimo (hacer al menos X) / Máximo (no más de X)
- Deadline con countdown en tiempo real
- Progreso del período + historial de períodos anteriores
- Vinculación de misiones a metas

### Stats
- KPIs: semanas, misiones completadas, % completitud, racha récord
- Gráficos de progreso, distribución por estado, participación por persona
- 7 insights algorítmicos: tendencia, mejor/peor semana, categoría estrella, equilibrio de carga, etc.

### Gastos
- Registro compartido de gastos con categorías

### Chat
- Mensajes rápidos entre los dos miembros

### Links
- Repositorio compartido de URLs con título y descripción

### Notificaciones push
- Notificaciones en iOS, Android y escritorio
- Alertas contextuales al completar misiones, avanzar al siguiente día, etc.

### General
- Auth por código de pareja (sin email/contraseña)
- Perfil por persona: nombre, avatar comprimido, color
- Instalable como PWA (funciona offline en modo lectura)
- Guardado en tiempo real con CAS + rebase — no se pierden cambios en edición simultánea
- Sincronización instantánea entre dispositivos via Supabase Realtime
- Changelog en-app con historial de versiones

---

## Arquitectura de datos

### Blob JSON (`app_data.data`)

Fuente de escritura. Contiene el estado completo de la app serializado como JSONB.

```
{
  currentWeekNumber: number,
  currentYear: number,
  settings: { person1, person2, colors },
  goals: Goal[],
  weeks: {
    "YYYY-Www": {
      weekNumber, year, epicObjective,
      missions: Mission[],
      workHours: { person1, person2 },
      photo?: string        -- base64 comprimida
    }
  }
}
```

### Tabla `missions`

Fuente de verdad para lectura desde v4.2.1. Dual-write activo: cada mutación del blob propaga los cambios a esta tabla. Permite consultas SQL eficientes por misión individual.

Columnas clave: `blob_id` (nanoid — ID del blob), `couple_id`, `week_key`, `status`, `series_blob_id`, `carried_from_blob_id`.

### Safety check de lectura

`loadFromNormalized` hace fallback automático al blob si:
- La tabla tiene 0 filas pero el blob tiene misiones
- La tabla tiene < 80% de las misiones del blob

### Guardado CAS

`save_app_data_cas` RPC con `WHERE version = p_version`. Si hay conflicto (otra persona guardó antes), el cliente recarga los datos frescos y re-aplica sus cambios locales encima (`rebaseMutators`) — nunca se descarta ningún cambio.

### Otras tablas

| Tabla | Contenido |
|-------|-----------|
| `couples` | Pareja: código de acceso, nombre |
| `couple_members` | Miembros de la pareja con auth.uid |
| `goals` | Metas normalizadas con `blob_id` |
| `couple_settings` | Ajustes de configuración normalizados |
| `push_subscriptions` | Endpoints Web Push por dispositivo |
| `app_data_backups` | Snapshots antes de cada save (retención: últimos 12) |
| `events` | Telemetría de eventos de la app |

---

## Variables de entorno

Crear `.env.local` en la raíz:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_VAPID_PUBLIC_KEY=<clave pública VAPID>
```

En Netlify: **Site settings → Environment variables**.

---

## Desarrollo local

**Requisitos:** Node.js 18+, npm

```bash
git clone https://github.com/fmarquezarate-png/misiones-pareja
cd misiones-pareja
npm install
cp .env.example .env.local   # añadir tus claves de Supabase
npm run dev
```

La app corre en `http://localhost:5173`.

```bash
npm run build    # build de producción (incluye lint)
npm run test     # tests unitarios (Vitest)
npm run lint     # ESLint — 0 errores requeridos para build
```

---

## Despliegue

- **Plataforma:** Netlify
- **Rama de producción:** `main`
- **Build command:** `npm run build` (incluye `eslint --max-warnings 0`)
- **Publish directory:** `dist`
- **Deploy automático:** sí, en cada push/merge a `main`

---

## Deuda técnica conocida

| Severidad | Item |
|-----------|------|
| Media | `applyCarryOver` no tiene retry si se pierde la ejecución del lunes |
| Baja | `expenses_v2_enabled` e `idb_offline_queue` — flags sin implementación activa |
| Baja | Push server-side vía tabla `push_queue` — alternativa a futuro (el timing ya está resuelto con `runAfterSave` en v4.2.3) |

---

*Versión actual: **v4.2.1** — Última actualización: 2026-06-01*
