# Workshop de Visión — v4.1 · Estado Actual y Sueño a 10 Años
## Misiones de Pareja · 28 de mayo de 2026

> **Conducido por:** Coordinador — rol de Project Manager  
> **Documentado por:** Redactor  
> **Todos los agentes participan:** Coordinador · Programador · Analista · Forense · Scanner · Experto en Datos · UI/UX · Redactor · Externo · QA · DevOps  
> **Foco:** Estado actual con sus problemas reales + visión honesta a 10 años por área  
> **Fecha de referencia:** 28 de mayo de 2026 · Versión en producción: v4.1.0

---

## Apertura del Coordinador

Este workshop tiene un foco diferente al anterior. El Workshop v4.1 fue un postmortem: miramos atrás, analizamos lo que falló, corregimos el rumbo. Este workshop mira hacia adelante.

La pregunta que le hice a cada agente fue la misma: *¿Qué problema concreto ves hoy en tu área? ¿Y cómo sería esta aplicación en 10 años si la construyéramos como deberíamos?*

Las respuestas son honestas. Algunas son incómodas. Todas son necesarias.

Una nota metodológica importante: los agentes trabajan sobre datos reales del código, no sobre ideas. El inventario técnico que usamos como base tiene números concretos: App.jsx tiene 1.176 líneas, 34 useState, 19 useEffect. Hay 35 componentes. GastosView.jsx pesa 34KB. StatsView.jsx pesa 37KB. vitest está instalado pero ningún test existe. El CAS está desactivado. La normalización está al 97%.

Esos números no mienten.

---

## 1. Análisis Técnico Profundo — Estado Real del Sistema

### 1.1 Arquitectura actual (datos reales)

```
src/
├── App.jsx                  1.176 líneas · 34 useState · 19 useEffect · CoupleMissions + AppWithAuth
├── supabase.js              465 líneas · 22 funciones exportadas · 1 RPC activa
├── components/              35 archivos · total ~350 KB de código de interfaz
│   ├── GastosView.jsx       34 KB — la más compleja después de App.jsx
│   ├── StatsView.jsx        37.7 KB — la más grande
│   ├── HomeDashboard.jsx    30.5 KB — refactorizado en esta sesión
│   ├── CalendarView.jsx     22.1 KB
│   └── ProfileModal.jsx     22.8 KB
├── lib/                     8 módulos: flags, push, repo, track, insights, backfill, appUtils, userPrefs
└── views/                   1 archivo (GoalsView.jsx — posible inconsistencia con components/)
```

**La modularización ocurrió.** App.jsx pasó de ~4.276 líneas (estado en el que el Programador la recibió) a 1.176 líneas actuales. Ese trabajo está hecho y es real. La arquitectura tiene sentido.

**El problema que persiste:** CoupleMissions (dentro de App.jsx) concentra 34 useState y 19 useEffect. Es el nuevo monolito: un componente que sabe demasiado y que cualquier bug futuro va a afectar.

### 1.2 Mapa de estado de los flags

| Flag | Estado | Impacto si se activa mal |
|------|--------|--------------------------|
| `dual_write_normalized` | ✅ true | Bajo — ya estable |
| `cas_version_check` | ❌ false | Alto — requiere triggers deshabilitados |
| `read_from_normalized` | ❌ false | Crítico — requiere todos los paths de mutación |
| `push_enabled` | ✅ true | Bajo |
| `idb_offline_queue` | ❌ false | Ninguno aún |

### 1.3 Deuda técnica cuantificada

| Deuda | Tamaño estimado | Riesgo si no se atiende |
|-------|----------------|------------------------|
| CoupleMissions monolítico (34 useState) | 3-5 días de refactor | Bug en un hook afecta toda la app |
| 0 tests escritos (vitest instalado, sin usar) | 2 semanas para cobertura básica | Cada deploy es una apuesta |
| `read_from_normalized: false` — 3 paths sin `updateNormalizedMission` | 1 día | Sprint G-2 no puede cerrarse |
| `cas_version_check: false` — depende de Externo | 0 días de código, 1 acción Externo | Saves concurrentes sin protección |
| `setTimeout(1500ms)` push frágil | 0.5 días | Notificaciones prematuras en conexiones lentas |
| GastosView.jsx sin tests (34KB, lógica compleja) | 1 semana | Regresiones invisibles en splits y proyectos |
| Blob sin límite de tamaño | 1 día preventivo | En ~2 años, saves silenciosos si blob > 8MB |
| README.md desactualizado (describe v1.8 sin auth) | 2 horas | Confusión de cualquier colaborador nuevo |
| `app_data_backups` sin política de retención | 0.5 días SQL | Tabla crece indefinidamente |

---

## 2. Voz del Coordinador

### 2.1 Problema que veo hoy

El proyecto está técnicamente en mejor estado que hace una semana, pero en peor estado de confianza. El usuario vivió 3 días con la app rota y ese daño no es solo técnico: es el contrato de fiabilidad entre el producto y las personas que lo usan.

El problema de gestión que veo es que seguimos operando en modo reactivo. Cada sesión comienza cuando el usuario reporta algo y terminamos apagando incendios. No hay una cadencia de trabajo proactivo — un ciclo de sprints con duración fija, objetivos claros, criterios de aceptación escritos antes de empezar y retrospectiva al final.

El segundo problema: las dependencias del Externo crean cuellos de botella invisibles. `cas_version_check: false` lleva días así esperando 2 líneas de SQL. No hay SLA real. No hay forma de que el equipo sepa si el Externo vio la tarea o si está bloqueado por algo.

### 2.2 Sueño a 10 años

En 2036, Misiones de Pareja es un producto que otras 10.000 parejas usan. No por ambición de escala, sino porque la propuesta de valor es real: una herramienta honesta de coordinación para dos personas que construyen una vida juntos.

El coordinador del proyecto en 2036 no gestiona emergencias. Gestiona tradeoffs: ¿invierte el equipo en la nueva feature de retrospectiva mensual o en mejorar el rendimiento del calendar? Esas son las decisiones interesantes. Para llegar ahí, el trabajo de hoy es construir el andamiaje correcto: tests, observabilidad, pipeline, documentación. El aburrido trabajo de infraestructura que hace posible el trabajo creativo.

---

## 3. Voz del Programador

### 3.1 Problema que veo hoy

**CoupleMissions es el nuevo monolito.** Redujimos App.jsx de 4.276 a 1.176 líneas. Eso fue un logro real. Pero extrajimos los componentes de interfaz, no el estado. CoupleMissions sigue teniendo 34 useState y 19 useEffect en un solo componente. Cuando cualquiera de esos hooks interactúa con otro de forma inesperada, el bug es difícil de aislar porque el contexto es enorme.

El segundo problema que veo es la asimetría entre lo que hay instalado y lo que se usa. `vitest` está en `package.json`. Hay un script `test: vitest run`. Cero tests escritos. Eso no es deuda técnica, es una deuda de voluntad. El framework está listo. Solo falta escribir el primer test.

El tercer problema: los 3 paths de mutación que faltan para `updateNormalizedMission` (patchMissionGlobal, patchAllFutureSeries, applyCarryOver) son ~1 día de trabajo. Llevamos días con `read_from_normalized: false` esperando ese día.

### 3.2 Sueño a 10 años

En 2036, el código de Misiones de Pareja es legible por cualquier desarrollador en 20 minutos. Hay una separación clara entre: capa de dominio (qué significa una misión, un objetivo, una semana), capa de infraestructura (cómo se guarda, se sincroniza, se notifica) y capa de presentación (cómo se muestra).

La capa de dominio tiene 200 tests unitarios. Cada regla de negocio tiene un test. La capa de infraestructura tiene tests de integración que corren contra un Supabase local. Los deploys son automáticos, no manuales.

El monolito App.jsx de hoy no existe. En su lugar hay una arquitectura de contextos React con responsabilidades claras: AuthContext, DataContext, SyncContext, NotificationContext. Cada contexto tiene su propio test. El desarrollador que se une al proyecto en 2036 no necesita leer 1.176 líneas para entender dónde vive cada cosa.

---

## 4. Voz del Analista

### 4.1 Problema que veo hoy

**La telemetría acaba de resucitar pero nadie sabe qué medir.** `track.js` funcionó mal desde v3.4.0 hasta v4.0.4 — meses de datos perdidos. Ahora funciona. Pero los eventos que se trackean fueron diseñados cuando la app era un monolito sin auth. No hay un plan de métricas: ¿qué queremos saber? ¿Con qué frecuencia usa la app la pareja? ¿Qué features usan y cuáles ignoran? ¿En qué paths se rompen las sesiones? Sin esas respuestas, seguimos tomando decisiones de producto a ciegas.

El segundo problema que veo es silencioso pero importante: **el blob crece sin límite**. Las fotos se guardan en base64 directamente en el JSON. En este momento no es un problema. En 2 años, si la pareja tiene 50 semanas con foto, el blob puede superar 5-8MB. Eso afecta el tiempo de carga, la latencia de save, y eventualmente causará fallos. Nadie está midiendo el tamaño actual del blob.

El tercer hallazgo: GastosView.jsx pesa 34KB y tiene lógica de splits de gastos, proyectos y filtros sin ningún test. Es la parte del código con mayor probabilidad de regresión silenciosa porque es compleja y nadie la mira activamente.

### 4.2 Sueño a 10 años

En 2036, el Analista tiene un dashboard real. No hipotético: tablas en Supabase con eventos bien diseñados, Grafana o un equivalente mostrando métricas semanales, alertas automáticas cuando algo cambia de forma anómala (saves que fallan >2%, blob que crece >20% en una semana, retención que cae).

El sueño más importante: en 2036, cuando el equipo propone una nueva feature, la decisión se toma con datos. "¿Usas la pestaña de Gastos?" no es una pregunta que le hacemos al usuario. Es una métrica que ya tenemos: X% de las sesiones tocan GastosView, Y% crean un gasto nuevo, Z% usan la feature de proyectos. Las features que nadie usa se deprecan. Las que más se usan se mejoran. Eso es un producto maduro.

---

## 5. Voz del Forense

### 5.1 Problema que veo hoy

**El sistema no tiene voz.** Cuando algo falla en producción, la primera señal es el usuario reportando el problema. No hay logs estructurados accesibles. No hay manera de que el equipo sepa que `save_app_data_cas` falló 12 veces esta mañana para un couple específico. Si el Externo no está mirando los logs de Supabase activamente, los fallos son invisibles.

El segundo problema: los endpoints `?probe=1` y `?diagnose=1` que añadí a `send-push` para diagnosticar el VAPID son la única herramienta de diagnóstico no destructiva que tiene el sistema. Para todo lo demás — CAS, realtime, onboarding — el diagnóstico requiere reproducir el bug manualmente o inferirlo de síntomas. Eso consume días.

El tercer problema: el path de onboarding (`createCouple` → `joinCouple`) es el más frágil del sistema porque combina 3 operaciones secuenciales (INSERT couples, INSERT couple_members, joinCouple) con RLS policies que dependen del estado previo. El fix del rollback en v4.0.11 fue necesario pero no suficiente: no hay forma de verificar que el onboarding de una pareja nueva funciona correctamente sin hacerlo manualmente.

### 5.2 Sueño a 10 años

En 2036, cada operación crítica del sistema (save, load, CAS, push, onboarding) tiene un endpoint de health check no destructivo. El DevOps corre esos health checks automáticamente cada 5 minutos. Cuando algo falla, el equipo recibe una alerta antes de que el usuario lo reporte.

El sueño técnico profundo: en 2036, cada error que llega al usuario tiene un trace ID. El usuario puede decir "el error fue a las 14:32", el equipo busca ese trace ID en los logs, y en 2 minutos saben exactamente qué pasó: qué RPC se llamó, con qué parámetros, qué respondió, en qué paso falló. Diagnóstico en minutos, no en días.

---

## 6. Voz del Scanner

### 6.1 Problema que veo hoy

**Hay 3 bugs latentes de los que estoy seguro sin haber hecho el scan:**

1. **`applyCarryOver`** — solo corre si `isTodayMonday()`. Si la pareja no abre la app el lunes (o si la app no estaba activa en background), las tareas pendientes no se arrastran a la semana siguiente. Nunca hay retry. Este bug existe desde la v1.x y sobrevivió todos los sprints porque el síntoma es silencioso: las tareas simplemente no aparecen.

2. **`app_data_backups` sin retención** — cada UPDATE en `app_data` añade una fila en `app_data_backups`. Con saves cada 700ms de debounce, en una sesión activa de 1 hora pueden acumularse cientos de backups. La tabla crece indefinidamente. Nadie la limpia.

3. **`GastosView.jsx` — lógica de splits sin cobertura** — 34KB de código que calcula divisiones de gastos entre personas, con proyectos anidados. Sin tests. Los errores de redondeo en splitting son el tipo de bug que el usuario detecta meses después cuando el total "no cierra".

El patrón que noto: los bugs que más me preocupan son los que ocurren en condiciones de timing (lunes, primera apertura, sesión larga) o en acumulación silenciosa (tabla sin retención). Son difíciles de reproducir y fáciles de ignorar.

### 6.2 Sueño a 10 años

En 2036, el Scanner no existe como rol reactivo. Existe como proceso automatizado: cada PR pasa por un scan estático que verifica invariantes conocidos (¿hay algún useEffect con closure sobre estado sin ref espejo? ¿hay algún Promise sin reject? ¿hay algún trigger con I/O en una tabla con lock?). Ese scan corre en CI y bloquea el merge si detecta el patrón.

Los bugs que hoy se escapan porque requieren "saber qué buscar" en 2036 son atrapados automáticamente. El Scanner humano se dedica a los bugs nuevos, no a los ya conocidos.

---

## 7. Voz del Experto en Datos

### 7.1 Problema que veo hoy

**El blob JSON sigue siendo la fuente de verdad y eso es una deuda de arquitectura fundamental.** No porque el blob sea malo, sino porque toda la complejidad del sistema — CAS, backups, dual-write, normalización — existe para compensar las limitaciones del blob. Si en algún momento el blob se corrompe (lo cual ya pasó: race condition del 25/05), los datos del usuario están en riesgo.

El diseño actual tiene tres capas de seguridad (CAS + snapshot backup + auto_backup) y aún así tuvimos 2 misiones perdidas que se recuperaron gracias a la tabla normalizada. Eso dice algo sobre el riesgo real.

**El segundo problema es la ausencia de una fuente de verdad unificada.** Hoy el blob es la fuente de escritura y la tabla `missions` es solo dual-write parcial. Mañana (Sprint G-2) el flip habilitará la tabla como fuente de lectura, pero `goals`, `couple_settings` y `week_photos` siguen siendo blob-only. En 5 años, si la app escala, cada tabla sin normalizar completa es una deuda que crece.

**El tercer problema:** la columna `data jsonb` en `app_data` no tiene schema validation en la DB. `isValidAppData()` es la única guarda y vive en el cliente. Si alguien inserta directamente en Supabase o si el cliente envía un JSON malformado que pasa la validación superficial, los datos se guardan sin objeción.

### 7.2 Sueño a 10 años

En 2036, Misiones de Pareja no tiene un blob JSON central. Cada entidad (misión, meta, semana, gasto, mensaje) tiene su propia tabla con schema estricto en PostgreSQL. El cliente hace operaciones relacionales: INSERT una misión, UPDATE un status, DELETE un goal. No hay serialización/deserialización de un estado gigante.

La consecuencia: los saves son atómicos por operación. No hay race condition global porque cada UPDATE afecta a una fila específica. El CAS de versión global no es necesario porque las colisiones ocurren a nivel de fila, no de blob. El tiempo de carga es O(consulta) no O(blob completo). El tiempo de save es O(operación) no O(JSON de 200KB).

El camino para llegar ahí es gradual: Fase 1 es Sprint G-2 (tabla missions como fuente de verdad de lectura). Fase 2 es normalizar goals, couple_settings, week_photos. Fase 3 es deprecar el blob. Fase 4 es Schema Validation en DB (CHECK constraints, NOT NULL, FK). Ese es el mapa de 10 años para los datos.

---

## 8. Voz del UI/UX

### 8.1 Problema que veo hoy

**La app no habla.** Cuando el usuario guarda algo, no hay ningún feedback visual de que se guardó. Cuando hay un error de red, no hay un estado de "sin conexión" visible. El debounce de 700ms es invisible para el usuario. Marta puede editar el título de una misión, cerrar la app antes de que el save complete, y perder el cambio sin nunca saber que pasó.

El segundo problema de UX es que **la navegación es opaca**. Hay 7 pestañas (Inicio, Semana, Stats, Gastos, Chat, Calendario, Historial, Pendientes) accesibles desde el SideMenu. El 80% del tiempo de uso real ocurre en 2 de esas pestañas. Las otras 5 están a 2 taps de distancia pero el usuario no sabe que existen. La app no guía, solo espera a que el usuario explore.

El tercer problema: **la versión mobile-web y la PWA instalada tienen comportamientos diferentes** que el UI no comunica. El push solo funciona en la PWA instalada. El SW solo actualiza en la instalada. El usuario que usa la app desde el navegador sin instalar tiene una experiencia degradada que la app no le explica.

### 8.2 Sueño a 10 años

En 2036, la app tiene presencia emocional. No es un tracker de tareas. Es un espacio compartido que recuerda el año que pasaron juntos: la semana en que terminaron la mudanza, las tres semanas seguidas con el objetivo épico de "tener más tiempo libre", el momento exacto en que completaron la meta de running.

El sueño técnico de UX: en 2036 la app es nativa. No PWA, no web-app — nativa en iOS y Android. Tiene haptics cuando completas una misión. Tiene widgets en la pantalla de inicio que muestran el porcentaje de la semana. Tiene notificaciones ricas con imagen. Tiene modo landscape para tablet.

El sueño de producto: en 2036 la app tiene un "resumen del año" generado automáticamente en enero. No es Spotify Wrapped aplicado a tareas. Es algo propio: las 5 semanas con más misiones completadas, la categoría que más creció, el objetivo épico más repetido, la semana más difícil que igual terminaron bien. Una narrativa del año como pareja.

---

## 9. Voz del Redactor

### 9.1 Problema que veo hoy

**El README.md miente.** Describe el sistema de la v1.8 (sin auth, blob puro, sin RLS). La realidad es una app con auth OAuth, couples table, RLS, dual-write normalizado, push notifications, 11 agentes. Cualquier persona nueva que lea el README tiene una imagen del proyecto que no coincide con lo que existe.

El segundo problema: **el CHANGELOG es técnico hasta el punto de ser ilegible para el usuario**. Las entradas de v4.0.x son precisas y valiosas para el equipo, pero si la pareja va a Settings y toca "v4.1.0 ¿qué hay de nuevo?", lee sobre CAS y dataVersionRef. No sobre qué cambió para ellos.

El tercer problema es de proceso: **no hay ningún documento que describa las decisiones de producto tomadas y por qué**. El `CLAUDE.md` tiene las reglas técnicas. El WORKSHOP tiene el análisis. Pero no hay un "Architecture Decision Record" (ADR) que diga: "decidimos usar blob JSON porque en mayo 2025 era la opción más rápida para una app de 2 personas, y planeamos migrar cuando lleguemos a X usuarios".

### 9.2 Sueño a 10 años

En 2036, la documentación del proyecto es un asset, no una deuda. Hay tres capas:
1. **Para el usuario:** notas de versión en lenguaje humano ("ahora puedes ver las tareas pendientes de tu pareja desde su perfil")
2. **Para el equipo:** CHANGELOG técnico con causa raíz, fix y medida preventiva (como hoy)
3. **Para futuros contribuidores:** ADRs que explican las decisiones de arquitectura, por qué se tomaron y cuándo deben revisarse

El sueño a 10 años: el proyecto es open source. La documentación es tan buena que una pareja de desarrolladores puede hacer fork, cambiar los nombres y los colores, y tener su propia instancia en 2 horas. La arquitectura es tan limpia que contribuir un bug fix toma un día, no una semana de entender el contexto.

---

## 10. Voz del Externo (Supabase)

### 10.1 Problema que veo hoy

**Hay dos triggers activos que bloquean la re-activación del CAS y llevan días sin ejecutarse.** El SQL está preparado en `TAREAS_SQL_AGENTE_SUPABASE.md`. La tarea es 2 líneas de `ALTER TABLE DISABLE TRIGGER`. Mientras eso no ocurra, la app opera sin protección contra saves concurrentes. No es un P0 activo (la app funciona), pero es un P1 que podría convertirse en P0 si ambas personas editan simultáneamente.

El segundo problema que veo desde la consola de Supabase: **la tabla `app_data_backups` crece sin control**. Cada save exitoso añade una fila. Con el debounce de 700ms, una sesión de edición activa de 30 minutos puede generar ~50 backups. No hay política de retención. En 6 meses esta tabla puede tener decenas de miles de filas y afectar el rendimiento de las queries.

El tercer problema: **no tengo visibilidad del estado de las Edge Functions en producción**. Sé que `send-push` funciona porque el equipo lo verificó. Pero no hay health check automático. Si el secret VAPID_PRIVATE_KEY expira o se corrompe, no hay forma de saberlo hasta que el push deje de llegar.

### 10.2 Sueño a 10 años

En 2036, el schema de Supabase es relacional completo. No hay un blob de 200KB que se upsertea completo en cada save. Las operaciones son transaccionales: `BEGIN; UPDATE missions SET status = 'DONE' WHERE id = ?; INSERT INTO events (type, ...) VALUES (...); COMMIT`. Los conflictos se resuelven a nivel de fila con optimistic locking, no a nivel de blob con CAS global.

El sueño de infraestructura: en 2036 hay un staging environment real. Cada PR se despliega automáticamente en un branch de Supabase (que ya es una feature de Supabase Pro). Los cambios de schema se prueban en staging antes de ir a producción. Las Edge Functions se testean con datos reales de staging. El Externo no ejecuta SQL en producción directamente: ejecuta migrations verificadas que el equipo aprobó.

---

## 11. Voz del QA

### 11.1 Problema que veo hoy (primer día)

**Heredé un proyecto con vitest instalado y cero tests escritos.** Eso no es neutralidad: es deuda acumulada. Cada versión que se deployó sin tests es una apuesta que salió bien... o no (v4.0.x). El ciclo de 16 versiones en un día es el caso de uso que justifica mi existencia.

Mi análisis del estado actual como QA nuevo:

Los flows críticos sin cobertura son:
1. **Save cycle** — crear misión, editar, refrescar: ¿persiste? Sin test.
2. **Carryover** — tarea pendiente de la semana anterior aparece en la nueva: sin test.
3. **Split de gastos** — GastosView calcula correctamente el balance: sin test (y es el módulo más complejo en KB).
4. **Normalización** — dual-write escribe correctamente en tabla missions: sin test de integración.
5. **Push** — notificación llega al partner cuando se completa una tarea: sin test end-to-end.

El mayor riesgo hoy: no tenemos contrato de comportamiento entre versiones. Cada deploy puede romper silenciosamente un flow existente sin que el equipo lo detecte hasta que el usuario lo reporta.

### 11.2 Sueño a 10 años

En 2036, el checklist de regresión manual que escribí hoy es un test automatizado. Cada uno de los 15 puntos del checklist tiene su equivalente en código: un test de integración que corre en <30 segundos, verifica el flow completo, y bloquea el merge si falla.

El pipeline ideal: `git push` → `eslint` → `vitest unit` (1s) → `vitest integration` contra Supabase local (10s) → build → `playwright e2e` en Chromium (30s) → deploy a staging → smoke tests automáticos → deploy a production. Si cualquier paso falla, merge bloqueado. Los humanos hacen code review, no QA manual.

El sueño más ambicioso: en 2036 hay un test que simula a "Marta" — una pareja de usuarios sintéticos que usan la app durante 1 semana simulada cada noche. Si la misión de Marta no persiste, si el carryover no funciona el lunes virtual, si el push no llega, la alerta llega al equipo antes de que cualquier usuario real lo experimente.

---

## 12. Voz del DevOps

### 12.1 Problema que veo hoy (primer día)

**El pipeline de deploy es manual y frágil.** Un push a `main` triggeriza un deploy en Netlify. Si el build falla, el deploy falla. Si el build pasa pero el SW es incorrecto, el deploy "tiene éxito" pero los usuarios siguen viendo la versión vieja. No hay verificación post-deploy automatizada. No hay staging environment. No hay rollback automatizado.

Los tres problemas concretos que identifico desde el inventario de infraestructura:

1. **Sin paridad documentada entre Netlify y Supabase** — no hay un lugar donde se liste exhaustivamente qué variables de entorno existen, dónde están seteadas, y quién las seteó. Si alguien cambia `VAPID_PRIVATE_KEY` en Supabase Secrets sin actualizar el documento, el push deja de funcionar y nadie sabe por qué.

2. **Sin staging environment** — todos los cambios van directamente a producción. No hay una URL de preview donde el equipo pueda verificar que `read_from_normalized: true` funciona antes de que los usuarios lo vean.

3. **Sin health checks automáticos** — `version.json` está configurado como NetworkOnly en el SW (correcto). Pero nadie verifica automáticamente que la versión en Netlify después de un deploy coincide con el APP_VERSION del build. Ese test manual toma 5 segundos; automatizarlo toma 10 minutos.

### 12.2 Sueño a 10 años

En 2036, el pipeline de Misiones de Pareja es comparable al de cualquier startup bien gestionada. Cada PR tiene un preview deployment automático en Netlify con su propio branch de Supabase. Los reviewers pueden probar los cambios en producción-like antes de aprobar el merge.

El deploy a producción es un botón, no un push. El botón sólo aparece cuando CI está verde, QA aprobó, y el Coordinador marcó el PR como "listo". El deploy tiene un health check post-deploy que verifica que la app responde, que el SW está activo, que `version.json` devuelve la nueva versión, y que el ping a `send-push` responde 200. Si algo falla, el deploy se revierte automáticamente al último build bueno.

---

## 13. Análisis Cruzado: Patrones Sistémicos

Después de escuchar a 11 agentes, emergen 4 patrones que ninguno mencionó explícitamente pero que están presentes en todos:

### Patrón 1: Visibilidad
*El sistema no sabe qué está pasando y no puede decirlo.*
Afecta a: Forense, Analista, QA, DevOps, Externo. La misma raíz: no hay observabilidad. No hay logs, no hay métricas, no hay alertas. El conocimiento del estado del sistema vive en la cabeza del equipo, no en herramientas.

### Patrón 2: Contrato
*No hay contratos escritos entre capas.*
Afecta a: Programador, QA, Experto en Datos. No hay tipos explícitos entre el blob y la UI. No hay tests que definan el comportamiento esperado. No hay schema validation en DB. Cuando algo cambia de forma inesperada, la detección es lenta porque no hay contrato que violar.

### Patrón 3: Temporalidad
*Los bugs de timing son los más difíciles de reproducir y los más dañinos.*
Afecta a: Scanner, Forense, Analista. `applyCarryOver` requiere que sea lunes. El save tiene debounce de 700ms. El push tiene `setTimeout(1500ms)`. Los backups se acumulan indefinidamente. Todos son problemas de tiempo, no de lógica.

### Patrón 4: Acumulación silenciosa
*Las cosas que crecen sin límite eventualmente colapsan.*
Afecta a: Analista, Experto en Datos, Externo, Scanner. El blob crece. La tabla de backups crece. Los datos sin retención se acumulan. Nadie mide el tamaño actual. Nadie alerta cuando superan un umbral.

---

## 14. Backlog Consolidado

### P0 — Bloqueantes (esta semana)

| ID | Tarea | Dueño | Bloquea |
|----|-------|-------|---------|
| EXT-P0-1 | Deshabilitar `trg_push_on_app_data_update` y `trg_notify_push_on_app_data_update` | Externo | Re-activación CAS |
| DEV-P0-1 | Tras EXT-P0-1: re-activar `cas_version_check: true` en flags.js | Programador + DevOps | Protección saves concurrentes |

### P1 — Sprint siguiente (próximos 7 días)

| ID | Tarea | Dueño | Estimación |
|----|-------|-------|------------|
| G2-1 | `updateNormalizedMission` para `patchMissionGlobal` | Programador | 0.5 días |
| G2-2 | `updateNormalizedMission` para `patchAllFutureSeries` | Programador | 0.5 días |
| G2-3 | `updateNormalizedMission` para `applyCarryOver` | Programador | 0.5 días |
| G2-FLIP | Re-activar `read_from_normalized: true` (tras G2-1/2/3 + Scanner sign-off) | Coordinador | Gate |
| EXT-P1-1 | Fix policy INSERT `couple_members` → `user_id = auth.uid()` | Externo | Onboarding |
| QA-1 | Escribir primeros 5 tests unitarios (save cycle + carryover) | QA + Programador | 1 día |
| UX-1 | Añadir indicador visual "guardando..." (spinner/ícono de nube) | Programador + UI/UX | 0.5 días |
| DEVOPS-1 | Documentar todas las env vars (Netlify + Supabase Secrets) en un md | DevOps | 2 horas |
| ANALISTA-1 | Medir tamaño actual del blob en producción | Analista + Externo | 1 hora |

### P2 — Sprint G-3 / Q3 2026

| ID | Tarea | Dueño | Estimación |
|----|-------|-------|------------|
| SQL-RETENTION | Policy de retención para `app_data_backups` (mantener últimas 50 filas por couple) | Externo + Experto en Datos | 0.5 días |
| CARRY-RETRY | Implementar retry de `applyCarryOver` para días no-lunes | Programador | 1 día |
| GASTOS-TESTS | Tests de lógica de splitting en GastosView | QA + Programador | 2 días |
| README-UPDATE | Actualizar README.md a arquitectura real v4.x | Redactor | 2 horas |
| ADR-1 | Escribir primer ADR: por qué blob JSON + plan de migración | Redactor + Experto en Datos | 1 día |
| DEVOPS-STAGING | Investigar Supabase branch (staging) para preview deployments | DevOps | 1 día investigación |
| PUSH-TIMING | Mover `sendContextualPush` al `.then()` del save (Sprint E-2) | Programador | 1 día |
| TELEMETRY-PLAN | Diseñar el plan de métricas: qué eventos trackear, qué dashboards | Analista | 1 día |

### Deuda Técnica Mayor (Roadmap Q4 2026)

| ID | Tarea | Área | Estimación |
|----|-------|------|------------|
| ARCH-1 | Extraer estado de CoupleMissions a contextos React separados | Programador | 1 semana |
| ARCH-2 | Normalizar tabla `goals` con dual-write + flip | Experto en Datos + Programador | 1 semana |
| ARCH-3 | Normalizar `couple_settings` y `week_photos` | Experto en Datos + Programador | 1 semana |
| QA-PIPELINE | Configurar CI/CD con tests automáticos en GitHub Actions | DevOps + QA | 3 días |
| BLOB-LIMIT | Implementar límite de tamaño de blob y compresión de fotos antiguas | Programador + Analista | 2 días |

---

## 15. Conclusiones y Decisiones

### 15.1 El estado real es mejor de lo que parece, peor de lo que debería

*Mejor de lo que parece:* La modularización ocurrió. App.jsx bajó de 4.276 a 1.176 líneas. Hay 35 componentes bien separados. El sistema de dual-write funciona. El push llega. Los backups están activos. La telemetría resucitó.

*Peor de lo que debería:* Cero tests en un proyecto con vitest instalado. El CAS desactivado esperando 2 líneas de SQL. `read_from_normalized: false` esperando 1 día de trabajo. Un blob que nadie está midiendo. Una tabla de backups creciendo sin límite.

### 15.2 El gap entre hoy y 2036

El gap más importante no es tecnológico. Es de disciplina de proceso.

Las herramientas para llegar a 2036 existen hoy: vitest, playwright, Supabase branches, GitHub Actions, Netlify staging. No es una cuestión de qué herramientas elegir. Es una cuestión de si el equipo prioriza el andamiaje correcto sobre las features nuevas. Cada semana que deployamos sin tests es una semana que invertimos en features sobre arena.

La visión de cada agente a 10 años es coherente y alcanzable. No requiere tecnología que no existe. Requiere tiempo, disciplina, y la voluntad de hacer el trabajo aburrido (tests, documentación, retención de datos, health checks) antes de hacer el trabajo emocionante (nueva feature, nueva integración, nueva plataforma).

### 15.3 Las 3 decisiones más importantes de los próximos 30 días

**Decisión 1: Tests primero.**
Antes del próximo sprint de features, el QA escribe los primeros 5 tests que cubren el save cycle y el carryover. Esos tests son el primer contrato entre versiones. Si pasan, el feature se deploya. Si fallan, no.

**Decisión 2: Cerrar Sprint G-2 de verdad.**
Los 3 paths que faltan (patchMissionGlobal, patchAllFutureSeries, applyCarryOver) son 1 día de trabajo. Se hacen. Se hace el Scanner sign-off. Se flipea `read_from_normalized: true`. Se cierra Sprint G-2. Esta tarea lleva semanas "pendiente".

**Decisión 3: Definir el ritmo.**
El equipo no puede operar solo en modo reactivo. Se propone una cadencia: sprint de 2 semanas, con objetivo claro al inicio, retrospectiva al final, y una regla: cada sprint cierra con al menos tantos tests nuevos como features nuevas.

### 15.4 La frase que resume el workshop

> *"La app funciona. El equipo sabe cómo mejorarla. La brecha entre ambos es disciplina, no conocimiento."*

---

## Apéndice A: Inventario técnico de referencia (base del workshop)

| Métrica | Valor |
|---------|-------|
| Versión en producción | v4.1.0 |
| Líneas App.jsx | 1.176 |
| useState en CoupleMissions | 34 |
| useEffect en CoupleMissions | 19 |
| Componentes en src/components/ | 35 |
| Módulos en src/lib/ | 8 |
| Líneas supabase.js | 465 |
| Archivo más pesado | StatsView.jsx — 37.7 KB |
| Tests escritos | 0 |
| Test runner instalado | vitest ^4.1.7 — sin usar |
| Agentes del equipo | 11 |
| Flags arquitectónicos desactivados | 2 (cas_version_check, read_from_normalized) |
| Tareas Externo pendientes P0 | 1 |
| Tareas Externo pendientes P1 | 1 |

---

## Apéndice B: Mapa de visión 2036 por área

| Área | Visión central a 10 años |
|------|--------------------------|
| Coordinador | 10.000 parejas, decisiones basadas en datos, sprints con cadencia fija |
| Programador | Arquitectura de contextos React, 200 tests, deploys automáticos |
| Analista | Dashboard de métricas real, decisiones de producto con datos |
| Forense | Trace ID por error, health checks automáticos, zero diagnósticos manuales |
| Scanner | Scan estático en CI, patrones conocidos atrapados automáticamente |
| Experto en Datos | Schema relacional completo, no hay blob central, operaciones atómicas |
| UI/UX | App nativa, haptics, widget iOS/Android, resumen anual narrativo |
| Redactor | Open source, ADRs, documentación en tres capas, README como manual real |
| Externo | Staging con Supabase branches, migrations versionadas, zero SQL manual en prod |
| QA | "Marta sintética" corriendo tests nocturnos, pipeline CI/CD completo |
| DevOps | Deploy con botón, health checks post-deploy, rollback automático |

---

*Workshop documentado el 28 de mayo de 2026 · Próxima revisión: post-cierre Sprint G-2*  
*Archivos de soporte: `WORKSHOP_v4_INFORME_EJECUTIVO.md` (19/05), `WORKSHOP_v4_1_ESTADO_ACTUAL.md` (28/05)*
