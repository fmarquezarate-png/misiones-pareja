import { describe, it, expect } from "vitest";
import { detectarDeporte, eventosDeporte, evaluarDia, entrenosDelCalendario, lineaBase, indexarDias, UMBRAL, KCAL_POR_PASO, posiblesEntrenos, deportesHabituales } from "../lib/deporteCalendario.js";
import { ventanaPico, PICO_UMBRAL } from "../../supabase/functions/health-ingest/parse.js";
import { sumarDias, indexar } from "../lib/pet.js";

const m = (title, extra = {}) => ({ id: title + (extra.date || ""), title, status: "DONE", date: "2026-09-29", who: "person1", ...extra });

describe("detectarDeporte: títulos reales del calendario", () => {
  it("reconoce el pádel y el gimnasio", () => {
    for (const t of ["Padel Masc Moli", "PADEL con Chesca y Pipe", "Americana Padel OPmobility", "Torneo de Padel - David Lloyd"]) expect(detectarDeporte(m(t))?.id, t).toBe("padel");
    for (const t of ["Gym", "Entreno box", "Entreno crossfit"]) expect(detectarDeporte(m(t))?.id, t).toBe("gym");
    expect(detectarDeporte(m("primer dia yoga"))?.id).toBe("yoga");
  });
  it("«partido con/vs» solo es pádel con la raqueta", () => {
    expect(detectarDeporte(m("Partido vs MarcPipe", { emoji: "🎾" }))?.id).toBe("padel");
    expect(detectarDeporte(m("Partido con Memi", { emoji: "🎾" }))?.id).toBe("padel");
    expect(detectarDeporte(m("Partido con los primos", { emoji: "🍕" }))).toBeNull();
  });
  it("no confunde planes que MENCIONAN un deporte", () => {
    for (const t of ["Comidita CROSSFITEROS!", "Cumple mini Luca Box 1 añito", "Playita Box", "Cotizar Zapatillas y pala de padel", "Coordinar Partido Master Mixto", "Torneo pololo el finde"]) expect(detectarDeporte(m(t)), t).toBeNull();
  });
  it("los partidos de Mi Equipo (con escudo) se ven, no se juegan", () => {
    expect(detectarDeporte(m("Barça vs Madrid", { crest: "fcb", emoji: "⚽" }))).toBeNull();
  });
});

describe("eventosDeporte", () => {
  const weeks = { a: { missions: [
    m("Padel Masc Moli", { time: "20:30", endTime: "21:45" }),
    m("Padel Mixto", { who: "together", date: "2026-09-22", time: "21:00", duration: 75 }),
    m("Entreno box", { who: "person2" }),
    m("Gym", { status: "TBC", date: "2026-09-28" }),
    m("Padel futuro", { date: "2026-10-05" }),
  ] } };
  it("solo lo HECHO, hasta hoy, de esa persona o de los dos", () => {
    const e = eventosDeporte(weeks, "person1", "2026-09-29");
    expect(e.map(x => x.titulo)).toEqual(["Padel Mixto", "Padel Masc Moli"]);
    expect(eventosDeporte(weeks, "person2", "2026-09-29").map(x => x.titulo)).toEqual(["Padel Mixto", "Entreno box"]);
  });
  it("la duración sale de la hora de fin, de `duration` o de la típica del deporte", () => {
    const e = eventosDeporte(weeks, "person1", "2026-09-29");
    expect(e.find(x => x.titulo === "Padel Masc Moli").minutos).toBe(75);
    expect(eventosDeporte(weeks, "person2", "2026-09-29").find(x => x.titulo === "Entreno box").minutos).toBe(60);
  });
  it("un torneo de todo el día se acota a 3 h de juego", () => {
    const w = { a: { missions: [m("Torneo padel all included", { time: "09:00", endTime: "23:59" })] } };
    expect(eventosDeporte(w, "person1", "2026-09-29")[0].minutos).toBe(180);
  });
});

// Base: 30 días normales (7.000 pasos, 300 kcal, pulso 110) y el día del partido.
function historial(dia, hoyDia) {
  const f = [];
  for (let i = 1; i <= 30; i++) {
    const d = sumarDias(dia, -i);
    f.push({ day: d, metric: "step_count", value: 7000 }, { day: d, metric: "active_energy", value: 300, unit: "kcal" }, { day: d, metric: "heart_rate_max", value: 110 });
  }
  for (const [k, v] of Object.entries(hoyDia)) f.push({ day: dia, metric: k, value: v, unit: k === "active_energy" ? "kcal" : undefined });
  return f;
}
const evPadel = { id: "p", dia: "2026-09-29", inicio: 20 * 60 + 30, fin: 21 * 60 + 45, minutos: 75, deporte: "padel", titulo: "Padel" };

describe("evaluarDia: cuándo el reloj confirma el partido", () => {
  const evalua = hoyDia => {
    const filas = historial("2026-09-29", hoyDia);
    const dias = indexarDias(filas);
    return evaluarDia([evPadel], dias.get("2026-09-29"), lineaBase("2026-09-29", dias, new Set(["2026-09-29"])))[0];
  };
  it("pulso, energía y pasos altos → confirmado, con las kcal MEDIDAS", () => {
    const e = evalua({ step_count: 13000, active_energy: 1000, heart_rate_max: 190 });
    expect(e.nivel).toBe("confirmado");
    expect(e.kcalMedidas).toBe(700);
    expect(e.kcal).toBe(700);
    expect(e.cuenta).toBe(true);
  });
  it("lo medido se acota a ±50 % de la fórmula (un día con más cosas no se atribuye entero al partido)", () => {
    const e = evalua({ step_count: 13000, active_energy: 3000, heart_rate_max: 190 });
    const formula = KCAL_POR_PASO * 6000 + 379 * 1.25;
    expect(e.kcal).toBe(Math.round(formula * 1.5));
  });
  it("una sola señal → probable, con la fórmula", () => {
    const e = evalua({ step_count: 7100, active_energy: 320, heart_rate_max: 185 });
    expect(e.nivel).toBe("probable");
    expect(e.kcal).toBe(Math.round(KCAL_POR_PASO * 100 + 379 * 1.25));
  });
  it("llevando el reloj y sin ninguna señal → no coincide, no cuenta", () => {
    const e = evalua({ step_count: 6900, active_energy: 280, heart_rate_max: 111 });
    expect(e.nivel).toBe("no_coincide");
    expect(e.cuenta).toBe(false);
    expect(e.kcal).toBe(0);
  });
  it("sin pulso en todo el día (sin reloj) → cuenta, con una estimación", () => {
    const e = evalua({ step_count: 5000, active_energy: 200 });
    expect(e.nivel).toBe("sin_reloj");
    expect(e.cuenta).toBe(true);
    expect(e.kcal).toBe(Math.round(542 * 1.25));
  });
  it("los umbrales son los ajustados con el historial", () => {
    expect(UMBRAL).toEqual({ pulso: 160, kcal: 250, pasos: 2500 });
  });
  it("si el pico de pulso fue a OTRA hora, no cuenta como señal del partido", () => {
    const seg = (h, mi) => Math.floor(new Date(2026, 8, 29, h, mi).getTime() / 1000);
    const base = { step_count: 7100, active_energy: 320, heart_rate_max: 185 };
    expect(evalua({ ...base, hr_pico_desde: seg(7, 0), hr_pico_hasta: seg(9, 0) }).nivel).toBe("no_coincide");
    const bien = evalua({ ...base, hr_pico_desde: seg(20, 10), hr_pico_hasta: seg(23, 41) });
    expect(bien.nivel).toBe("probable");
    expect(bien.picoEnHora).toBe(true);
  });
  it("dos partidos el mismo día se reparten lo medido por duración", () => {
    const filas = historial("2026-09-29", { step_count: 16000, active_energy: 1300, heart_rate_max: 190 });
    const dias = indexarDias(filas);
    const r = evaluarDia([evPadel, { ...evPadel, id: "q", inicio: 18 * 60, fin: 18 * 60 + 75 }], dias.get("2026-09-29"), lineaBase("2026-09-29", dias, new Set(["2026-09-29"])));
    expect(r.map(x => x.kcalMedidas)).toEqual([500, 500]);
  });
  it("los kJ se convierten (el historial antiguo venía en kJ)", () => {
    const d = indexarDias([{ day: "2026-01-01", metric: "active_energy", value: 4184, unit: "kJ" }]);
    expect(d.get("2026-01-01").kcal).toBeCloseTo(1000);
  });
});

describe("entrenosDelCalendario", () => {
  const weeks = { a: { missions: [m("Padel Masc Moli", { time: "20:30", endTime: "21:45" }), m("Gym", { date: "2026-09-28", time: "19:45", endTime: "20:30" })] } };
  const filas = historial("2026-09-29", { step_count: 13000, active_energy: 1000, heart_rate_max: 190 });
  it("sale un entreno con hora local, minutos y kcal, que el motor cuenta", () => {
    const r = entrenosDelCalendario({ weeks, persona: "person1", filas, entrenos: [], hoy: "2026-09-29" });
    const w = r.entrenos.find(x => x.deporte === "padel");
    expect(w).toMatchObject({ start_at: "2026-09-29T20:30:00", end_at: "2026-09-29T21:45:00", minutes: 75, source: "calendario", nivel: "confirmado" });
    expect(indexar([], r.entrenos).get("2026-09-29").__workout_min).toBe(75);
  });
  it("si el reloj ya lo registró como entreno, no se cuenta dos veces", () => {
    const reloj = [{ start_at: new Date(2026, 8, 28, 19, 53).toISOString(), name: "Interior Ejecutar", minutes: 32 }];
    const r = entrenosDelCalendario({ weeks, persona: "person1", filas, entrenos: reloj, hoy: "2026-09-29" });
    expect(r.resumen.enReloj).toBe(1);
    expect(r.entrenos.some(x => x.deporte === "gym")).toBe(false);
  });
  it("sin persona (no se sabe quién mira) no inventa nada", () => {
    expect(entrenosDelCalendario({ weeks, persona: null, filas, hoy: "2026-09-29" }).entrenos).toEqual([]);
  });
});

describe("ventanaPico (servidor): en qué franja subió el pulso", () => {
  const ahora = Date.parse("2026-09-29T22:41:00Z") / 1000;
  it("si el máximo sube por encima del umbral, la franja va del envío anterior a este", () => {
    const v = ventanaPico({ value: 94, updated_at: "2026-09-29T18:10:00Z" }, 195, ahora);
    expect(v).toEqual({ desde: Date.parse("2026-09-29T18:10:00Z") / 1000, hasta: ahora });
  });
  it("sin pico nuevo, o por debajo del umbral, no hay franja", () => {
    expect(ventanaPico({ value: 195, updated_at: "2026-09-29T18:10:00Z" }, 190, ahora)).toBeNull();
    expect(ventanaPico({ value: 90, updated_at: "2026-09-29T18:10:00Z" }, PICO_UMBRAL - 1, ahora)).toBeNull();
  });
  it("primer envío del día: se sabe el final, no el principio", () => {
    expect(ventanaPico(null, 180, ahora)).toEqual({ desde: null, hasta: ahora });
  });
});

// Referencia REAL: sesiones de la app de Huawei (captura de Fran, 30/09/2026), en
// kcal ACTIVAS (total − basal de la duración). Si alguien toca la fórmula, esto
// dice si acierta más o menos que hoy (9 % de error mediano en los confirmados).
describe("calibración contra el reloj (sesiones reales de pádel)", () => {
  const base = { pasos: 7000, kcal: 300 };
  const casos = [
    // [Δkcal del día, Δpasos, pulso máx, kcal activas según Huawei]
    [1157, 6534, 195, 1083],
    [965, 5547, 191, 922],
    [530, 3467, 191, 598],
    [822, 7461, 185, 662],
  ];
  it("error mediano ≤ 12 % en los partidos confirmados", () => {
    const errores = casos.map(([dk, dp, hx, real]) => {
      const e = evaluarDia([evPadel], { kcal: base.kcal + dk, pasos: base.pasos + dp, pulsoMax: hx }, base)[0];
      expect(e.nivel).toBe("confirmado");
      return Math.abs(e.kcal - real) / real;
    }).sort((a, b) => a - b);
    expect((errores[1] + errores[2]) / 2).toBeLessThanOrEqual(0.12);
  });
});

describe("posiblesEntrenos: «¿hiciste deporte?»", () => {
  const dia = "2026-08-10";
  const filasCon = extra => historial(dia, extra);
  const weeks = { a: { missions: [] } };
  it("el tenis del 10/08 (170 lpm, +230 kcal, sin apuntar) se pregunta", () => {
    const r = posiblesEntrenos({ filas: filasCon({ step_count: 4842, active_energy: 485, heart_rate_max: 170 }), weeks, persona: "person1", hoy: "2026-08-12" });
    expect(r.map(x => x.dia)).toEqual([dia]);
    expect(r[0].pulsoMax).toBe(170);
  });
  it("un pulso de 165 sin nada más, no (evita avisos de más)", () => {
    expect(posiblesEntrenos({ filas: filasCon({ step_count: 7000, active_energy: 300, heart_rate_max: 165 }), weeks, persona: "person1", hoy: "2026-08-12" })).toEqual([]);
  });
  it("≥ 175 se pregunta aunque no haya más señales", () => {
    expect(posiblesEntrenos({ filas: filasCon({ step_count: 7000, active_energy: 300, heart_rate_max: 180 }), weeks, persona: "person1", hoy: "2026-08-12" })).toHaveLength(1);
  });
  it("si ya está apuntado, o dijiste que no, no se vuelve a preguntar", () => {
    const f = filasCon({ step_count: 4842, active_energy: 485, heart_rate_max: 170 });
    const conPadel = { a: { missions: [m("Padel", { date: dia })] } };
    expect(posiblesEntrenos({ filas: f, weeks: conPadel, persona: "person1", hoy: "2026-08-12" })).toEqual([]);
    expect(posiblesEntrenos({ filas: f, weeks, persona: "person1", hoy: "2026-08-12", descartados: [dia] })).toEqual([]);
  });
  it("con la franja del pico, sugiere la hora (cuarto siguiente al envío anterior)", () => {
    const seg = (h, mi) => Math.floor(new Date(2026, 7, 10, h, mi).getTime() / 1000);
    const r = posiblesEntrenos({ filas: filasCon({ step_count: 9000, active_energy: 700, heart_rate_max: 185, hr_pico_desde: seg(20, 10), hr_pico_hasta: seg(23, 41) }), weeks, persona: "person1", hoy: "2026-08-12" });
    expect(r[0].horaSugerida).toBe("20:15");
  });
  it("sin saber quién mira, nada", () => {
    expect(posiblesEntrenos({ filas: filasCon({ heart_rate_max: 190 }), weeks, persona: null, hoy: "2026-08-12" })).toEqual([]);
  });
});

describe("deportesHabituales", () => {
  it("el más apuntado primero", () => {
    const w = { a: { missions: [m("Gym", { date: "2026-09-01" }), m("Padel", { date: "2026-09-02" }), m("Padel", { date: "2026-09-03" })] } };
    expect(deportesHabituales(w, "person1", "2026-09-29")[0].id).toBe("padel");
  });
});
