# Sprites de las mascotas — dónde dejarlos

> **Fran: deja aquí los archivos tal como los tengas** (una hoja de sprites
> grande, PNGs sueltos, lo que sea). No hace falta que los ordenes ni los
> recortes: eso lo hace el agente diseñador. Solo súbelos y dime.

## Cómo subirlos sin terminal

1. Abre el repositorio en GitHub.
2. Entra en la carpeta `public/mascotas/`.
3. Botón **Add file → Upload files**.
4. Arrastra los archivos.
5. Abajo, **Commit changes**.

Si son muchos, puedes arrastrar la carpeta entera.

## Dónde acabarán (esto lo hago yo, no tú)

```
public/mascotas/
├── mascota-a/
│   ├── huevo.png          ← con el que empieza todo
│   ├── bebe.png
│   ├── joven.png
│   ├── adulto.png
│   └── final.png
├── mascota-b/
│   └── (las mismas etapas)
└── comun/
    └── (estados: feliz, cansado, entrenando, durmiendo…)
```

Reglas de formato que voy a aplicar al recortarlos:

- **PNG con fondo transparente**, cuadrado (el mismo lienzo en todas las
  etapas, para que la mascota no "salte" de tamaño al evolucionar).
- **256×256** para la vista grande; se escala hacia abajo sola.
- Un archivo por etapa/estado, nombre en minúsculas y sin acentos.
- Peso objetivo: **< 40 KB** por sprite. Van dentro del paquete de la app y
  cuentan en el arranque.

## Por qué en `public/` y no en Storage

Son pocos, no cambian nunca y tienen que verse **sin conexión** (la mascota es
lo primero que se mira al abrir). Un archivo en `public/` lo cachea el service
worker y está disponible offline; uno en Storage necesitaría red.
