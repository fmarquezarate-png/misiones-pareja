# Workshop v5 — Informe Consolidado
## Misiones de Pareja · 21 de agosto de 2026 · v5.14.0

> Convocado tras la saga de guardado/offline (v5.12.0 → v5.14.0) y los Bloques 3/4/5
> de features de conexión de pareja. Formato heredado de `WORKSHOP_v4_3_CONSOLIDADO`.

**Nota de proceso:** se convocaron 8 agentes en paralelo. **5 completaron** su auditoría
sobre el repo real (Programador, Analista, Experto en Datos, Forense, DevOps). **3 quedaron
cortados por un límite de sesión de la plataforma** (Scanner, QA, UI/UX) — sus secciones las
completó el **Coordinador** con auditoría directa del código y quedan marcadas como tal.

---

## 1. Resumen ejecutivo

La app está **funcional y estable** por primera vez en la saga: la causa raíz del "error al
guardar" (blob de 4MB de fotos base64 contra un `statement_timeout=8s`) está **atacada por los
dos lados** — alivio server-side (timeout → 20s) y cura client-side (fotos a Storage, blob →
~200KB). Los Bloques 3/4/5 entregaron ~10 features de conexión, todas con lógica pura + tests
(134 tests, CI real en GitHub Actions).

Pero el workshop destapó que **el fix de v5.14.0 dejó tres regresiones/deudas nuevas** y que
**dos cambios de infra viven fuera del repo**. Lo importante, sin adornos:

- **[P0] El fallback base64 de fotos reintroduce la causa raíz en silencio.** Si una subida a
  Storage falla, se reinyecta la foto base64 al blob (`HistoryView.jsx`) — exactamente lo que
  v5.14.0 sacó. Sin telemetría, un fallo persistente de Storage resucita el timeout de guardado.
- **[P0] Fuga de fotos huérfanas en Storage.** No existe `deleteWeekPhoto` en todo el repo:
  reemplazar/borrar una foto abandona el objeto en el bucket para siempre.
- **[P0] Dos cambios de infra sin versionar** (`statement_timeout=20s` y el bucket `photos`) →
  reproducibilidad rota: un proyecto Supabase recreado vuelve a 8s y sin bucket.
- **[P0] La telemetría de guardado nunca incluyó el `blob_size`** — el número que resolvió el
  caso — por eso costó 3 versiones diagnosticarlo, todo detrás del muro de "acceso a Supabase".
- **[P0/P1 Datos] Los "dos backups" son una ilusión:** `snapshot_app_data` es un fósil (solo la
  1ª foto de cada pareja por `ON CONFLICT DO NOTHING`), y `backup_app_data` es amplificación de
  escritura sin retención viva (85MB acumulados).

Consenso del equipo: **el incendio está apagado, pero el fix creó humo nuevo que hay que ventilar
antes de dar el sprint por cerrado.**

---

## 2. Estado actual del sistema

### 2.1 Flags de arquitectura (`src/lib/flags.js`)
| Flag | Estado | Nota |
|------|--------|------|
| `dual_write_normalized` | `true` | Activo; coste de escritura por tabla que nadie lee. |
| `cas_version_check` | `true` | CAS con fallback gracioso (v5.13.0). |
| `read_from_normalized` | **`false`** | Permanente. Falta schema (`endDate`/`endTime`/`goalId`). |
| `idb_offline_queue` | `false` | **Flag muerto: cero referencias en `src/`.** |

### 2.2 La saga de guardado/offline (recap)
- **v5.12.0** — Persistencia local durable en **IndexedDB** (`localStore.js`, `pickFreshest`),
  porque localStorage reventaba por cuota (fotos base64) y lo desaloja iOS.
- **v5.13.0/v5.13.1** — Degradación gráciles del CAS (last-write-wins seguro tras no converger)
  + exposición del error técnico real en UI (`saveErrDetail`).
- **v5.14.0** — **CAUSA RAÍZ** (con acceso directo a Supabase): blob 4MB (3.8MB de fotos base64
  en `weeks`) + `statement_timeout=8s` → 65 `canceling statement due to statement timeout`/24h.
  Fix: timeout 8s→20s (server) + fotos a bucket `photos` de Storage, migración automática, blob
  4MB→~200KB (client).

### 2.3 Métricas al 21/08/2026
- `App.jsx`: **2703 líneas**; `CoupleMissions` ≈ 2400, con **60 `useState`, 43 `useEffect`,
  25 `useRef`, 7 `useCallback`, 0 `useMemo`** (128 hooks en un componente).
- **27 módulos** en `src/lib/`, **72 componentes**, **16 archivos de test / 134 tests** (vitest).
- CI real: `.github/workflows/ci.yml` (lint + test + build en cada push/PR, Node 22).
- Blob de la pareja activa: **4MB → ~200KB** tras migración. `app_data_backups`: **85MB / 23 filas**.

---

## 3. Hallazgos por agente

### Programador
- **`CoupleMissions` sigue siendo el monolito** (2703 líneas, 128 hooks). Adelgazó bien (de 4276,
  ~70 componentes extraídos + libs puras), pero el corazón transaccional (estado + save +
  dual-write + realtime) sigue indivisible.
- **`runSave` (`App.jsx:1216-1414`, ~200 líneas) es correcto pero intestable** — máquina de estados
  CAS inline. `assessWrite`/`rebaseMutators`/`pickFreshest` sí son puras y testeadas; la lógica más
  veces rota del proyecto no tiene test directo. Extraerla a `runSaveStep(state, deps)` puro es la
  deuda de testeo más rentable del repo.
- **Duplicación literal** entre `cycleStatus` (`App.jsx:1619`) y `cycleStatusGlobal` (`:1750`): el
  bloque de racha `taskCongrat` (~30 líneas, fórmula sutil de "últimos 15 días") está **verbatim en
  dos sitios**. Candidato a helper `computeStreakDelta(data, mission)`.
- **`CLAUDE.md §6` desincronizado del código:** `patchM` ya no existe (consolidado en
  `patchMissionGlobal`, que sí dual-escribe). El "4º black hole" está cerrado; hay un "5º"
  (status de la misión arrastrada) ya cubierto en `App.jsx:1639`. La doc mancó, el código no.
- **Se paga el coste de `dual_write_normalized: true` por una tabla que nadie lee** (11 call-sites
  async por mutación). El limbo (ni flip ni apagado) es lo peor de ambos mundos.
- **El flush a background (`App.jsx:1101`) es un 2º escritor** que llama `saveWithRetry` **sin
  `withTimeoutRetry` y sin resincronizar `dataVersionRef`** — el patrón que la §5 marca como origen
  de pérdidas. Mitigado por el re-fetch al volver a `visible`, pero merece unificarse o justificarse.

**Backlog Programador:** [P1] extraer state-machine CAS a `save.js` puro + tests · [P1]
resincronizar `CLAUDE.md §6` · [P2] de-duplicar `taskCongrat` · [P2] salir del limbo de `missions`.
**Línea roja:** no firmo flip de `read_from_normalized` sin schema completo + CAS extraído/testeado;
no meto otra feature en `CoupleMissions` sin extraer antes `runSave`.

### Analista
- **[≈P0] El fallback base64 de fotos REVIVE la causa raíz — en silencio.** `HistoryView.jsx`
  (`pickWeekPhoto`): si `uploadWeekPhoto` falla, `update(...{ photo: b64 })` reinyecta la foto al
  blob. Único rastro: un `console.warn`. Con RLS/cuota/cuelgue de WKWebView → cada foto vuelve a
  engordar el blob → vuelve el timeout que costó toda la saga. Cambia una pérdida visible (foto no
  subida, reintentar) por una degradación invisible del sistema.
- **La migración latch-ea el ref ANTES del await** (`App.jsx:875`): si fallan todos los uploads,
  `migrated.length===0` retorna con el ref ya en `true` → no reintenta en toda la sesión, blob sigue
  en 4MB, solo un `console.warn`. Éxito parcial deja las restantes varadas hasta recargar.
- **Migración concurrente de la pareja → huérfanos en Storage** (`uid()` en el path): ambos
  dispositivos migran la misma foto a paths distintos → archivo huérfano permanente. No hay path de
  limpieza en el repo.
- **`rebaseMutators` descarta mutadores en silencio** (`save.js:25-28`): `catch` vacío sin
  telemetría. Un edit del usuario que falle transitoriamente desaparece sin rastro. Mínimo:
  `track("rebase_mutator_dropped")`.
- **El false-conflict de CAS por RLS sigue enmascarado, no diagnosticado** (`repo.js:266`). El
  fallback gracioso evita el error visible pero tapa un posible bug server-side sin confirmar. Tarea
  del Externo: verificar `RETURNING`/RLS del RPC.
- **`read_from_normalized: false` correcto** — verificados los 4 dual-write presentes; el "4º black
  hole" (`patchM`) está cerrado estructuralmente. **Flag muerto `idb_offline_queue`** (cero refs).
  `pickFreshest` correcto (desempata a IDB, la fuente durable).

**Backlog Analista:** [P1] no reinyectar base64 al fallar upload (+ `track()`) · [P1] telemetría en
`rebaseMutators` catch · [P2] migración resiliente (no latchar en fallo total, dedup/huérfanos) ·
[P2] CAS false-conflict al Externo + limpiar `idb_offline_queue`.
**Veto:** mantengo la línea roja sobre `read_from_normalized`. Marco el fallback base64 como
**condición de cierre de sprint**: sin instrumentación `track()`, es un P0 disfrazado de fallback amable.

### Experto en Datos
- **`backup_app_data` (AFTER, sin dedup) es amplificación de escritura pura y ahora redundante:**
  copia el blob entero a `app_data_backups` en CADA save. Con el blob a 200KB bajó 20x, pero sigue
  siendo una 2ª escritura serializada en la misma transacción del save.
- **`snapshot_app_data` (BEFORE, `ON CONFLICT (identifier) DO NOTHING`) NO es un backup: es un
  fósil.** Solo conserva la PRIMERA foto de cada pareja, para siempre. Las "dos capas de backup"
  que creíamos tener desde mayo **nunca existieron** — una es write-amp, la otra un fósil de mayo.
- **`app_data_backups` sin retención viva:** la limpieza de mayo (663→12) fue un `DELETE` manual,
  no un `pg_cron`. Por eso hoy son **85MB en 23 filas** (blobs de 4MB pre-migración sin limpiar).
  `TAREAS_SQL` la marca "✅ COMPLETADO" y es engañoso.
- **El timeout a 20s es analgésico, no antibiótico:** `weeks`/`missions`/**el historial de chat**
  siguen en el blob y crecen monótonamente. En meses un blob "solo texto" llega a 500KB-1MB y con
  `backup_app_data` duplicando cada escritura volveremos a rozar el timeout — ahora a 20s, así que
  tardaremos más en enterarnos. Cura de raíz: **sacar del blob lo append-only** (chat → tabla
  `messages`, que ya existe), no subir el timeout otra vez.
- **Fotos huérfanas en Storage: fuga garantizada** (confirmado: cero `storage.remove` en el repo).
  Bucket `photos` **público** con path `{userId}/...` → fotos personales accesibles por URL sin
  caducidad (revisar con UI/UX).
- **Dual-write / `read_from_normalized: false` correcto y permanente.** Deuda histórica sin cerrar:
  la misión huérfana `42a03092` (1 fila en tabla sin match en blob).

**Backlog Externo/SQL:** [P0] consolidar backups en UN trigger incremental con retención real +
purgar la basura pre-migración + `VACUUM` · [P0] retención como `pg_cron`, no acto manual · [P1]
medir techo real (`pg_column_size(data)`, alertar >500KB) y planear chat→tabla `messages` · [P1]
cerrar fuga de fotos (`deleteWeekPhoto` client + barrido server) · [P2] limpiar huérfana `42a03092`
+ evaluar bucket privado.
**Línea roja:** no firmo que "hay dos capas de backup operativas"; no acepto P2-1 (retención) como
cerrado mientras sea un `DELETE` manual; si alguien propone subir el timeout otra vez en vez de
sacar datos del blob, ahí planto la línea.

### Forense
- **Se violó la línea roja en los dos primeros intentos: se deployó sin el body del error.** El
  body real (`canceling statement due to statement timeout`) existía desde el primer fallo en
  `result.error`/`e.message`. Nadie lo leyó hasta v5.13.1. Dos versiones quemadas por no mirar la
  string que ya teníamos.
- **La telemetría del fallo omitía el único número que importaba: el tamaño del blob.**
  `track("save_error", {message, code, coupleId})` (`App.jsx:1403`) no emite `blob_size`. El proxy
  `JSON.stringify(next).length` solo se emite en `save_validation_failed`, que nunca se disparó
  (el blob de 4MB era válido). 65 fallos de telemetría ciega al síntoma.
- **La telemetría es write-only para el equipo:** `track()` escribe en `events` (Supabase) y no hay
  vista de lectura fuera de la consola. Diagnóstico definitivo + telemetría propia viven TODOS tras
  el mismo muro — por eso la causa "solo se halló al obtener acceso directo".
- **Se confundió "cuelgue de red" (WKWebView) con "cancelación de servidor".** La saga v4.22.x
  entrenó el reflejo "todo fallo de guardado = cuelgue de WKWebView" → v5.12 (offline) y v5.13
  (CAS cliente). Pero un cuelgue no devuelve body; un `statement_timeout` sí, con código Postgres.
  Y el timeout de cliente (15-20s) > server (8s) → el servidor siempre cancelaba primero.
- **El screenshot del usuario (WiFi bueno + v5.13.0) fue el único acto forense real** — descartó la
  rama "red" con un dato binario. Llegó DESPUÉS de dos fixes, no antes.
- **`saveErrDetail` (v5.13.1) es la pieza correcta y se queda**, pero es un probe manual de un solo
  dispositivo/momento: no agrega `blob_size` ni da la visión agregada ("65/24h") que reveló el patrón.

**Backlog Forense:** [P0] emitir `blob_size`/`photo_bytes` en todo `save_error` + `save_ok`
muestreado · [P0] dashboard de lectura de `events` fuera de la consola (Edge Function
`?diagnose=events&since=24h`) · [P1] endpoint `?diagnose=save` (pg_column_size, statement_timeout,
count de backups) · [P2] guard client-side `blob_oversize` (>1.5MB) con desglose por sección.
**Regla propuesta:** ningún fix de un fallo de guardado se deploya sin el body/`code` crudo de un
fallo real Y sin el `blob_size` de ese guardado; toda telemetría `save_error` DEBE incluir `blob_size`.

### DevOps
- **git: rama = `origin/main` = `13c940a` (v5.14.0), divergencia 0/0.** `version.json` y
  `APP_VERSION` sincronizados. Paridad repo↔repo perfecta.
- **[P0] `statement_timeout='20s'` no existe en el repo como código** — solo como prosa en
  `CLAUDE.md`/`CHANGELOG.md`. Un `ALTER ROLE` de una línea que vive solo en el estado mutable de
  Postgres. Proyecto recreado → vuelve a 8s en silencio y el error resucita.
- **[P0] El bucket `photos` es dependencia de infra no versionada Y contradice la doc:**
  `photoStore.js:10` usa `"photos"` (público), pero `TAREAS_SQL:697-712` documenta `couple-assets`
  + una tabla `week_photos` que nunca se construyó. Deploy limpio → toda subida de foto lanza.
- **CI real (no solo local):** `.github/workflows/ci.yml` corre lint + test + build en cada push/PR
  (Node 22). Equivalente al `prebuild` local. Bien.
- **Ciclo del Service Worker completo:** `skipWaiting` + `SKIP_WAITING` + `controllerchange`→reload
  + `version.json` `no-store`. v5.14.0 SÍ llega a la PWA iOS instalada. Fotos cacheadas offline
  (`week-photos`, CacheFirst).
- **`vite-plugin-pwa` en `^0.17.0`** (semver 0.x: el caret permite minors que pueden romper) —
  candidata a pin exacto. **Deriva:** conviven `vercel.json` y `netlify.toml` (config muerta).

**Backlog DevOps:** [P0] versionar el `statement_timeout` (migración SQL idempotente + backlog
Externo) · [P0] documentar bucket `photos` como prerequisito de infra + reconciliar la doc de
`couple-assets`/`week_photos` · [P1] pinear `vite-plugin-pwa` · [P2] eliminar `netlify.toml` · [P2]
smoke-check post-deploy de `/version.json`.
**Paridad:** repo↔repo perfecta; **repo↔infra derivada** (timeout + bucket viven solo en Supabase).

### Scanner *(Coordinador — el agente cayó por límite de sesión de la plataforma)*
- **[OK] Migración `loveNote`→`loveNotes` limpia:** ningún componente lee ya `data.loveNote`
  singular (grep confirma solo la referencia en el comentario de `loveNote.js`). El inicio deriva de
  `loveNotes[0]`; el muro y el inicio no divergen.
- **[P1] Fuga de fotos huérfanas** (coincide con Datos/Analista): sin `deleteWeekPhoto`, cada
  reemplazo/borrado abandona el objeto en Storage.
- **[P1] Migración de fotos no auto-reintentable** (coincide con Programador/Analista): ref latcheado
  antes del await.
- **[P2] Push de nudge/gratitud/notita/ritual:** todos usan `sendContextualPush(..., sessionUserId)`
  (excluyen al emisor) con tags únicos (`mp-nudge-{id}`, `mp-gratitude`, `mp-lovenote`, `mp-ritual`)
  — correcto. La notita/gratitud/ritual dependen de `runAfterSave`/envío directo bien aplicado.
- **Sign-off:** doy sign-off de los paths de features de conexión (reacciones/nudge/ritual/notitas/
  gratitud/fechas/sugeridor/homeHighlight) y de la lectura `photoUrl || photo`. **No doy sign-off**
  del path de subida/migración de fotos hasta cerrar los dos P1 (huérfanos + reintento).

### QA *(Coordinador — el agente cayó por límite de sesión de la plataforma)*
- **Cobertura:** 134 tests. Existen `save.test.js` y `save-integration.test.js` (el path de save no
  está a cero), pero **la máquina CAS de `runSave` inline no tiene test directo** de sus ramas
  conflict/rpc-error/no-converge.
- **Sin test la migración de fotos** (`App.jsx`) ni el **path de subida** de `photoStore` (solo hay
  tests de sus helpers puros `dataUrlToBlob`/`extFromMime`/`isInlinePhoto`). Falta el contrato "si
  falla a medias, no se pierde ninguna foto ni se corrompe el blob".
- **Contratos en riesgo por la sesión:** consolidación del inicio (`HomeHighlight` elige
  `UpcomingDates` vs `DateIdea`) y migración `loveNote→loveNotes` — sin test de regresión.
- **Riesgo de producción:** ~30 fotos migrando a la vez en el primer arranque de la pareja real;
  el fallback base64 puede reinflar el blob si Storage falla (ver Analista P0).

**Checklist de regresión v5.14.0 (pareja real, iOS + Android):** (1) guardar cambios repetidos sin
"error"; (2) abrir Histórico → toast "📸 fotos optimizadas", verificar que se ven todas; (3) blob de
la pareja < 500KB tras migrar (verificable por Externo); (4) subir foto nueva → aparece y persiste
tras recargar; (5) quitar foto → desaparece de ambos dispositivos; (6) offline: histórico muestra
fotos ya vistas; (7) notita/gratitud/nudge llegan a la pareja, no a uno mismo; (8) inicio no empuja
el progreso de la semana fuera de vista.
**Backlog QA:** [P1] test del contrato de migración de fotos (fallo parcial no pierde datos) · [P1]
tests directos de las ramas de `runSave` (tras extraerlo, ver Programador) · [P2] test de regresión
`loveNotes`/`HomeHighlight`.

### UI/UX *(Coordinador — el agente cayó por límite de sesión de la plataforma)*
- **[P1] Densidad del inicio:** en un día "cargado" el inicio apila **LoveNote + GratitudeCard +
  HomeHighlight + banner de ritual** (`App.jsx:2242-2247`) ANTES del `HomeDashboard` → el progreso
  de la semana queda empujado hacia abajo en iPhone. La consolidación (v5.9.0) ayudó (fusionó
  fechas+sugeridor en `HomeHighlight`), pero gratitud y notita siguen sumando. Revisar prioridad/
  colapso cuando coinciden 3+.
- **[P1] Sin feedback al subir foto de semana:** `pickWeekPhoto` no tiene estado "subiendo…" — como
  ahora sube a Storage (puede tardar en móvil), Marta ve que "no pasa nada" tras elegir la foto.
  Añadir spinner/estado por semana.
- **[P0-UX] El mensaje "conexión inestable" era deshonesto:** el error real era un timeout de
  servidor, no la red. `saveErrDetail` (v5.13.1) lo mitiga mostrando el detalle técnico, pero el
  titular sigue culpando a la conexión. Debe decir la verdad ("estamos guardando, puede tardar")
  sin inventar una causa.
- **[P2] Toast de migración "📸 X fotos optimizadas — la app irá más rápida":** tranquiliza, correcto.

**Backlog UI/UX:** [P1] estado "subiendo…" en foto de semana · [P1] regla de densidad del inicio
(máx N tarjetas / colapso) · [P2] revisar copy del banner de error de guardado.
**Línea roja:** el mensaje que culpa a la "conexión" cuando el problema es del servidor confunde a
Marta y la manda a reiniciar el router — no dejo pasar copy que diagnostica mal por ella.

### Externo (Supabase) — *ejecutado en esta sesión con acceso directo (MCP)*
- ✅ **`ALTER ROLE authenticated SET statement_timeout = '20s'`** (verificado: `rolconfig` =
  `statement_timeout=20s`). Alivio inmediato, sin deploy de app.
- ✅ Diagnóstico confirmado con datos: `pg_column_size(data)` = 4.043.012 (3.849 kB en `weeks`),
  65 `canceling statement due to statement timeout`/24h en logs, `authenticated` estaba en 8s.
- ✅ Confirmado bucket `photos` **público**, RLS por carpeta `{userId}/...`, límite 10MB.
- **Pendiente Externo (P0/P1):** consolidar triggers de backup + retención `pg_cron`; versionar el
  cambio de timeout; barrido de fotos huérfanas; medir techo del blob (chat).

### Redactor
- **`CLAUDE.md §6` desincronizado** (lo marcó Programador): `patchM` ya no existe; resincronizar.
- **`TAREAS_SQL` marca P2-1 (retención) como "✅ COMPLETADO"** cuando fue un `DELETE` manual — el
  Experto pide reabrirlo como "🔁 recurrente".
- **Deriva de doc de Storage:** `TAREAS_SQL:697-712` habla de `couple-assets`/`week_photos`; el
  código usa `photos`. Marcar la sección obsoleta.
- ✅ `CHANGELOG.md` ↔ `changelogData.js` sincronizados hasta v5.14.0; CLAUDE.md §5 al día con las
  filas de v5.12/v5.13/v5.14.

---

## 4. Decisiones tomadas en esta sesión

| # | Decisión | Responsable | Racional |
|---|----------|-------------|---------|
| D-1 | El fix de v5.14.0 (timeout 20s + fotos a Storage) se **mantiene**: es correcto y apagó el incendio. | Coordinador | Diagnóstico confirmado con datos del servidor. |
| D-2 | El **fallback base64** de `HistoryView` se marca **condición de cierre de sprint**: hay que instrumentarlo con `track()` y decidir si se elimina. | Analista + Coordinador | Reintroduce la causa raíz en silencio. |
| D-3 | **Toda telemetría `save_error` DEBE incluir `blob_size`** (regla forense). | Forense | El número que resolvió el caso nunca estuvo en la telemetría. |
| D-4 | Los **dos cambios de infra** (timeout + bucket `photos`) se **versionan** como migración/prerequisito. | DevOps | Reproducibilidad rota hasta cerrarlo. |
| D-5 | **`snapshot_app_data` se elimina** (fósil) y `backup_app_data` gana **retención `pg_cron`** (≤30/pareja). | Experto en Datos | No tenemos dos capas de backup; tenemos write-amp + un fósil. |
| D-6 | **`read_from_normalized` permanece `false`** (línea roja doble: Analista + Programador). | Coordinador | Falta schema + CAS extraído/testeado + Scanner sign-off + staging. |
| D-7 | **`idb_offline_queue` se resuelve** (cablear o borrar). | Analista | Un flag que no gatea nada es una mina. |
| D-8 | **`CLAUDE.md §6` y `TAREAS_SQL` se resincronizan** con el código real. | Redactor | Doc drift = decisiones sobre datos stale (la regla DevOps de mayo). |

---

## 5. Backlog resultante

### P0 — Crítico (≤48h)
- **C-P0-1** No reinyectar base64 al fallar el upload de foto (o, si se mantiene, instrumentar con
  `track("week_photo_upload_failed", {blob_size})` y avisar al usuario). *(Programador + Analista)*
- **C-P0-2** `deleteWeekPhoto(url)` + engancharlo en borrado/reemplazo de foto (cierra la fuga de
  Storage). *(Programador)*
- **C-P0-3** Añadir `blob_size`/`photo_bytes` a `track("save_error")` y a un `save_ok` muestreado.
  *(Programador + Forense)*
- **E-P0-1** `DROP TRIGGER trg_snapshot_app_data` + retención `pg_cron` (≤30/pareja) en
  `backup_app_data` + purga de blobs pre-migración + `VACUUM`. *(Externo)*
- **E-P0-2** Versionar `statement_timeout='20s'` (migración idempotente) + documentar bucket
  `photos` como prerequisito de infra. *(DevOps + Externo)*

### P1 — Importante (≤1 semana)
- **C-P1-1** Migración de fotos resiliente: no latchar `photoMigrationRef` en fallo total; reintentar
  fotos varadas. *(Programador + Analista)*
- **C-P1-2** `track("rebase_mutator_dropped")` en el `catch` de `save.js`. *(Analista)*
- **C-P1-3** Extraer la máquina CAS de `runSave` a `save.js` puro + tests directos. *(Programador + QA)*
- **C-P1-4** Estado "subiendo…" en la subida de foto de semana. *(UI/UX)*
- **D-P1-1** Resincronizar `CLAUDE.md §6` y `TAREAS_SQL` con el código real. *(Redactor)*
- **E-P1-1** Verificar `RETURNING`/RLS del RPC `save_app_data_cas` (¿false-conflict real?). *(Externo)*
- **F-P1-1** Dashboard/endpoint de lectura de `events` (`?diagnose=events`). *(Forense)*

### P2 — Deuda técnica
- De-duplicar `taskCongrat` (`computeStreakDelta`) · resolver `idb_offline_queue` · pinear
  `vite-plugin-pwa` · eliminar `netlify.toml` · smoke-check `/version.json` post-deploy · limpiar
  huérfana `42a03092` · evaluar bucket `photos` privado · regla de densidad del inicio · plan
  chat→tabla `messages`.

---

## 6. Riesgos abiertos

1. **Recaída del timeout por fallback base64** — si Storage falla persistentemente, el blob vuelve a
   crecer foto a foto sin que nadie lo vea. *Mitiga: C-P0-1 + C-P0-3.*
2. **Reproducibilidad de infra** — timeout y bucket viven solo en Supabase. *Mitiga: E-P0-2.*
3. **Crecimiento del blob por chat** — el historial de mensajes append-only sigue dentro. *Mitiga:
   plan chat→`messages` (P2) + alerta >500KB.*
4. **Sin backup real** — `snapshot` es fósil; si un save corrupto pasa `isValidAppData`, la única red
   es `backup_app_data` (sin retención). *Mitiga: E-P0-1.*
5. **Fuga de Storage no acotada** — huérfanos por reemplazo y por doble-migración de la pareja.
   *Mitiga: C-P0-2 + barrido server.*

---

## 7. Próximos pasos — secuencia sugerida

1. **Hoy (P0 cliente, bajo riesgo):** C-P0-1, C-P0-2, C-P0-3 en un lote + tests → deploy.
2. **Externo (P0 datos):** E-P0-1 (triggers/retención) y E-P0-2 (versionar timeout + doc bucket).
3. **Semana:** C-P1-* (migración resiliente, telemetría rebase, extraer CAS + tests, spinner foto) +
   D-P1-1 (resync docs) + F-P1-1 (dashboard events).
4. **Diferido:** P2 (limbo de `missions`, chat→tabla, densidad del inicio).

---

## Apéndice: reglas propuestas para `CLAUDE.md`

1. **Nada de binarios en el blob** *(ya añadida en §5 con v5.14.0)* — reforzada: cualquier
   `pg_column_size(data) > 500KB` es alerta, y lo append-only (chat) va a su tabla.
2. **Regla forense de guardado:** ningún fix de un fallo de guardado se deploya sin el body/`code`
   crudo de un fallo real Y sin el `blob_size`; toda telemetría `save_error` incluye `blob_size`.
3. **Infra versionada:** todo cambio server-side (ALTER ROLE, bucket, trigger) se refleja en una
   migración/backlog del repo — la infra no puede vivir solo en la instancia.
4. **Fallback que revive una causa raíz = P0 disfrazado:** cualquier `catch` que restaure el estado
   corregido (base64 al blob) debe instrumentarse con `track()` y documentarse como riesgo asumido.
</content>
