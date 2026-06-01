/**
 * Tests de integración del núcleo de guardado v4.2.0
 *
 * Simulan los escenarios reales de uso con dos usuarios concurrentes
 * (Ana y Bob) sin depender del cliente Supabase ni del DOM de React.
 */
import { describe, it, expect } from "vitest";
import { rebaseMutators } from "../lib/save.js";
import { isValidAppData } from "../lib/validation.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

const ok = d => !!d && typeof d === "object" && !!d.weeks && !!d.settings;

function blankData(overrides = {}) {
  return {
    weeks: { "2026-W22": { weekNumber: 22, year: 2026, label: "", missions: [] } },
    settings: { person1: "Ana", person2: "Bob" },
    goals: [],
    ...overrides,
  };
}

function addMission(id, title, who = "p1") {
  return d => ({
    ...d,
    weeks: {
      ...d.weeks,
      "2026-W22": {
        ...d.weeks["2026-W22"],
        missions: [...d.weeks["2026-W22"].missions, { id, title, who, status: "TBC" }],
      },
    },
  });
}

function setStatus(id, status) {
  return d => ({
    ...d,
    weeks: {
      ...d.weeks,
      "2026-W22": {
        ...d.weeks["2026-W22"],
        missions: d.weeks["2026-W22"].missions.map(m =>
          m.id === id ? { ...m, status } : m
        ),
      },
    },
  });
}

// ─── ESCENARIO 1: bug histórico de pérdida de datos ─────────────────────────

describe("Escenario 1 — el bug histórico: Ana edita después de que Bob guarda", () => {
  /**
   * Antes de v4.2.0:
   *   1. Ana y Bob cargan versión 10.
   *   2. Bob guarda → DB pasa a v11. Realtime manda datos a Ana.
   *   3. Ana editaba algo → su dataVersionRef seguía en v10.
   *   4. save_app_data_cas(v10) → conflicto (DB está en v11).
   *   5. App DESCARTABA el cambio de Ana y cargaba v11 de Bob.
   *
   * Con v4.2.0 (rebase-on-conflict):
   *   5. App recarga v11 (Bob) y RE-APLICA el cambio de Ana encima.
   *   6. Ambos cambios sobreviven.
   */
  it("el cambio de Ana sobrevive aunque Bob guardó primero", () => {
    // Estado inicial compartido (ambos en v10)
    const initial = blankData();

    // Bob agrega una misión y "guarda" (simula: esto ya está en la DB como v11)
    const addBob = addMission("bob-m1", "Misión de Bob", "p2");
    const afterBob = addBob(initial); // ← esto es lo que hay en DB v11

    // Ana agrega su propia misión (mutador local no confirmado)
    const addAna = addMission("ana-m1", "Misión de Ana", "p1");

    // En la DB hay v11 (de Bob). Ana intenta guardar v10 → conflicto.
    // rebaseMutators simula el comportamiento de runSave ante conflicto:
    const merged = rebaseMutators(afterBob, [addAna], ok);

    const ids = merged.weeks["2026-W22"].missions.map(m => m.id).sort();
    expect(ids).toEqual(["ana-m1", "bob-m1"]);  // ambas sobreviven
  });

  it("la versión rebasada es válida según isValidAppData", () => {
    const initial = blankData();
    const addBob  = addMission("bob-m1", "Bob", "p2");
    const addAna  = addMission("ana-m1", "Ana", "p1");
    const fresh   = addBob(initial);
    const merged  = rebaseMutators(fresh, [addAna], ok);
    expect(isValidAppData(merged)).toBe(true);
  });
});

// ─── ESCENARIO 2: múltiples ediciones de Ana en vuelo ───────────────────────

describe("Escenario 2 — varias ediciones de Ana sin confirmar", () => {
  it("todos los cambios pendientes se aplican en orden sobre el estado fresco", () => {
    const initial = blankData({
      weeks: {
        "2026-W22": {
          weekNumber: 22, year: 2026, label: "",
          missions: [
            { id: "m1", title: "Limpiar la casa", who: "p1", status: "TBC" },
          ],
        },
      },
    });

    // Bob completa una misión distinta y guarda → v11
    const fresh = {
      ...initial,
      weeks: {
        "2026-W22": {
          ...initial.weeks["2026-W22"],
          missions: [
            { id: "m1", title: "Limpiar la casa", who: "p1", status: "TBC" },
            { id: "m2", title: "Compras (Bob)", who: "p2", status: "DONE" },
          ],
        },
      },
    };

    // Ana hizo 3 cosas que aún no se confirmaron:
    const ana1 = setStatus("m1", "IN_PROGRESS");
    const ana2 = addMission("m3", "Plan de cita", "p1");
    const ana3 = setStatus("m1", "DONE");

    const merged = rebaseMutators(fresh, [ana1, ana2, ana3], ok);
    const m1 = merged.weeks["2026-W22"].missions.find(m => m.id === "m1");
    const m2 = merged.weeks["2026-W22"].missions.find(m => m.id === "m2");
    const m3 = merged.weeks["2026-W22"].missions.find(m => m.id === "m3");

    expect(m1.status).toBe("DONE");       // ✓ progresión de Ana conservada
    expect(m2.status).toBe("DONE");       // ✓ cambio de Bob conservado
    expect(m3).toBeDefined();             // ✓ nueva misión de Ana también
    expect(merged.weeks["2026-W22"].missions).toHaveLength(3);
  });
});

// ─── ESCENARIO 3: mutador inválido / misión borrada por el partner ────────────

describe("Escenario 3 — mutador que ya no aplica (misión borrada por la pareja)", () => {
  it("ignora el mutador sin romper el resto del rebase", () => {
    // Bob borró m1 mientras Ana editaba — fresh no tiene m1
    const fresh = blankData({
      weeks: {
        "2026-W22": {
          weekNumber: 22, year: 2026, label: "",
          missions: [{ id: "m2", title: "Misión de Bob", who: "p2", status: "TBC" }],
        },
      },
    });

    // Ana tenía pendiente completar m1 (que Bob borró) + agregar m3
    const completeM1 = d => ({
      ...d,
      weeks: {
        ...d.weeks,
        "2026-W22": {
          ...d.weeks["2026-W22"],
          // m1 no existe en fresh → .map no hace nada (puro, no lanza)
          missions: d.weeks["2026-W22"].missions.map(m =>
            m.id === "m1" ? { ...m, status: "DONE" } : m
          ),
        },
      },
    });
    const addM3 = addMission("m3", "Nueva de Ana", "p1");

    const merged = rebaseMutators(fresh, [completeM1, addM3], ok);
    const ids = merged.weeks["2026-W22"].missions.map(m => m.id).sort();

    expect(ids).toContain("m2");   // misión de Bob intacta
    expect(ids).toContain("m3");   // nueva misión de Ana sobrevive
    expect(ids).not.toContain("m1"); // la borrada no reaparece
  });
});

// ─── ESCENARIO 4: datos corruptos nunca llegan a guardarse ───────────────────

describe("Escenario 4 — corrupción silenciosa bloqueada por isValidAppData", () => {
  it("si el rebase produce estructura inválida, devuelve el estado fresco intacto", () => {
    const fresh = blankData();
    const corrupt = () => ({ weeks: null, settings: null }); // rompe invariante
    const merged = rebaseMutators(fresh, [corrupt], ok);
    expect(merged).toBe(fresh);      // referencia exacta — nada se modificó
    expect(ok(merged)).toBe(true);
  });

  it("un mutador que lanza excepción se ignora y los siguientes siguen aplicando", () => {
    const fresh = blankData();
    const throws = () => { throw new Error("fallo inesperado"); };
    const addM  = addMission("mx", "Sobrevivo", "p1");
    const merged = rebaseMutators(fresh, [throws, addM], ok);
    expect(merged.weeks["2026-W22"].missions).toHaveLength(1);
    expect(merged.weeks["2026-W22"].missions[0].id).toBe("mx");
  });
});

// ─── ESCENARIO 5: conflictos repetidos (loop de 6 intentos) ─────────────────

describe("Escenario 5 — rebase genera resultado guardable en el segundo intento", () => {
  it("después del rebase la versión es correcta y el siguiente CAS tiene éxito", () => {
    /**
     * Simula el loop de reintentos de runSave:
     *  intento 0: conflicto → rebase sobre fresh v11
     *  intento 1: éxito con la versión rebased
     */
    const initial = blankData();
    let dbVersion = 11;
    let dbData    = { ...initial, weeks: { "2026-W22": { ...initial.weeks["2026-W22"],
      missions: [{ id: "bob-m", title: "Bob guardó primero", who: "p2", status: "TBC" }]
    }}};

    const addAna = addMission("ana-m", "Ana editó", "p1");

    // Intento 0: conflicto simulado (cliente tenía v10)
    // → rebase sobre fresh (v11, datos de Bob)
    const rebased = rebaseMutators(dbData, [addAna], ok);

    // Intento 1: guardar con v11 → éxito simulado (v12)
    const mockCAS = (data, version) => {
      if (version === dbVersion) {
        dbVersion += 1;
        dbData = data;
        return { success: true, newVersion: dbVersion };
      }
      return { success: false, conflict: true };
    };

    const result = mockCAS(rebased, 11);
    expect(result.success).toBe(true);
    expect(result.newVersion).toBe(12);

    // Verificar que el estado final contiene ambas misiones
    const ids = dbData.weeks["2026-W22"].missions.map(m => m.id).sort();
    expect(ids).toEqual(["ana-m", "bob-m"]);
  });
});

// ─── ESCENARIO 6: guard isValidAppData dentro del reducer update(fn) ─────────

describe("Escenario 6 — guard de validación en update(fn)", () => {
  it("isValidAppData rechaza datos sin weeks", () => {
    expect(isValidAppData(null)).toBe(false);
    expect(isValidAppData({ weeks: null, settings: {} })).toBe(false);
    expect(isValidAppData({ weeks: [], settings: {} })).toBe(false); // array no válido
  });

  it("isValidAppData acepta estructura mínima correcta", () => {
    expect(isValidAppData({ weeks: {}, settings: {}, goals: [] })).toBe(true);
  });

  it("isValidAppData rechaza goals como no-array", () => {
    expect(isValidAppData({ weeks: {}, settings: {}, goals: "no" })).toBe(false);
  });

  it("isValidAppData rechaza semana con missions no-array", () => {
    expect(isValidAppData({
      weeks: { "2026-W22": { missions: "bad" } },
      settings: {}
    })).toBe(false);
  });
});
