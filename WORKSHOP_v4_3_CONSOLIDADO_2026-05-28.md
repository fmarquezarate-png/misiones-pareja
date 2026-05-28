# Workshop v4.3 — Informe Consolidado
## Misiones de Pareja · 28 de mayo de 2026

---

| Campo | Valor |
|-------|-------|
| **Proyecto** | Misiones de Pareja |
| **Versión al inicio del workshop** | 4.0.15 |
| **Versión al cierre del workshop** | 4.1.0 |
| **Fecha** | 2026-05-28 |
| **Branch activo** | `claude/modest-heisenberg-zB9mn` |
| **Stack** | React 18 + Vite 5 + Supabase + Netlify (PWA) |
| **Documento previo** | WORKSHOP_v4_2_VISION_2036.md |

**Participantes del workshop:**

| Agente | Rol |
|--------|-----|
| Coordinador | Guardián del scope, gate de deploy |
| Programador | Análisis de código, pragmatismo técnico |
| Analista | Auditoría de paths, veto técnico |
| Scanner | Scan sistemático de bugs, triaje P0/P1/P2 |
| Forense | Diagnóstico por evidencia, patrones de crisis |
| UI/UX | Experiencia de usuario, test en dispositivo |
| QA | Red de seguridad pre-deploy, checklists |
| DevOps | Infra, CI/CD, Service Worker, env vars |
| Experto en Datos | Integridad SQL/RLS, triggers, auditoría DB |
| Redactor | Documentación, CHANGELOG, sincronización |

---

## 1. Resumen ejecutivo

- **El sistema está estable pero con deuda de arquitectura activa.** Los flags `cas_version_check` y `read_from_normalized` están desactivados por razones técnicas válidas. Ambos requieren trabajo Externo (P0) y trabajo de código (P1) antes de poder reactivarse de forma segura.

- **El dual-write está incompleto.** Tres paths de mutación de misiones — `patchMissionGlobal`, `patchAllFutureSeries`, `applyCarryOver` — escriben en el blob pero nunca sincronizan la tabla `missions`. Mientras `read_from_normalized: false`, esta inconsistencia es silenciosa pero acumulada.

- **El CI/CD es inexistente y el lint en producción está neutralizado.** No hay `.github/workflows`. El flag `--max-warnings 9999` en el prebuild hace que ESLint no pueda bloquear un build con regresiones. Dos cambios de una línea cada uno eliminan ambos problemas.

- **El onboarding está roto para nuevos usuarios.** La RLS de `couple_members` usa `is_couple_member()` para INSERT, condición que devuelve `false` cuando el usuario aún no es miembro. Nadie puede crear una pareja nueva sin la corrección del Externo.

- **Los triggers de push en `app_data` siguen activos y son el único bloqueante para reactivar CAS.** `trg_push_on_app_data_update` y `trg_notify_push_on_app_data_update` ejecutan `net.http_post` dentro de la transacción `FOR UPDATE` de `save_app_data_cas`. Mientras existan, activar CAS produce statement timeouts intermitentes.

- **La feature v4.1.0 — "Acciones para subir tu %" — fue entregada y verificada en producción.** El sheet de misiones pendientes con tap-to-advance funciona en iOS y Android. Fix preventivo de `onClick` en iOS PWA aplicado en `PersonStatsSheet` y `DayDetailSheet`.

- **La gestión de crisis v4.0.x (16 versiones en un día el 26/05) expuso dos ausencias estructurales:** sin checklist pre-deploy formal y sin protocolo de escalada al Forense tras 2 intentos fallidos. Ambas medidas están documentadas en CLAUDE.md. Los nuevos agentes QA y DevOps son la respuesta institucional.

---

## 2. Estado actual del sistema

### 2.1 Flags de arquitectura

| Flag | Valor actual | Estado | Bloqueante para cambiar |
|------|-------------|--------|------------------------|
| `cas_version_check` | `false` | Desactivado (v4.0.14) | Externo deshabilita `trg_push_on_app_data_update` y `trg_notify_push_on_app_data_update` |
| `dual_write_normalized` | `true` | Activo | — (activo y parcialmente funcional) |
| `read_from_normalized` | `false` | Revertido (v4.0.15) | Implementar `updateNormalizedMission` en 3 paths: `patchMissionGlobal`, `patchAllFutureSeries`, `applyCarryOver` |

### 2.2 Deuda técnica cuantificada

| Categoría | Ítems activos | Riesgo principal |
|-----------|--------------|-----------------|
| Dual-write incompleto | 3 paths de mutación sin sync | Inconsistencia silenciosa tabla/blob si se flipea `read_from_normalized` |
| Sin CAS activo | 1 flag desactivado | Race condition de save abierta; último save gana |
| Lint neutralizado en CI | `--max-warnings 9999` | Regresiones de ESLint no bloquean builds en producción |
| Sin CI/CD | 0 workflows GitHub Actions | Deploys manuales, 0 automatización |
| Tests insuficientes | 8 tests de fecha, 0 de paths críticos | Regresiones en save/dual-write/realtime sin cobertura |
| Onboarding roto | RLS `couple_members` INSERT | Nuevos usuarios no pueden crear pareja |
| `app_data_backups` sin retención | Crecimiento indefinido | Potencial agotamiento de almacenamiento |
| `isValidAppData` permisivo | Acepta blob vacío `{}` | Save corrupto pasa el gate de validación |
| `track.js` pérdida de eventos | `queue.splice(0)` antes del insert | Telemetría perdida si el insert falla |
| `isEnabled()` sin cache | `localStorage.getItem` en cada call | Overhead de lectura en cada evaluación de flag |
| `syncCarryDone` — `completedLate` incorrecto | Marca sin verificar retraso real | Estadísticas de puntualidad incorrectas |
| `applyCarryOver` usa `new Date()` | Mezcla reloj runtime con estado blob | Comportamiento incorrecto si la app corre en contexto offline/desfasado |
| `loadFromNormalized` sin trace | Falla silenciosamente | Sin diagnóstico cuando el fallback se activa en producción |

### 2.3 Cobertura de tests al 28/05/2026

| Path | Tests automatizados |
|------|-------------------|
| Utilidades de fecha | 8 tests (vitest) |
| Save / CAS / retry | 0 |
| Dual-write blob→tabla | 0 |
| Realtime / race conditions | 0 |
| Push subscription + envío | 0 |
| Onboarding (crear/unirse a pareja) | 0 |
| Service Worker update cycle | 0 |

---

## 3. Hallazgos por agente

### Programador

- `App.jsx` con 1176 líneas, 34 `useState`, 19 `useEffect` en `CoupleMissions` — la extracción modular fue progreso real respecto a las 4276 líneas originales, pero el componente sigue siendo un monolito de estado con alto costo de razonamiento.
- `eslint src/ --max-warnings 9999` en el script `prebuild` hace que ESLint en CI sea decorativo — una regresión de lint nunca bloquea el build de producción.
- `isEnabled()` en `flags.js` llama a `localStorage.getItem` en cada invocación — sin cache de módulo, evalúa flags repetidamente en loops de render.
- `track.js`: `queue.splice(0)` antes del `INSERT` a Supabase — si el insert falla, los eventos de telemetría se pierden permanentemente sin posibilidad de reintento.
- `applyCarryOver` usa `new Date()` internamente para `isFirstWeekOfMonth` pero compara contra `data.currentWeekNumber` del blob — mezcla reloj runtime con estado almacenado, fuente de comportamientos incorrectos en PWAs offline.

### Experto en Datos

- `trg_push_on_app_data_update` y `trg_notify_push_on_app_data_update` ejecutan `net.http_post` dentro de la transacción `FOR UPDATE` de `save_app_data_cas` — cuando la Edge Function tarda, el lock se extiende y produces statement timeouts. Este es el único bloqueante para reactivar CAS.
- Los dos triggers apuntan a la misma función: push duplicado por cada save. Actualmente silencioso porque el push viene del cliente; se volvería visible en cuanto se active push server-side (Sprint E-1).
- La RLS de `couple_members` para INSERT usa `is_couple_member()` como `WITH CHECK` — la función devuelve `false` porque el usuario aún no es miembro al momento del INSERT. Nadie puede crear una pareja nueva.
- `app_data_backups` crece indefinidamente — falta una política de retención (mantener las últimas 50 filas por pareja).
- Tres paths de mutación de `missions` — `patchMissionGlobal`, `patchAllFutureSeries`, `applyCarryOver` — no tienen contraparte `updateNormalizedMission`. El dual-write está incompleto para todas las operaciones de edición.

### Analista

- `syncCarryDone` marca `completedLate: true` de forma incondicional, sin verificar si la misión efectivamente está atrasada — las estadísticas de puntualidad reflejan datos incorrectos desde que se introdujo la función.
- `loadFromNormalized` falla silenciosamente: cuando el fallback al blob se activa, no hay traza, log ni alerta al usuario; en producción es imposible saber cuándo y por qué se activó.
- El patrón de stale closures en `useEffect` con dependencias incompletas es un riesgo estructural recurrente — el bug de `pendingSave` se corrigió en v4.0.6, pero el patrón puede reaparecer en cualquier nuevo effect sin el patrón de `ref` espejo.
- `isValidAppData` acepta `{ weeks: {}, settings: {} }` como blob válido — un save que borre todas las semanas pasa el gate de integridad sin alerta.
- El safety check de fallback al 80% (tabla < 80% del blob → usa blob) funciona correctamente, pero no hay telemetría de cuándo se activa en producción — no se sabe si el fallback ocurre en alguna pareja actualmente.

### Scanner

- Con `read_from_normalized: false`, los 3 paths de mutación sin sync son "black holes" acumulativos: escriben en el blob pero la tabla `missions` recibe el dual-write incompleto. El gap crece semana a semana.
- Con `cas_version_check: false`, no hay protección contra race conditions de save — si dos personas editan simultáneamente, el último save gana y los cambios del primero se pierden sin aviso.
- La cobertura de tests es de 8 casos (todos de fecha) para una superficie de código que incluye save, dual-write, realtime y push — los paths más críticos para la integridad de datos tienen cobertura cero.
- `vite-plugin-pwa` en `^0.17.0` con semver `^` — actualizaciones automáticas de dependencias podrían traer breaking changes sin control.
- El flag `--max-warnings 9999` en prebuild hace que el estándar de lint local (0 errores requeridos, definido en CLAUDE.md) no sea equivalente al estándar de CI.

### Forense

- La crisis v4.0.x (16 versiones en un día el 26/05) siguió el mismo patrón que la crisis push de v3.8.7-3.8.10: múltiples intentos de fix sin recoger primero los datos crudos de la respuesta de error.
- `save_app_data_cas` falló con 400 durante semanas porque usaba `WHERE couple_id = ...` pero la PK de `app_data` es `id` (tipo text) — el error era silencioso porque el fallback a `saveWithRetry` funcionaba, haciendo que el CAS pareciera funcionar cuando era decorativo.
- Ninguno de los 16 bugs de v4.0.x tuvo checklist pre-deploy formal — cada fix se deploó asumiendo que no afectaría paths adyacentes, y la mitad de los fixes introdujo nuevos bugs.
- Los endpoints `?probe=1` y `?diagnose=1` en `send-push` son el único mecanismo de diagnóstico sin secrets — este patrón no está replicado en otros lugares críticos del sistema (save, realtime, onboarding).
- La regla de escalar al Forense tras 2 intentos fallidos estaba documentada antes del 26/05 y no se aplicó durante la crisis — la regla necesita ser operativa, no solo documental.

### UI/UX

- La feature v4.1.0 — "Acciones para subir tu %" en `PersonStatsSheet` — fue entregada con la UX correcta: prioridad ASAP → IN_PROGRESS → TBC, callout verde con potencial de mejora, estado vacío positivo, máximo 5 tareas visibles.
- Bug iOS confirmado y corregido: `onClick` en `div` sin `cursor: pointer` no dispara en iOS PWA — fix aplicado con botón `✕` explícito en `PersonStatsSheet` y `DayDetailSheet`.
- Riesgo abierto: el sheet muestra hasta 5 misiones pendientes con indicador "+ N más" — si hay 15 pendientes, el usuario no puede ver el total real ni cuáles se están omitiendo. Considerar expandir la vista en una iteración futura.
- La métrica de "porcentaje al que llegarías si completaras las pendientes" es información motivacional bien ejecutada — refuerza la acción sin crear culpa.

### QA

- No existe un checklist de regresión de 15 ítems que corra antes de cada deploy — cada versión se lanza con verificación manual ad-hoc.
- El path completo `save → dual-write → realtime → push` no tiene ningún test de integración — cualquier regresión en este flujo solo se detecta en producción.
- El `--max-warnings 9999` hace imposible usar ESLint como gate de calidad en CI — una regresión que introduzca una variable no declarada no bloquea el build.
- El onboarding (crear pareja, primer login) es el path más crítico para nuevos usuarios y no tiene ningún test automatizado.
- El comportamiento del Service Worker en iOS PWA después del fix de `skipWaiting` (v4.0.13) no ha sido verificado en dispositivo real.

### DevOps

- No existe `.github/workflows` — el CI/CD completo depende del build automático de Netlify sin ninguna capa de validación previa.
- Las env vars `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` no tienen validación de existencia antes del build — un build sin estas vars produciría un deploy silenciosamente roto.
- `version.json` en `/public` existe pero no hay script que lo lea post-deploy para verificar que la versión activa en producción coincide con la deployada.
- `vite-plugin-pwa ^0.17.0`: el rango semver `^` puede traer breaking changes en actualizaciones automáticas de dependencias.
- El Service Worker en estado `waiting` podía persistir semanas en PWAs instaladas — fix aplicado en v4.0.13, no verificado en iOS.

### Externo (Supabase)

**Ejecutado en la sesión del 26/05:**
- `trg_snapshot_app_data` activo — backup automático antes de cada UPDATE en `app_data`.
- Edge Function `send-push` v2.1 — CORS headers corregidos con `x-client-info` y `apikey`.
- Columnas `carried_from_blob_id` y `series_blob_id` añadidas a `missions`.
- Fix `save_app_data_cas` — cláusula `WHERE` corregida a `WHERE id = p_couple_id`.
- Re-backfill de 4 columnas (`time`, `reminder`, `series_pattern`, `series_end_date`) — 139 filas actualizadas.

**Pendiente P0 (≤24h):**
- Deshabilitar `trg_push_on_app_data_update`.
- Deshabilitar `trg_notify_push_on_app_data_update`.

**Pendiente P1 (≤72h):**
- Fix RLS `couple_members` INSERT policy.
- Política de retención `app_data_backups` (últimas 50 filas por pareja).

### Redactor

- Los 8 archivos `.md` en la raíz del proyecto no tienen jerarquía ni ownership claro — quien consulta no sabe cuál es el documento vigente de referencia.
- `CHANGELOG.md` tiene como título "Shared Calendar" — el proyecto es "Misiones de Pareja".
- `CLAUDE.md` sección 5 mezcla reglas activas con arqueología histórica — imposible distinguir qué sigue vigente.
- `TAREAS_SQL_AGENTE_SUPABASE.md` no tiene campo "completado el" para las tareas ejecutadas — imposible auditar cuándo se ejecutó cada migración.
- La sincronización entre `CHANGELOG.md` y `constants.js::CHANGELOG` estuvo desactualizadas 8 versiones — la regla correctiva está en CLAUDE.md sección 3 pero debe verificarse en cada sesión.

---

## 4. Decisiones tomadas en esta sesión

| # | Decisión | Responsable | Racional |
|---|----------|-------------|---------|
| D-1 | `cas_version_check: false` permanece desactivado hasta confirmación escrita del Externo de haber deshabilitado los 2 triggers push en `app_data`. | Coordinador | Activar CAS con los triggers activos produce timeouts en producción confirmados. |
| D-2 | `read_from_normalized: false` permanece hasta que `updateNormalizedMission` esté implementada en los 3 paths faltantes. | Coordinador | Con los 3 black holes activos, flipear el flag causa pérdida silenciosa de ediciones de misiones en cada recarga. |
| D-3 | La feature v4.1.0 — "Acciones para subir tu %" — se entrega y hace push en esta sesión. | Programador + UI/UX | Feature completamente implementada, verificada en iOS/Android, sin riesgos de regresión identificados. |
| D-4 | Los agentes QA y DevOps quedan incorporados al equipo permanente. | Coordinador | La crisis v4.0.x demostró que la ausencia de checklists de regresión y de un responsable de infra es un riesgo sistémico. |
| D-5 | Observabilidad (Sentry, dashboards) diferida a Q3 2026. | Coordinador | El equipo no tiene bandwidth para implementarlo correctamente ahora. Los endpoints `?probe=1`/`?diagnose=1` cubren la necesidad inmediata de diagnóstico. |
| D-6 | El protocolo de flip de flag arquitectónico queda formalizado: PR separado + Scanner sign-off + inventario de triggers + Forense pre-audit + Redactor CHANGELOG. | Coordinador | El flip de `read_from_normalized: true` en v4.0.0 sin este protocolo generó la crisis v4.0.x. |
| D-7 | `quitar --max-warnings 9999` del prebuild es trabajo P0 de código en esta sesión o la siguiente. | Programador | Sin este cambio, el lint en CI no equivale al lint local documentado en CLAUDE.md. |
| D-8 | Documentar los 3 black holes de dual-write en CLAUDE.md como deuda técnica explícita con consecuencia conocida. | Redactor | La deuda oculta genera accidentes; la deuda documentada genera decisiones informadas. |

---

## 5. Backlog resultante

### P0 — Crítico (≤24 horas)

| ID | Tarea | Responsable | Bloqueante para | Estado |
|----|-------|-------------|----------------|--------|
| E-P0-1 | Deshabilitar `trg_push_on_app_data_update` en `app_data` | Externo | Reactivar `cas_version_check: true` | Pendiente |
| E-P0-2 | Deshabilitar `trg_notify_push_on_app_data_update` en `app_data` | Externo | Reactivar `cas_version_check: true` | Pendiente |
| C-P0-1 | Quitar `--max-warnings 9999` del script `prebuild` en `package.json` | Programador | Lint en CI equivalente a lint local | Pendiente |
| C-P0-2 | Implementar `updateNormalizedMission` para `patchMissionGlobal`, `patchAllFutureSeries`, `applyCarryOver` | Programador | Reactivar `read_from_normalized: true` | Pendiente |

**Nota de gate:** E-P0-1 y E-P0-2 son PREREQUISITO BLOQUEANTE para cualquier activación de `cas_version_check: true`. El Coordinador no levanta este gate sin confirmación escrita del Externo.

### P1 — Importante (≤72 horas)

| ID | Tarea | Responsable | Bloqueante para | Estado |
|----|-------|-------------|----------------|--------|
| E-P1-1 | Fix RLS `couple_members` INSERT: cambiar `is_couple_member()` → `user_id = auth.uid()` | Externo | Onboarding funcional para nuevos usuarios | Pendiente |
| E-P1-2 | Política de retención `app_data_backups`: mantener últimas 50 filas por pareja | Externo | Estabilidad de almacenamiento a largo plazo | Pendiente |
| C-P1-1 | Hardener `isValidAppData`: rechazar blob vacío `{ weeks: {}, settings: {} }` | Programador | Gate de validación robusto | Pendiente |
| C-P1-2 | Fix `track.js`: mover `queue.splice(0)` al `.then()` del insert, no antes | Programador | Integridad de telemetría | Pendiente |
| C-P1-3 | Cache de módulo en `isEnabled()` de `flags.js` | Programador | Rendimiento en evaluación de flags | Pendiente |
| C-P1-4 | Fix `syncCarryDone`: verificar realmente si la misión está atrasada antes de marcar `completedLate: true` | Programador | Integridad de estadísticas | Pendiente |

### P2 — Deuda técnica

| ID | Tarea | Responsable | Notas |
|----|-------|-------------|-------|
| C-P2-1 | Smoke test post-deploy: verificar `version.json` + SW activo + blob válido | DevOps | Una línea en script post-deploy |
| C-P2-2 | Fix `applyCarryOver`: usar `currentWeekNumber` del blob, no `new Date()` | Programador | Comportamiento correcto en offline |
| C-P2-3 | Actualizar `README.md` a v4.x: quitar título "Shared Calendar", reflejar "Misiones de Pareja" | Redactor | Quick win de documentación |
| C-P2-4 | Añadir trace a `loadFromNormalized` cuando falla: log visible + contador de activaciones | Programador | Observabilidad del fallback |
| C-P2-5 | Inventario de env vars en `docs/agents/devops.md` + validación pre-build en Netlify | DevOps | Previene deploys silenciosamente rotos |
| C-P2-6 | Checklist de regresión QA (15 ítems) disponible antes de cada deploy | QA | Formalización del proceso |
| C-P2-7 | Agregar al menos 3 tests de integración para el path `save → dual-write` | QA + Programador | Cobertura de paths críticos |

---

## 6. Riesgos abiertos

### Riesgo 1 — Race condition de save sin protección
**Descripción:** Con `cas_version_check: false`, si dos personas editan simultáneamente, el último `upsert` gana y los cambios de la primera se pierden silenciosamente. El blob confirma que esto ocurrió el 25/05 (2 misiones perdidas antes de activar CAS por primera vez).  
**Probabilidad:** Media — la app tiene 2 usuarios activos con patrones de uso superpuestos.  
**Impacto:** Alto — pérdida de datos sin aviso al usuario.  
**Mitigación activa:** Dos capas de backup (`trg_snapshot_app_data` + `auto_backup_on_update`). Mitigación completa: reactivar CAS tras E-P0-1/E-P0-2.

### Riesgo 2 — Dual-write incompleto acumula divergencia tabla/blob
**Descripción:** Los paths `patchMissionGlobal`, `patchAllFutureSeries` y `applyCarryOver` actualizan el blob pero no la tabla `missions`. El gap entre tabla y blob crece silenciosamente con cada edición de misión y cada carryover semanal.  
**Probabilidad:** Alta — estos paths se usan cada semana.  
**Impacto:** Alto — si `read_from_normalized` se activa antes de implementar `updateNormalizedMission`, las ediciones de misiones desaparecen al recargar.  
**Mitigación activa:** `read_from_normalized: false` permanece hasta que C-P0-2 esté completado. Documentado en CLAUDE.md.

### Riesgo 3 — Onboarding roto para nuevos usuarios
**Descripción:** La RLS de `couple_members` para INSERT usa `is_couple_member()`, que devuelve `false` cuando el usuario aún no es miembro. Ningún usuario nuevo puede crear o unirse a una pareja.  
**Probabilidad:** Certeza para cualquier usuario nuevo.  
**Impacto:** Alto — el onboarding es el path más crítico para crecimiento de usuarios.  
**Mitigación activa:** La app intenta rollback del couple si el INSERT a `couple_members` falla (v4.0.11). Mitigación completa: E-P1-1.

### Riesgo 4 — Deploy con regresión de lint sin bloqueo
**Descripción:** `--max-warnings 9999` en prebuild hace que errores de ESLint no bloqueen el build de producción. Un bug como `pushNudgeVisible` (que tumbó la app en v3.8.8 y motivó `no-undef: error`) podría deployarse sin que el CI lo rechace.  
**Probabilidad:** Baja — ESLint local sigue siendo el gate real para el equipo.  
**Impacto:** Medio — si el bug llega a producción, impacto directo en todos los usuarios activos.  
**Mitigación activa:** Ninguna automática. Mitigación completa: C-P0-1 (quitar `--max-warnings 9999`).

### Riesgo 5 — Service Worker no verificado en iOS PWA post-fix
**Descripción:** El fix de `skipWaiting` (v4.0.13) fue implementado y razonado correctamente, pero no fue verificado en un dispositivo iOS real con PWA instalada. iOS tiene comportamiento diferente al estándar para Service Workers en WKWebView.  
**Probabilidad:** Baja-media — el fix sigue la especificación.  
**Impacto:** Medio — usuarios en iOS no recibirían actualizaciones automáticas, viendo versiones antiguas indefinidamente.  
**Mitigación activa:** El botón "Actualizar versión" en Settings envía `SKIP_WAITING` como fallback manual. Mitigación completa: verificación en dispositivo iOS real (QA / DevOps).

---

## 7. Próximos pasos — Secuencia de 72 horas

La secuencia respeta las dependencias entre tareas. No saltarse el orden.

### Hora 0-4: Externo (P0 bloqueante)

1. **E-P0-1 + E-P0-2** — Externo deshabilita los 2 triggers push en `app_data`.
   ```sql
   ALTER TABLE public.app_data DISABLE TRIGGER trg_push_on_app_data_update;
   ALTER TABLE public.app_data DISABLE TRIGGER trg_notify_push_on_app_data_update;
   ```
   Confirmar al equipo: lista completa de triggers activos en `app_data` post-ejecución.

### Hora 4-8: Código P0 (bloqueado hasta confirmación Externo para CAS)

2. **C-P0-1** — Programador quita `--max-warnings 9999` del `prebuild` en `package.json`. Verificar que el build pasa sin errores.

3. **C-P0-2** — Programador implementa `updateNormalizedMission` en `patchMissionGlobal`, `patchAllFutureSeries`, `applyCarryOver`. Este trabajo puede iniciar en paralelo a E-P0-1/E-P0-2.

### Hora 8-16: Activación CAS (requiere confirmación escrita Externo de E-P0-1/E-P0-2)

4. Coordinador verifica confirmación escrita del Externo.
5. **Programador** abre PR separado para `cas_version_check: true`. Checklist obligatorio:
   - [ ] Externo confirmó E-P0-1 y E-P0-2 por escrito
   - [ ] Scanner sign-off del path de save con CAS activo
   - [ ] Forense verificó que no hay otros I/O en la transacción `FOR UPDATE`
   - [ ] Redactor actualiza CHANGELOG.md en el mismo PR
6. PR pasa lint (ahora sin `--max-warnings 9999`) y se mergea.

### Hora 16-48: Activación read_from_normalized (requiere C-P0-2 completo)

7. Programador completa y verifica `updateNormalizedMission` en los 3 paths.
8. **Scanner sign-off** del path completo de escritura: mutación → blob → `updateNormalizedMission` → tabla.
9. Programador abre PR separado para `read_from_normalized: true`. Checklist obligatorio:
   - [ ] `patchMissionGlobal` tiene `updateNormalizedMission`
   - [ ] `patchAllFutureSeries` tiene `updateNormalizedMission`
   - [ ] `applyCarryOver` tiene `updateNormalizedMission`
   - [ ] Scanner sign-off del path de lectura desde tabla normalizada
   - [ ] Forense pre-audit: inventario de triggers activos en `missions`
   - [ ] Redactor actualiza CHANGELOG.md en el mismo PR
   - [ ] Coordinador levanta el gate explícitamente
10. PR se mergea. Redactor verifica sincronización `constants.js::CHANGELOG` ↔ `CHANGELOG.md`.

### Hora 48-72: Externo P1 + Código P1

11. **E-P1-1** — Externo corrige RLS `couple_members` INSERT.
12. **E-P1-2** — Externo implementa política de retención `app_data_backups`.
13. **C-P1-1 a C-P1-4** — Programador atiende los P1 de código en el orden que la carga lo permita.
14. **DevOps** documenta inventario de env vars y agrega validación pre-build.

---

## 8. Métricas del sistema al 28/05/2026

| Métrica | Valor |
|---------|-------|
| Versión actual | 4.1.0 |
| Versión anterior al workshop | 4.0.15 |
| Versiones lanzadas el 26/05 (crisis) | 16 (v4.0.0 a v4.0.15) |
| Versiones en el sprint v4.x total | 16 + 1 = 17 |
| Líneas en App.jsx | 1176 (reducido de 4276) |
| `useState` en CoupleMissions | 34 |
| `useEffect` en CoupleMissions | 19 |
| Tests automatizados | 8 (todos de fecha) |
| Tests de paths críticos | 0 |
| Archivos `.md` en raíz | 8 |
| Agentes en el equipo | 10 |
| Flags de arquitectura activos | 3 (`cas`, `dual_write`, `read_from`) |
| Flags activos en producción | 1 (`dual_write_normalized: true`) |
| Misiones en tabla `missions` (FRANANA) | ~225 |
| Misiones en blob (FRANANA) | 220 |
| Backups automáticos activos | 2 capas (snapshot + auto_backup) |
| Workflows de CI/CD | 0 |
| Edge Functions activas | 1 (`send-push` v2.1) |
| Triggers activos en `app_data` | 4 (2 de backup, 2 de push pendientes deshabilitar) |
| P0 abiertos al cierre del workshop | 4 (2 Externo, 2 Código) |
| P1 abiertos al cierre del workshop | 6 (2 Externo, 4 Código) |

---

## Apéndice: Reglas añadidas a CLAUDE.md en este workshop

Las siguientes reglas se documentaron en CLAUDE.md durante o tras esta sesión:

1. **Protocolo de flip de flag arquitectónico:** PR separado + Scanner sign-off + inventario de triggers + Forense pre-audit + Redactor CHANGELOG. Ningún agente distinto del Coordinador puede levantar este gate.

2. **Dual-write incompleto como deuda explícita:** `patchMissionGlobal`, `patchAllFutureSeries`, `applyCarryOver` son los tres paths que no tienen `updateNormalizedMission`. Están documentados como deuda activa en la sección de arquitectura.

3. **`queue.splice(0)` en `track.js`:** el splice debe ser posterior al insert exitoso, no previo.

4. **`isEnabled()` sin cache:** cualquier función que lea `localStorage` en un hot path debe tener cache de módulo.

5. **`completedLate: true` incondicional en `syncCarryDone`:** bug documentado como P1 pendiente — la función debe verificar si la misión está realmente atrasada antes de marcar el flag.

---

*Documento generado por el Redactor — Misiones de Pareja Workshop v4.3 · 2026-05-28*
