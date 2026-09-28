import { describe, it, expect } from "vitest";
import {
  horarioSueno, estaDormida, decidirModo, planificarPaseo, animCaricia, rngConSemilla,
  RETRASO_MS, TRISTE_TRAS_MS, LIMITES,
} from "../lib/petBehavior.js";

const noche = (day, wake, bed, horas = 7) => [
  { day, metric: "wake_min", value: wake },
  { day, metric: "bed_min", value: bed },
  { day, metric: "sleep_asleep", value: horas },
];
const a = (h, m = 0) => new Date(2026, 8, 28, h, m, 0);   // lunes 28/09/2026, hora LOCAL

describe("horarioSueno", () => {
  it("mediana de las últimas noches", () => {
    const f = [...noche("2026-09-25", 420, -30), ...noche("2026-09-26", 450, -10), ...noche("2026-09-27", 430, -20)];
    const h = horarioSueno(f, "2026-09-28");
    expect(h.despertarTipico).toBe(430);
    expect(h.acostarseTipico).toBe(-20);
    expect(h.despertarHoy).toBeNull();
  });
  it("si ya llegó la de hoy, la usa", () => {
    const f = [...noche("2026-09-27", 430, -20), ...noche("2026-09-28", 500, 0)];
    expect(horarioSueno(f, "2026-09-28").despertarHoy).toBe(500);
  });
  // Una siesta de 1 h a las 17:00 no es tu hora de despertar.
  it("las siestas y registros cortos no cuentan", () => {
    const f = [...noche("2026-09-27", 430, -20), ...noche("2026-09-26", 1020, 960, 1)];
    expect(horarioSueno(f, "2026-09-28").despertarTipico).toBe(430);
  });
  it("sin datos, un horario razonable por defecto", () => {
    const h = horarioSueno([], "2026-09-28");
    expect(h.despertarTipico).toBe(420);
    expect(h.noches).toBe(0);
  });
});

describe("dormir: 15 min detrás de ti", () => {
  const h = { despertarTipico: 7 * 60, acostarseTipico: -30, despertarHoy: null };   // 7:00 y 23:30
  it("sigue dormida hasta 15 min después de que te despiertes", () => {
    expect(estaDormida(7 * 60 + 10, h)).toBe(true);
    expect(estaDormida(7 * 60 + 16, h)).toBe(false);
  });
  it("se duerme 15 min después que tú", () => {
    expect(estaDormida(23 * 60 + 40, h)).toBe(false);
    expect(estaDormida(23 * 60 + 46, h)).toBe(true);
  });
  it("si hoy te despertaste tarde, ella también", () => {
    expect(estaDormida(8 * 60 + 30, { ...h, despertarHoy: 8 * 60 + 20 })).toBe(true);
    expect(estaDormida(8 * 60 + 36, { ...h, despertarHoy: 8 * 60 + 20 })).toBe(false);
  });
  it("si te acuestas pasada la medianoche", () => {
    const tarde = { despertarTipico: 9 * 60, acostarseTipico: 90, despertarHoy: null };     // 1:30 → 9:00
    expect(estaDormida(60, tarde)).toBe(false);           // 1:00: aún despierta
    expect(estaDormida(110, tarde)).toBe(true);           // 1:50
    expect(estaDormida(23 * 60, tarde)).toBe(false);      // 23:00: despierta
  });
});

describe("decidirModo", () => {
  const horario = { despertarTipico: 7 * 60, acostarseTipico: -30, despertarHoy: null };
  const entreno = { name: "Pádel", start_at: "2026-09-28T18:00:00+02:00", end_at: "2026-09-28T19:30:00+02:00" };
  // Las fechas ISO de arriba van en +02:00; el reloj de los tests, en local.
  // Se construye el "ahora" desde el propio instante del entreno para no
  // depender del huso de la máquina que ejecute los tests.
  const en = (iso, deltaMin) => new Date(Date.parse(iso) + deltaMin * 60e3);

  it("entrena mientras tú entrenas…", () => {
    expect(decidirModo({ ahora: en(entreno.start_at, 30), horario, entrenos: [entreno] }).modo).toBe("entrenando");
  });
  it("…y termina 15 min después que tú", () => {
    expect(decidirModo({ ahora: en(entreno.end_at, 14), horario, entrenos: [entreno] }).modo).toBe("entrenando");
    expect(decidirModo({ ahora: en(entreno.end_at, 16), horario: { ...horario, acostarseTipico: -1 }, entrenos: [entreno] }).modo).not.toBe("entrenando");
  });
  // El entreno llega con la sincronización, tarde: entrena 15 min desde que se entera.
  it("si se entera tarde, entrena 15 min desde ese momento", () => {
    const visto = Date.parse(entreno.end_at) + 40 * 60e3;
    const vistos = { [`${entreno.start_at}|${entreno.name}`]: visto };
    expect(decidirModo({ ahora: new Date(visto + 10 * 60e3), horario, entrenos: [entreno], vistos }).modo).toBe("entrenando");
    expect(decidirModo({ ahora: new Date(visto + 20 * 60e3), horario, entrenos: [entreno], vistos }).modo).not.toBe("entrenando");
  });
  it("de madrugada duerme, y dice cuándo despierta", () => {
    const r = decidirModo({ ahora: a(3), horario });
    expect(r.modo).toBe("durmiendo");
    expect(r.motivo).toContain("07:15");
  });
  // Regla de Fran: triste SOLO por falta de cariño.
  it("dos días sin caricias → triste", () => {
    const ahora = a(12);
    expect(decidirModo({ ahora, horario, ultimaCaricia: ahora.getTime() - TRISTE_TRAS_MS - 60e3 }).modo).toBe("triste");
    expect(decidirModo({ ahora, horario, ultimaCaricia: ahora.getTime() - 3600e3 }).modo).toBe("libre");
  });
  it("dormida no está triste (duerme)", () => {
    const ahora = a(3);
    expect(decidirModo({ ahora, horario, ultimaCaricia: 0 }).modo).toBe("durmiendo");
  });
  it("de día y querida: pasea", () => {
    expect(decidirModo({ ahora: a(12), horario, ultimaCaricia: a(11).getTime() }).modo).toBe("libre");
  });
  it("sin caricias registradas aún, no está triste", () => {
    expect(decidirModo({ ahora: a(12), horario, ultimaCaricia: null }).modo).toBe("libre");
  });
  it("el retraso es de 15 minutos", () => {
    expect(RETRASO_MS).toBe(15 * 60e3);
  });
});

describe("planificarPaseo", () => {
  const todas = new Set(["feliz", "caminar_derecha", "caminar_izquierda", "caminar_frente", "caminar_atras"]);
  const caja = { ancho: 360, alto: 220 };

  it("el sprite de caminar sigue la dirección VISUAL del movimiento", () => {
    const rng = rngConSemilla(7);
    for (let i = 0; i < 200; i++) {
      const pos = { x: rng(), y: 0.3 + rng() * 0.5 };
      const p = planificarPaseo(pos, rng, caja, todas);
      if (p.ms === 0) continue;
      const dx = (p.destino.x - pos.x) * caja.ancho, dy = (p.destino.y - pos.y) * caja.alto;
      const esperado = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "caminar_derecha" : "caminar_izquierda") : (dy >= 0 ? "caminar_frente" : "caminar_atras");
      expect(p.anim).toBe(esperado);
    }
  });
  it("nunca se sale del hábitat", () => {
    const rng = rngConSemilla(3);
    for (let i = 0; i < 300; i++) {
      const { destino } = planificarPaseo({ x: 0.5, y: 0.5 }, rng, caja, todas);
      expect(destino.x).toBeGreaterThanOrEqual(LIMITES.x[0]);
      expect(destino.x).toBeLessThanOrEqual(LIMITES.x[1]);
      expect(destino.y).toBeGreaterThanOrEqual(LIMITES.y[0]);
      expect(destino.y).toBeLessThanOrEqual(LIMITES.y[1]);
    }
  });
  it("la duración sale de la distancia: no se teletransporta", () => {
    const rng = rngConSemilla(11);
    for (let i = 0; i < 50; i++) {
      const p = planificarPaseo({ x: 0.5, y: 0.5 }, rng, caja, todas);
      if (p.ms) expect(p.ms).toBeGreaterThan(100);
      expect(p.pausaMs).toBeGreaterThanOrEqual(1500);
    }
  });
  // Etapas sin sprites de caminar (el huevo): no se rompe, se queda en idle.
  it("sin sprites de caminar, usa lo que haya", () => {
    const p = planificarPaseo({ x: 0.5, y: 0.5 }, rngConSemilla(1), caja, new Set(["idle"]));
    expect(p.anim).toBe("idle");
  });
});

describe("animCaricia", () => {
  it("elige la más alegre que tenga la etapa", () => {
    expect(animCaricia(new Set(["feliz", "alegria", "triste"]))).toBe("alegria");
    expect(animCaricia(new Set(["feliz", "triste"]))).toBe("feliz");
    expect(animCaricia(new Set(["idle"]))).toBe("idle");
  });
});
