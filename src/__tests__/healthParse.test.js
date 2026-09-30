// Tests del importador de Health Auto Export (supabase/functions/health-ingest).
//
// Cada caso reproduce la FORMA real de un dato del archivo de Fran (28/09/2026)
// — no sus valores: los números son inventados. Son los formatos que rompieron
// el importador y que ningún ejemplo de la documentación mostraba.
import { describe, it, expect } from "vitest";
import {
  aplanar, aplanarConAvisos, limpiar, aplanarEntrenos, diaLocal, instante, aKcal, NUNCA,
  esIntimo, INTIMO_RE, sanearPayload, sinRecientes, CAMPOS_ENTRENO, SUENO_POR_CAMA,
} from "../../supabase/functions/health-ingest/parse.js";

const metrica = (name, units, data) => ({ name, units, data });
const buscar = (filas, metric) => filas.filter(f => f.metric === metric);

describe("fechas", () => {
  it("el día es el local del teléfono, sin pasar por UTC", () => {
    expect(diaLocal("2026-09-28 00:30:00 +0200")).toBe("2026-09-28");
    expect(diaLocal("2026-09-28T23:30:00-0500")).toBe("2026-09-28");
    expect(diaLocal(null)).toBeNull();
  });
  it("instante conserva el huso horario", () => {
    expect(instante("2026-09-24 20:40:55 +0200")).toBe("2026-09-24T20:40:55+02:00");
  });
});

describe("sueño", () => {
  // Forma real (Huawei): fases e inBed a 0, total en totalSleep/asleep.
  it("reloj Huawei: fases a 0, total en totalSleep", () => {
    const f = aplanar([metrica("sleep_analysis", "hr", [{
      rem: 0, core: 0, deep: 0, awake: 0, inBed: 0, asleep: 6.5, totalSleep: 6.5,
      date: "2025-05-13 00:00:00 +0200", sleepEnd: "2025-05-13 07:10:00 +0200",
      sleepStart: "2025-05-13 00:40:00 +0200", source: "Salud de Huawei",
    }])]);
    expect(buscar(f, "sleep_asleep")[0].value).toBe(6.5);
    // Los ceros NO se guardan como "0 horas".
    expect(buscar(f, "sleep_in_bed")).toHaveLength(0);
    expect(buscar(f, "sleep_deep")).toHaveLength(0);
  });

  it("Apple Watch: asleep a 0, total = suma de fases", () => {
    const f = aplanar([metrica("sleep_analysis", "hr", [{
      asleep: 0, inBed: 0, core: 4, deep: 1, rem: 1.5, awake: 0.3,
      sleepEnd: "2026-09-20 07:00:00 +0200",
    }])]);
    expect(buscar(f, "sleep_asleep")[0].value).toBeCloseTo(6.5);
    expect(buscar(f, "sleep_deep")[0].value).toBe(1);
  });

  // Decidir minutos/horas fase a fase convertía 20 min de profundo en "20 h".
  it("en minutos, se convierte toda la noche junta", () => {
    const f = aplanar([metrica("sleep_analysis", "min", [{
      totalSleep: 420, deep: 20, rem: 90, sleepEnd: "2026-09-20 07:00:00 +0200",
    }])]);
    expect(buscar(f, "sleep_asleep")[0].value).toBe(7);
    expect(buscar(f, "sleep_deep")[0].value).toBeCloseTo(20 / 60);
  });

  it("la noche cuenta en el día del despertar", () => {
    const f = aplanar([metrica("sleep_analysis", "hr", [{
      totalSleep: 7, sleepStart: "2026-09-19 23:30:00 +0200", sleepEnd: "2026-09-20 06:30:00 +0200",
      date: "2026-09-19 00:00:00 +0200",
    }])]);
    expect(f[0].day).toBe("2026-09-20");
  });

  // En el archivo real había 7 noches de más de 16 h (hasta 34,5 h).
  it("una 'noche' de 34 h se descarta y se apunta", () => {
    const { filasLimpias, rechazos } = limpiar(aplanar([metrica("sleep_analysis", "hr", [{
      totalSleep: 34.5, sleepEnd: "2024-03-01 10:00:00 +0100",
    }])]));
    expect(buscar(filasLimpias, "sleep_asleep")).toHaveLength(0);
    expect(rechazos[0]).toMatchObject({ metric: "sleep_asleep", value: 34.5 });
  });
});

describe("hora de despertar y de acostarse", () => {
  it("minutos desde la medianoche del día del despertar", () => {
    const f = aplanar([metrica("sleep_analysis", "hr", [{
      totalSleep: 7, sleepStart: "2026-09-19 23:40:00 +0200", sleepEnd: "2026-09-20 07:12:00 +0200",
    }])]);
    expect(buscar(f, "wake_min")[0]).toMatchObject({ day: "2026-09-20", value: 7 * 60 + 12 });
    expect(buscar(f, "bed_min")[0].value).toBe(-20);          // la víspera
  });
  it("acostarse pasada la medianoche es positivo", () => {
    const f = aplanar([metrica("sleep_analysis", "hr", [{
      totalSleep: 6, sleepStart: "2026-09-20 01:30:00 +0200", sleepEnd: "2026-09-20 07:30:00 +0200",
    }])]);
    expect(buscar(f, "bed_min")[0].value).toBe(90);
  });
  it("sin sueño real no hay hora de despertar", () => {
    const f = aplanar([metrica("sleep_analysis", "hr", [{
      totalSleep: 0, asleep: 0, sleepStart: "2026-09-20 01:30:00 +0200", sleepEnd: "2026-09-20 07:30:00 +0200",
    }])]);
    expect(buscar(f, "wake_min")).toHaveLength(0);
  });
});

describe("pulso: { Min, Avg, Max } sin qty", () => {
  // Antes se tiraban ENTEROS: 972 días de pulso de Fran, en silencio.
  it("se guardan media, mínimo y máximo", () => {
    const f = aplanar([metrica("heart_rate", "count/min", [{
      Avg: 72.4, Min: 51, Max: 143, date: "2026-09-25 00:00:00 +0200", source: "Salud de Huawei",
    }])]);
    expect(buscar(f, "heart_rate")[0].value).toBe(72.4);
    expect(buscar(f, "heart_rate_min")[0].value).toBe(51);
    expect(buscar(f, "heart_rate_max")[0].value).toBe(143);
  });
});

describe("energía en kJ", () => {
  it("active_energy en kJ se guarda en kcal", () => {
    const f = aplanar([metrica("active_energy", "kJ", [{ qty: 4184, date: "2026-09-01 00:00:00 +0200" }])]);
    expect(f[0].value).toBeCloseTo(1000);
    expect(f[0].unit).toBe("kcal");
  });
  it("en kcal se deja igual", () => {
    const f = aplanar([metrica("active_energy", "kcal", [{ qty: 500, date: "2026-09-01 00:00:00 +0200" }])]);
    expect(f[0].value).toBe(500);
  });
  it("aKcal", () => {
    expect(aKcal(4184, "kJ")).toBeCloseTo(1000);
    expect(aKcal(null, "kJ")).toBeNull();
  });
});

describe("nombres reales", () => {
  it("walking_running_distance tiene rango de cordura", () => {
    const { rechazos } = limpiar(aplanar([metrica("walking_running_distance", "km", [
      { qty: 999, date: "2026-09-01 00:00:00 +0200" },
    ])]));
    expect(rechazos).toHaveLength(1);
  });
});

describe("lo que no se guarda nunca", () => {
  // Forma real: sin qty, con claves de protección. Es íntimo y la mascota no
  // lo necesita: no se guarda ni se apunta en ningún sitio.
  it("sexual_activity no sale del parser", () => {
    const f = aplanar([metrica("sexual_activity", "count", [{
      "Protection Used": 1, "Protection Not Used": 0, Unspecified: 0, date: "2022-05-07 00:00:00 +0200",
    }])]);
    expect(f).toEqual([]);
  });
  it("la lista incluye los datos de ciclo", () => {
    expect(NUNCA.has("sexual_activity")).toBe(true);
    expect(NUNCA.has("menstrual_flow")).toBe(true);
  });
});

describe("limpiar", () => {
  it("dos fuentes del mismo total: se queda el mayor, no la suma", () => {
    const { filasLimpias } = limpiar([
      { day: "2026-09-01", metric: "step_count", value: 8000 },
      { day: "2026-09-01", metric: "step_count", value: 8400 },
    ]);
    expect(filasLimpias[0].value).toBe(8400);
  });
  it("una medida instantánea se promedia", () => {
    const { filasLimpias } = limpiar([
      { day: "2026-09-01", metric: "resting_heart_rate", value: 60 },
      { day: "2026-09-01", metric: "resting_heart_rate", value: 64 },
    ]);
    expect(filasLimpias[0].value).toBe(62);
  });
});

describe("entrenos", () => {
  // Forma real: duration en SEGUNDOS, energía en kJ, distancia {qty, units}.
  const real = {
    name: "Interior Ejecutar", start: "2026-09-24 20:40:55 +0200", end: "2026-09-24 21:21:21 +0200",
    duration: 2426, activeEnergyBurned: { qty: 1824.224, units: "kJ" },
    distance: { qty: 5.98, units: "km" }, avgHeartRate: { units: "bpm", qty: 159.2 },
    source: "Salud de Huawei",
  };

  it("minutos de inicio a fin", () => {
    expect(aplanarEntrenos([real])[0].minutes).toBeCloseTo(40.43, 1);
  });
  it("sin fin, usa duration en SEGUNDOS (no en minutos)", () => {
    const w = aplanarEntrenos([{ ...real, end: undefined }])[0];
    expect(w.minutes).toBeCloseTo(2426 / 60, 1);
  });
  // Antes: 1824 "kcal" para una carrera de 40 min. Son 436.
  it("las calorías en kJ se convierten a kcal", () => {
    expect(aplanarEntrenos([real])[0].kcal).toBeCloseTo(436, 0);
  });
  it("distancia y pulso medio desde objetos {qty}", () => {
    const w = aplanarEntrenos([real])[0];
    expect(w.distance_km).toBe(5.98);
    expect(w.avg_hr).toBe(159.2);
  });
  it("el mismo entreno reenviado no se duplica", () => {
    expect(aplanarEntrenos([real, { ...real }])).toHaveLength(1);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Auditoría v6 (29/09/2026): cada bloque fija un hallazgo confirmado con el
// archivo real de Fran.
// ─────────────────────────────────────────────────────────────────────────────

describe("F37 · el crudo se guarda saneado", () => {
  const envio = {
    data: {
      metrics: [
        { name: "sexual_activity", units: "count", data: [{ date: "2022-05-07 00:00:00 +0200", Unspecified: 1 }] },
        { name: "menstrual_flow", units: "count", data: [{ date: "2022-05-07 00:00:00 +0200", qty: 1 }] },
        { name: "step_count", units: "count", data: [{ date: "2026-09-01 00:00:00 +0200", qty: 9000 }] },
      ],
      workouts: [{
        name: "Correr", start: "2026-09-24 20:40:55 +0200", end: "2026-09-24 21:21:21 +0200", duration: 2426,
        route: [{ latitude: 41.39, longitude: 2.17 }], heartRateData: Array(3000).fill({ qty: 150 }),
        location: "Interior", metadata: { HKWeatherTemperature: 21 }, source: { name: "Huawei" },
      }],
      cycleTracking: [{ date: "2026-09-01", flow: "light" }],
    },
  };
  const s = sanearPayload(envio);
  it("sin actividad sexual ni ciclo", () => {
    expect(s.data.metrics.map(m => m.name)).toEqual(["step_count"]);
    expect(s.data.cycleTracking).toBeUndefined();
    expect(JSON.stringify(s)).not.toMatch(/sexual|menstru|cycle/i);
  });
  it("sin ruta GPS, pulso por segundo, ubicación ni metadatos", () => {
    const w = s.data.workouts[0];
    for (const k of ["route", "heartRateData", "location", "metadata"]) expect(w[k]).toBeUndefined();
    expect(w.duration).toBe(2426);
  });
  it("y pesa mucho menos", () => {
    expect(JSON.stringify(s).length).toBeLessThan(JSON.stringify(envio).length / 4);
  });
  it("no rompe con basura", () => {
    expect(sanearPayload(null)).toEqual({ data: {} });
    expect(sanearPayload({ data: { metrics: "no" } }).data.metrics).toEqual([]);
  });
  // Health Auto Export añade tipos nuevos: la lista cerrada nunca los tendrá todos.
  it("lo íntimo se detecta por patrón, no solo por lista", () => {
    for (const n of ["menstrual_flow", "contraceptive", "pregnancy_test_result", "intermenstrual_bleeding", "sexual_activity"]) {
      expect(esIntimo(n), n).toBe(true);
    }
    for (const n of ["step_count", "heart_rate", "sleep_analysis", "vo2_max", "walking_speed"]) expect(esIntimo(n), n).toBe(false);
    expect(INTIMO_RE.test("cycle_tracking")).toBe(true);
  });
});

describe("F44 · una noche por día: la principal", () => {
  const siesta = { totalSleep: 1, sleepStart: "2026-09-20 15:00:00 +0200", sleepEnd: "2026-09-20 16:00:00 +0200", source: "Zepp Life" };
  const noche = { totalSleep: 7, sleepStart: "2026-09-19 23:40:00 +0200", sleepEnd: "2026-09-20 07:10:00 +0200", source: "Huawei" };
  const { filas, avisos } = aplanarConAvisos([metrica("sleep_analysis", "hr", [siesta, noche])]);
  it("la hora de despertar es la de la noche, no el promedio con la siesta", () => {
    expect(buscar(filas, "wake_min")).toHaveLength(1);
    expect(buscar(filas, "wake_min")[0].value).toBe(7 * 60 + 10);
    expect(buscar(filas, "bed_min")[0].value).toBe(-20);
  });
  it("el sueño del día es el de la noche principal", () => {
    expect(buscar(filas, "sleep_asleep")).toHaveLength(1);
    expect(buscar(filas, "sleep_asleep")[0].value).toBe(7);
    expect(avisos.sueno_secundario).toBe(1);
  });
  it("da igual el orden de llegada", () => {
    const al = aplanarConAvisos([metrica("sleep_analysis", "hr", [noche, siesta])]).filas;
    expect(buscar(al, "wake_min")[0].value).toBe(7 * 60 + 10);
  });
  it("dos fuentes de la misma noche no se suman", () => {
    const dup = aplanarConAvisos([metrica("sleep_analysis", "hr", [noche, { ...noche, totalSleep: 6.8, source: "Mi Fitness" }])]).filas;
    expect(buscar(dup, "sleep_asleep")[0].value).toBe(7);
  });
});

describe("F45 · nadie duerme más de lo que dura su noche", () => {
  const registro = { totalSleep: 9, sleepStart: "2026-09-19 23:00:00 +0200", sleepEnd: "2026-09-20 05:00:00 +0200" };
  it("el total se recorta al intervalo real y se avisa", () => {
    const { filas, avisos } = aplanarConAvisos([metrica("sleep_analysis", "hr", [registro])]);
    expect(buscar(filas, "sleep_asleep")[0].value).toBeCloseTo(6);
    expect(avisos.sueno_recortado_al_intervalo).toBe(1);
  });
  it("una diferencia de minutos (redondeo) no se toca", () => {
    const { filas, avisos } = aplanarConAvisos([metrica("sleep_analysis", "hr", [{ ...registro, totalSleep: 6.1 }])]);
    expect(buscar(filas, "sleep_asleep")[0].value).toBe(6.1);
    expect(avisos.sueno_recortado_al_intervalo).toBeUndefined();
  });
  it("las fases también se recortan", () => {
    const { filas } = aplanarConAvisos([metrica("sleep_analysis", "hr", [{ ...registro, totalSleep: 6, deep: 8 }])]);
    expect(buscar(filas, "sleep_deep")[0].value).toBeCloseTo(6);
  });
  it("en minutos se compara ya en horas", () => {
    const { filas } = aplanarConAvisos([metrica("sleep_analysis", "min", [{ ...registro, totalSleep: 540 }])]);
    expect(buscar(filas, "sleep_asleep")[0].value).toBeCloseTo(6);
  });
});

describe("F48 · la procedencia del entreno", () => {
  it("source llega como { name, identifier }: se guarda el nombre", () => {
    const w = aplanarEntrenos([{ name: "Correr", start: "2026-09-24 20:40:55 +0200", end: "2026-09-24 21:21:21 +0200", source: { name: "Salud de Huawei", identifier: "com.huawei" } }])[0];
    expect(w.source).toBe("Salud de Huawei");
    expect(w.source).not.toContain("[object");
  });
  it("y sigue valiendo un texto o nada", () => {
    expect(aplanarEntrenos([{ name: "x", start: "2026-09-24 20:40:55 +0200", source: "iPhone" }])[0].source).toBe("iPhone");
    expect(aplanarEntrenos([{ name: "x", start: "2026-09-24 20:40:55 +0200" }])[0].source).toBeNull();
  });
});

describe("F59 · nada se descarta en silencio", () => {
  it("cuenta y clasifica lo que ignora", () => {
    const { filas, avisos } = aplanarConAvisos([
      metrica("step_count", "count", [
        { date: "2026-09-01 00:00:00 +0200", qty: 9000 },
        { qty: 5 },                                         // sin fecha
        { date: "2026-09-02 00:00:00 +0200", qty: "mucho" }, // valor no numérico
        { date: "2026-09-03 00:00:00 +0200" },               // sin qty ni Avg
      ]),
    ]);
    expect(filas).toHaveLength(1);
    expect(avisos).toMatchObject({ sin_fecha: 1, sin_valor: 1, forma_desconocida: 1 });
  });
  it("una fecha imposible se descarta ella sola, no envenena la tanda", () => {
    expect(diaLocal("2026-02-31 00:00:00 +0100")).toBeNull();
    expect(diaLocal("2026-13-01")).toBeNull();
    expect(diaLocal("2026-02-28 10:00:00 +0100")).toBe("2026-02-28");
    const { filas, avisos } = aplanarConAvisos([metrica("step_count", "count", [
      { date: "2026-02-31 00:00:00 +0100", qty: 100 }, { date: "2026-02-27 00:00:00 +0100", qty: 8000 },
    ])]);
    expect(filas).toHaveLength(1);
    expect(avisos.fecha_imposible).toBe(1);
  });
  it("fechas del futuro o de antes del 2000 se rechazan (con 'hoy')", () => {
    const { filas, avisos } = aplanarConAvisos([metrica("step_count", "count", [
      { date: "2026-12-25 00:00:00 +0100", qty: 100 }, { date: "1999-01-01 00:00:00 +0100", qty: 100 }, { date: "2026-09-28 00:00:00 +0200", qty: 100 },
    ])], { hoy: "2026-09-28" });
    expect(filas).toHaveLength(1);
    expect(avisos).toMatchObject({ fecha_futura: 1, fecha_imposible: 1 });
  });
  it("una métrica mal formada no tira las demás", () => {
    const { filas, avisos } = aplanarConAvisos([
      { name: "raro", units: "x", data: 5 },
      metrica("step_count", "count", [{ date: "2026-09-01 00:00:00 +0200", qty: 9000 }]),
    ]);
    expect(filas).toHaveLength(1);
    expect(avisos.metrica_malformada).toBe(1);
  });
  it("un nombre de métrica absurdo no llega a la base de datos", () => {
    const { filas } = aplanarConAvisos([metrica("x".repeat(200), "u", [{ date: "2026-09-01 00:00:00 +0200", qty: 1 }])]);
    expect(filas).toEqual([]);
  });
  it("aplanar() sigue devolviendo solo las filas", () => {
    expect(Array.isArray(aplanar([metrica("step_count", "count", [{ date: "2026-09-01 00:00:00 +0200", qty: 9000 }])]))).toBe(true);
  });
});

describe("F56 · los días recientes son de la automatización", () => {
  it("sinRecientes quita desde el corte", () => {
    const f = [{ day: "2026-09-25" }, { day: "2026-09-26" }, { day: "2026-09-27" }, { day: "2026-09-28" }];
    expect(sinRecientes(f, "2026-09-26").map(x => x.day)).toEqual(["2026-09-25"]);
  });
});

describe("CAMPOS_ENTRENO", () => {
  it("son los que el importador usa (y ninguno pesado)", () => {
    for (const k of ["route", "heartRateData", "location", "metadata"]) expect(CAMPOS_ENTRENO).not.toContain(k);
    expect(CAMPOS_ENTRENO).toContain("start");
  });
});

// Fran (30/09/2026): «hay muchísimos días que sí tengo datos de sueño». 134 noches del
// archivo real solo traían «tiempo en cama» (iPhone sin reloj, Mi Fitness, Zepp) y se tiraban.
describe("noches con solo tiempo en cama", () => {
  const noche = o => ({ name: "sleep_analysis", units: "hr", data: [{ date: "2021-11-04 00:00:00 +0100", totalSleep: 0, asleep: 0, core: 0, deep: 0, rem: 0, awake: 0, source: "iPhone de Francisco", ...o }] });
  const filasDe = o => aplanarConAvisos([noche(o)], {});
  it("iPhone: tiempo en cama × 0,884 como sueño, marcado como estimado", () => {
    const { filas, avisos } = filasDe({ inBed: 5.52, inBedStart: "2021-11-04 02:18:26 +0100", inBedEnd: "2021-11-04 07:49:36 +0100", sleepStart: "2021-11-04 02:18:26 +0100", sleepEnd: "2021-11-04 07:49:36 +0100" });
    const s = filas.find(x => x.metric === "sleep_asleep");
    expect(s.value).toBeCloseTo(5.52 * SUENO_POR_CAMA, 1);
    expect(s.source).toMatch(/^Estimado: tiempo en cama/);
    expect(filas.find(x => x.metric === "wake_min").value).toBe(7 * 60 + 49);
    expect(avisos.sueno_estimado_por_cama).toBe(1);
  });
  it("Mi Fitness con `inBed` corrupto (336 h): manda el intervalo real", () => {
    const { filas } = filasDe({ inBed: 336.15, inBedStart: "2022-11-13 05:31:00 +0100", inBedEnd: "2022-11-13 12:16:00 +0100", date: "2022-11-13 00:00:00 +0100", source: "Mi Fitness" });
    expect(filas.find(x => x.metric === "sleep_in_bed").value).toBeCloseTo(6.75, 2);
  });
  it("franjas de día (Zepp 11:29→19:02) o de más de 12 h no son noches", () => {
    expect(filasDe({ inBed: 7.57, inBedStart: "2022-02-12 11:29:00 +0100", inBedEnd: "2022-02-12 19:02:59 +0100" }).avisos.cama_no_valida).toBe(1);
    expect(filasDe({ inBed: 603, inBedStart: "2022-11-18 18:34:00 +0100", inBedEnd: "2022-11-19 18:00:00 +0100" }).avisos.cama_no_valida).toBe(1);
  });
  it("si otra fuente MIDIÓ el sueño de esa noche, gana la medida aunque sea menor", () => {
    const m = { name: "sleep_analysis", units: "hr", data: [
      { date: "2023-03-10 00:00:00 +0100", totalSleep: 0, asleep: 0, inBed: 9, inBedStart: "2023-03-09 23:30:00 +0100", inBedEnd: "2023-03-10 08:30:00 +0100", source: "iPhone" },
      { date: "2023-03-10 00:00:00 +0100", totalSleep: 6.5, asleep: 6.5, sleepStart: "2023-03-10 00:30:00 +0100", sleepEnd: "2023-03-10 07:30:00 +0100", source: "Mi Fitness" },
    ] };
    const s = aplanarConAvisos([m], {}).filas.find(x => x.metric === "sleep_asleep");
    expect(s.value).toBe(6.5);
    expect(s.source).toBe("Mi Fitness");
  });
});

describe("sueño en muestras (exportación sin resumir)", () => {
  const t = (ini, fin, value, source = "Salud de Huawei") => ({ startDate: ini, endDate: fin, value, qty: 0, source });
  const sueno = data => aplanarConAvisos([{ name: "sleep_analysis", units: "hr", data }]).filas;
  const val = (filas, metric, day) => filas.find(f => f.metric === metric && f.day === day)?.value;

  // Una fuente puede escribir la noche como «Asleep» Y además sus fases.
  it("no cuenta dos veces un tramo general y sus fases", () => {
    const filas = sueno([
      t("2025-05-13 23:30:00 +0200", "2025-05-14 07:30:00 +0200", "Asleep"),
      t("2025-05-13 23:30:00 +0200", "2025-05-14 02:30:00 +0200", "Core"),
      t("2025-05-14 02:30:00 +0200", "2025-05-14 04:00:00 +0200", "Deep"),
      t("2025-05-14 04:00:00 +0200", "2025-05-14 05:00:00 +0200", "Awake"),
      t("2025-05-14 05:00:00 +0200", "2025-05-14 07:30:00 +0200", "REM"),
    ]);
    expect(val(filas, "sleep_asleep", "2025-05-14")).toBeCloseTo(8, 5);
    expect(val(filas, "sleep_deep", "2025-05-14")).toBeCloseTo(1.5, 5);
    expect(val(filas, "sleep_rem", "2025-05-14")).toBeCloseTo(2.5, 5);
    expect(val(filas, "wake_min", "2025-05-14")).toBe(450);
    expect(val(filas, "bed_min", "2025-05-14")).toBe(-30);
  });
  it("sin tramo general, suma las fases y deja fuera lo despierto", () => {
    const filas = sueno([
      t("2025-10-01 01:00:00 +0200", "2025-10-01 03:00:00 +0200", "Core"),
      t("2025-10-01 03:00:00 +0200", "2025-10-01 03:30:00 +0200", "Awake"),
      t("2025-10-01 03:30:00 +0200", "2025-10-01 07:00:00 +0200", "Deep"),
    ]);
    expect(val(filas, "sleep_asleep", "2025-10-01")).toBeCloseTo(5.5, 5);
    expect(val(filas, "sleep_awake", "2025-10-01")).toBeCloseTo(0.5, 5);
  });
  it("el total del día suma noche y siesta; la hora de despertar es la de la noche", () => {
    const filas = sueno([
      t("2025-10-02 00:30:00 +0200", "2025-10-02 07:30:00 +0200", "Asleep"),
      t("2025-10-02 15:00:00 +0200", "2025-10-02 16:00:00 +0200", "Asleep"),
    ]);
    expect(val(filas, "sleep_asleep", "2025-10-02")).toBeCloseTo(8, 5);
    expect(val(filas, "wake_min", "2025-10-02")).toBe(450);
    expect(val(filas, "bed_min", "2025-10-02")).toBe(30);
  });
  // Mayo de 2025 (Fran, lesión): días de 16–17 h de sueño REALES. Nada los recorta.
  it("un día de 17 h de sueño se guarda entero", () => {
    const filas = sueno([
      t("2025-05-13 22:00:00 +0200", "2025-05-14 11:00:00 +0200", "Asleep"),
      t("2025-05-14 13:30:00 +0200", "2025-05-14 18:20:00 +0200", "Asleep"),
    ]);
    const { filasLimpias, rechazos } = limpiar(filas);
    expect(rechazos).toEqual([]);
    expect(filasLimpias.find(f => f.metric === "sleep_asleep").value).toBeCloseTo(17 + 50 / 60, 5);
  });
  it("con dos fuentes gana la que registra más sueño, sin mezclarlas", () => {
    const filas = sueno([
      t("2025-10-03 00:00:00 +0200", "2025-10-03 07:00:00 +0200", "Asleep", "Salud de Huawei"),
      t("2025-10-03 01:00:00 +0200", "2025-10-03 06:00:00 +0200", "Asleep", "Sleep Cycle"),
    ]);
    expect(val(filas, "sleep_asleep", "2025-10-03")).toBeCloseTo(7, 5);
    expect(filas.find(f => f.metric === "sleep_asleep").source).toBe("Salud de Huawei");
  });
  it("mezclado con noches resumidas, las dos formas se leen", () => {
    const filas = aplanarConAvisos([{ name: "sleep_analysis", units: "hr", data: [
      { date: "2026-09-01 00:00:00 +0200", sleepStart: "2026-09-01 01:12:00 +0200", sleepEnd: "2026-09-01 07:24:00 +0200", totalSleep: 6.2, source: "Salud de Huawei" },
      t("2025-10-04 00:00:00 +0200", "2025-10-04 06:00:00 +0200", "Asleep"),
    ] }]).filas;
    expect(val(filas, "sleep_asleep", "2026-09-01")).toBeCloseTo(6.2, 5);
    expect(val(filas, "sleep_asleep", "2025-10-04")).toBeCloseTo(6, 5);
  });
});
