// Contraste WCAG (v5.28.0). Puro, sin dependencias.
//
// Existe porque en v5.27.0 se descubrió que el texto secundario de los temas
// oscuros llevaba desde siempre un contraste de 2.0:1 — por debajo del mínimo
// de WCAG incluso para texto grande — y nadie lo había medido nunca. La regla
// del proyecto es ahora "el contraste es un número, no una opinión", así que la
// fórmula vive en el código y hay una prueba que recorre TODAS las
// combinaciones de tema × superficie × color de texto.

// Umbrales WCAG 2.1 nivel AA.
export const AA_NORMAL = 4.5;   // texto normal
export const AA_LARGE = 3.0;    // >=18.66px o >=14px en negrita; también iconos/bordes

// "#abc" | "#aabbcc" | "rgba(r,g,b,a)" | "rgb(r,g,b)" → [r,g,b,a] con a en 0..1.
export function parseColor(c) {
  const s = String(c || "").trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = [...h].map(x => x + x).join("");
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [r, g, b, a];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(s);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3], rgb[4] === undefined ? 1 : +rgb[4]];
  return null;
}

// Compone `fg` (posiblemente translúcido) sobre `bg` opaco → color resultante.
// Necesario porque varias tarjetas son `rgba(255,255,255,0.85)`: su contraste
// real depende del fondo del tema, no del blanco puro.
export function flatten(fg, bg) {
  const f = parseColor(fg), b = parseColor(bg);
  if (!f || !b) return null;
  const a = f[3];
  return [0, 1, 2].map(i => Math.round(f[i] * a + b[i] * (1 - a)));
}

export function relativeLuminance(color, over = "#000000") {
  const rgb = flatten(color, over);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(v => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Razón de contraste entre un color de texto y una superficie. `base` es el
// fondo opaco sobre el que se apoya la superficie (para superficies con alpha).
// ── Ajuste de tinta ─────────────────────────────────────────────────────────
// Los colores de estado/categoría/persona son FIJOS: los mismos verdes y
// amarillos se pintan sobre fondos muy distintos. Nacieron para fondo oscuro y
// sobre los temas claros dan 1.6–2.8:1 (el amarillo de "Trabajo" sobre blanco
// es 1.64 — invisible). Esto los oscurece (o aclara) por LUMINOSIDAD hasta que
// cumplen, manteniendo tono y saturación: sigue siendo "el verde de Hecho",
// solo que legible.

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0))
          : max === g ? (b - r) / d + 2
          : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h, s, l) {
  const f = n => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * v).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Devuelve `color` si ya cumple `min` sobre `surface`; si no, el mismo tono con
// la luminosidad ajustada hasta cumplir. Si es imposible, el extremo alcanzado.
export function readableOn(color, surface, min = AA_LARGE, base = "#000000") {
  const start = contrastRatio(color, surface, base);
  if (start === null || start >= min) return color;
  const rgb = parseColor(color);
  if (!rgb) return color;
  const [h, s, l0] = rgbToHsl(rgb);
  // Hacia dónde hay recorrido: si la superficie es clara, oscurecer; si es
  // oscura, aclarar.
  const surfSolid = flatten(surface, base);
  const dir = relativeLuminance(`rgb(${surfSolid.join(",")})`) > 0.18 ? -1 : 1;
  let best = color, bestRatio = start;
  for (let step = 1; step <= 100; step++) {
    const l = Math.min(1, Math.max(0, l0 + dir * step * 0.01));
    const cand = hslToHex(h, s, l);
    const r = contrastRatio(cand, surface, base);
    if (r > bestRatio) { best = cand; bestRatio = r; }
    if (r >= min) return cand;
    if (l === 0 || l === 1) break;
  }
  return best;
}

export function contrastRatio(fg, surface, base = "#000000") {
  const surfaceSolid = flatten(surface, base);
  if (!surfaceSolid) return null;
  const surfaceHex = `rgb(${surfaceSolid.join(",")})`;
  const l1 = relativeLuminance(fg, surfaceHex);
  const l2 = relativeLuminance(surfaceHex);
  if (l1 === null || l2 === null) return null;
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
