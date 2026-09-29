import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { elegirAnimacion, retrato, PREFERENCIAS } from "../lib/petSprites.js";
import { ETAPAS } from "../lib/pet.js";

// Se prueba contra el manifest REAL: si alguien regenera los sprites y falta
// una animación, esto lo dice antes de que la mascota salga en blanco.
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "mascotas");
const manifest = JSON.parse(readFileSync(join(raiz, "manifest.json"), "utf8"));
const ANIMOS = Object.keys(PREFERENCIAS);   // los ánimos que sabe pintar el catálogo de sprites
const ESPECIES = Object.keys(manifest.pets);

describe("manifest real", () => {
  it("tiene las dos mascotas", () => {
    expect(ESPECIES.sort()).toEqual(["broot", "nix"]);
  });
  it("cada especie tiene las cinco etapas del motor", () => {
    for (const e of ESPECIES) {
      expect(Object.keys(manifest.pets[e].stages).sort()).toEqual(ETAPAS.map(x => x.id).sort());
    }
  });
  it("cada archivo referenciado existe", () => {
    for (const e of ESPECIES) for (const [, st] of Object.entries(manifest.pets[e].stages)) {
      expect(existsSync(join(raiz, st.portrait)), st.portrait).toBe(true);
      for (const a of Object.values(st.anims)) expect(existsSync(join(raiz, a.src)), a.src).toBe(true);
    }
  });
});

describe("elegirAnimacion", () => {
  // La garantía importante: para CUALQUIER combinación hay algo que pintar.
  it("toda especie × etapa × ánimo da una animación que existe", () => {
    for (const e of ESPECIES) for (const et of ETAPAS) for (const an of ANIMOS) {
      const a = elegirAnimacion(manifest, e, et.id, an);
      expect(a, `${e}/${et.id}/${an}`).not.toBeNull();
      expect(a.frames).toBeGreaterThan(0);
      expect(existsSync(join(raiz, a.src))).toBe(true);
    }
  });

  it("usa la animación exacta cuando existe", () => {
    expect(elegirAnimacion(manifest, "nix", "jr", "cansado").id).toBe("cansado");
    expect(elegirAnimacion(manifest, "broot", "pro", "durmiendo").id).toBe("dormir");
    expect(elegirAnimacion(manifest, "nix", "prime", "entrenando").id).toBe("entrenar");
  });

  // Broot Pro no tiene "cansado": cae a dormir, que es lo más parecido.
  it("si falta, cae a la más parecida", () => {
    expect(elegirAnimacion(manifest, "broot", "pro", "cansado").id).toBe("dormir");
    expect(elegirAnimacion(manifest, "broot", "jr", "celebrando").id).toBe("feliz");
  });

  it("el huevo siempre está en idle, sea cual sea el ánimo", () => {
    for (const e of ESPECIES) for (const an of ANIMOS) {
      expect(elegirAnimacion(manifest, e, "huevo", an).id).toBe("idle");
    }
  });

  it("sin manifest o con datos raros no revienta", () => {
    expect(elegirAnimacion(null, "nix", "jr", "feliz")).toBeNull();
    expect(elegirAnimacion(manifest, "dragon", "jr", "feliz")).toBeNull();
    expect(elegirAnimacion(manifest, "nix", "jr", "animo_inventado").id).toBe("feliz");
  });

  it("cada ánimo del motor tiene su cadena de alternativas", () => {
    for (const an of ANIMOS) expect(PREFERENCIAS[an], an).toBeTruthy();
  });
});

describe("retrato", () => {
  it("existe para cada especie y etapa", () => {
    for (const e of ESPECIES) for (const et of ETAPAS) expect(retrato(manifest, e, et.id)).toBeTruthy();
  });
});
