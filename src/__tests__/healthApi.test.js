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

import { leerTodo } from "../lib/healthApi.js";

describe("leerTodo (paginación)", () => {
  // Simula el tope real de Supabase: nunca devuelve más de 1.000 filas.
  const fuente = total => {
    const filas = Array.from({ length: total }, (_, i) => ({ i }));
    const llamadas = [];
    const pedir = async (a, b) => {
      llamadas.push([a, b]);
      return { data: filas.slice(a, Math.min(b + 1, a + 1000)), error: null };
    };
    return { pedir, llamadas };
  };

  // El bug real: 1.288 filas y solo llegaban 1.000.
  it("trae las 1.288 filas del primer envío de Fran, no las 1.000 primeras", async () => {
    const { pedir } = fuente(1288);
    const r = await leerTodo(pedir);
    expect(r).toHaveLength(1288);
    expect(r[1287].i).toBe(1287);
  });

  it("para en cuanto una página llega incompleta", async () => {
    const { pedir, llamadas } = fuente(2500);
    await leerTodo(pedir);
    expect(llamadas).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  // Justo un múltiplo de la página: hace falta una petición más para saber
  // que se acabó, y esa llega vacía.
  it("un total exacto de 1.000 filas no se queda colgado ni duplica", async () => {
    const { pedir, llamadas } = fuente(1000);
    const r = await leerTodo(pedir);
    expect(r).toHaveLength(1000);
    expect(llamadas).toHaveLength(2);
  });

  it("sin filas devuelve lista vacía con una sola petición", async () => {
    const { pedir, llamadas } = fuente(0);
    expect(await leerTodo(pedir)).toEqual([]);
    expect(llamadas).toHaveLength(1);
  });

  it("un error de Supabase se propaga, no se traga", async () => {
    const pedir = async () => ({ data: null, error: { message: "boom" } });
    await expect(leerTodo(pedir)).rejects.toThrow("boom");
  });

  // Nunca "todo" cuando no es todo.
  it("si se pasa del tope de seguridad, falla en vez de devolver datos a medias", async () => {
    const { pedir } = fuente(5000);
    await expect(leerTodo(pedir, { maxPaginas: 2 })).rejects.toThrow(/demasiadas filas/);
  });
});

describe("resumirPorPersona: «último envío» ignora los imports de historial", () => {
  it("un import que reescribe filas antiguas no cuenta como envío reciente", () => {
    const filas = [
      { user_id: "u", day: "2026-09-28", metric: "step_count", value: 5000, updated_at: "2026-09-28T08:00:00Z" },
      { user_id: "u", day: "2022-03-01", metric: "step_count", value: 7000, updated_at: "2026-09-29T20:00:00Z" },   // import de hoy sobre datos de 2022
    ];
    expect(resumirPorPersona(filas)[0].ultimoEnvio).toBe("2026-09-28T08:00:00Z");
  });
  it("sin filas recientes con fecha, no revienta", () => {
    expect(resumirPorPersona([{ user_id: "u", day: "2026-09-28", metric: "x", value: 1 }])[0].ultimoEnvio).toBeNull();
  });
});
