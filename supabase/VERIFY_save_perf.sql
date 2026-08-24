-- Verificación tras ejecutar 20260821_save_perf_photos.sql
-- Correr en el SQL Editor de Supabase y pasarle el resultado a Fran/Claude.

-- 1. VACUUM (fuera de transacción — correr SOLO/aislado, sin otras sentencias).
VACUUM (ANALYZE) public.app_data_backups;

-- 2. Trigger fósil eliminado: NO debe aparecer 'trg_snapshot_app_data'.
SELECT t.tgname, t.tgenabled
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'app_data' AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 3. Retención aplicada: ninguna pareja con >30 backups, y tamaño de la tabla.
SELECT couple_id::text, COUNT(*) AS backups
FROM public.app_data_backups GROUP BY 1 ORDER BY 2 DESC;
SELECT pg_size_pretty(pg_total_relation_size('public.app_data_backups')) AS backups_size;

-- 4. Timeout del rol authenticated = 20s.
SELECT rolname, rolconfig FROM pg_roles WHERE rolname = 'authenticated';

-- 5. LA CURA: tamaño del blob por pareja tras la migración de fotos (v5.14–5.18).
--    Debería haber bajado de ~4MB a cientos de KB si la pareja ya abrió la app.
SELECT id, pg_size_pretty(pg_column_size(data)::numeric) AS blob_size, version, updated_at
FROM public.app_data ORDER BY pg_column_size(data) DESC;

-- 6. Job de retención programado (si pg_cron está disponible).
SELECT jobname, schedule FROM cron.job WHERE jobname = 'app_data_backups_retention';
