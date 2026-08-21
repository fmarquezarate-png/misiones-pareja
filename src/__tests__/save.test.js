import { describe, it, expect } from "vitest";
import { rebaseMutators, decideSaveStep } from "../lib/save.js";

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

  it("onDrop se llama cuando un mutador lanza (telemetría, no silencioso)", () => {
    const reasons = [];
    const throws = () => { throw new Error("x"); };
    rebaseMutators({ weeks: {} }, [throws], ok, (r) => reasons.push(r));
    expect(reasons).toEqual(["mutator_threw"]);
  });

  it("onDrop se llama con 'invalid_result' si el rebase queda inválido", () => {
    const reasons = [];
    const badOk = () => false;
    rebaseMutators({ weeks: {} }, [(d) => d], badOk, (r) => reasons.push(r));
    expect(reasons).toContain("invalid_result");
  });

  it("onDrop es opcional — no rompe si no se pasa", () => {
    expect(() => rebaseMutators({ weeks: {} }, [() => { throw new Error("x"); }], ok)).not.toThrow();
  });
});

describe("decideSaveStep — decisión del bucle CAS", () => {
  it("success cuando el RPC devolvió fila (save entró)", () => {
    expect(decideSaveStep({ success: true, newVersion: 5 })).toBe("success");
  });
  it("rebase cuando hay conflicto de versión", () => {
    expect(decideSaveStep({ success: false, conflict: true })).toBe("rebase");
  });
  it("fallback ante error del RPC", () => {
    expect(decideSaveStep({ success: false, error: { code: "57014" } })).toBe("fallback");
  });
  it("fallback si CAS está deshabilitado", () => {
    expect(decideSaveStep({ success: false, casDisabled: true })).toBe("fallback");
  });
  it("fallback ante resultado nulo/indefinido (nunca lanza)", () => {
    expect(decideSaveStep(null)).toBe("fallback");
    expect(decideSaveStep(undefined)).toBe("fallback");
    expect(decideSaveStep({})).toBe("fallback");
  });
  it("success tiene prioridad sobre conflict si ambos estuvieran (defensivo)", () => {
    expect(decideSaveStep({ success: true, conflict: true })).toBe("success");
  });
});
