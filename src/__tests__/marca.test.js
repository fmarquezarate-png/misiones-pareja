// Un solo nombre de app de cara al usuario (Fran eligió "Shared Calendar",
// 28/09/2026). Convivieron dos durante meses; este test impide que vuelva a
// colarse el otro en un texto visible.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { APP_NAME } from "../lib/marca.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const archivos = dir => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) return f === "__tests__" || f === "data" ? [] : archivos(p);
  return /\.(jsx?|ts)$/.test(f) ? [p] : [];
});

describe("nombre de la app", () => {
  it("es Shared Calendar", () => {
    expect(APP_NAME).toBe("Shared Calendar");
  });
  it("ningún texto de la app usa el nombre viejo", () => {
    const culpables = archivos(SRC)
      .filter(p => !p.endsWith("marca.js"))                   // su comentario lo explica
      .filter(p => /misiones de pareja/i.test(readFileSync(p, "utf8")));
    expect(culpables).toEqual([]);
  });
});
