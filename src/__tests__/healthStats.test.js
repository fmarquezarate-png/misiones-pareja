import { describe, it, expect } from "vitest";
import { serie, kpi, metasSemana, repartoEntrenos, ultimaNoche } from "../lib/healthStats.js";

const f = (day, metric, value) => ({ day, metric, value });

describe("serie", () => {
  it("7 días terminando hoy, con null donde no hay dato", () => {
    const s = serie([f("2026-09-28", "step_count", 9000), f("2026-09-25", "step_count", 4000)], "step_count", "2026-09-28");
    expect(s.map(d => d.dia)).toEqual(["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28"]);
    expect(s[6].valor).toBe(9000);
    expect(s[0].valor).toBeNull();
  });
  // Mismo criterio que el motor: 0 pasos es "no se midió".
  it("un 0 en pasos o sueño es null, no cero", () => {
    expect(serie([f("2026-09-28", "step_count", 0)], "step_count", "2026-09-28")[6].valor).toBeNull();
  });
});

describe("kpi", () => {
  const filas = [
    ...[1, 2, 3, 4, 5, 6, 7].map(i => f(`2026-09-${String(14 + i).padStart(2, "0")}`, "resting_heart_rate", 60)),
    ...[1, 2, 3, 4, 5, 6, 7].map(i => f(`2026-09-${String(21 + i).padStart(2, "0")}`, "resting_heart_rate", 57)),
  ];
  it("media de 7 días contra los 7 anteriores", () => {
    const k = kpi(filas, "resting_heart_rate", "2026-09-28", { mejorSi: "baja" });
    expect(k.actual).toBe(57);
    expect(k.antes).toBe(60);
    expect(k.delta).toBe(-3);
  });
  // El pulso en reposo mejora al BAJAR: la flecha no puede pintarse en rojo.
  it("sabe qué dirección es buena", () => {
    expect(kpi(filas, "resting_heart_rate", "2026-09-28", { mejorSi: "baja" }).bueno).toBe(true);
    expect(kpi(filas, "resting_heart_rate", "2026-09-28", { mejorSi: "sube" }).bueno).toBe(false);
  });
  it("una variación mínima (<2 %) es neutra", () => {
    const casi = [f("2026-09-20", "step_count", 8000), f("2026-09-27", "step_count", 8050)];
    expect(kpi(casi, "step_count", "2026-09-28").bueno).toBeNull();
  });
  it("sin la semana anterior, no inventa variación", () => {
    const k = kpi([f("2026-09-28", "step_count", 9000)], "step_count", "2026-09-28");
    expect(k.delta).toBeNull();
    expect(k.actual).toBe(9000);
  });
  it("la media es sobre los días CON dato, y lo dice", () => {
    const k = kpi([f("2026-09-28", "step_count", 9000), f("2026-09-27", "step_count", 7000)], "step_count", "2026-09-28");
    expect(k.actual).toBe(8000);
    expect(k.diasConDato).toBe(2);
  });
});

describe("kpi: acumulados en días cerrados", () => {
  const filas = [
    ...[21, 22, 23, 24, 25, 26, 27].map(d => f(`2026-09-${d}`, "step_count", 9000)),
    f("2026-09-28", "step_count", 1500),               // hoy a las 10:00
  ];
  it("hoy a medias no hunde la media", () => {
    expect(kpi(filas, "step_count", "2026-09-28").actual).toBeLessThan(9000);
    const k = kpi(filas, "step_count", "2026-09-28", { cerrados: true });
    expect(k.actual).toBe(9000);
    expect(k.hoyValor).toBe(1500);
    expect(k.serie).toHaveLength(7);
    expect(k.serie[6].dia).toBe("2026-09-28");           // la gráfica sí enseña hoy
  });
  it("el periodo es configurable (14 días)", () => {
    const k = kpi(filas, "step_count", "2026-09-28", { n: 14, cerrados: true });
    expect(k.serie).toHaveLength(14);
    expect(k.n).toBe(14);
  });
});

describe("metasSemana", () => {
  const metas = [
    { id: "p", tipo: "pasos", objetivo: 8000, periodo: "dia" },
    { id: "k", tipo: "kcal", objetivo: 3500, periodo: "semana" },
  ];
  // Lunes 28/09 → solo cuenta hoy; jueves 01/10 → lun-jue.
  it("cuenta los días cumplidos desde el lunes", () => {
    const filas = [f("2026-09-28", "step_count", 9000), f("2026-09-29", "step_count", 3000), f("2026-09-30", "step_count", 8500)];
    const r = metasSemana(filas, [], metas, "2026-10-01").find(m => m.id === "p");
    expect(r).toMatchObject({ cumplidos: 2, conDato: 3, dias: 4 });
  });
  it("la meta semanal acumula y da el progreso", () => {
    const filas = [f("2026-09-28", "active_energy", 1000), f("2026-09-29", "active_energy", 750)];
    const r = metasSemana(filas, [], metas, "2026-09-29").find(m => m.id === "k");
    expect(r.valor).toBe(1750);
    expect(r.progreso).toBe(0.5);
  });
  it("sin datos en la semana, valor null y progreso 0", () => {
    expect(metasSemana([], [], metas, "2026-09-29").find(m => m.id === "k")).toMatchObject({ valor: null, progreso: 0 });
  });
});

describe("repartoEntrenos", () => {
  const w = (d, name) => ({ start_at: `${d}T10:00:00+02:00`, name });
  it("cuenta por tipo en la ventana, ordenado", () => {
    const r = repartoEntrenos([w("2026-09-01", "Pádel"), w("2026-09-10", "Correr"), w("2026-09-20", "Pádel"), w("2025-01-01", "Remo")], "2026-09-28");
    expect(r.total).toBe(3);
    expect(r.tipos[0]).toMatchObject({ nombre: "Pádel", n: 2 });
    expect(r.tipos.find(t => t.nombre === "Remo")).toBeUndefined();
  });
});

describe("ultimaNoche", () => {
  it("la última noche real, con sus fases si las hay", () => {
    const r = ultimaNoche([
      f("2026-09-27", "sleep_asleep", 7.5), f("2026-09-27", "sleep_deep", 1.5), f("2026-09-27", "sleep_rem", 1.2),
      f("2026-09-27", "wake_min", 432),
      f("2026-09-28", "sleep_asleep", 0.8),            // siesta: no cuenta
    ], "2026-09-28");
    expect(r.dia).toBe("2026-09-27");
    expect(r.total).toBe(7.5);
    expect(r.fases.map(x => x.nombre)).toEqual(["Profundo", "REM"]);
    expect(r.despertar).toBe(432);
  });
  // Reloj Huawei: fases a 0 → sin fases, pero sí total.
  it("sin fases, lista vacía (no barras a cero)", () => {
    expect(ultimaNoche([f("2026-09-27", "sleep_asleep", 7)], "2026-09-28").fases).toEqual([]);
  });
  it("sin sueño, null", () => {
    expect(ultimaNoche([], "2026-09-28")).toBeNull();
  });
});

import { detalleMetrica, porSemanas, resumenParaIA } from "../lib/healthStats.js";

describe("detalleMetrica", () => {
  const filas = [
    f("2026-09-20", "step_count", 12000), f("2026-09-21", "step_count", 3000),
    f("2026-09-22", "step_count", 9000), f("2026-09-23", "step_count", 8500),
    f("2026-09-24", "step_count", 8100), f("2026-09-26", "step_count", 9500),
  ];
  const d = detalleMetrica(filas, "step_count", "2026-09-26", 7, { meta: 8000 });

  it("día más alto y más bajo, con su fecha", () => {
    expect(d.mas).toEqual({ dia: "2026-09-20", valor: 12000 });
    expect(d.menos).toEqual({ dia: "2026-09-21", valor: 3000 });
  });
  it("cobertura: 6 de 7 días con dato", () => {
    expect(d.conDato).toBe(6);
    expect(d.total).toBe(7);
  });
  // Un día sin dato (el 25) no rompe la racha ni la cuenta: se salta.
  it("racha de días cumpliendo la meta, hasta el hueco o el fallo", () => {
    expect(d.racha).toBe(1);   // 26 cumple; 25 sin dato → corta (solo hoy puede faltar)
  });
  it("hoy sin dato todavía no rompe la racha", () => {
    const r = detalleMetrica([...filas, f("2026-09-25", "step_count", 9000)], "step_count", "2026-09-27", 8, { meta: 8000 });
    expect(r.racha).toBe(5);   // 22–26 cumplen; 27 (hoy) aún sin dato
  });
  // El pulso en reposo es MEJOR cuanto más bajo.
  it("en métricas que mejoran al bajar, el mejor día es el mínimo", () => {
    const hr = [f("2026-09-25", "resting_heart_rate", 62), f("2026-09-26", "resting_heart_rate", 55)];
    const r = detalleMetrica(hr, "resting_heart_rate", "2026-09-26", 7, { mejorSi: "baja" });
    expect(r.mejor.valor).toBe(55);
    expect(r.peor.valor).toBe(62);
  });
  it("tendencia: segunda mitad frente a la primera", () => {
    const sube = Array.from({ length: 14 }, (_, i) => f(`2026-09-${String(i + 1).padStart(2, "0")}`, "step_count", i < 7 ? 5000 : 10000));
    expect(detalleMetrica(sube, "step_count", "2026-09-14", 14).tendencia).toBeCloseTo(1);
  });
  it("con pocos datos no inventa tendencia", () => {
    expect(detalleMetrica([f("2026-09-26", "step_count", 9000)], "step_count", "2026-09-26", 14).tendencia).toBeNull();
  });
});

describe("porSemanas", () => {
  it("agrupa de lunes a domingo con la media de los días con dato", () => {
    const s = [{ dia: "2026-09-21", valor: 10 }, { dia: "2026-09-22", valor: 20 }, { dia: "2026-09-28", valor: 5 }, { dia: "2026-09-29", valor: null }];
    expect(porSemanas(s)).toEqual([{ dia: "2026-09-21", valor: 15 }, { dia: "2026-09-28", valor: 5 }]);
  });
});

describe("resumenParaIA", () => {
  const d = detalleMetrica([f("2026-09-25", "step_count", 9000), f("2026-09-26", "step_count", 4000)], "step_count", "2026-09-26", 7);
  const txt = resumenParaIA({ nombre: "Pasos", unidad: "pasos/día", dias: 7, detalle: d, pregunta: "¿Qué día anduve más?" });
  it("lleva la métrica, los valores, los extremos y la pregunta", () => {
    expect(txt).toContain("Pasos");
    expect(txt).toContain("09-25:9000");
    expect(txt).toContain("máx 9000 (2026-09-25)");
    expect(txt).toContain("¿Qué día anduve más?");
  });
  // Un hueco no es un cero, tampoco para la IA.
  it("marca los días sin dato como '-' y lo explica", () => {
    expect(txt).toContain("09-20:-");
    expect(txt).toMatch(/sin dato, no es cero/);
  });
  it("es compacto incluso con 90 días", () => {
    const largo = detalleMetrica(Array.from({ length: 90 }, (_, i) => f(`2026-0${i < 30 ? 7 : i < 61 ? 8 : 9}-${String((i % 30) + 1).padStart(2, "0")}`, "step_count", 8000 + i)), "step_count", "2026-09-30", 90);
    expect(resumenParaIA({ nombre: "Pasos", unidad: "pasos", dias: 90, detalle: largo, pregunta: "?" }).length).toBeLessThan(2000);
  });
});

import { diasEntre, porMeses, extremosMensuales, resumenHistoricoParaIA } from "../lib/healthStats.js";

describe("histórico completo", () => {
  it("diasEntre es inclusivo y cruza años", () => {
    expect(diasEntre("2026-09-01", "2026-09-30")).toBe(30);
    expect(diasEntre("2025-12-31", "2026-01-01")).toBe(2);
  });

  const s = [
    ...Array.from({ length: 20 }, (_, i) => ({ dia: `2025-01-${String(i + 1).padStart(2, "0")}`, valor: 6000 })),
    ...Array.from({ length: 25 }, (_, i) => ({ dia: `2025-02-${String(i + 1).padStart(2, "0")}`, valor: 11000 })),
    { dia: "2025-03-01", valor: 30000 }, { dia: "2025-03-02", valor: null },
  ];
  const meses = porMeses(s);

  it("medias mensuales con el nº de días con dato", () => {
    expect(meses.map(m => [m.mes, m.valor, m.dias])).toEqual([["2025-01", 6000, 20], ["2025-02", 11000, 25], ["2025-03", 30000, 1]]);
  });
  // Un mes con 1 día suelto no puede ser "tu mejor mes".
  it("el mejor mes exige datos suficientes", () => {
    const e = extremosMensuales(meses);
    expect(e.mejor.mes).toBe("2025-02");
    expect(e.peor.mes).toBe("2025-01");
  });
  it("en métricas que mejoran al bajar, se invierte", () => {
    const e = extremosMensuales(meses, { mejorSi: "baja" });
    expect(e.mejor.mes).toBe("2025-01");
  });
  it("sin meses válidos, no inventa récords", () => {
    expect(extremosMensuales([{ mes: "2025-03", valor: 1, dias: 2 }])).toEqual({ alto: null, bajo: null, mejor: null, peor: null });
  });
  it("el resumen histórico va por meses y es compacto aunque haya 6 años", () => {
    const largo = Array.from({ length: 72 }, (_, i) => ({ mes: `20${20 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`, valor: 8000 + i, dias: 30 }));
    const det = { conDato: 2000, media: 8500, mas: { dia: "2022-05-02", valor: 31642 }, menos: { dia: "2024-01-01", valor: 900 }, serie: [{ dia: "2020-01-01" }, { dia: "2026-09-28" }] };
    const txt = resumenHistoricoParaIA({ nombre: "Pasos", unidad: "pasos al día", detalle: det, meses: largo, extremos: extremosMensuales(largo), pregunta: "¿He mejorado?" });
    expect(txt).toContain("HISTÓRICO COMPLETO");
    expect(txt).toContain("día más alto 31642 (2022-05-02)");
    expect(txt).toContain("mes más alto 2025-12");
    expect(txt.length).toBeLessThan(2600);
  });
});

describe("repartoEntrenos: el deporte del calendario se agrupa por deporte", () => {
  it("dos títulos distintos de pádel cuentan como «Pádel»", () => {
    const r = repartoEntrenos([
      { start_at: "2026-09-22T21:00:00", name: "Padel Mixto Moli", nombreDeporte: "Pádel" },
      { start_at: "2026-09-23T20:00:00", name: "Padel Masc Moli", nombreDeporte: "Pádel" },
      { start_at: "2026-09-24T18:40:55+00:00", name: "Interior Ejecutar" },
    ], "2026-09-29");
    expect(r.tipos[0]).toMatchObject({ nombre: "Pádel", n: 2 });
  });
});

// Fran (30/09/2026): «el más alto y el más bajo están al revés». Las métricas NEUTRAS
// (abiertas desde «Datos y conexión», peso) caían en la rama de «mejor si baja».
describe("más alto / más bajo: nunca al revés", () => {
  const filas = [f("2026-09-26", "walking_step_length", 60), f("2026-09-27", "walking_step_length", 70), f("2026-09-28", "walking_step_length", 65)];
  for (const mejorSi of ["sube", "baja", "neutral", undefined]) {
    it(`con mejorSi=${mejorSi}: «más» es el valor más alto y «menos» el más bajo`, () => {
      const d = detalleMetrica(filas, "walking_step_length", "2026-09-28", 7, { mejorSi });
      expect(d.mas.valor).toBe(70);
      expect(d.menos.valor).toBe(60);
    });
  }
  it("neutra: no hay «mejor» ni «peor»", () => {
    const d = detalleMetrica(filas, "walking_step_length", "2026-09-28", 7, { mejorSi: "neutral" });
    expect(d.mejor).toBeNull(); expect(d.peor).toBeNull();
  });
  it("«mejor» sigue la dirección: sube → el más alto; baja → el más bajo", () => {
    expect(detalleMetrica(filas, "walking_step_length", "2026-09-28", 7, { mejorSi: "sube" }).mejor.valor).toBe(70);
    expect(detalleMetrica(filas, "walking_step_length", "2026-09-28", 7, { mejorSi: "baja" }).mejor.valor).toBe(60);
  });
  it("meses: alto/bajo por valor; mejor/peor solo con dirección", () => {
    const meses = [{ mes: "2026-07", valor: 80, dias: 20 }, { mes: "2026-08", valor: 75, dias: 20 }];
    expect(extremosMensuales(meses, { mejorSi: "neutral" })).toMatchObject({ alto: { mes: "2026-07" }, bajo: { mes: "2026-08" }, mejor: null, peor: null });
    expect(extremosMensuales(meses, { mejorSi: "baja" }).mejor.mes).toBe("2026-08");
  });
  it("tendencia neutra (peso) sin verde ni rojo", () => {
    const p = [...[1,2,3,4,5,6,7].map(i => f(`2026-09-${String(14+i).padStart(2,"0")}`, "weight_body_mass", 80)), ...[1,2,3,4,5,6,7].map(i => f(`2026-09-${String(21+i).padStart(2,"0")}`, "weight_body_mass", 77))];
    expect(kpi(p, "weight_body_mass", "2026-09-28", { mejorSi: "neutral" }).bueno).toBeNull();
  });
});
