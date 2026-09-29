import { spriteUrl } from "../lib/petSprites.js";
// Un sprite animado de la mascota a partir de su tira (manifest.json).
//
// La tira es una imagen con todos los fotogramas en fila. Se enseña a través
// de una ventana del tamaño de UN fotograma y la imagen se desplaza con
// `transform: translateX` en saltos exactos. Por qué así y no con
// `background-position`: la regla del proyecto (CLAUDE.md §5, celebraciones)
// es animar solo transform/opacity, que componen en la GPU sin repintar.
//
// `steps(n, jump-none)` va del primer fotograma al último en n saltos, cada
// uno el mismo tiempo — y al terminar una animación de una sola vez se queda
// en el último fotograma, no en un hueco vacío.

// `frame`: si se pasa, se enseña ESE fotograma quieto (la pausa: de pie,
// mirando hacia donde iba, con el primer fotograma de caminar).
export default function PetSprite({ anim, size = 112, onFin, style, frame = null }) {
  if (!anim) return null;
  const n = Math.max(1, anim.frames);
  const dur = n / Math.max(1, anim.fps || 8);
  const bucle = anim.loop !== false && !onFin;
  return (
    <div style={{ width: size, height: size, overflow: "hidden", position: "relative", ...style }}>
      <img
        // La `key` reinicia la animación al cambiar de tira.
        key={anim.src}
        src={spriteUrl(anim.src, anim.v)}
        alt=""
        draggable={false}
        onAnimationEnd={onFin}
        style={{
          display: "block", height: size, width: size * n, maxWidth: "none",
          "--mp-tx": `${-size * (n - 1)}px`,
          transform: frame != null ? `translateX(${-size * Math.min(frame, n - 1)}px)` : undefined,
          animation: frame == null && n > 1 ? `mpSprite ${dur}s steps(${n}, jump-none) ${bucle ? "infinite" : "1 forwards"}` : undefined,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
