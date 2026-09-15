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

## Pasos (5 minutos)

### 1. Tu clave

Es la misma que usas en el widget de Scriptable, la línea `FD_KEY_INLINE`.

> Esa clave viene escrita en el archivo `.js` que me pasaste. Si ese archivo
> circula (lo compartes, lo subes a algún sitio), **rótala** en
> football-data.org y usa la nueva aquí.

Si prefieres una nueva: <https://www.football-data.org/client/register> (gratis,
10 peticiones/minuto — de sobra, la función cachea).

### 2. Guardarla como secreto de Supabase

En la consola de Supabase → **Edge Functions → Secrets** (o
*Project Settings → Edge Functions*), añade:

```
FOOTBALL_DATA_KEY = <tu clave>
```

O por terminal:

```bash
supabase secrets set FOOTBALL_DATA_KEY=tu_clave_aqui
```

### 3. Desplegar la función

```bash
supabase functions deploy football
```

(La función ya está escrita en `supabase/functions/football/index.ts`.)

### 4. Comprobar que vive

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

### 5. Listo

En la app: **☰ → Nosotros → Mi Equipo**. Arriba, junto al escudo, verás la
etiqueta de procedencia:

- **● en vivo** → está usando la función. Todo desbloqueado.
- **⚠ respaldo** → sigue con openfootball. Algo falló en los pasos de arriba.

## Si falla

La app **nunca se queda en blanco**: si la función no responde, vuelve sola a
openfootball y lo dice con la etiqueta naranja, en vez de enseñarte datos viejos
como si fueran de hoy.

## Qué sigue pendiente

- **Probabilidades** (ganar la liga, pasar de fase): calculables con el
  calendario restante + la fuerza de cada equipo, que ya tendremos. Es el motor
  Monte Carlo de tu widget, portado. Pendiente de hacer.
- **Tarjetas y valoración media**: no existen en ninguna fuente abierta. Harían
  falta datos de pago (SofaScore, Opta) y eso es otra conversación.
