import { describe, it, expect } from "vitest";
import { THEMES, STATUS, CATEGORIES, DEFAULT_COLORS } from "../constants.js";
import { contrastRatio, readableOn, parseColor, flatten, AA_NORMAL, AA_LARGE } from "../lib/contrast.js";

describe("utilidades de contraste", () => {
  it("lee hex de 3, 6 y 8 dígitos y rgb/rgba", () => {
    expect(parseColor("#fff")).toEqual([255, 255, 255, 1]);
    expect(parseColor("#130d2a")).toEqual([19, 13, 42, 1]);
    expect(parseColor("rgba(255,255,255,0.85)")).toEqual([255, 255, 255, 0.85]);
    expect(parseColor("rgb(1, 2, 3)")).toEqual([1, 2, 3, 1]);
    expect(parseColor("azul")).toBe(null);
  });

  it("compone una superficie translúcida sobre su fondo", () => {
    // Blanco al 85% sobre un fondo claro sigue siendo casi blanco…
    expect(flatten("rgba(255,255,255,0.85)", "#f5f0ea")).toEqual([254, 253, 252]);
    // …pero sobre uno oscuro, no. Por eso hay que componer antes de medir.
    expect(flatten("rgba(255,255,255,0.85)", "#000000")).toEqual([217, 217, 217]);
  });

  it("da los valores canónicos de WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });
});

// ── La auditoría: TODAS las combinaciones ────────────────────────────────────
// tema × superficie × color de texto. Si alguien añade un tema o cambia un
// token y deja texto ilegible, esta prueba lo dice con nombre y número.
const SURFACES = ["card", "bg", "menuBg", "topBarBg"];

const fails = (theme, surface, colorKey, min) => {
  const r = contrastRatio(theme[colorKey], theme[surface], theme.bg);
  return r === null || r < min ? `${theme.id}/${surface}/${colorKey} = ${r === null ? "?" : r.toFixed(2)} (min ${min})` : null;
};

describe("contraste de los temas", () => {
  it("hay temas que auditar y todos declaran sus colores", () => {
    expect(THEMES.length).toBeGreaterThan(10);
    for (const t of THEMES) {
      for (const k of ["bg", "card", "menuBg", "topBarBg", "text", "textMuted", "textDim", "accent"]) {
        expect(parseColor(t[k]), `${t.id}.${k} = ${t[k]}`).not.toBe(null);
      }
    }
  });

  it("el texto principal cumple AA en todas las superficies de todos los temas", () => {
    const bad = THEMES.flatMap(t => SURFACES.map(s => fails(t, s, "text", AA_NORMAL))).filter(Boolean);
    expect(bad).toEqual([]);
  });

  it("el texto secundario cumple AA en todas las superficies de todos los temas", () => {
    const bad = THEMES.flatMap(t => SURFACES.map(s => fails(t, s, "textMuted", AA_NORMAL))).filter(Boolean);
    expect(bad).toEqual([]);
  });

  it("el texto terciario cumple AA en todas las superficies de todos los temas", () => {
    // El que estaba en 2.0:1 hasta v5.27.0. Es texto normal: le toca 4.5.
    const bad = THEMES.flatMap(t => SURFACES.map(s => fails(t, s, "textDim", AA_NORMAL))).filter(Boolean);
    expect(bad).toEqual([]);
  });

  it("el color de acento es al menos legible como texto grande", () => {
    // El acento se usa en títulos, chips y etiquetas cortas (>=14px negrita).
    const bad = THEMES.flatMap(t => SURFACES.map(s => fails(t, s, "accent", AA_LARGE))).filter(Boolean);
    expect(bad).toEqual([]);
  });

  it("los tres niveles de texto se distinguen entre sí (jerarquía real)", () => {
    for (const t of THEMES) {
      const [r1, r2, r3] = ["text", "textMuted", "textDim"].map(k => contrastRatio(t[k], t.card, t.bg));
      expect(r1, `${t.id}: principal vs secundario`).toBeGreaterThan(r2 * 1.15);
      expect(r2, `${t.id}: secundario vs terciario`).toBeGreaterThan(r3 * 1.15);
    }
  });

  it("el color de error se ve en todos los temas", () => {
    const bad = THEMES.map(t => t.error ? fails(t, "card", "error", AA_LARGE) : null).filter(Boolean);
    expect(bad).toEqual([]);
  });
});

describe("colores fijos de la app sobre cada tema", () => {
  // Estos NO cambian con el tema: los mismos verdes/naranjas se pintan sobre
  // fondos muy distintos. Son texto pequeño (etiquetas de estado, chips).
  const fixed = [
    ...Object.entries(STATUS).map(([k, v]) => [`estado:${k}`, v.color]),
    ...CATEGORIES.map(c => [`categoría:${c.id}`, c.color]),
    ...Object.entries(DEFAULT_COLORS).map(([k, v]) => [`persona:${k}`, v]),
  ];

  it("EN CRUDO son ilegibles sobre los temas claros — por eso existe readableOn", () => {
    // Documenta el defecto: nacieron para fondo oscuro. Sobre las tarjetas casi
    // blancas de los temas claros el amarillo de "Trabajo" da 1.64:1.
    const crudos = [];
    for (const t of THEMES) {
      for (const [name, color] of fixed) {
        if (contrastRatio(color, t.card, t.bg) < AA_LARGE) crudos.push(`${t.id}·${name}`);
      }
    }
    expect(crudos.length).toBeGreaterThan(0);
    expect(crudos.every(x => !x.startsWith("violet·"))).toBe(true);   // los oscuros van bien
  });

  it("la TINTA que publica el tema (readableOn) sí cumple, en todos los temas", () => {
    const bad = [];
    for (const t of THEMES) {
      for (const [name, color] of fixed) {
        const ink = readableOn(color, t.card, AA_LARGE, t.bg);
        const r = contrastRatio(ink, t.card, t.bg);
        if (r < AA_LARGE) bad.push(`${t.id} · ${name} (${color} → ${ink}) = ${r.toFixed(2)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("readableOn — ajuste de tinta manteniendo el tono", () => {
  it("deja el color intacto si ya cumple", () => {
    expect(readableOn("#34d399", "#130d2a")).toBe("#34d399");
  });

  it("oscurece sobre superficie clara hasta cumplir", () => {
    const fixed = readableOn("#fbbf24", "#ffffff", AA_LARGE);   // amarillo: 1.64 sobre blanco
    expect(fixed).not.toBe("#fbbf24");
    expect(contrastRatio(fixed, "#ffffff")).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("aclara sobre superficie oscura hasta cumplir", () => {
    const fixed = readableOn("#1a3a1a", "#0a0714", AA_LARGE);
    expect(contrastRatio(fixed, "#0a0714")).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("mantiene el tono: el verde sigue siendo verde", () => {
    const fixed = readableOn("#34d399", "#ffffff", AA_NORMAL);
    const [r, g, b] = parseColor(fixed);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it("no revienta con entradas raras", () => {
    expect(readableOn("azul", "#fff")).toBe("azul");
    expect(readableOn(null, "#fff")).toBe(null);
  });
});
