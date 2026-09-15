# Escudos de equipo

Deja aquí los PNG y la app los usa automáticamente. **No hay que tocar código
ni desplegar nada**: si el archivo existe se ve; si no, se dibuja el escudo
genérico con los colores del equipo.

## Formato

- **Nombre del archivo**: `{id}.png` — exactamente el `id` del equipo tal y como
  aparece en `src/lib/teams.js`. Por ejemplo `barcelona.png`, `real-madrid.png`,
  `man-united.png`.
- **Tamaño**: 128×128 px (basta; se pinta entre 11 y 40 px). 256×256 si quieres
  margen para pantallas retina.
- **Formato**: PNG con **fondo transparente**, el escudo centrado y sin márgenes
  grandes alrededor.
- **Peso**: idealmente por debajo de 20 KB cada uno.

## Ids disponibles

### LaLiga
alaves · athletic · atletico · barcelona · betis · celta · deportivo · elche ·
espanyol · getafe · levante · malaga · osasuna · racing · rayo · real-madrid ·
real-sociedad · sevilla · valencia · villarreal

### Premier League
arsenal · aston-villa · bournemouth · brentford · brighton · chelsea ·
coventry · crystal-palace · everton · forest · fulham · hull · ipswich ·
leeds · liverpool · man-city · man-united · newcastle · sunderland · tottenham

No hace falta subirlos todos ni de golpe: cada archivo que aparezca sustituye a
su escudo dibujado, uno a uno.
