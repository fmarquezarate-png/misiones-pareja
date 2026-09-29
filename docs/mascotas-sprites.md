# Sprites de las mascotas — cómo se generan y qué comprueba el proyecto

> Antes este archivo vivía en `public/mascotas/LEEME.md` y explicaba cómo subir los
> PNG a mano. Estaba obsoleto y **se publicaba en producción**. Ahora la cadena es
> automática y esto es solo documentación.

## La cadena

```
Broot.zip / Nix.zip (hojas de presentación de 1536×1024, sin transparencia real)
   │  python3 scripts/sprites/slice.py --src <carpeta con Broot/ y Nix/>   (~2 min)
   ▼
public/mascotas/<mascota>/<etapa>/<animación>.webp   tiras horizontales, 128×128 por fotograma
   │  scripts/sprites/limpiar.py   quita líneas sueltas del recorte (bordes de celda)
   │  scripts/sprites/escala.py    escala, caja del cuerpo y hash de contenido
   ▼
public/mascotas/manifest.json
```

`slice.py` ejecuta los dos pasos finales solo. Antes se hacían a mano y regenerar los
sprites **perdía `escala` y `cuerpo`** en silencio.

## Qué lleva el manifest de cada etapa

| Campo | Para qué |
|---|---|
| `anims.<id>.src/frames/fps/loop` | reproducir la tira |
| `anims.<id>.v` y `portraitV` | hash de contenido: va en la URL (`?v=`) para que el service worker (CacheFirst, un año) sirva un sprite regenerado |
| `escala` | tamaño en pantalla: cada etapa crece respecto a la anterior (Jr 1,0 → UPF 1,45) |
| `cuerpo` | caja real del cuerpo (0..1 del lienzo): línea de flotación de Nix y límites del paseo |

## Qué falla si algo se rompe

`src/__tests__/mascotasAssets.test.js` lee las cabeceras WebP reales y falla si una tira
no mide `fotogramas × 128 × 128`, si falta `escala`/`cuerpo`/hash, si hay archivos en disco
que el manifest no conoce, o si vuelve a aparecer una línea suelta en un fotograma.

## Formato para sprites nuevos

- Una animación por imagen, tira horizontal, fotogramas de 128 px pegados, fondo transparente.
- El suelo (pies) siempre a la misma altura en todos los fotogramas de una etapa.
- Sin texto, números de fotograma, paletas ni marcos.
- `dormir` debe ser un **bucle de dormido** (respirando), no «acostarse → dormir → despertarse».

## Limpieza, bucles, fondos y fauna (v6.1.0)

- **`limpiar.py`** (se ejecuta tras `slice.py`, antes de `escala.py`): quita rayas sueltas del recorte y **restos del fondo blanco** de las hojas (píxeles casi blancos y sin color conectados al exterior; sobre el agua se veían como una mancha blanca alrededor de Nix). Lo blanco encerrado por el cuerpo no se toca. Ejecutarlo UNA vez sobre la salida de `slice.py`: cada pasada recomprime el WebP.
- **Bucles** (`BUCLES` en `escala.py` → `bucle: [primero, último]` en el manifest): `dormir` cuenta una historia (despierta → se tumba → duerme → a veces despierta). `PetSprite` repite solo el tramo de sueño; la tira no se recorta.
- **Fondos** (`public/mascotas/fondos/{nix,broot}.webp`, registro `FONDOS` en `petSprites.js`): panorama por especie; el cielo dinámico (sol real, estrellas, tiempo) va detrás, fundido por el borde superior. Al cambiar un archivo, subir su `v`.
- **Fauna** (`public/mascotas/fauna/*.webp`, registro `FAUNA` en `petAmbiente.js`): mariposas, abeja y pájaros (Broot), gaviotas (Nix), recortados de las hojas de entorno. Cruzan de día y con buen tiempo, máximo dos a la vez.
- Las hojas originales de entorno (pájaros, peces, cangrejos, árboles, flores, lluvia…) traen más piezas sin usar: cangrejos y peces del mar, arbustos, setas y árboles del prado. Siguiente paso posible.

- **Clima** (`public/mascotas/clima/`, `petClima.js`): nubes de lluvia, ondas, charcos, burbujas y salpicaduras recortadas de las hojas de entorno. El cielo cubierto NUNCA oscurece toda la escena: filtro solo al panorama + velo solo en el cielo.
