// Integridad de los sprites REALES (public/mascotas). Nació de la auditoría v6
// (29/09/2026): la cadena de recorte era frágil — regenerar borraba `escala` y
// `cuerpo`, ninguna prueba miraba las dimensiones y 21 fotogramas de Broot Jr
// llevaban líneas sueltas del recorte.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { spriteUrl, urlRetrato, FONDOS } from "../lib/petSprites.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "mascotas");
const manifest = JSON.parse(readFileSync(join(RAIZ, "manifest.json"), "utf8"));
const ETAPAS = ["huevo", "jr", "pro", "prime", "upf"];

// Dimensiones desde la cabecera WebP (VP8X: ancho-1 y alto-1 en 24 bits).
function dimensionesWebP(ruta) {
  const b = readFileSync(ruta);
  expect(b.subarray(0, 4).toString(), ruta).toBe("RIFF");
  expect(b.subarray(8, 12).toString(), ruta).toBe("WEBP");
  const tipo = b.subarray(12, 16).toString();
  if (tipo === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), alfa: !!(b[20] & 0x10) };
  if (tipo === "VP8L") { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff), alfa: true }; }
  return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, alfa: false };
}
const archivosWebP = dir => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? archivosWebP(p) : f.endsWith(".webp") ? [p] : [];
});

describe("manifest de mascotas", () => {
  it("cada mascota tiene las cinco etapas, con escala, cuerpo y hash", () => {
    for (const [pet, pd] of Object.entries(manifest.pets)) {
      expect(Object.keys(pd.stages), pet).toEqual(ETAPAS);
      for (const [st, sd] of Object.entries(pd.stages)) {
        const id = `${pet}/${st}`;
        expect(sd.escala, `${id} escala`).toBeGreaterThan(0.5);
        expect(sd.cuerpo, `${id} cuerpo`).toMatchObject({ x0: expect.any(Number), x1: expect.any(Number), y0: expect.any(Number), y1: expect.any(Number) });
        expect(sd.cuerpo.x1, `${id} caja`).toBeGreaterThan(sd.cuerpo.x0);
        expect(sd.portraitV, `${id} portraitV`).toMatch(/^[0-9a-f]{8}$/);
        for (const [an, a] of Object.entries(sd.anims)) expect(a.v, `${id}/${an} v`).toMatch(/^[0-9a-f]{8}$/);
      }
    }
  });

  // La razón de ser de la escala: evolucionar se ve MÁS GRANDE, nunca más pequeño
  // (Nix UPF medía 54 px de alto frente a los 73 de Jr antes de escalar).
  it("el cuerpo VISIBLE (medido × escala) crece en cada evolución", () => {
    for (const [pet, pd] of Object.entries(manifest.pets)) {
      const visible = ["jr", "pro", "prime", "upf"].map(e => pd.stages[e].cuerpoPx * pd.stages[e].escala);
      for (let i = 1; i < visible.length; i++) {
        expect(visible[i], `${pet}: ${["jr", "pro", "prime", "upf"][i]} debe verse más grande que la etapa anterior`).toBeGreaterThan(visible[i - 1]);
      }
    }
  });
});

describe("archivos WebP reales", () => {
  const referenciados = new Set();
  for (const [pet, pd] of Object.entries(manifest.pets)) {
    for (const [st, sd] of Object.entries(pd.stages)) {
      for (const [an, a] of Object.entries(sd.anims)) {
        referenciados.add(a.src);
        it(`${pet}/${st}/${an}: mide ${a.frames} × 128 de ancho y 128 de alto, con transparencia`, () => {
          const d = dimensionesWebP(join(RAIZ, a.src));
          expect(d.w).toBe(a.frames * 128);
          expect(d.h).toBe(128);
          expect(d.alfa).toBe(true);
        });
      }
      referenciados.add(sd.portrait);
      it(`${pet}/${st}/retrato: 128 × 128`, () => {
        const d = dimensionesWebP(join(RAIZ, sd.portrait));
        expect([d.w, d.h]).toEqual([128, 128]);
      });
    }
  }
  it("no hay archivos en disco que el manifest no conozca", () => {
    // fondos/ y fauna/ no son sprites del manifest: los comprueban FONDOS y petAmbiente.
    const enDisco = archivosWebP(RAIZ).map(p => relative(RAIZ, p).split("\\").join("/")).filter(f => !/^(fondos|fauna|clima)\//.test(f));
    expect(enDisco.filter(f => !referenciados.has(f))).toEqual([]);
  });
  it("ningún archivo de documentación se publica dentro de public/mascotas", () => {
    expect(existsSync(join(RAIZ, "LEEME.md"))).toBe(false);
  });
  it("pesa lo que se prometió (menos de 3 MB en total)", () => {
    const total = archivosWebP(RAIZ).reduce((a, p) => a + statSync(p).size, 0);
    expect(total).toBeLessThan(3 * 1024 * 1024);
  });
});

describe("URLs versionadas", () => {
  it("llevan el hash de contenido", () => {
    expect(spriteUrl("nix/jr/feliz.webp", "abcd1234")).toBe("/mascotas/nix/jr/feliz.webp?v=abcd1234");
    expect(spriteUrl("nix/jr/feliz.webp")).toBe("/mascotas/nix/jr/feliz.webp");
    expect(spriteUrl(null, "x")).toBeNull();
  });
  it("el retrato usa portraitV", () => {
    const st = manifest.pets.nix.stages.jr;
    expect(urlRetrato(manifest, "nix", "jr")).toBe(`/mascotas/${st.portrait}?v=${st.portraitV}`);
    expect(urlRetrato(manifest, "dragon", "jr")).toBeNull();
  });
});

describe("bucles: solo se repite la parte que no cuenta una historia", () => {
  const anims = Object.entries(manifest.pets).flatMap(([p, pd]) => Object.entries(pd.stages).flatMap(([s, sd]) => Object.entries(sd.anims).map(([a, ad]) => [`${p}/${s}/${a}`, ad])));
  it("el rango cabe en la tira y deja al menos 5 fotogramas", () => {
    for (const [nombre, a] of anims) {
      if (!a.bucle) continue;
      expect(a.bucle[0], nombre).toBeGreaterThanOrEqual(0);
      expect(a.bucle[1], nombre).toBeLessThan(a.frames);
      expect(a.bucle[1] - a.bucle[0] + 1, nombre).toBeGreaterThanOrEqual(5);
    }
  });
  it("todo dormir que empieza despierto tiene su bucle", () => {
    for (const [nombre, a] of anims) if (/\/dormir$/.test(nombre) && a.frames >= 18) expect(a.bucle, nombre).toBeTruthy();
  });
});

describe("fondos del hábitat", () => {
  it("cada especie del manifest tiene su panorama y existe el archivo", () => {
    for (const e of Object.keys(manifest.pets)) {
      expect(FONDOS[e], e).toBeTruthy();
      expect(existsSync(join(RAIZ, FONDOS[e].src)), e).toBe(true);
      expect(FONDOS[e].horizonte).toBeGreaterThan(0.2);
      expect(FONDOS[e].horizonte).toBeLessThan(0.7);
      expect(FONDOS[e].fade[0]).toBeLessThan(FONDOS[e].fade[1]);
    }
  });
});
