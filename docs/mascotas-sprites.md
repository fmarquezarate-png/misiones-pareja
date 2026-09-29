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
