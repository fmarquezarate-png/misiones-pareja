import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FAUNA, permitido, elegirVisitante, proximaEspera, ESPERA_S } from "../lib/petAmbiente.js";
import { rngConSemilla } from "../lib/petBehavior.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "mascotas", "fauna");

describe("permitido", () => {
  const ok = { fase: "dia", clima: {}, visible: true, reducir: false };
  it("de día y con buen tiempo, sí", () => expect(permitido(ok)).toBe(true));
  it("nunca de noche, con mal tiempo, oculta o con reducir movimiento", () => {
    expect(permitido({ ...ok, fase: "noche" })).toBe(false);
    for (const c of [{ lluvia: 1 }, { nieve: 1 }, { tormenta: 1 }]) expect(permitido({ ...ok, clima: c })).toBe(false);
    expect(permitido({ ...ok, visible: false })).toBe(false);
    expect(permitido({ ...ok, reducir: true })).toBe(false);
  });
});

describe("dibujos", () => {
  it("cada visitante tiene su archivo y sus medidas cuadran con el registro", async () => {
    for (const lista of Object.values(FAUNA)) for (const f of lista) {
      expect(existsSync(join(raiz, `${f.id}.webp`)), f.id).toBe(true);
    }
  });
});

describe("elegirVisitante", () => {
  it("cada especie tiene los suyos y una desconocida no falla", () => {
    expect(elegirVisitante("broot", rngConSemilla(1), 260)?.id).toMatch(/mariposa|abeja|pajaro|petirrojo/);
    expect(elegirVisitante("nix", rngConSemilla(1), 260)?.id).toMatch(/^gaviota_/);
    expect(elegirVisitante("otra", rngConSemilla(1), 260)).toBeNull();
  });
  it("mira hacia donde va (reflejado solo si hace falta)", () => {
    const rng = rngConSemilla(5);
    for (let i = 0; i < 300; i++) {
      const v = elegirVisitante("broot", rng, 260);
      const f = FAUNA.broot.find(x => x.id === v.id);
      expect(v.volteado).toBe(v.dir !== f.mira);
    }
  });
  it("las aves vuelan alto y las mariposas sobre el prado; nada se sale del hábitat", () => {
    const rng = rngConSemilla(9);
    for (let i = 0; i < 400; i++) {
      const v = elegirVisitante("broot", rng, 260);
      const f = FAUNA.broot.find(x => x.id === v.id);
      expect(v.y).toBeGreaterThanOrEqual(Math.round(f.y[0] * 260));
      expect(v.y).toBeLessThanOrEqual(Math.round(f.y[1] * 260));
      expect(v.dur).toBeGreaterThanOrEqual(f.dur[0]);
      expect(v.dur).toBeLessThanOrEqual(f.dur[1]);
    }
  });
  it("no repite enseguida al mismo", () => {
    const rng = rngConSemilla(2);
    for (let i = 0; i < 200; i++) {
      const rec = ["mariposa_azul", "abeja"];
      expect(rec).not.toContain(elegirVisitante("broot", rng, 260, rec).id);
    }
  });
  it("la espera entre visitantes es larga", () => {
    const rng = rngConSemilla(3);
    for (let i = 0; i < 100; i++) { const e = proximaEspera(rng); expect(e).toBeGreaterThanOrEqual(ESPERA_S[0]); expect(e).toBeLessThanOrEqual(ESPERA_S[1]); }
  });
});
