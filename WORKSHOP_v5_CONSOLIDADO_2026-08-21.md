# Workshop v5 — Informe Consolidado
## Misiones de Pareja · 21 de agosto de 2026 · v5.14.0

> Convocado tras la saga de guardado/offline (v5.12.0 → v5.14.0) y los Bloques 3/4/5
> de features de conexión de pareja. Formato heredado de `WORKSHOP_v4_3_CONSOLIDADO`.

**Nota de proceso:** se convocaron 8 agentes en paralelo. 5 completaron a la primera (Programador,
Analista, Experto en Datos, Forense, DevOps); 3 (Scanner, QA, UI/UX) quedaron cortados por un
límite de sesión de la plataforma y se **reconvocaron después** — **los 8 completaron su auditoría
sobre el repo real.** El re-run de Scanner/QA/UI/UX aportó hallazgos nuevos de peso (fotos de cápsula
y avatares aún en base64, áreas de toque por debajo de 44px, cobertura de tests de la orquestación
de guardado) integrados en el backlog de abajo.

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
- **[P0] La cura de fotos está INCOMPLETA** (hallazgo del re-run de Scanner): la migración solo saca
  las fotos de SEMANA; las **fotos de Cápsula del Tiempo (`capsule.photo`) y los avatares
  (`settings.photos.*`) siguen en base64 dentro del blob** → la causa raíz del `statement_timeout`
  sigue latente y volverá con el uso.
- **[P0 UX] El gesto estrella no se puede tocar:** el botón 👉 "dar un toque" mide 24px y la ✕ de
  quitar foto 16px (mínimo iOS = 44px); y subir una foto de semana no muestra ningún "subiendo…" →
  parece colgada 3-6s.

Consenso del equipo: **el incendio está apagado, pero el fix creó humo nuevo que hay que ventilar
antes de dar el sprint por cerrado — y la cura de fotos hay que terminarla (cápsulas + avatares).**

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

### Scanner
Escaneé los 9 libs nuevos, sus 9 componentes, los handlers en `App.jsx` y los paths de lectura de
foto/notita/reacción/gratitud en todas las vistas que comparten esos datos.
- **[P1] `capsule.photo` (Cápsula del Tiempo) sigue como base64 DENTRO del blob — 2ª fuente de bloat
  que reintroduce la causa raíz de v5.14.0.** `TimeCapsuleView.jsx:51` (`toDataURL(0.75)`, 800px) →
  `App.jsx` `createTimeCapsule` guarda `photo: photo||null` en `data.timeCapsules[]`. La migración de
  v5.14.0 SOLO barre `week.photo`; las fotos de cápsula NO se suben a Storage nunca, se acumulan, y
  `TimeCapsuleReveal.jsx:44` las renderiza raw. La regla §5 "nada de base64 en el blob" se cumple
  para semanas pero **se viola para cápsulas.** Es el hallazgo que más importa: sin esto, el "error
  al guardar" vuelve con el uso.
- **[P1] Foto de semana nueva "no cambia" si la subida falla y ya había `photoUrl`.**
  `HistoryView.jsx` (catch de `pickWeekPhoto`) guarda `photo:b64` pero NO limpia `photoUrl`; el render
  usa `w.photoUrl || w.photo` → el usuario ve la FOTO VIEJA, no la que acaba de elegir. Fix: en el
  catch, `photoUrl:null` junto a `photo:b64`.
- **[P2] `sessionPersonId` cae a `"person1"` en reacciones si el nombre no matchea `p1`/`p2`.**
  `App.jsx` `toggleReaction` hace `myId = sessionPersonId || "person1"`. Nombres no configurados/
  mayúsculas/espacios → AMBOS miembros reaccionan como `"person1"` y colisionan. Afecta también
  `c.from === sessionPersonId` en cápsulas.
- **[P2] Dos modelos de identidad conviviendo:** notitas/gratitud deciden autoría por
  `fromName === myName` (`LoveNote.jsx:48`, `NotesWallView.jsx:52`, `gratitude.js:19`) → si un
  miembro se renombra, sus notitas/gratitudes pasadas dejan de matchear y pierde el botón "Quitar";
  las reacciones (person-id estable) no sufren esto.
- **[P2] Reacciones huérfanas:** `delMission`/`deleteMissionGlobal` no limpian `data.reactions[id]` →
  el mapa acumula entradas de misiones/mensajes inexistentes en el mismo blob que intentamos adelgazar.
- **[P2] Migración de fotos: ref latcheado antes del async** (confirma a Analista/Programador) con un
  matiz: el guard `isInlinePhoto(nw[k]?.photo)` evita pisar, pero podría escribir un `photoUrl`
  derivado de un base64 VIEJO sobre una foto nueva en una ventana estrecha.
- **[P2] Avatares (`settings.photos.*`) siguen en base64 en el blob** (`ProfileModal.jsx:99`,
  `toDataURL(0.8)`). Acotado (3, se reemplazan) pero contradice la regla absoluta; candidato al mismo
  `photoStore` tras migrar cápsulas.
- **[P2] Tags de push fijos colapsan eventos** (`mp-lovenote`/`mp-gratitude`/`mp-ritual`/
  `mp-mission-done`): varias completadas seguidas se colapsan en una notificación. **Confirmado que
  NINGÚN componente lee ya `data.loveNote` singular** — la migración `loveNote→loveNotes` es limpia,
  inicio (`loveNotes[0]`) y muro derivan de la misma fuente, no divergen.

**Backlog Scanner:** [P1] fotos de cápsula a Storage (`createTimeCapsule` + barrido en migración) ·
[P1] limpiar `photoUrl` en el fallback base64 de `HistoryView`. Reducers `update(fn)` de las
features nuevas **verificados puros** (`uid()`/`Date.now()` fuera del reducer, push en
`runAfterSave`/directo) — seguros ante rebase-on-conflict, sin excepciones.
**Sign-off:** DOY sign-off a reacciones (reducer puro/idempotente, exclusión del emisor), notitas/muro
(migración limpia) y reducers de gratitud/ritual/cápsula. **NO doy sign-off** al path de fotos como
"libre de bloat" (cápsulas + avatares en base64 → §5 incompleta), NI al **modelo de identidad**
(mezcla nombre-string vs person-id con fallback silencioso a `"person1"`) — hay que unificar en
person-id antes de darlo por cerrado.

### QA
Abrí los cuatro archivos y corrí la suite: **134/134 verde, 16 files, 2.84s**. Pero "verde" engaña:
casi toda la cobertura es de funciones puras de `lib/`; los paths que esta sesión tocó de verdad no
tienen ni un test que los ejecute.
- **`save.test.js` + `save-integration.test.js` (14 tests) prueban `rebaseMutators`/`isValidAppData`,
  NO `runSave`.** El "Escenario 5" simula el loop con un `mockCAS` escrito a mano, no el `saveWithCAS`
  real ni el bucle `for(attempt<3)`. Las tres ramas críticas viven inline en `App.jsx` **sin
  cobertura**: `result.conflict` + re-snapshot, `cas_rpc_error`→fallback, y `cas_no_converge_fallback`.
- **`photoStore.test.js` solo cubre helpers puros — `uploadWeekPhoto`, el corazón de v5.14.0, no tiene
  test.** Sin cobertura: el path `${userId}/weeks/...` (que la RLS EXIGE empiece por `{userId}/`), los
  `throw` de error/sin-publicUrl, y el sanitizado de la weekKey. Un cambio de formato de path rompería
  la RLS en producción sin que ningún test se entere.
- **La migración de fotos no tiene test, y su contrato de seguridad es el más importante de la
  release** ("si falla a medias no se pierde ninguna foto ni se corrompe el blob"). Hoy se cumple por
  dos guardas correctas pero **embebidas en un `useEffect` → intesteables** tal cual.
- **Chicken-and-egg: el save que dispara la migración TODAVÍA carga las fotos no migradas.** Si 5 de
  30 suben antes de que el resto cuelgue, el `update()` guarda un blob que aún tiene ~25 base64 (~3MB)
  → puede pegar contra el mismo `statement_timeout` que intenta evitar. Y el toast "📸 optimizadas"
  salta tras `update()`, que solo AGENDA el save debounced — **no espera confirmación.**
- **Reinflación real y silenciosa** (`HistoryView` catch): el fallback reescribe base64 al blob sin
  toast ni `track()` — el `console.warn` es invisible. "Nada de base64 en el blob" es solo happy-path.
- **`localStore.test.js` cubre solo `pickFreshest`** — el pegamento con IndexedDB (`saveLocalBackup`,
  `loadLocalBackupAsync`, tragado de `QuotaExceededError`), donde estaba el bug de cuota, sin test.
- **Migración `loveNote→loveNotes` sin test** (riesgo bajo: produce ≤1 entrada, no hay histórico
  plural que perder — pero es una línea untesteada sin función pura).
- **`HomeHighlight` bien cubierto** (11 líneas, `hasImminentDate` con 3 tests de borde). En verde.

**Checklist de regresión v5.14.0 (pareja real, iOS+Android, ~15 min):** (1) migración camino feliz:
toast + miniaturas siguen viéndose, persisten como `photoUrl` tras recargar; (2) no se pierde nada:
contar fotos antes/después = igual; (3) migración parcial/mala señal: las no migradas siguen visibles
(base64), sin error ni blob corrupto, y terminan al recuperar señal; (4) reinflación: subir foto con
señal cortada → sigue apareciendo (hoy NO avisa); (5) blob adelgazado: un save normal completa sin
"error"; (6) conflicto CAS: A y B editan casi a la vez → ambas ediciones sobreviven; (7) cuelgue:
nunca el texto crudo `timeout: saveWithCAS…`, siempre el mensaje amable; (8) offline durable: reabrir
en avión pinta desde IndexedDB, no pantalla de error ni "Persona 1/2" vacío; (9) notitas tras
migración: la v5.6.0 aparece en el muro; (10) inicio consolidado: fecha ≤7d muestra "Próximas fechas",
si no la idea de plan; (11) ciclo misión (crear/editar/ciclar/refrescar persiste); (12) SW/versión:
recarga a v5.14.0, no queda en `waiting`.
**Backlog QA:** [P0] extraer el reducer de migración a `applyPhotoMigration(data, urlMap)` puro +
`photoMigration.test.js` (contrato "no se pierde ninguna foto") · [P0] extender `photoStore.test.js`
para `uploadWeekPhoto` con `supabase.storage` mockeado (path empieza por `{userId}/`, throws) · [P1]
`migrations.test.js` (loveNote→loveNotes + birthdays, idempotencia) · [P1/P2] extraer
`decideSaveStep(...)` puro de `runSave` + tests de las ramas; `track()` en el fallback base64.

### UI/UX
Reviso desde la óptica de Marta (iPhone, PWA instalada, una mano, línea 5). Todo con archivo:línea.
- **[P1] Densidad del inicio — un lunes cargado empuja el progreso de la semana fuera de pantalla.**
  Orden en `App.jsx:2242-2261`: `LoveNote`→`GratitudeCard`→`HomeHighlight`→banner `PlanningRitual`→
  recién entonces `HomeDashboard`. Un lunes con notita + prompt de gratitud + ritual = **4 tarjetas
  de ~90-120px = ~400-450px** antes del header del dashboard → el progreso de la semana (el motivo de
  abrir la app) queda bajo el fold en un iPhone SE/mini. `HomeHighlight` solo colapsa 2→1; los otros
  tres no ceden espacio. **No basta.**
- **[P0] Subir foto de semana parece que se colgó — no hay estado "subiendo…".** `pickWeekPhoto`
  (`HistoryView.jsx:12-22`) hace `await uploadWeekPhoto` (red, 3-6s en línea 5) pero el `<label>`
  📷/🖼️ no cambia: sin spinner, sin deshabilitar, sin preview optimista. Marta toca, no pasa nada
  visible → cree que falló, retoca (posible doble subida) o se va. Anti-patrón "parece congelado",
  ahora en la subida.
- **[P0] Áreas de toque por debajo de 44px — dos casi inusables.** **👉 Nudge** (`NudgeMenu.jsx:12`)
  = **24×24px**, el gesto estrella de conexión, pegado a `Reactions` → Marta abre reacciones queriendo
  dar un toque. **✕ quitar foto** (`HistoryView.jsx:72`) = **16×16px** superpuesta a una miniatura con
  `onClick` de lightbox → acierta el zoom en vez de la ✕, y sin `aria-label`. También bajo 40px: ✕ de
  gratitud (24) y de ritual (26), botones Quitar/Cambiar/Responder de notita (~28-30), y 📷/🖼️ (32,
  sin `aria-label`, solo `title` que en táctil no se lee). Los toggles del ritual sí son grandes ✓.
- **[P1] El mensaje "conexión inestable" acusa al wifi de Marta cuando la causa era el servidor.**
  `App.jsx:1405`. La 2ª frase ("Tu cambio quedó guardado… reintentará sola") es excelente; el titular
  la manda a reiniciar el router por un `statement_timeout` que no es suyo. Copy neutro: "No se pudo
  guardar ahora mismo".
- **[P1] El "Ahora no" de la gratitud no persiste — el prompt reaparece.** `GratitudeCard.jsx:9`
  guarda `dismissed` en estado local; al remontar (cambio de pestaña, realtime) vuelve a `false` y el
  prompt reaparece aunque Marta ya dijo que no. Persistir por día en `localStorage` (patrón `wrapped`).
- **[P2] "DETALLE TÉCNICO" monospace (v5.13.1):** la etiqueta "(mándaselo a Fran)" lo salva
  reencuadrándolo como "no es para ti", pero la caja negra bajo el ⚠ compite con el mensaje humano.
  Aceptable si va **colapsada** tras un "▸ Detalle para Fran", no expandida por defecto.
- **[P2] Zona bottom-center saturada:** `pushNudge`/`syncMsg`/`syncError`/toasts comparten `bottom:90`
  → pueden pisarse. Hay guardas parciales (`syncError && !syncMsg`) pero no un stack ordenado. El toast
  "📸 optimizadas" (correcto, "la app irá más rápida" reencuadra la jerga) puede quedar tapado.

**Backlog UI/UX:** [P0] estado "subiendo…" + preview optimista en foto de semana · [P0] áreas de toque
≥44px en 👉 nudge y ✕ quitar foto (+ `aria-label`) · [P1] microcopy de error neutro + detalle técnico
colapsado · [P1] presupuesto de densidad (máx 2 tarjetas de conexión sobre `HomeDashboard`; persistir
"Ahora no" de gratitud por día).
**Línea roja:** no dejo pasar (1) subir foto sin ningún "subiendo…" (parece colgada segundos), (2) el
👉 a 24px y la ✕ a 16px (el gesto estrella que no se puede tocar es peor que no tenerlo), y (3) culpar
a "su conexión" por un timeout de servidor.

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
  `track("week_photo_upload_failed", {blob_size})` y avisar al usuario). En el catch, limpiar también
  `photoUrl` (Scanner: hoy muestra la foto vieja). *(Programador + Analista + Scanner)*
- **C-P0-2** `deleteWeekPhoto(url)` + engancharlo en borrado/reemplazo de foto (cierra la fuga de
  Storage). *(Programador)*
- **C-P0-3** Añadir `blob_size`/`photo_bytes` a `track("save_error")` y a un `save_ok` muestreado.
  *(Programador + Forense)*
- **C-P0-4** **Cápsulas del tiempo y avatares a Storage** (`createTimeCapsule` + `ProfileModal` +
  barrido en la migración): mientras sigan en base64 en el blob, la cura de v5.14.0 está incompleta y
  la causa raíz sigue latente. *(Scanner)*
- **C-P0-5 (UI/UX)** Estado "subiendo…" + preview optimista en la subida de foto de semana (hoy parece
  colgada 3-6s); y áreas de toque ≥44px + `aria-label` en 👉 nudge (24px) y ✕ quitar foto (16px).
  *(UI/UX)*
- **Q-P0-1** Extraer el reducer de migración a `applyPhotoMigration(data, urlMap)` puro +
  `photoMigration.test.js` (contrato "no se pierde ninguna foto"); extender `photoStore.test.js` para
  `uploadWeekPhoto` (path `{userId}/`, throws). *(QA)*
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
- **C-P1-5** Migración robusta: el save que dispara la migración aún carga las base64 no migradas
  (chicken-and-egg, QA) → migrar en lotes o esperar confirmación antes del toast "optimizadas". *(QA)*
- **U-P1-1** Presupuesto de densidad del inicio (máx 2 tarjetas de conexión sobre `HomeDashboard`) +
  persistir el "Ahora no" de gratitud por día + microcopy de error neutro + detalle técnico colapsado.
  *(UI/UX)*
- **S-P1-1** Unificar el modelo de identidad de las features de conexión en **person-id** (hoy
  notitas/gratitud usan `fromName===myName`, se rompe al renombrar; reacciones caen a `"person1"` si
  el nombre no matchea). *(Scanner)*
- **Q-P1-1** `migrations.test.js` (loveNote→loveNotes + birthdays, idempotencia). *(QA)*

### P2 — Deuda técnica
- De-duplicar `taskCongrat` (`computeStreakDelta`) · resolver `idb_offline_queue` · pinear
  `vite-plugin-pwa` · eliminar `netlify.toml` · smoke-check `/version.json` post-deploy · limpiar
  huérfana `42a03092` · evaluar bucket `photos` privado · plan chat→tabla `messages` · **limpiar
  `data.reactions[id]` al borrar misión** (Scanner: reacciones huérfanas) · **tags de push únicos**
  para `mission-done` · stack ordenado de overlays bottom-center (UI/UX).

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
