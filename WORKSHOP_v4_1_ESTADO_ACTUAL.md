# Workshop de Estado del Proyecto — v4.1.0
## Misiones de Pareja · 28 de mayo de 2026

> **Conducido por:** Coordinador  
> **Documentado por:** Redactor  
> **Participantes:** Coordinador, Programador, Analista, Forense, Scanner, Experto en Datos, UI/UX, Redactor, Externo (en diferido)  
> **Versión en producción al iniciar workshop:** v4.1.0  
> **Referencia anterior:** `WORKSHOP_v4_INFORME_EJECUTIVO.md` (19/05/2026)

---

## Prólogo del Coordinador

Este workshop se convocó porque la semana del 26 de mayo de 2026 fue la peor semana técnica del proyecto desde su inicio. En un solo día, la app pasó por 16 versiones (v4.0.0 a v4.1.0). El usuario reportó que "la app no funciona", que los cambios no se guardaban, que las ediciones desaparecían al refrescar. Vinimos a v4.0 con la promesa de estabilidad y entregamos caos.

La buena noticia: todos los P0 están corregidos. La app guarda. El Service Worker se actualiza. El push llega. El changelog está sincronizado.

La mala noticia: llegamos aquí por acumulación de deuda arquitectónica no auditada, por deploy gates que no funcionaron, y por un equipo que confundió "el código es correcto" con "el sistema está listo para producción".

Este documento es el postmortem, el diagnóstico del estado actual y el plan hacia adelante. También es una revisión honesta de cada rol y una propuesta de contratación de agentes nuevos.

---

## 1. Estado Actual del Sistema (v4.1.0)

### 1.1 Flags y su significado operacional

| Flag | Valor | Razón | Condición para cambiar |
|------|-------|-------|----------------------|
| `dual_write_normalized` | `true` | Activo y funcionando. Insert/delete/status se propagan a tabla `missions` | Permanente |
| `read_from_normalized` | `false` | **Revertido v4.0.15** — `patchMissionGlobal` y `applyCarryOver` no tienen `updateNormalizedMission` | Cuando todos los paths de mutación tengan su contraparte normalizada |
| `cas_version_check` | `false` | **Desactivado v4.0.14** — triggers push en `app_data` corren `net.http_post` dentro del FOR UPDATE lock | Cuando Externo confirme que `trg_push_on_app_data_update` y `trg_notify_push_on_app_data_update` están deshabilitados |
| `push_enabled` | `true` | Funciona. CORS correcto en prod y en repo | — |
| `idb_offline_queue` | `false` | No implementado | Futuro |
| `stats_insights_enabled` | `true` | Activo | — |
| `goals_drilldown_enabled` | `true` | Activo | — |

### 1.2 Lo que funciona hoy

- **Guardado**: `saveWithRetry` (upsert simple, sin lock). Confiable. Sin statement timeouts.
- **Carga**: desde blob. `weeksData` se lee desde el JSON completo. Consistente.
- **Realtime**: `subscribeToUpdates` con `pendingSaveRef` (ref espejo, no closure stale). Funciona.
- **Push**: CORS correcto en Edge Function y en repo. Notificaciones llegan.
- **Service Worker**: `skipWaiting()` en install. Updates se aplican al primer refresh.
- **Dual-write**: insert/delete/status van a tabla `missions` en paralelo con el blob.
- **Backup**: `trg_snapshot_app_data` (BEFORE UPDATE) → `app_data_backups`. Dos capas.
- **Telemetría**: fix v4.0.4 — flush espera userId/coupleId. Eventos llegan a Supabase.
- **Onboarding**: rollback si `couple_members` INSERT falla (v4.0.11).
- **Feature UI nueva**: "Acciones para subir tu %" en sheet de persona (v4.1.0).

### 1.3 Deuda técnica activa

| Ítem | Severidad | Descripción | Solución |
|------|-----------|-------------|----------|
| `read_from_normalized: false` | P1 | Tabla `missions` es backup/analytics, no fuente de verdad. Ediciones y carryover no tienen `updateNormalizedMission` | Implementar `updateNormalizedMission` para `patchMissionGlobal`, `patchAllFutureSeries`, `applyCarryOver` |
| `cas_version_check: false` | P1 | Sin CAS, saves concurrentes de dos personas en <700ms pueden pisar datos | Externo deshabilita triggers → re-activar flag |
| `setTimeout(1500ms)` push | P2 | `sendContextualPush` se llama con delay fijo. Frágil en conexiones lentas | Mover al `.then()` del save, o tabla `push_queue` (Sprint E-2) |
| `trg_push_on_app_data_update` activo | P0 BLOQUEANTE | Trigger duplicado corre `net.http_post` dentro de transacción. Bloquea re-activación de CAS | Externo ejecuta SQL en `TAREAS_SQL_AGENTE_SUPABASE.md` sección 🚨 CRÍTICO |
| `couple_members` policy RLS | P1 | INSERT usa `is_couple_member()` que falla antes de que el usuario sea miembro | Externo cambia a `user_id = auth.uid()` |
| Sin tests automatizados | P1 | Cero cobertura. 16 versiones en un día son la consecuencia | Ver sección 5: propuesta Agente QA |
| `app_data` blob ilimitado | P2 | Blob crece sin compresión ni límite. Fotos en base64 acumulan | Compresión de blob antiguo, límite de tamaño |

### 1.4 Tareas Externo pendientes (bloqueantes)

Ver `TAREAS_SQL_AGENTE_SUPABASE.md` para SQL completo.

**P0 — CRÍTICO (bloquea re-activación de CAS):**
```sql
ALTER TABLE public.app_data DISABLE TRIGGER trg_push_on_app_data_update;
ALTER TABLE public.app_data DISABLE TRIGGER trg_notify_push_on_app_data_update;
```
→ Confirmar con lista de triggers activos post-ejecución.

**P1 — Fix onboarding:**
```sql
-- Cambiar policy INSERT de couple_members
-- de: is_couple_member() 
-- a: user_id = auth.uid()
```

---

## 2. Postmortem: El ciclo v4.0.x

### 2.1 La secuencia de eventos

| Versión | Fecha | Qué pasó |
|---------|-------|----------|
| v4.0.0 | 26/05 | Se activó `read_from_normalized: true`. La app leyó desde la tabla `missions` en lugar del blob. Las 2 misiones perdidas por race condition del 25/05 se recuperaron. Se vio como un éxito. |
| v4.0.1–v4.0.3 | 26/05 | Scanner detectó 10 bugs en el flujo de datos + 10 en push. 9 fixes en cascada. |
| v4.0.4–v4.0.6 | 26/05 | Telemetría muerta, stale closure en realtime, CAS con version 0, más fixes. |
| v4.0.7–v4.0.8 | 26/05 | Promise sin reject, carryover con tabla, CORS push, backups. |
| v4.0.9 | 26/05 | **P0 descubierto**: `doSaveWithRetry` dejaba `dataVersionRef` obsoleto. Cambios se perdían silenciosamente. |
| v4.0.10–v4.0.11 | 26/05 | CORS desync en repo, onboarding rollback. |
| v4.0.12 | 26/05 | WeekTimeline sort cronológico. |
| v4.0.13 | 26/05 | SW skipWaiting. |
| v4.0.14 | 26/05 | **P0 descubierto**: triggers push dentro de FOR UPDATE lock → statement timeout → saves fallaban. `cas_version_check: false`. |
| v4.0.15 | 26/05 | **P0 descubierto**: ediciones y carryover no persistían. `read_from_normalized: false`. |
| v4.1.0 | 28/05 | Primera feature nueva post-crisis. |

### 2.2 Causa raíz sistémica

No fue un bug. Fueron tres decisiones arquitectónicas tomadas sin verificación cruzada de capas:

1. **`read_from_normalized: true` activado sin que todos los paths de mutación estuvieran implementados.** El dual-write solo cubría insert/delete/status. `patchMissionGlobal` y `applyCarryOver` no tenían `updateNormalizedMission`. Nadie verificó exhaustivamente todos los paths antes del flip.

2. **`save_app_data_cas` con triggers I/O dentro de la transacción.** El Experto en Datos diseñó el CAS correctamente. Pero los triggers `trg_push_on_app_data_update` y `trg_notify_push_on_app_data_update` hacían `net.http_post` dentro del `FOR UPDATE`. Ningún agente auditó la interacción entre la nueva RPC y los triggers existentes.

3. **El deploy gate no funcionó.** El Coordinador no exigió sign-off del Scanner antes de activar el primer flag arquitectónico. El Scanner no exigió evidencia de los triggers antes de liberar para deploy. El gate existía en papel; no en práctica.

### 2.3 Lo que el sistema salvó

- La tabla `missions` actuó como red de seguridad el 25/05 — 2 misiones perdidas del blob se recuperaron con el flip del flag.
- `trg_snapshot_app_data` (activo desde v4.0.8) tiene backups de todos los saves desde entonces.
- Feature flags permitieron revertir sin rollback de schema.
- ESLint `no-undef` y `rules-of-hooks` atraparon bugs en build, no en producción.

### 2.4 Tiempo perdido

Estimación conservadora: **3 días** en modo bombero, 0 features entregadas. Equivalente a 1 sprint completo de trabajo productivo. El costo real es mayor porque el usuario vivió la app rota y perdió confianza.

---

## 3. Voz de cada agente

### Coordinador — *Postmortem y lecciones*

> "El deploy gate de v4.0.0 no funcionó porque era un gate de papel, no de proceso. Existía la regla pero no el mecanismo de enforcement. Mi responsabilidad: en el momento en que el Programador propuso activar `read_from_normalized: true`, debí haber exigido: 1) Scanner sign-off explícito con listado de todos los paths de mutación cubiertos, 2) confirmación del Externo de que no había triggers I/O en el camino del CAS, 3) checklist escrito en el PR. Nada de eso ocurrió."

**Medida adoptada:** El gate ahora es triple (Scanner + Externo + Checklist). Documentado en `CLAUDE.md` sección 4. No es negociable.

**Próxima decisión ejecutiva:** El roadmap original A-J de `WORKSHOP_v4_INFORME_EJECUTIVO.md` necesita reescribirse. Hicimos Sprints D, E, G en forma parcial y fuera de orden. Ver sección 6 para el nuevo roadmap.

---

### Analista — *Lo que nadie quería mirar*

> "Hay dos problemas que señalé pero no escalé con suficiente intensidad. El primero: `sendContextualPush` con `setTimeout(1500ms)` es frágil. El segundo, más importante: nadie auditó la tabla de triggers existentes contra el nuevo RPC de CAS. Yo sabía que `net.http_post` dentro de transacciones era un antipatrón. Lo vi en el esquema cuando revisé el backfill de missions. No lo dije en voz alta antes del deploy. Eso no se repite."

**Propuesta del Analista para el próximo Sprint G-2 real:**
- Antes de cualquier flip de flag, el Analista entrega una tabla completa: para cada path de mutación, ¿qué escribe en blob? ¿qué escribe en tabla? ¿hay trigger en ese path? ¿ese trigger hace I/O?
- Formato: checklist de 2 columnas con firma explícita "auditado" o "no auditado".

**Hallazgo preocupante actual:** El blob en `app_data.data` no tiene compresión automática. Fotos en base64 acumulan en el JSON. No hay límite de tamaño. Si el blob supera ~8MB, los saves podrían comenzar a fallar silenciosamente por límite de Supabase o de red. **Recomendación: medir el tamaño actual del blob antes del próximo sprint.**

---

### Programador — *Pragmatismo sobre lo que falló*

> "El código era correcto. El timing no lo era. `updateNormalizedMission` para `patchMissionGlobal` y `applyCarryOver` era una tarea real, no trivial — la dejamos como 'pendiente para después' antes de activar el flag. El 'después' nunca llegó porque el flag se activó inmediatamente. Lección: un flag arquitectónico no se activa hasta que todos los paths están implementados y verificados, sin excepciones."

**Estado técnico desde la perspectiva del Programador:**
- `App.jsx` sigue siendo el monolito (ahora ~5000 líneas). El refactor modular del roadmap original sigue pendiente.
- El `CoupleMissions` component concentra demasiado estado. Con el tiempo, este será el origen del siguiente bug difícil de diagnosticar.
- **Deuda pendiente real:** `updateNormalizedMission` para los 3 paths que faltan. Estimación: 1 jornada de trabajo.

**Recomendación para el próximo sprint:** Completar los 3 paths antes de hablar de re-activar `read_from_normalized`. No hay atajo.

---

### Forense — *Por qué llegamos tarde a los diagnósticos*

> "Mi activación llegó demasiado tarde. v4.0.9 (CAS versión stale) y v4.0.14 (triggers dentro de FOR UPDATE) fueron diagnosticados por el usuario reportando síntomas, no por diagnóstico proactivo antes del deploy. La regla dice 'activar cuando un bug persiste tras 2 intentos de fix', pero ningún deploy debería salir a producción con un path de save no auditado end-to-end."

**Propuesta del Forense:** Añadir a su protocolo un checklist de activación PRE-deploy (no solo reactivo):
- ¿Qué respuesta devuelve este endpoint si el step N falla?
- ¿Hay algún timeout implícito en este path?
- ¿El error llega visible al usuario o es silencioso?

Si cualquier respuesta es "no lo sé", el Forense bloquea el deploy hasta saberlo.

---

### Scanner — *El patrón que se escapó*

> "El primer scan (v4.0.2/v4.0.3) fue una operación de dos agentes paralelos que capturó 20 bugs. Lo que no capturó fue el patrón cross-sistema trigger → CAS. Por qué: no leí los triggers existentes de `app_data` como parte del scan. Los scans de datos y de push auditaron el código JavaScript. Nadie auditó el schema de Supabase como parte del scan. Ese punto ciego es ahora un mandato explícito en mi `.md`: cualquier scan que toque un path de save debe incluir consulta a Externo de los triggers activos en las tablas involucradas."

**Nuevo mandato de activación:** Antes de cualquier flip de flag arquitectónico, el Scanner ejecuta un scan específico de "¿qué triggers corren cuando este flag es true?" con lista de triggers del Externo como input.

---

### Experto en Datos — *El antipatrón que debí nombrar*

> "El CAS que diseñé es correcto en aislamiento. La RPC `save_app_data_cas` con `FOR UPDATE` es la forma estándar de evitar overwrites concurrentes. Lo que fallé en comunicar es el corolario obvio para cualquier DBA: cualquier trigger en una tabla con `FOR UPDATE` que haga I/O externo es una bomba de tiempo. `trg_push_on_app_data_update` existía antes del CAS. Cuando diseñé el CAS, debí haber incluido explícitamente en mi entregable: 'verificar y deshabilitar todo trigger con net.http_post en `app_data` antes de activar save_app_data_cas'. No lo hice."

**Nueva regla técnica del Experto en Datos:** Todo diseño de RPC con lock (`FOR UPDATE`, `SERIALIZABLE`, `EXCLUSIVE`) debe incluir en el entregable un inventario de triggers en la tabla afectada y dictamen explícito sobre si son compatibles con el lock.

**Análisis de consistencia actual:**
- Tabla `missions`: 222 filas (incluye 2 misiones recuperadas post-race condition de 25/05)
- Blob: fuente de verdad. Consistent con tabla para insert/delete/status.
- Gap conocido: ediciones y carryover solo en blob. Tabla ~97% sincronizada.
- Estimación de trabajo para cerrar gap: 1 día (Programador).

---

### UI/UX — *El usuario real bajo el caos técnico*

> "Durante los 3 días rotos, 'Marta' no pudo planificar su semana. No es abstracto. El impacto de una app que parece guardar pero no guarda es peor que una app que da error visible — porque Marta reingresa la información convencida de que se perdió, y luego aparece duplicada cuando la app 'se arregla'. Los bugs silenciosos son los más dañinos para la experiencia."

**Observación de UI/UX sobre el sistema de estados:**
- El badge `TBC/ASAP/IN_PROGRESS/DONE` es correcto pero nadie ve la diferencia entre TBC y DONE al ciclar rápido. Falta un micro-feedback visual (animación) cuando una misión pasa a DONE.
- La sección "Acciones para subir tu %" (v4.1.0) es exactamente el tipo de feature que Marta usa en 30 segundos entre estaciones. El tap → cycleStatus es correcto.
- **Deuda UX no técnica:** la app no tiene estado de "guardando..." visible. Cuando hay debounce de 700ms, el usuario no sabe si sus cambios están seguros. Un indicador sutil (spinner pequeño, ícono de nube) reduciría la ansiedad.

---

### Redactor — *El contrato con el usuario*

> "El CHANGELOG tuvo 8 versiones de desincronización en algún momento de este proyecto. El mandato del mismo commit fue introducido para ese bug. Durante el ciclo v4.0.x, el CHANGELOG estuvo sincronizado en cada versión. El sistema funciona cuando se respeta."

**Verificación del Redactor (28/05/2026):**
- `APP_VERSION` en `constants.js`: `"4.1.0"` ✅
- `LAST_UPDATE`: `"2026-05-28"` ✅
- `CHANGELOG` array (constants.js): entrada v4.1.0 presente ✅
- `CHANGELOG.md`: entrada v4.1.0 presente con descripción completa ✅
- Entradas v4.0.0 → v4.0.15 presentes y sincronizadas ✅

**Hallazgo del Redactor:** el `README.md` sigue documentando la arquitectura del "sistema sin auth" (v1.8.0). No refleja la realidad actual (couples, auth, dual-write, RLS). El README necesita una actualización completa que refleje el estado v4.x. No es urgente, pero es deuda de documentación visible externamente.

---

### Externo (en diferido) — *Diagnóstico de infraestructura*

> Última intervención del Externo (26/05): "La solución ya está aplicada... La DB está limpia."

**Estado confirmado por Externo:**
- `save_app_data_cas` RPC: funciona correctamente con `WHERE id = couple_id` corregido.
- `trg_snapshot_app_data`: activo, probado.
- Edge Function `send-push` v2.1: CORS correcto con `x-client-info, apikey`.
- `carried_from_blob_id`: columna añadida a tabla `missions`.
- `series_blob_id`: columna añadida a tabla `missions`.

**Pendiente del Externo (confirmado sin ejecutar):**
- 🚨 P0: Deshabilitar `trg_push_on_app_data_update` y `trg_notify_push_on_app_data_update`.
- P1: Fix policy INSERT de `couple_members`.

---

## 4. Revisión de Roles Actuales

Cada rol fue evaluado contra lo que el ciclo v4.0.x reveló. Los ajustes propuestos están separados en "actualizar .md" (ajuste de documento) vs "cambio de proceso" (cambio en cómo funciona el equipo).

### 4.1 Coordinador

**Fortalezas confirmadas:** Gestión de scope, priorización, distribución equipo/externo/usuario.

**Debilidades reveladas:** El gate de deploy era declarativo, no ejecutado. No exigió evidencia antes de los flips de flag.

**Ajuste propuesto:**
- Añadir sección "Protocolo de flip de flag arquitectónico" al `.md` con checklist de 4 ítems: Scanner sign-off explícito + Externo inventario de triggers + Forense audit de paths de error + Redactor verificación de CHANGELOG pre-deploy.
- Cambiar la frase característica para reflejar la lección.

### 4.2 Programador

**Fortalezas confirmadas:** Edits quirúrgicos, fix con cambio mínimo, velocidad de implementación.

**Debilidades reveladas:** Activó flags antes de que todos los paths estuvieran implementados.

**Ajuste propuesto:**
- Añadir regla explícita: "Un flag arquitectónico no se activa en el mismo PR que lo implementa. Requiere PR separado con checklist firmado por Coordinador."

### 4.3 Analista

**Fortalezas confirmadas:** Detecta patrones sistémicos, auditorías numéricas.

**Debilidades reveladas:** Identificó riesgos pero no los escaló a nivel de bloqueante.

**Ajuste propuesto:**
- Añadir poder de "veto técnico" explícito: si el Analista detecta un riesgo P0 no mitigado, puede marcar un PR como "BLOQUEADO — requiere resolución" y el Coordinador no puede desbloquear sin respuesta escrita al riesgo.

### 4.4 Forense

**Fortalezas confirmadas:** Metodología de diagnóstico rigurosa, endpoints probe/diagnose.

**Debilidades reveladas:** Solo reactivo. No auditó el path de save antes del deploy.

**Ajuste propuesto:**
- Añadir modalidad "pre-deploy audit": el Forense revisa cualquier cambio que modifique el path de save (CAS, versión, triggers) antes del deploy, no después.

### 4.5 Scanner

**Fortalezas confirmadas:** Scan paralelo, triaje P0/P1/P2, cross-system tracing mandato (añadido post-crisis).

**Debilidades reveladas:** No incluyó triggers de Supabase en el scope del scan.

**Ajuste propuesto (ya implementado):** El mandato post-v4.0.9 en `scanner.md` ya incluye el tracing cross-sistema. Añadir explícitamente: "Todo scan que afecte una tabla Supabase con triggers activos debe listar esos triggers como input antes del análisis."

### 4.6 Experto en Datos

**Fortalezas confirmadas:** DDL correcto, CAS bien diseñado, dual-write strategy.

**Debilidades reveladas:** No incluyó auditoría de triggers existentes en el entregable del CAS.

**Ajuste propuesto:** Añadir a "Forma de trabajo": "Cualquier diseño de RPC con lock incluye inventario de triggers activos en la tabla y dictamen de compatibilidad."

### 4.7 UI/UX

**Fortalezas confirmadas:** Test de Marta, mobile-first absoluto, microcopy.

**Estado:** Rol correcto. Subutilizado durante el ciclo de crisis (que fue 100% técnico).

**Ajuste propuesto:** Añadir responsabilidad de "validación de estados vacíos y de error". La app actualmente no tiene estados de error visibles para el usuario (ej: "guardando...", "error al guardar"). El UI/UX debe diseñar estos estados antes de que el Programador los implemente.

### 4.8 Redactor

**Estado:** Funcionó correctamente durante v4.0.x. El mandato del mismo commit se respetó en todos los lotes.

**Ajuste menor:** Añadir verificación del `README.md` como parte del checklist semestral (no en cada versión, pero sí en workshops).

### 4.9 Externo

**Fortalezas:** Diagnóstico preciso, ejecución correcta de SQL, reporte literal de resultados.

**Debilidades reveladas:** No hay SLA definido. Las 2 tareas pendientes (P0 triggers, P1 policy) llevan sin ejecutar desde el 26/05.

**Ajuste propuesto:** Definir SLA por prioridad:
- P0 CRÍTICO: ≤24h (bloquea el equipo)
- P1: ≤72h
- P2: siguiente sesión disponible

---

## 5. Propuesta de Contratación de Nuevos Agentes

### 5.1 Agente QA / Testing  ⭐ PRIORIDAD ALTA

**¿Por qué?**  
16 versiones en un día. Cero tests automatizados. Cada bug que llegó a producción fue reportado por el usuario, no capturado por el equipo. El costo de un agente QA es una fracción del costo de 3 días de work en modo bombero.

**¿Qué valor aporta?**  
- Checklists de regresión manual pre-deploy: "estas 10 operaciones deben funcionar antes de mergear a main".
- Estrategia de tests: qué testear con unit tests, qué con integración, qué manualmente.
- Mantener un "contrato de comportamiento": si el save de una misión en la semana actual funciona en v4.0.0, debe funcionar en cada versión posterior.
- Post-mortems de bug: para cada bug P0, documentar el test que lo habría capturado.

**Decisión del Coordinador:** ✅ Contratar. Archivo `.md` creado en `docs/agents/qa.md`.

---

### 5.2 Agente DevOps / Deployment  ⭐ PRIORIDAD MEDIA-ALTA

**¿Por qué?**  
El pipeline de deploy es una caja negra. El CORS de la Edge Function estaba desincronizado entre el repo y producción durante semanas sin que nadie lo supiera (v4.0.10). El SW se quedaba en "waiting" en PWA instaladas (v4.0.13). Las env vars en Netlify no están documentadas. Nadie es dueño del "último kilómetro" entre el código y el usuario.

**¿Qué valor aporta?**  
- Documentar y verificar la paridad entre repo y producción (Netlify, Supabase Edge Functions).
- Checklist de deploy: ¿el build pasa? ¿las env vars están seteadas? ¿el SW está en el estado correcto?
- Gestión de branches: qué va a main, qué va a staging, cómo funciona el CI/CD.
- Primer punto de contacto cuando "algo funciona en local pero no en producción".

**Decisión del Coordinador:** ✅ Contratar. Archivo `.md` creado en `docs/agents/devops.md`.

---

### 5.3 Agente Observabilidad / Monitoring  ⭐ PRIORIDAD MEDIA

**¿Por qué?**  
La telemetría estuvo muerta desde v3.4.0 hasta v4.0.4 — **meses** — sin que nadie lo supiera. No hay alertas de producción. No hay métricas de saves/sesión, tamaño del blob, errores de CAS. El equipo se entera de los problemas cuando el usuario los reporta, no antes.

**¿Qué valor aporta?**  
- Medir salud del sistema: save success rate, tamaño del blob, errores de red.
- Alertas proactivas: "el blob supera 500KB", "CAS está fallando más del 5% de las veces".
- Dashboards de telemetría: convertir los eventos de `track.js` en métricas visibles.
- Detectar anomalías antes de que el usuario las reporte.

**Decisión del Coordinador:** ⏸ Propuesta pero NO contratar todavía. Razón: la telemetría acaba de ser reparada (v4.0.4). Primero hay que verificar que los datos llegan, luego crear el rol. Revisar en el próximo workshop.

---

## 6. Backlog Priorizado

### 6.1 Bloqueantes inmediatos (Externo)

**Esta semana, antes de cualquier otro trabajo:**

| ID | Tarea | Responsable | Prioridad |
|----|-------|-------------|-----------|
| E-CRIT-1 | Deshabilitar `trg_push_on_app_data_update` y `trg_notify_push_on_app_data_update` | Externo | P0 CRÍTICO |
| E-CRIT-1-B | Tras deshabilitar triggers, Coordinador re-activa `cas_version_check: true` en flags.js | Programador | P0 depende de E-CRIT-1 |
| E-P1-1 | Fix policy INSERT `couple_members` → `user_id = auth.uid()` | Externo | P1 |

### 6.2 Sprint siguiente (una vez desbloqueado CAS)

| ID | Tarea | Responsable | Estimación |
|----|-------|-------------|------------|
| G-2-REAL-1 | `updateNormalizedMission` para `patchMissionGlobal` | Programador | 0.5 días |
| G-2-REAL-2 | `updateNormalizedMission` para `patchAllFutureSeries` | Programador | 0.5 días |
| G-2-REAL-3 | `updateNormalizedMission` para `applyCarryOver` | Programador | 0.5 días |
| G-2-FLIP | Re-activar `read_from_normalized: true` tras Scanner sign-off | Coordinador | post G-2-REAL-1/2/3 |
| UX-SAVE-STATE | Indicador visual "guardando..." en la app | Programador + UI/UX | 0.5 días |
| README-UPDATE | Actualizar README.md a arquitectura real v4.x | Redactor | 1h |

### 6.3 Roadmap Q3 2026

El roadmap original A-J del Workshop v4 fue interrumpido. Re-priorización:

| Sprint | Foco | Estado |
|--------|------|--------|
| Sprint G-2 | Flip `read_from_normalized: true` (completar dual-write) | En progreso — bloqueado |
| Sprint E-2 | Push server-side: `push_queue` en DB, deshabilitar `setTimeout(1500ms)` | Depende de E-CRIT-1 |
| Sprint H | Gastos v2 (si la telemetría confirma uso activo de la pestaña) | Por confirmar con datos |
| Sprint I | Refactor modular `App.jsx` (extraer CoupleMissions + vistas) | Deuda técnica mayor |
| Sprint J | Performance: compresión de blob, límite de tamaño | Riesgo latente |

---

## 7. Conclusiones y Decisiones

### 7.1 Decisiones tomadas en este workshop

| Decisión | Tomada por | Estatus |
|----------|-----------|---------|
| `read_from_normalized` permanece `false` hasta que los 3 paths de mutación estén implementados | Coordinador | ✅ Implementada (v4.0.15) |
| `cas_version_check` permanece `false` hasta que Externo confirme deshabilitar triggers | Coordinador | ✅ Implementada (v4.0.14) |
| Deploy gate triple (Scanner + Externo + Forense) para flips de flag | Coordinador | ✅ Documentado en CLAUDE.md |
| Contratar Agente QA | Coordinador | ✅ Archivo `.md` creado |
| Contratar Agente DevOps | Coordinador | ✅ Archivo `.md` creado |
| Agente Observabilidad: aplazar hasta verificar telemetría | Coordinador | ⏸ Aplazado |
| Actualizar todos los `.md` de agentes con lecciones de v4.0.x | Redactor | ✅ Commitado |

### 7.2 Métricas de salud del proyecto (28/05/2026)

| Indicador | Estado | Tendencia |
|-----------|--------|-----------|
| App guarda correctamente | ✅ | Estable |
| App lee correctamente (blob) | ✅ | Estable |
| Push llega al partner | ✅ | Estable |
| SW se actualiza al refrescar | ✅ | Corregido |
| Dual-write insert/delete/status | ✅ | Activo |
| CAS (save optimista) | ❌ Desactivado | Pendiente Externo |
| Tests automatizados | ❌ Cero | Deuda |
| README actualizado | ❌ Obsoleto | Deuda menor |
| Triggers push deshabilitados | ❌ Pendiente | P0 Externo |

### 7.3 Sentencia del equipo

> *"v4.0.0 fue el sprint más costoso del proyecto. No porque el código fuera malo, sino porque activamos sistemas sin verificar que el terreno estaba preparado. El resultado fue positivo a largo plazo: tenemos backup, dual-write, push funcional, CAS diseñado, telemetría. Pero el camino fue más doloroso de lo necesario."*
>
> *"El proyecto está en mejor forma técnica hoy que antes del 26/05. La app que funcionaba 'perfectamente' antes tenía CAS silenciosamente roto, CORS de push silenciosamente roto, telemetría muerta, SW que nunca actualizaba. Esos problemas estaban ahí. Los encontramos al moverlos. El proceso fue turbulento; los cimientos son más sólidos."*
>
> — Coordinador, cerrando el workshop

---

## Apéndice A: Inventario de archivos modificados en v4.0.x (resumen)

| Archivo | Cambios principales |
|---------|---------------------|
| `src/lib/flags.js` | `read_from_normalized: false`, `cas_version_check: false` |
| `src/sw.js` | `skipWaiting()` en install + listener SKIP_WAITING |
| `src/main.jsx` | Sin cambio (controllerchange ya estaba) |
| `src/supabase.js` | Múltiples fixes: CAS versión, loadFromNormalized, createCouple rollback, carried_from_blob_id |
| `src/App.jsx` / `src/components/*` | isSavingRef, pendingSaveRef, sendContextualPush delay, múltiples fixes |
| `src/components/WeekTimeline.jsx` | Sort cronológico dentro del día |
| `src/components/HomeDashboard.jsx` | PersonStatsSheet acciones pendientes + fix backdrop iOS |
| `supabase/functions/send-push/index.ts` | CORS headers sincronizados con producción v2.1 |
| `CLAUDE.md` | Deploy gate, reglas preventivas, historia de bugs |
| `TAREAS_SQL_AGENTE_SUPABASE.md` | P0 crítico documentado, E-1 marcado BLOQUEANTE |
| `docs/agents/scanner.md` | Mandato cross-system tracing |

---

*Documento generado: 28 de mayo de 2026 · Próximo workshop recomendado: post Sprint G-2 completo (cuando `read_from_normalized: true` esté re-activado con todos los paths cubiertos)*
