# Misiones de Pareja 💞

> Tracker semanal de misiones y actividades para parejas. Planificad juntos, medid el progreso, construid hábitos.

---

## ¿Qué es?

Misiones de Pareja es una PWA (Progressive Web App) diseñada para que dos personas gestionen conjuntamente sus objetivos semanales, eventos, metas y estadísticas de pareja. Funciona como un tablero compartido donde cada tarea puede asignarse a una persona o a los dos, con seguimiento de estado, categorías, historial y análisis de tendencias.

La app no requiere registro: una sola instancia de datos compartida, pensada para uso en pareja con acceso desde cualquier dispositivo.

---

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 18 (hooks, sin router) |
| Build | Vite 5 + `@vitejs/plugin-react` |
| PWA | `vite-plugin-pwa` 0.17 (service worker, offline, instalable) |
| Persistencia | Supabase (PostgreSQL via REST, upsert de un blob JSON) |
| Despliegue | Netlify (CI/CD desde rama `main`) |
| Estilos | CSS-in-JS inline (sin librería de estilos) |

**Dependencias de producción:**
- `react` / `react-dom` ^18.2
- `@supabase/supabase-js` ^2.39

---

## Estructura de carpetas

```
misiones-pareja/
├── src/
│   ├── App.jsx          # Toda la aplicación (componentes, lógica, estilos)
│   ├── main.jsx         # Punto de entrada React
│   └── supabase.js      # Cliente Supabase + loadData / saveData
├── public/
│   ├── icon-192.png     # Icono PWA
│   └── icon-512.png     # Icono PWA maskable
├── dist/                # Build de producción (generado)
├── index.html           # HTML raíz
├── vite.config.js       # Config Vite + PWA manifest
├── netlify.toml         # Build command + SPA redirect
└── package.json
```

> **Nota:** Toda la lógica vive en un único archivo `App.jsx` (~1700 líneas). Esta decisión fue intencional para simplificar el desarrollo inicial, pero es el principal punto de deuda técnica a resolver en v2.0.

---

## Features actuales — v1.8.0

### 🎯 P1 — Semana actual
- Objetivo épico editable de la semana
- Lista de misiones con estado ciclable: `TBC → ASAP → En curso → Hecho`
- Multi-categoría por misión (Pareja, Deporte, Casa, Salud, Trabajo, Ocio, Social, Viaje)
- Asignación por persona: Persona 1 / Persona 2 / Juntos
- Tipos: Tarea o Evento (con fecha/hora/duración)
- Tareas recurrentes (Semanal / Mensual) con generación automática cada lunes
- Carry-over automático: misiones pendientes se arrastran a la semana siguiente
- Registro de horas laborales por persona
- Filtro global por persona (persiste entre tabs)

### 📅 P2 — Calendario
- Vista mensual con emojis por día
- Panel lateral con detalle del día seleccionado
- Ciclar estado de misiones directamente desde el día
- Filtro de persona sincronizado con el filtro global
- Exportar a Google Calendar (.ics) / PDF de semana

### 🗂️ P3 — Historial
- Listado de semanas pasadas con progreso visual
- Foto de recuerdo por semana
- Filtros: Esta semana / 4 últimas / 8 últimas / Todas
- Exportar PDF del rango filtrado
- Filtro de persona global aplicado

### 🏅 P4 — Metas
- Metas con periodicidad: Semanal / Mensual / Anual
- Tipo de límite: Mínimo (hacer al menos X) o Máximo (no más de X)
- Deadline opcional con countdown en tiempo real (HH:MM:SS cuando quedan <24h)
- Progreso del período actual + historial de períodos anteriores
- Archivar / reactivar metas
- Vinculación de misiones a metas desde el formulario de tarea

### 📊 P5 — Stats
- Filtros: Quién (Todos / P1 / P2 / Juntos) × Rango (Siempre / Esta sem. / 4 / 8 / 12 sem.)
- KPIs: semanas, misiones, % completitud, racha récord
- Gráfico de progreso semanal normalizado al máximo real
- Distribución de estados (donut SVG + barras)
- Participación por persona con % de completitud
- Gráfico de categorías: toggle Actividades / Horas (Trabajo en escala independiente)
- 7 insights algorítmicos: tendencia, mejor/peor semana, categoría estrella, punto débil, equilibrio de carga, ratio vida-trabajo, racha perfecta, velocidad semanal
- Detalle colapsable por semana con navegación directa

### ⚙️ General
- Versión dorada con fecha y popup de changelog
- Configuración de nombres y colores por persona
- "Distribuir eventos": mueve misiones con fecha a su semana correcta
- Instalable como PWA (funciona offline en modo lectura)

---

## Features planeadas — v2.0

### Alta prioridad
- **Autenticación OAuth** (Google / Apple) — actualmente bloqueante para multi-pareja
- **Multi-pareja / multi-usuario**: cada pareja con su propio espacio de datos aislado
- **Notificaciones push**: recordatorio del objetivo épico los lunes
- **Split en archivos**: descomponer `App.jsx` en componentes modulares

### Media prioridad
- **Menú principal / navegación lateral**: acceso rápido entre secciones
- **Modo oscuro/claro** configurable
- **Plantillas de semana**: semanas predefinidas por tipo (viaje, trabajo intenso, etc.)
- **Fotos múltiples** por semana (actualmente solo 1)
- **Compartir semana**: URL pública de solo lectura para una semana concreta

### Baja prioridad / Exploración
- **Claude API para insights reales**: análisis narrativo generado por IA (base algorítmica ya en v1.8)
- **Widget nativo iOS/Android** via Shortcuts
- **Gamificación**: badges, logros por rachas, niveles de pareja
- **Sync bidireccional con Google Calendar**

---

## Arquitectura de datos

### Supabase — tabla `app_data`

```
app_data
├── id          TEXT PRIMARY KEY   -- fijo: "couple-missions"
├── data        JSONB              -- todo el estado de la app serializado
└── updated_at  TIMESTAMPTZ
```

La app serializa y deserializa un único objeto JSON. No hay relaciones entre tablas. Toda la lógica de negocio vive en el cliente.

### Estructura del blob JSON (`data`)

```
{
  seedVersion: number,              -- versión del schema (actualmente 5)
  currentWeekNumber: number,        -- semana ISO activa
  currentYear: number,
  settings: {
    person1: string,                -- nombre Persona 1
    person2: string,                -- nombre Persona 2
    colors: {                       -- colores hex por persona
      person1, person2, together
    }
  },
  goals: Goal[],
  weeks: {
    "YYYY-Www": Week               -- clave ISO (ej. "2026-W14")
  }
}
```

**Week:**
```
{
  weekNumber: number,
  year: number,
  epicObjective: string,
  missions: Mission[],
  workHours: { person1: number, person2: number },
  photo?: string,                   -- base64 comprimida
  createdAt: timestamp
}
```

**Mission:**
```
{
  id: string,
  emoji: string,
  title: string,
  status: "TBC" | "ASAP" | "IN_PROGRESS" | "DONE",
  type: "task" | "event",
  who: "person1" | "person2" | "together",
  categories: string[],             -- ids de CATEGORIES (multi desde v1.8)
  category?: string,                -- campo legacy (pre v1.8, mantenido por compatibilidad)
  date?: string,                    -- ISO date "YYYY-MM-DD"
  time?: string,
  duration?: number,                -- horas
  goalId?: string,
  carriedFrom?: string,             -- id de misión original si fue arrastrada
  carriedFromWeek?: string,         -- clave de semana origen
  seriesId?: string,                -- id compartido para tareas recurrentes
  seriesPattern?: "weekly" | "monthly",
  createdAt: timestamp,
  completedAt?: timestamp
}
```

**Goal:**
```
{
  id: string,
  emoji: string,
  title: string,
  who: "person1" | "person2" | "together",
  period: "weekly" | "monthly" | "annual",
  goalType: "min" | "max",          -- desde v1.8
  target: number,
  deadline?: string,                -- ISO date
  active: boolean,
  createdAt: timestamp
}
```

---

## Flujo de autenticación

### Estado actual — Sin auth

La app usa una única fila fija (`id = "couple-missions"`) en Supabase. Cualquiera con la URL puede leer y escribir los datos. La seguridad depende de que la URL no sea pública.

Las claves de Supabase (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`) están expuestas en el cliente (son públicas por diseño en Supabase cuando Row Level Security está activo). Actualmente RLS no está configurado.

### Lo que falta para OAuth

1. **Habilitar Auth en Supabase**: activar proveedor Google/Apple en el dashboard
2. **Añadir columna `couple_id`** a `app_data`: vincular cada fila a una pareja
3. **Tabla `couples`**: `{ id, user1_id, user2_id, invite_token }`
4. **Flujo de invitación**: Persona 1 crea la pareja → genera token → Persona 2 se une con el token
5. **Row Level Security**: política `SELECT/UPDATE WHERE couple_id = auth.uid()` o relación vía `couples`
6. **Pantalla de login** en la app (actualmente no existe ningún componente de auth)
7. **Migración de datos**: opción de importar datos existentes al crear cuenta

**Bloqueante principal:** La decisión de arquitectura de invitación (¿cómo vinculan sus cuentas dos usuarios?) no está definida. El resto es implementación directa.

---

## Variables de entorno

Crear `.env.local` en la raíz del proyecto:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

En Netlify: **Site settings → Environment variables** — añadir las mismas dos variables.

---

## Correr en local

**Requisitos:** Node.js 18+, npm

```bash
git clone https://github.com/fmarquezarate-png/misiones-pareja
cd misiones-pareja
npm install
cp .env.example .env.local   # añadir tus claves de Supabase
npm run dev
```

La app corre en `http://localhost:5173`.

Para build de producción:
```bash
npm run build
npm run preview   # sirve el build en :4173
```

---

## Known Issues / Technical debt

| Severidad | Issue |
|-----------|-------|
| Alta | `App.jsx` monolítico (~1700 líneas) — difícil de mantener y testear |
| Alta | Sin autenticación — datos accesibles para quien conozca la URL |
| Alta | Sin tests (unitarios ni e2e) |
| Media | SVG del donut tiene atributo `r` duplicado (warning en build, no falla) |
| Media | `maxH` variable huérfana en StatsView (no causa error, residuo de refactor) |
| Media | El campo legacy `mission.category` (string) coexiste con `mission.categories` (array) — la migración se hace en runtime pero no hay script de limpieza |
| Baja | `compressImage` no tiene límite de tamaño — imágenes muy grandes pueden saturar el JSONB |
| Baja | `applyCarryOver` se ejecuta solo si `isTodayMonday()` — si se pierde el lunes no hay retry |
| Baja | Toda la persistencia es un upsert de blob completo — sin diff, sin historial, sin rollback |

---

## Próximos pasos bloqueadores para v2.0

### 1. Decisión de arquitectura multi-usuario
Antes de cualquier código de auth hay que definir:
- ¿Un usuario puede pertenecer a más de una pareja?
- ¿Qué pasa con los datos existentes al migrar?
- ¿Flujo de invitación por link, código, o email?

### 2. Refactor de `App.jsx`
La monolitización actual hace inviable añadir auth, tests o features complejas sin riesgo de regresión. Propuesta de división mínima:
- `hooks/useAppData.js` — lógica de persistencia y estado global
- `components/MissionCard.jsx`, `AddMissionForm.jsx`, `CalendarView.jsx`, etc.
- `views/WeekView.jsx`, `StatsView.jsx`, `GoalsView.jsx`, `HistoryView.jsx`
- `lib/weekHelpers.js` — funciones ISO week, carry-over, repair

### 3. Schema de Supabase v2
Requiere migración con script antes de activar auth:
```sql
ALTER TABLE app_data ADD COLUMN couple_id UUID REFERENCES couples(id);
CREATE TABLE couples (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ...);
-- Migrar fila "couple-missions" a couple_id generado
```

### 4. RLS en Supabase
Actualmente desactivado. Activarlo sin auth rompería la app. Debe hacerse en paralelo con el flujo de OAuth.

---

## Despliegue

- **Plataforma:** Netlify
- **Rama de producción:** `main`
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Deploy automático:** sí, en cada push/merge a `main`
- **SPA redirect:** configurado en `netlify.toml` (`/* → /index.html`)

---

*Versión actual: **v1.8.0** — Última actualización: 2026-03-30*
