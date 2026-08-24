-- 20260821 — Rendimiento de guardado + backups (workshop v5 / v5.14.0–v5.15.0)
--
-- Contexto: el "error al guardar" recurrente era un statement_timeout (8s) del
-- rol `authenticated` contra un blob de 4MB (fotos de semana en base64). Fix:
-- (1) subir el timeout a 20s, (2) sacar las fotos del blob a Storage (client),
-- (3) sanear los triggers de backup de `app_data`.
--
-- Esta migración documenta y hace REPRODUCIBLES los cambios server-side que se
-- aplicaron a mano vía MCP el 21/08/2026 (antes vivían solo en la instancia).
-- Idempotente: se puede re-ejecutar sin efecto adverso.

-- ── 1. Timeout del rol authenticated: 8s → 20s ──────────────────────────────
-- Los guardados de blobs grandes entran con margen. Reversible.
ALTER ROLE authenticated SET statement_timeout = '20s';

-- ── 2. Backups de app_data: eliminar el trigger "fósil" ─────────────────────
-- `trg_snapshot_app_data` insertaba con ON CONFLICT (identifier) DO NOTHING y
-- identifier = couple_id → solo conservaba la PRIMERA foto de cada pareja para
-- siempre (inútil como backup incremental) y duplicaba la escritura en cada save.
-- `backup_app_data` (AFTER UPDATE) queda como única capa de backup.
DROP TRIGGER IF EXISTS trg_snapshot_app_data ON public.app_data;

-- ── 3. Retención de app_data_backups: mantener las últimas 30 por pareja ─────
-- Purga inmediata de la basura acumulada (incl. blobs de 4MB pre-migración).
DELETE FROM public.app_data_backups
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY couple_id ORDER BY id DESC) AS rn
    FROM public.app_data_backups
  ) r WHERE r.rn > 30
);

-- Retención recurrente vía pg_cron (si la extensión está disponible). Semanal.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Re-ejecutable: quitar el job previo (si lo hay) antes de re-crearlo.
    BEGIN PERFORM cron.unschedule('app_data_backups_retention'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'app_data_backups_retention',
      '0 4 * * 0',
      $job$DELETE FROM public.app_data_backups WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY couple_id ORDER BY id DESC) AS rn
          FROM public.app_data_backups
        ) r WHERE r.rn > 30);$job$
    );
  END IF;
END $$;

-- NOTA: VACUUM (ANALYZE) public.app_data_backups; debe correrse fuera de esta
-- migración (VACUUM no puede ir en un bloque transaccional).

-- ── Prerequisito de infra (Storage), documentado aquí para reproducibilidad ──
-- El bucket público `photos` (RLS: subida en carpeta propia `{userId}/...`,
-- lectura pública) es DEPENDENCIA de la app desde v5.14.0 (fotos de semana) y
-- v5.15.0 (fotos de cápsula). Debe existir en cualquier proyecto recreado.
