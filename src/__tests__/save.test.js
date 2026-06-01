import { describe, it, expect } from "vitest";
import { rebaseMutators } from "../lib/save.js";

// Validador estructural mínimo equivalente al de la app (sin importar
// supabase.js, que instancia el cliente al cargar y no tiene env en tests).
const ok = (d) => !!d && typeof d === "object" && !!d.weeks;

describe("rebaseMutators — recuperación de conflicto CAS", () => {
  it("re-aplica el cambio local sobre los datos frescos de la pareja (no descarta)", () => {
    // Estado fresco: la pareja agregó la misión B mientras editábamos.
    const fresh = { weeks: { "2026-W01": { missions: [{ id: "B", title: "de la pareja" }] } } };
    // Nuestra intención sin confirmar: agregar la misión A.
    const addA = (d) => ({
      ...d,
      weeks: {
        ...d.weeks,
        "2026-W01": { ...d.weeks["2026-W01"], missions: [...d.weeks["2026-W01"].missions, { id: "A", title: "mía" }] },
      },
    });

    const merged = rebaseMutators(fresh, [addA], ok);
    const ids = merged.weeks["2026-W01"].missions.map((m) => m.id).sort();
    // Ambas sobreviven: la de la pareja Y la nuestra.
    expect(ids).toEqual(["A", "B"]);
  });

  it("aplica varios mutadores en orden sobre la base fresca", () => {
    const fresh = { weeks: { w: { missions: [] } } };
    const add = (id) => (d) => ({ ...d, weeks: { w: { missions: [...d.weeks.w.missions, { id }] } } });
    const merged = rebaseMutators(fresh, [add("x"), add("y")], ok);
    expect(merged.weeks.w.missions.map((m) => m.id)).toEqual(["x", "y"]);
  });

  it("si el rebase produce datos inválidos, devuelve la base fresca intacta", () => {
    const fresh = { weeks: { w: { missions: [{ id: "B" }] } } };
    const corrupt = () => ({ weeks: null }); // rompe la estructura
    const merged = rebaseMutators(fresh, [corrupt], ok);
    expect(merged).toBe(fresh);
  });

  it("ignora un mutador que lanza sobre datos frescos y conserva el resto", () => {
    const fresh = { weeks: { w: { missions: [] } } };
    const throws = () => { throw new Error("la misión ya no existe"); };
    const addZ = (d) => ({ ...d, weeks: { w: { missions: [...d.weeks.w.missions, { id: "Z" }] } } });
    const merged = rebaseMutators(fresh, [throws, addZ], ok);
    expect(merged.weeks.w.missions.map((m) => m.id)).toEqual(["Z"]);
  });
});
