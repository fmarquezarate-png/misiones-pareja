import { describe, it, expect } from "vitest";
import {
  ETAPAS, PUNTOS, HISTERESIS,
  normalizar, sumarDias, lunesDe, indexar, evaluarDia, evaluarSemana, lineaTemporal,
  puntosDelDia, etapaPorXp, siguienteEtapa, simular, animo, frameHuevo,
} from "../lib/pet.js";

// Genera filas de `health_daily` para un rango de días.
function dias(desde, n, porDia) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const day = sumarDias(desde, i);
    for (const [metric, value] of Object.entries(porDia(i, day))) out.push({ day, metric, value, unit: null });
  }
  return out;
}
const perfecto = () => ({ step_count: 9000, sleep_asleep: 7.5, apple_exercise_time: 40 });
const malo = () => ({ step_count: 1500, sleep_asleep: 4, apple_exercise_time: 0 });

describe("fechas", () => {
  it("suma días cruzando mes y año", () => {
    expect(sumarDias("2026-09-30", 1)).toBe("2026-10-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("el lunes de la semana (semanas de lunes a domingo)", () => {
    expect(lunesDe("2026-09-28")).toBe("2026-09-28");   // lunes
    expect(lunesDe("2026-10-04")).toBe("2026-09-28");   // domingo
    expect(lunesDe("2026-10-01")).toBe("2026-09-28");   // jueves
  });
});

describe("normalizar", () => {
  // Si el iPhone está en kJ, una meta de 3500 kcal se "cumpliría" con 4 veces menos.
  it("convierte kJ a kcal", () => {
    expect(normalizar("active_energy", 4184, "kJ")).toBeCloseTo(1000);
  });
  it("convierte millas a km", () => {
    expect(normalizar("distance_walking_running", 1, "mi")).toBeCloseTo(1.609, 2);
  });
  it("deja lo demás igual", () => {
    expect(normalizar("step_count", 8000, "count")).toBe(8000);
    expect(normalizar("active_energy", 500, "kcal")).toBe(500);
  });
});

describe("evaluarDia", () => {
  it("todas las metas cumplidas = 1", () => {
    const idx = indexar(dias("2026-09-01", 1, perfecto));
    expect(evaluarDia("2026-09-01", idx).puntuacion).toBe(1);
  });
  it("ninguna cumplida = 0", () => {
    const idx = indexar(dias("2026-09-01", 1, malo));
    expect(evaluarDia("2026-09-01", idx).puntuacion).toBe(0);
  });

  // La regla que protege de los fallos de sincronización.
  it("un día SIN datos es neutro (null), no un día malo", () => {
    expect(evaluarDia("2026-09-01", indexar([])).puntuacion).toBeNull();
  });

  // Si el reloj no midió el sueño, no se cuenta como sueño fallado.
  it("solo cuentan las metas con dato", () => {
    const idx = indexar([{ day: "2026-09-01", metric: "step_count", value: 9000 }]);
    const ev = evaluarDia("2026-09-01", idx);
    expect(ev.puntuacion).toBe(1);
    expect(ev.metas.find(m => m.tipo === "sueno").valor).toBeNull();
  });
});

describe("ceros que no son datos", () => {
  // El caso real del 28/09: Health Auto Export mandaba sleep_asleep = 0 cada
  // noche (el sueño iba repartido en fases). Contarlo como "dormí 0 h" hacía
  // fallar la meta de sueño a diario y la mascota no salía del huevo.
  it("0 h de sueño es 'sin dato', no una meta fallada", () => {
    const idx = indexar([
      { day: "2026-09-01", metric: "step_count", value: 9000 },
      { day: "2026-09-01", metric: "sleep_asleep", value: 0 },
    ]);
    const ev = evaluarDia("2026-09-01", idx);
    expect(ev.metas.find(m => m.tipo === "sueno").valor).toBeNull();
    expect(ev.puntuacion).toBe(1);           // solo cuentan los pasos, que sí cumple
  });

  it("un día de menos de 300 pasos (móvil olvidado) es sin dato", () => {
    const idx = indexar([{ day: "2025-04-20", metric: "step_count", value: 25 }]);
    expect(evaluarDia("2025-04-20", idx).puntuacion).toBeNull();
    const idx2 = indexar([{ day: "2025-04-20", metric: "step_count", value: 1200 }]);
    expect(evaluarDia("2025-04-20", idx2).puntuacion).toBe(0);     // 1.200 sí es un día (flojo)
  });

  it("0 pasos también es 'sin dato'", () => {
    const idx = indexar([{ day: "2026-09-01", metric: "step_count", value: 0 }]);
    expect(evaluarDia("2026-09-01", idx).puntuacion).toBeNull();
  });

  // Donde 0 sí es un valor real, se respeta.
  it("0 minutos de ejercicio SÍ es un dato (y falla la meta)", () => {
    const idx = indexar([{ day: "2026-09-01", metric: "apple_exercise_time", value: 0 }]);
    expect(evaluarDia("2026-09-01", idx).puntuacion).toBe(0);
  });

  it("79 días con pasos buenos y sueño a 0 ya no dejan la mascota en el huevo", () => {
    const filas = dias("2026-06-22", 79, () => ({ step_count: 9000, sleep_asleep: 0, sleep_in_bed: 0 }));
    const s = simular({ nacimiento: "2026-06-22", filas, hoy: "2026-09-09" });
    expect(s.nacida).toBe(true);
    expect(s.etapaId).not.toBe("huevo");
  });
});

describe("formatos reales del historial", () => {
  it("una 'noche' de menos de 2 h (siesta o registro cortado) es sin dato", () => {
    const idx = indexar([{ day: "2025-05-14", metric: "sleep_asleep", value: 0.97 }]);
    expect(evaluarDia("2025-05-14", idx).metas.find(m => m.tipo === "sueno").valor).toBeNull();
  });
  it("2 h o más sí cuenta (y falla la meta de 7 h)", () => {
    const idx = indexar([{ day: "2025-05-14", metric: "sleep_asleep", value: 4 }]);
    expect(evaluarDia("2025-05-14", idx).metas.find(m => m.tipo === "sueno").cumplida).toBe(false);
  });
  it("la distancia se encuentra con el nombre que usa Health Auto Export", () => {
    const metas = [{ id: "d", tipo: "distancia", objetivo: 5, periodo: "dia" }];
    const idx = indexar([{ day: "2026-09-01", metric: "walking_running_distance", value: 6.2 }]);
    expect(evaluarDia("2026-09-01", idx, metas).puntuacion).toBe(1);
  });
  it("...y con el nombre antiguo", () => {
    const metas = [{ id: "d", tipo: "distancia", objetivo: 5, periodo: "dia" }];
    const idx = indexar([{ day: "2026-09-01", metric: "distance_walking_running", value: 6.2 }]);
    expect(evaluarDia("2026-09-01", idx, metas).puntuacion).toBe(1);
  });
});

describe("ejercicio sin Apple Watch", () => {
  // El reloj de Fran es Huawei: no manda apple_exercise_time. El ejercicio
  // sale de los entrenos.
  it("sin apple_exercise_time, cuentan los minutos de los entrenos", () => {
    const idx = indexar([], [
      { start_at: "2026-09-01T08:00:00+02:00", minutes: 20 },
      { start_at: "2026-09-01T19:00:00+02:00", minutes: 15 },
    ]);
    const ej = evaluarDia("2026-09-01", idx).metas.find(m => m.tipo === "ejercicio");
    expect(ej.valor).toBe(35);
    expect(ej.cumplida).toBe(true);
  });

  it("si el reloj SÍ manda minutos de ejercicio, mandan esos", () => {
    const idx = indexar(
      [{ day: "2026-09-01", metric: "apple_exercise_time", value: 50 }],
      [{ start_at: "2026-09-01T08:00:00+02:00", minutes: 20 }],
    );
    expect(evaluarDia("2026-09-01", idx).metas.find(m => m.tipo === "ejercicio").valor).toBe(50);
  });

  // Un día sin entreno no se puede distinguir de uno sin registrar.
  it("sin entreno ni minutos, el ejercicio es 'sin dato', no fallado", () => {
    const idx = indexar([{ day: "2026-09-01", metric: "step_count", value: 9000 }]);
    expect(evaluarDia("2026-09-01", idx).metas.find(m => m.tipo === "ejercicio").valor).toBeNull();
  });
});

describe("evaluarSemana", () => {
  const metas = [{ id: "kcal-s", tipo: "kcal", objetivo: 3500, periodo: "semana" },
                 { id: "sueno-s", tipo: "sueno", objetivo: 7, periodo: "semana" }];
  it("los totales se suman en la semana", () => {
    const idx = indexar(dias("2026-09-28", 7, () => ({ active_energy: 600 })));
    const r = evaluarSemana("2026-09-28", idx, metas).find(m => m.id === "kcal-s");
    expect(r.valor).toBe(4200);
    expect(r.cumplida).toBe(true);
  });
  // 7 h de media, no 49 h "acumuladas".
  it("el sueño se promedia, no se suma", () => {
    const idx = indexar(dias("2026-09-28", 7, () => ({ sleep_asleep: 6.5 })));
    const r = evaluarSemana("2026-09-28", idx, metas).find(m => m.id === "sueno-s");
    expect(r.valor).toBeCloseTo(6.5);
    expect(r.cumplida).toBe(false);
  });
  it("una semana sin datos se marca como tal", () => {
    expect(evaluarSemana("2026-09-28", indexar([]), metas)[0].sinDatos).toBe(true);
  });
  it("la semana en curso solo cuenta hasta hoy", () => {
    const idx = indexar(dias("2026-09-28", 7, () => ({ active_energy: 600 })));
    const r = evaluarSemana("2026-09-28", idx, metas, "2026-09-30").find(m => m.id === "kcal-s");
    expect(r.valor).toBe(1800);
  });
});

describe("puntos y etapas", () => {
  it("un día sin datos no suma ni resta", () => {
    expect(puntosDelDia(null)).toBe(0);
  });
  it("un día malo resta, pero menos de lo que suma uno perfecto", () => {
    expect(puntosDelDia(0)).toBeLessThan(0);
    expect(Math.abs(puntosDelDia(0))).toBeLessThan(puntosDelDia(1));
  });
  it("etapa por xp", () => {
    expect(ETAPAS[etapaPorXp(0)].id).toBe("huevo");
    expect(ETAPAS[etapaPorXp(60)].id).toBe("jr");
    expect(ETAPAS[etapaPorXp(5000)].id).toBe("upf");
  });

  // Sin margen, una semana regular en el límite haría parpadear la forma.
  it("desevolucionar exige caer un 20 % por debajo del umbral", () => {
    const pro = ETAPAS.findIndex(e => e.id === "pro");
    expect(siguienteEtapa(pro, 299)).toBe(pro);                          // justo debajo: aguanta
    expect(siguienteEtapa(pro, 300 * HISTERESIS)).toBe(pro);             // en el borde: aguanta
    expect(siguienteEtapa(pro, 300 * HISTERESIS - 1)).toBe(pro - 1);     // por debajo: baja
  });

  // Regla de Fran: puede desevolucionar, pero nunca muere.
  it("una mascota nacida nunca vuelve al huevo", () => {
    expect(ETAPAS[siguienteEtapa(1, 0)].id).toBe("jr");
  });
});

describe("simular", () => {
  const hoy = "2026-10-20";

  it("sin nacimiento, es un huevo sin nacer", () => {
    const s = simular({ nacimiento: null, hoy });
    expect(s).toMatchObject({ etapaId: "huevo", nacida: false, xp: 0 });
  });

  it("una semana perfecta hace eclosionar el huevo", () => {
    const s = simular({ nacimiento: "2026-10-10", filas: dias("2026-10-10", 10, perfecto), hoy });
    expect(s.nacida).toBe(true);
    expect(s.etapaId).toBe("jr");
    expect(s.eventos[0]).toMatchObject({ tipo: "evoluciona", de: "huevo", a: "jr" });
  });

  // El caso que importa: dejar de sincronizar no castiga.
  it("semanas SIN datos no la hacen retroceder", () => {
    const filas = dias("2026-08-01", 40, perfecto);   // 40 días buenos y luego nada
    const s = simular({ nacimiento: "2026-08-01", filas, hoy });
    expect(s.etapaId).toBe("pro");
    expect(s.eventos.some(e => e.tipo === "desevoluciona")).toBe(false);
  });

  it("descuidarla mucho tiempo sí la hace desevolucionar", () => {
    const filas = [
      ...dias("2026-06-01", 40, perfecto),
      ...dias("2026-07-11", 60, malo),
    ];
    const s = simular({ nacimiento: "2026-06-01", filas, hoy: "2026-09-10" });
    expect(s.eventos.some(e => e.tipo === "desevoluciona")).toBe(true);
    expect(s.nacida).toBe(true);           // ...pero sigue viva
  });

  // La regla de Fran: puede desevolucionar. Sin techo, una mascota que
  // llegaba arriba acumulaba tanto colchón que no bajaba nunca.
  it("la vitalidad tiene techo", () => {
    const s = simular({ nacimiento: "2024-01-01", filas: dias("2024-01-01", 600, perfecto), hoy: "2026-01-01" });
    expect(s.etapaId).toBe("upf");
    expect(s.xp).toBeLessThanOrEqual(2400);
  });

  it("desde la forma final, una mala racha larga la hace bajar", () => {
    const filas = [...dias("2024-01-01", 600, perfecto), ...dias("2025-08-23", 150, malo)];
    const s = simular({ nacimiento: "2024-01-01", filas, hoy: "2026-01-20" });
    expect(s.eventos.some(e => e.tipo === "desevoluciona" && e.de === "upf")).toBe(true);
    expect(s.nacida).toBe(true);
  });

  it("las reglas se pueden cambiar para comparar", () => {
    const filas = dias("2026-01-01", 30, perfecto);
    const blanda = simular({ nacimiento: "2026-01-01", filas, hoy: "2026-02-01", reglas: { puntos: { diaPerfecto: 20 }, tope: Infinity } });
    const normal = simular({ nacimiento: "2026-01-01", filas, hoy: "2026-02-01" });
    expect(blanda.xp).toBeGreaterThan(normal.xp);
  });

  it("la xp nunca es negativa", () => {
    const s = simular({ nacimiento: "2026-09-01", filas: dias("2026-09-01", 30, malo), hoy: "2026-10-01" });
    expect(s.xp).toBeGreaterThanOrEqual(0);
    expect(s.historial.every(h => h.xp >= 0)).toBe(true);
  });

  // Hoy aún está en juego: se premia lo ya hecho, no se castiga lo pendiente.
  it("hoy solo suma", () => {
    const base = simular({ nacimiento: "2026-10-18", filas: dias("2026-10-18", 2, perfecto), hoy });
    const conHoyMalo = simular({ nacimiento: "2026-10-18", filas: [...dias("2026-10-18", 2, perfecto), ...dias(hoy, 1, malo)], hoy });
    const conHoyBueno = simular({ nacimiento: "2026-10-18", filas: [...dias("2026-10-18", 2, perfecto), ...dias(hoy, 1, perfecto)], hoy });
    expect(conHoyMalo.xp).toBe(base.xp);
    expect(conHoyBueno.xp).toBe(base.xp + PUNTOS.diaPerfecto);
  });

  it("las metas semanales se liquidan el domingo", () => {
    const metas = [{ id: "kcal-s", tipo: "kcal", objetivo: 3500, periodo: "semana" }];
    const filas = dias("2026-09-28", 7, () => ({ active_energy: 600 }));   // lun 28 → dom 4
    const s = simular({ nacimiento: "2026-09-28", metas, filas, hoy: "2026-10-05" });
    expect(s.xp).toBe(PUNTOS.semanaCumplida);
  });

  it("es determinista: misma entrada, mismo resultado", () => {
    const args = { nacimiento: "2026-09-01", filas: dias("2026-09-01", 30, i => (i % 3 ? perfecto() : malo())), hoy };
    expect(simular(args)).toEqual(simular(args));
  });

  it("progreso entre 0 y 1", () => {
    const s = simular({ nacimiento: "2026-10-15", filas: dias("2026-10-15", 3, perfecto), hoy });
    expect(s.progreso).toBeGreaterThan(0);
    expect(s.progreso).toBeLessThan(1);
  });
});

describe("animo", () => {
  const hoy = "2026-10-20";
  const base = (extraHoy = {}) => simular({
    nacimiento: "2026-10-10",
    filas: [...dias("2026-10-10", 10, perfecto), ...dias(hoy, 1, () => extraHoy)],
    hoy,
  });

  it("de noche duerme", () => {
    expect(animo(base(), { hora: 2 }).animo).toBe("durmiendo");
    expect(animo(base(), { hora: 23 }).animo).toBe("durmiendo");
  });
  it("con un entreno hoy, entrena", () => {
    const s = simular({ nacimiento: "2026-10-10", filas: dias("2026-10-10", 10, perfecto),
      entrenos: [{ start_at: `${hoy}T08:00:00+02:00` }], hoy });
    expect(animo(s, { hora: 12 }).animo).toBe("entrenando");
  });
  it("si durmió poco, está cansada, y dice cuánto", () => {
    const a = animo(base({ sleep_asleep: 4.5 }), { hora: 12 });
    expect(a.animo).toBe("cansado");
    expect(a.motivo).toContain("4,5");
  });
  // Con el ejercicio como meta, cumplir todas implica cumplir esa: si
  // "entrenando" fuera primero, cumplirlo todo no se celebraría nunca.
  it("todas las metas de hoy cumplidas → celebra (aunque una sea de ejercicio)", () => {
    const a = animo(base({ step_count: 9000, sleep_asleep: 8, apple_exercise_time: 45 }), { hora: 12 });
    expect(a.animo).toBe("celebrando");
  });
  it("ejercicio cumplido sin completar el resto → entrena", () => {
    const a = animo(base({ step_count: 2000, sleep_asleep: 8, apple_exercise_time: 45 }), { hora: 12 });
    expect(a.animo).toBe("entrenando");
    expect(a.motivo).toContain("45");
  });
  it("varios días malos seguidos → triste", () => {
    const s = simular({ nacimiento: "2026-10-01", filas: dias("2026-10-01", 19, malo), hoy });
    expect(animo(s, { hora: 12 }).animo).toBe("triste");
  });
  // Sin datos no se sabe: no puede ponerla triste.
  it("sin datos recientes no está triste", () => {
    const s = simular({ nacimiento: "2026-10-01", filas: [], hoy });
    expect(animo(s, { hora: 12 }).animo).not.toBe("triste");
  });
  it("todo ánimo lleva su motivo", () => {
    for (const h of [2, 12]) expect(animo(base(), { hora: h }).motivo.length).toBeGreaterThan(3);
  });
});

describe("frameHuevo", () => {
  it("más cerca de nacer, más agrietado", () => {
    const poco = simular({ nacimiento: "2026-10-18", filas: dias("2026-10-18", 1, perfecto), hoy: "2026-10-19" });
    const mucho = simular({ nacimiento: "2026-10-14", filas: dias("2026-10-14", 5, perfecto), hoy: "2026-10-19" });
    expect(frameHuevo(mucho)).toBeGreaterThan(frameHuevo(poco));
  });
  it("nunca se pasa del último frame", () => {
    const s = simular({ nacimiento: "2026-01-01", filas: dias("2026-01-01", 200, perfecto), hoy: "2026-10-19" });
    expect(frameHuevo(s, 16)).toBe(15);
  });
});

describe("lineaTemporal", () => {
  const sim = simular({
    nacimiento: "2026-01-01",
    filas: [...dias("2026-01-01", 31, perfecto), ...dias("2026-02-01", 28, malo)],
    hoy: "2026-04-01",
  });
  const lt = lineaTemporal(sim);

  it("un resumen por mes, en orden", () => {
    expect(lt.map(m => m.mes)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });
  it("el ánimo del mes sale de la media", () => {
    expect(lt[0].animo).toBe("feliz");
    expect(lt[1].animo).toBe("triste");
  });
  // Un mes sin datos no es un mes triste.
  it("un mes sin datos dice 'sin datos', no inventa un ánimo", () => {
    expect(lt[2]).toMatchObject({ animo: "sin datos", media: null, diasConDatos: 0 });
  });
  it("los eventos caen en su mes", () => {
    expect(lt[0].eventos.some(e => e.tipo === "evoluciona" && e.a === "jr")).toBe(true);
  });
  // 31 días perfectos = 310 puntos: pasa por Jr (60) y termina en Pro (300).
  it("etapa con la que termina el mes y la más alta alcanzada", () => {
    expect(lt[0].etapa).toBe("pro");
    expect(lt[0].etapaMax).toBe("pro");
    const orden = ETAPAS.map(e => e.id);
    for (const m of lt) expect(orden.indexOf(m.etapaMax)).toBeGreaterThanOrEqual(orden.indexOf(m.etapa));
  });
  it("sin simulación, lista vacía", () => {
    expect(lineaTemporal(null)).toEqual([]);
  });
});
