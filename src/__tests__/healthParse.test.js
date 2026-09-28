// Tests del importador de Health Auto Export (supabase/functions/health-ingest).
//
// Cada caso reproduce la FORMA real de un dato del archivo de Fran (28/09/2026)
// — no sus valores: los números son inventados. Son los formatos que rompieron
// el importador y que ningún ejemplo de la documentación mostraba.
import { describe, it, expect } from "vitest";
import {
  aplanar, limpiar, aplanarEntrenos, diaLocal, instante, aKcal, NUNCA,
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
