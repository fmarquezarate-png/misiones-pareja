# Mi Equipo — datos en vivo (pasos para Fran)

## Por qué hace falta esto

La app leía los partidos de **openfootball**, la única fuente sin clave y con
CORS. Medido el 15/09/2026 contra el archivo vivo:

- último resultado publicado: **7 de septiembre** (8 días de retraso)
- **14 partidos ya jugados sin marcador**, la **jornada 5 entera**
- no publica **Champions** ni **Copa del Rey**
- no trae **ningún** dato de jugadores

Es decir: la clasificación se quedaba una jornada por detrás y media app pedida
no tenía de dónde salir. La fuente no da más.

## La solución: una Edge Function

Un navegador no puede guardar una clave (queda a la vista en el código) ni
saltarse CORS. **Un servidor sí.** La app ya tiene tres Edge Functions
(`send-push`, `misi-chat`, `get-shared-view`), así que el camino ya existe.

```
navegador  →  Edge Function `football`  →  football-data.org
(sin clave)   (guarda la clave)            (datos en vivo)
```

Con esto se desbloquea, **todo con la misma clave**:

| | |
|---|---|
| Clasificación al minuto | ✅ |
| Champions (fase liga y eliminatorias) | ✅ |
| Copa del Rey y Supercopa | ✅ |
| Todos los partidos del equipo, de todas sus competiciones | ✅ |
| Goleadores con **goles y asistencias** | ✅ |
| Tarjetas por jugador | ❌ no está en el plan gratuito |
| **Valoración media** de jugador | ❌ dato propietario de SofaScore/WhoScored, sin API abierta |

> **Ojo con Gemini**: una clave de un LLM no sirve para esto. Un modelo de
> lenguaje no consulta marcadores en vivo — se los inventaría. La clave que
> hace falta es de una **API de datos deportivos**, y ya tienes una.

## Qué significa "desplegar la función"

El código del servidor (`supabase/functions/football/index.ts`) está en este
repositorio, pero estar en el repositorio **no lo pone a funcionar**: hay que
subirlo a Supabase, que es quien lo ejecuta cuando la app lo llama. A eso se le
llama *desplegar*. Es el equivalente a "publicar": el archivo pasa de estar
escrito a estar encendido.

Se puede hacer de dos maneras. **La primera no necesita terminal ni instalar
nada** — todo desde el navegador, vale incluso desde el móvil.

---

## Camino A — desde GitHub, sin terminal (recomendado)

Son tres pantallas. La primera y la segunda solo se hacen **una vez en la vida**;
a partir de ahí desplegar es pulsar un botón.

### A1. Sacar tu token de Supabase (una vez)

1. Entra en <https://supabase.com/dashboard/account/tokens>
2. Botón **"Generate new token"**.
3. Ponle un nombre cualquiera, por ejemplo `github-deploy`.
4. Te enseña una cadena larga que empieza por `sbp_`. **Cópiala ahora** — solo
   se muestra una vez. Si la pierdes, generas otra y ya está.

### A2. Pegarla en GitHub (una vez)

1. Abre el repositorio en GitHub.
2. Pestaña **Settings** (la de arriba del todo, del repositorio — no la de tu
   perfil).
3. Menú de la izquierda: **Secrets and variables → Actions**.
4. Botón verde **"New repository secret"**.
5. Rellena y guarda:
   - **Name:** `SUPABASE_ACCESS_TOKEN`
   - **Secret:** la cadena `sbp_...` del paso anterior
6. Repite **"New repository secret"** una segunda vez, para la clave del fútbol:
   - **Name:** `FOOTBALL_DATA_KEY`
   - **Secret:** tu clave de football-data.org (ver más abajo, "Tu clave")

   > Si prefieres no meter la clave del fútbol en GitHub, sáltate este segundo
   > secreto y ponla a mano en Supabase (Camino B, paso B2). Con cualquiera de
   > los dos basta.

Lo que pegas aquí queda cifrado: GitHub ya no vuelve a enseñártelo, ni a ti ni a
nadie, y no aparece en los registros de ejecución.

### A3. Pulsar el botón (esto es lo único que repetirás)

1. En el repositorio, pestaña **Actions**.
2. En la lista de la izquierda, **"Desplegar Edge Function"**.
3. A la derecha, botón **"Run workflow"** → deja `football` seleccionado → otra
   vez **"Run workflow"**.
4. Espera ~1 minuto. Cuando salga el ✅ verde, está desplegada.

Si pinchas en la ejecución, el último paso te dice en castellano cómo quedó:

- `✅ Desplegada y con clave — datos en vivo.` → hecho.
- `⚠ Desplegada pero SIN la clave` → falta el secreto `FOOTBALL_DATA_KEY`:
  añádelo (A2, punto 6) y vuelve a pulsar Run workflow.

> El botón **"Run workflow"** solo aparece cuando este archivo está en la rama
> `main`. Si no lo ves, es que el cambio aún no está mergeado — lo mismo que
> pasa con el keep-alive.

A partir de ahora, además, cada vez que se cambie el código de la función y
llegue a `main`, se despliega sola. No tendrás que volver a Actions.

---

## Camino B — a mano (si prefieres verlo tú)

### B1. Tu clave

Es la misma que usas en el widget de Scriptable, la línea `FD_KEY_INLINE`.

> Esa clave viene escrita en el archivo `.js` que me pasaste. Si ese archivo
> circula (lo compartes, lo subes a algún sitio), **rótala** en
> football-data.org y usa la nueva aquí.

Si prefieres una nueva: <https://www.football-data.org/client/register> (gratis,
10 peticiones/minuto — de sobra, la función cachea).

### B2. Guardarla como secreto de Supabase

En la consola de Supabase → **Edge Functions → Secrets** (o
*Project Settings → Edge Functions*), añade:

```
FOOTBALL_DATA_KEY = <tu clave>
```

Esto se puede hacer desde el navegador, sin terminal, y es la alternativa al
punto 6 del paso A2.

### B3. Desplegar la función (esto sí necesita terminal)

La terminal es la ventana de texto donde se escriben comandos: en Mac se llama
**Terminal** (Aplicaciones → Utilidades), en Windows **PowerShell**.

```bash
# 1. Instalar la herramienta de Supabase (una vez)
brew install supabase/tap/supabase       # Mac
# o:  npm install -g supabase            # cualquier sistema con Node

# 2. Identificarte (abre el navegador y te pide confirmar)
supabase login

# 3. Situarte en la carpeta del proyecto descargado
cd ruta/a/misiones-pareja

# 4. Subir la función
supabase functions deploy football --project-ref txnsotchljquilfmdpdy
```

Ese último comando es exactamente el que te di sin explicar: coge la carpeta
`supabase/functions/football/`, la empaqueta y la sube a tu proyecto de Supabase
para que quede encendida. Nada más.

### B4. Comprobar que vive

Abre en el navegador, cambiando `<proyecto>` por tu referencia de Supabase:

```
https://<proyecto>.supabase.co/functions/v1/football?probe=1
```

Debe responder:

```json
{ "ok": true, "fn": "football", "hasKey": true, "competitions": ["es.1","en.1","cl"] }
```

Si `hasKey` sale `false`, el secreto no llegó: repite el paso 2 y vuelve a
desplegar.

---

## Cómo saber que funcionó (cualquiera de los dos caminos)

En la app: **☰ → Nosotros → Mi Equipo**. Arriba, junto al escudo, verás la
etiqueta de procedencia:

- **● en vivo** → está usando la función. Todo desbloqueado.
- **⚠ respaldo** → sigue con openfootball. Algo falló en los pasos de arriba.

## Si falla

La app **nunca se queda en blanco**: si la función no responde, vuelve sola a
openfootball y lo dice con la etiqueta naranja, en vez de enseñarte datos viejos
como si fueran de hoy.

## Qué sigue pendiente

- **Probabilidades** (ganar la liga, pasar de fase): ✅ hecho en v5.33.0 — el
  motor Monte Carlo de tu widget, portado a `src/lib/montecarlo.js`. Vive en la
  pestaña **Pronóstico**. Funciona mucho mejor con la función desplegada,
  porque se alimenta del calendario y la clasificación al día.
- **Tarjetas y valoración media**: no existen en ninguna fuente abierta. Harían
  falta datos de pago (SofaScore, Opta) y eso es otra conversación.
