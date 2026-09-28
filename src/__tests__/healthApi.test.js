import { describe, it, expect, vi } from "vitest";

// El cliente de Supabase no hace falta para las funciones puras.
vi.mock("../supabase.js", () => ({ default: {} }));

import { resumirPorPersona, formatoValor, NOMBRES_METRICA } from "../lib/healthApi.js";

const fila = (user_id, day, metric, value, updated_at = `${day}T10:00:00Z`) =>
  ({ user_id, day, metric, value, unit: null, source: "iPhone", updated_at });

describe("resumirPorPersona", () => {
  const filas = [
    fila("yo", "2026-09-26", "step_count", 7000),
    fila("yo", "2026-09-27", "step_count", 9000, "2026-09-28T09:00:00Z"),
    fila("yo", "2026-09-27", "sleep_asleep", 7.2),
    fila("ella", "2026-09-27", "step_count", 12000),
  ];

  it("separa a las dos personas", () => {
    const r = resumirPorPersona(filas);
    expect(r).toHaveLength(2);
    expect(r.find(p => p.userId === "ella").numDias).toBe(1);
  });

  it("cuenta días distintos, no filas", () => {
    const yo = resumirPorPersona(filas).find(p => p.userId === "yo");
    expect(yo.numDias).toBe(2);           // 3 filas, 2 días
    expect(yo.primerDia).toBe("2026-09-26");
    expect(yo.ultimoDia).toBe("2026-09-27");
  });

  it("el último envío es el más reciente", () => {
    const yo = resumirPorPersona(filas).find(p => p.userId === "yo");
    expect(yo.ultimoEnvio).toBe("2026-09-28T09:00:00Z");
  });

  it("de cada métrica guarda el valor del día más reciente", () => {
    const yo = resumirPorPersona(filas).find(p => p.userId === "yo");
    expect(yo.metricas.find(m => m.metric === "step_count")).toMatchObject({ day: "2026-09-27", value: 9000 });
  });

  it("los entrenos van con su persona", () => {
    const r = resumirPorPersona(filas, [{ user_id: "ella", start_at: "2026-09-27T08:00:00Z" }]);
    expect(r.find(p => p.userId === "ella").entrenos).toHaveLength(1);
    expect(r.find(p => p.userId === "yo").entrenos).toHaveLength(0);
  });

  it("sin datos, lista vacía", () => {
    expect(resumirPorPersona()).toEqual([]);
  });
});

describe("formatoValor", () => {
  it("el sueño en horas y minutos", () => {
    expect(formatoValor("sleep_asleep", 7.5)).toBe("7 h 30");
    expect(formatoValor("sleep_asleep", 6.05)).toBe("6 h 03");
  });
  // 7,999 h redondea a 60 min: tiene que salir "8 h", no "7 h 60".
  it("sin '7 h 60'", () => {
    expect(formatoValor("sleep_asleep", 7.999)).toBe("8 h");
  });
  it("números grandes con separador de miles", () => {
    expect(formatoValor("step_count", 12345, "count")).toMatch(/12.345/);
  });
  it("la unidad 'count' no se enseña", () => {
    expect(formatoValor("step_count", 500, "count")).not.toContain("count");
  });
  it("valor no numérico → guion", () => {
    expect(formatoValor("step_count", NaN)).toBe("—");
  });
});

describe("NOMBRES_METRICA", () => {
  // Las métricas que el motor usa como meta tienen que tener nombre legible.
  it("cubre todas las métricas de las metas", () => {
    for (const m of ["step_count", "sleep_asleep", "apple_exercise_time", "active_energy", "distance_walking_running", "mindful_minutes"]) {
      expect(NOMBRES_METRICA[m], m).toBeTruthy();
    }
  });
});
