# Salud → mascota: cómo conectar Health Auto Export (pasos para Fran)

## Cómo viajan los datos

```
iPhone (Salud)
   │  Health Auto Export, automatización "REST API", cada hora
   ▼
Supabase · Edge Function `health-ingest`      ← YA DESPLEGADA
   │  1. guarda el envío crudo (por si acaso)
   │  2. limpia: duplicados, iPhone+Watch contando doble, valores imposibles
   │  3. guarda un valor por persona / día / métrica
   ▼
tablas `health_daily` y `health_workouts`     ← las crea el paso 1
   │
   ▼
la app: mascota + panel de salud (solo lee lo de vuestra pareja)
```

Cada uno manda **sus** datos con **su** enlace. Tu mascota come de tus hábitos;
la de Ana, de los suyos.

---

## Paso 1 — Crear las tablas (una vez, 2 minutos)

1. Entra en <https://supabase.com/dashboard> y abre el proyecto.
2. Menú de la izquierda: **SQL Editor** → **New query**.
3. Abre en GitHub el archivo
   `supabase/migrations/20260928_health_ingest.sql`, botón **Copy raw file**
   (el icono de copiar, arriba a la derecha del archivo).
4. Pégalo en el editor de Supabase y pulsa **Run**.
5. Debe decir **Success. No rows returned**. Si sale un error en rojo,
   mándame una captura tal cual.

Es seguro ejecutarlo dos veces: no borra ni duplica nada.

## Paso 2 — Sacar vuestros enlaces personales (una vez)

En el mismo **SQL Editor**, **New query**, pega esto cambiando `TU_EMAIL` por
el email con el que entras en la app, y **Run**:

```sql
insert into public.health_tokens (token, couple_id, user_id, label)
select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
       cm.couple_id, cm.user_id, cm.person_name
from public.couple_members cm
where cm.couple_id = (
  select cm2.couple_id from public.couple_members cm2
  join auth.users u on u.id = cm2.user_id
  where u.email = 'TU_EMAIL'
)
returning label as persona, token;
```

Sale una tabla con **una fila por persona**: tu nombre con tu token, y el de
Ana con el suyo. Cada enlace es:

```
https://txnsotchljquilfmdpdy.supabase.co/functions/v1/health-ingest?k=TOKEN
```

cambiando `TOKEN` por el de cada uno.

> **Trata el enlace como una contraseña.** Quien lo tenga puede mandar datos
> en tu nombre (no leerlos: solo escribir). Si se filtra, se revoca uno sin
> tocar el otro — pídemelo.
>
> Si ejecutas este paso dos veces, se crean tokens nuevos y los viejos
> siguen valiendo. No pasa nada, pero usa siempre los últimos.

## Paso 3 — Configurar Health Auto Export (en cada iPhone)

En la app **Health Auto Export**:

1. Pestaña **Automations** → **+** (nueva) → tipo **REST API**.
2. **URL**: tu enlace del paso 2 (el tuyo en tu iPhone, el de Ana en el suyo).
3. **Export Format**: **JSON**.
4. **Data Type**: **Health Metrics**. Y crea una segunda automatización
   igual con **Workouts** si quieres que cuenten los entrenos.
5. **Time Grouping / Aggregation**: **Day** (un valor por día).
6. **Date Range**: los últimos **7 días** — así, si un día el móvil no
   envía, al siguiente se recupera. Los repetidos no duplican: se
   sobrescriben.
7. **Sync Cadence**: cada **hora** está bien.
8. **Métricas** a marcar (con estas la mascota tiene de sobra):
   - Step Count · Active Energy · Apple Exercise Time · Apple Stand Hour
   - Sleep Analysis
   - Resting Heart Rate · Heart Rate Variability
   - Walking + Running Distance · Mindful Minutes
   - Weight / Body Mass (opcional)
9. Actívala.

> Los nombres exactos de los botones pueden variar un poco según la versión
> de la app. Las automatizaciones pueden requerir la versión Premium.

### La primera vez: carga el histórico

Haz un envío manual con **Date Range** de los últimos **90 días**. La mascota
arranca mejor sabiendo de dónde vienes. Luego vuelve a dejarlo en 7.

## Paso 4 — Comprobar que llega

Tras un envío, Health Auto Export enseña la respuesta del servidor. Debe ser
parecida a:

```json
{ "ok": true, "metricas": 42, "entrenos": 3, "descartados": 0 }
```

| Respuesta | Qué significa |
|---|---|
| `"ok": true` | Llegó y se guardó. |
| `"descartados": N` | N datos imposibles tirados (p. ej. 300.000 pasos). Normal si es poco. |
| `token_invalido` | El enlace está mal copiado o revocado. |
| `falta_token` | Falta el `?k=...` al final del enlace. |
| `"ok": false, "guardado_crudo": true` | Llegó pero no se pudo interpretar. **No se ha perdido**: mándame captura y lo reproceso. |

---

## La limpieza, en detalle

| Problema real | Qué hace el sistema |
|---|---|
| Health Auto Export reenvía los mismos días una y otra vez | La clave es *persona + día + métrica*: reenviar **sobrescribe**, nunca duplica. |
| iPhone y Apple Watch cuentan los mismos pasos | En totales (pasos, calorías, sueño) se queda **el mayor**, no la suma. En medidas (pulso) se **promedia**. |
| Valores imposibles | Rango por métrica (pasos 0–100.000, pulso 25–230, sueño 0–16 h…). Lo que se sale se **descarta y se apunta** en `health_rejects` con el motivo. |
| Te duermes a las 2:00 del martes | La noche cuenta para el día en que **te despiertas**. |
| Zonas horarias | El día es el de **tu reloj**, no UTC — así no se cuela un día de más o de menos. |
| El parser se equivoca en algo | El envío crudo se guarda **antes** de interpretarlo (14 días). Se reprocesa sin pedirte nada. |

---

## Espacio en Supabase: qué crece y qué se limpia

Medido con el primer envío real (28/09/2026, ~16 datos por persona y día):

| Tabla | Crece | Regla |
|---|---|---|
| `health_daily` (el historial limpio) | ~1,8 MB **al año** | **No se borra nunca.** La mascota se recalcula desde su nacimiento; borrar historial la haría retroceder. |
| `health_workouts` | Mínimo | No se borra. |
| `health_raw` (envíos crudos) | ~0,9 MB **al día** | Se guarda **7 días** y se borra sola. Sin esta regla serían ~340 MB al año (el plan gratuito tiene 500 MB). |
| `health_rejects` (descartes) | Mínimo | 60 días. |

La limpieza la hace **la propia función en cada envío**, así que no depende de
que `pg_cron` esté activado. Además, un envío de más de 8 MB se rechaza con un
mensaje que pide trocear el rango de fechas, en vez de meter de golpe años de
datos.

Nada de esto toca `app_data`, así que no dispara el trigger de backups que
causó el problema de los 4 MB.

### Para vigilarlo (SQL Editor)

```sql
select relname                                        as tabla,
       n_live_tup                                     as filas,
       pg_size_pretty(pg_total_relation_size(relid))  as tamaño
from pg_stat_user_tables
where relname like 'health_%' or relname in ('app_data', 'app_data_backups')
order by pg_total_relation_size(relid) desc;
```

Si `health_raw` pasa de ~20 MB, algo no se está limpiando: avísame.
