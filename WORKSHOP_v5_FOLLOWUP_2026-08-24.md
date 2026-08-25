# Workshop v5 — Follow-up del Coordinador
## Misiones de Pareja · 24 de agosto de 2026 · v5.21.0

> Revisión de cierre: qué se prometió en `WORKSHOP_v5_CONSOLIDADO_2026-08-21.md`,
> qué se entregó, qué sigue abierto y por qué. Voz: Coordinador (guardián del
> scope, dueño del gate de deploy).

---

## 1. Veredicto ejecutivo

El workshop se convocó tras la saga de guardado/offline y destapó, además de la cura,
**cinco P0 nuevos** (varios eran regresiones de la propia cura v5.14.0). **A día de hoy el
grueso está cerrado y verificado en producción con datos**, no por intuición:

- **La prueba de fuego:** el blob de la pareja pasó de **~4 MB → 58 kB** (medido en Supabase el
  23/08). La causa raíz del `statement_timeout` está muerta.
- **7 releases** ejecutando el backlog (v5.15.0 → v5.21.0), **cada una con tests y CI verde**.
  Tests: **134 → 175**.
- **La regla "nada de base64 en el blob" está COMPLETA** (semanas + cápsulas + avatares).
- **Ningún flag de arquitectura se tocó** (`read_from_normalized` sigue `false`): el gate de
  deploy nunca estuvo en juego. El único cambio server-side sensible (`statement_timeout`,
  triggers de backup) se hizo con el SQL del Experto y se verificó.

Balance honesto: **~85-90% del backlog cerrado.** Quedan ~4 ítems abiertos, todos documentados,
ninguno bloqueante ni urgente. **No declaro "misión cumplida" al 100%** — abajo están los cabos sueltos.

---

## 2. Estado del backlog, ítem por ítem

### P0 — Crítico
| Ítem | Estado | Dónde |
|------|:---:|------|
| C-P0-1 · Fallback base64 no silencioso (+ limpiar `photoUrl`) | ✅ | v5.15.0 / v5.16.0 |
| C-P0-2 · `deletePhotoByUrl` (fuga de huérfanas) | ✅ | v5.15.0 |
| C-P0-3 · `blob_size` en telemetría (`save_error` + `save_ok` muestreado) | ✅ | v5.15.0 |
| C-P0-4 · Cápsulas **y avatares** fuera del blob | ✅ | v5.15.0 (cápsulas) · v5.18.0 (avatares) |
| C-P0-5 · "Subiendo…" + áreas de toque ≥40px | ✅ | v5.15.0 |
| Q-P0-1 · `applyPhotoMigration` puro + tests | ✅ (parcial) | v5.15.0 — *el `uploadWeekPhoto` en sí (llamada de red) sigue sin test con mock de Storage* |
| E-P0-1 · Drop trigger fósil + retención + purga + VACUUM | ✅ | Ejecutado por Fran en SQL Editor (23/08); backups purgados |
| E-P0-2 · Versionar `statement_timeout` + documentar bucket | ✅ | `supabase/migrations/20260821_save_perf_photos.sql` |

### P1 — Importante
| Ítem | Estado | Dónde |
|------|:---:|------|
| C-P1-1 · Migración de fotos resiliente (no latch permanente) | ✅ | v5.15.0 (guard "en curso") |
| C-P1-2 · `track("rebase_mutator_dropped")` | ✅ | v5.16.0 |
| C-P1-3 · Extraer `decideSaveStep` de `runSave` + tests | ✅ | v5.19.0 |
| C-P1-4 · Estado "subiendo…" | ✅ | v5.15.0 |
| D-P1-1 · Resync `CLAUDE.md §6` con el código real | ✅ | v5.18.0 |
| E-P1-1 · Verificar `RETURNING`/RLS del RPC `save_app_data_cas` | ✅ | Confirmado en diagnóstico: SECURITY DEFINER, correcto (no era RLS, era timeout) |
| S-P1-1 · Identidad por person-id (notitas/gratitud) | ✅ | v5.20.0 |
| Q-P1-1 · Tests de migración (`migrateBlob`) | ✅ | v5.17.0 |
| U-P1-1 · Densidad del inicio + microcopy + detalle colapsado | ✅ (mayormente) | v5.16.0 — *el "máx 2 tarjetas estricto" no se fuerza; se mitigó (ritual oculta highlight, gratitud persiste "ahora no")* |
| **F-P1-1 · Dashboard/endpoint de lectura de `events`** | ⚠️ **ABIERTO** | Se emite `blob_size` en la telemetría, pero **no hay superficie para leer `events` agregado sin abrir Supabase**. El pilar del Forense sigue sin construirse. |
| C-P1-5 · Migración por lotes / toast tras confirmar save | ⚠️ **PARCIAL** | La migración es resiliente, pero el toast "📸 optimizadas" salta tras `update()` (agenda el save), no tras confirmarlo; el "chicken-and-egg" (el save de migración aún puede cargar base64 no migradas) sigue teóricamente vivo, mitigado por el timeout a 20s. |

### P2 — Deuda técnica
| Ítem | Estado |
|------|:---:|
| `computeStreakDelta` (de-dup) · `idb_offline_queue` fuera · pin `vite-plugin-pwa` · reacciones huérfanas · tags de push únicos · avatares a Storage · retención cron de backups | ✅ (v5.16–5.18 + SQL) |
| **`netlify.toml`** (borrar/marcar legado) | ⏸️ **DIFERIDO** — ambigüedad de host (CLAUDE.md dice Netlify, DevOps dijo Vercel). No se toca sin confirmar dónde despliega de verdad. |
| **Reacciones → fallback `"person1"`** cuando el nombre no matchea | ⏸️ **DIFERIDO** — requiere repensar la derivación de person-id (no solo por nombre). |
| **Stack ordenado de overlays** bottom-center | ⚠️ ABIERTO (guardas parciales, sin z-stack ordenado). |
| **Chat → tabla `messages`** (sacar lo append-only del blob) | ⏸️ DIFERIDO — el Experto avisó que el blob podría re-engordar por el chat. Hoy no urge (blob a 58 kB), pero es la próxima frontera si crece. |

---

## 3. Riesgos abiertos del workshop — revisados

1. **Recaída del timeout por fallback base64** → **reducido**: instrumentado (`track`) + `photoUrl`
   se limpia. Detectable si pasa. No eliminado del todo (el fallback existe), pero visible.
2. **Reproducibilidad de infra** → **cerrado**: `statement_timeout` y bucket `photos` versionados.
3. **Crecimiento del blob por chat** → **abierto pero no urgente**: blob a 58 kB; vigilar con la
   telemetría `blob_size` (`save_ok` muestreado). Si algún día supera ~500 kB, migrar chat a tabla.
4. **Sin backup real (snapshot fósil)** → **cerrado**: fósil eliminado, `backup_app_data` con
   retención (≤30/pareja) + cron.
5. **Fuga de Storage** → **cerrado en cliente** (`deletePhotoByUrl` al reemplazar/quitar). *Barrido
   server-side de huérfanos preexistentes: no hecho (menor).*

---

## 4. Lo que el Coordinador deja EXPLÍCITAMENTE abierto

Para que no se pierdan (no son bloqueantes, pero existen):

1. **Observabilidad (F-P1-1)** — el ítem más valioso sin cerrar. Emitimos telemetría rica pero
   seguimos ciegos sin abrir Supabase. Recomendación: Edge Function `?diagnose=events&since=24h`
   con auth, o una vista interna. **Prioridad 1 de lo pendiente.**
2. **Toast de migración tras confirmación de save (C-P1-5)** — cosmético pero honesto.
3. **`netlify.toml`** — decisión de 1 línea en cuanto Fran confirme el host.
4. **Identidad person-id en reacciones** — cerrar el modelo de identidad que empezamos en notitas/gratitud.
5. **Stack de overlays** y, a futuro, **chat → tabla**.

## 5. Extras entregados fuera del backlog del workshop

- **Resiliencia offline durable (IndexedDB)** — pre-workshop pero parte de la misma saga.
- **Recurrencia "Diario"** (v5.21.0) — petición nueva de producto, no del workshop.
- **Plan Monolito Fase 3** (`docs/monolito-fase-3.md`) — hoja de ruta para descomponer el estado
  de `CoupleMissions`, con la regla clara de no tocar el núcleo de guardado sin campaña dedicada.

---

## 6. Gate de deploy (dictamen del Coordinador)

- No se flipeó ningún flag de arquitectura (`read_from_normalized`/`cas_version_check`/
  `dual_write_normalized` sin cambios de valor). El gate **no se activó** en toda la campaña.
- El Scanner dio sign-off de los paths de features y del path de fotos **una vez completadas
  cápsulas + avatares** (su reserva quedó saldada en v5.18.0).
- El Experto retiró su objeción sobre "dos backups ilusorios" tras E-P0-1.
- **Veredicto:** campaña cerrable. Lo abierto es observabilidad y deuda menor, no integridad de datos.

> Firma: Coordinador — 24/08/2026. "Cerramos el incendio con pruebas, no con optimismo; y dejamos
> por escrito los cinco cabos que faltan para no fingir que no existen."
</content>
