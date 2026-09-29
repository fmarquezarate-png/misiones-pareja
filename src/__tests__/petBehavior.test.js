import { describe, it, expect } from "vitest";
import {
  horarioSueno, estaDormida, decidirModo, planificarPaseo, animCaricia, rngConSemilla,
  RETRASO_MS, TRISTE_TRAS_MS, LIMITES, CICLOS, marchaDe, elegirSprite,
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

describe("planificarPaseo (v3: tramos rectos, ciclos enteros, zancada real)", () => {
  const todas = new Set(["feliz", "caminar_derecha", "caminar_izquierda", "caminar_frente", "caminar_atras"]);
  const caja = { ancho: 300, alto: 150 };
  const marcha = { cicloMs: 800, zancadaPx: 30 };
  const pasear = (n, semilla = 7) => {
    const rng = rngConSemilla(semilla);
    let pos = { x: 0.5, y: 0.6 }, dir = 1;
    const pasos = [];
    for (let i = 0; i < n; i++) {
      const p = planificarPaseo(pos, rng, caja, todas, dir, marcha);
      pasos.push({ desde: pos, ...p });
      pos = p.destino; dir = p.dir;
    }
    return pasos;
  };

  // El fallo de la v1: cruzaba en diagonal y el dibujo no cuadraba.
  it("nunca se mueve en diagonal", () => {
    for (const p of pasear(500)) {
      const cambiaX = p.destino.x !== p.desde.x, cambiaY = p.destino.y !== p.desde.y;
      expect(cambiaX && cambiaY).toBe(false);
    }
  });

  it("el sprite coincide SIEMPRE con el movimiento", () => {
    for (const p of pasear(500)) {
      if (p.destino.x > p.desde.x) expect(p.anim).toBe("caminar_derecha");
      else if (p.destino.x < p.desde.x) expect(p.anim).toBe("caminar_izquierda");
      else if (p.destino.y > p.desde.y) expect(p.anim).toBe("caminar_frente");
      else if (p.destino.y < p.desde.y) expect(p.anim).toBe("caminar_atras");
      else expect(p.anim).toMatch(/^caminar_(derecha|izquierda)$/);   // quieta, mirando hacia donde iba
    }
  });

  it("nunca se sale del hábitat", () => {
    for (const p of pasear(800, 3)) {
      expect(p.destino.x).toBeGreaterThanOrEqual(LIMITES.x[0] - 1e-9);
      expect(p.destino.x).toBeLessThanOrEqual(LIMITES.x[1] + 1e-9);
      expect(p.destino.y).toBeGreaterThanOrEqual(LIMITES.y[0] - 1e-9);
      expect(p.destino.y).toBeLessThanOrEqual(LIMITES.y[1] + 1e-9);
    }
  });

  // Inercia: en mitad del campo, rara vez se da la vuelta sin motivo. Los
  // giros en la pared son obligados ("llega y gira") y no cuentan.
  it("tiene inercia: en mitad del campo sigue hacia donde iba", () => {
    const pasos = pasear(2000, 11);
    let libres = 0, siguen = 0, dirAnterior = 1;
    for (const p of pasos) {
      if (p.destino.x === p.desde.x) continue;
      // Giro obligado: a menos de un tramo mínimo (0,1) de la pared.
      const minimo = (CICLOS.min * marcha.zancadaPx) / caja.ancho;
      const enPared = p.desde.x - LIMITES.x[0] < minimo - 1e-9 || LIMITES.x[1] - p.desde.x < minimo - 1e-9;
      if (!enPared) { libres++; if (p.dir === dirAnterior) siguen++; }
      dirAnterior = p.dir;
    }
    expect(siguen / libres).toBeGreaterThan(0.65);
  });

  it("anda sobre todo en horizontal", () => {
    const pasos = pasear(1000, 5).filter(p => p.ms > 0);
    const horiz = pasos.filter(p => p.destino.x !== p.desde.x).length;
    expect(horiz / pasos.length).toBeGreaterThan(0.7);
  });

  // Los pies no patinan: la velocidad es SIEMPRE zancada/ciclo, y cada tramo
  // dura ciclos ENTEROS (termina en la postura de pie, sin cortar el paso).
  it("velocidad = zancada por ciclo, en ciclos enteros", () => {
    for (const p of pasear(600, 13)) {
      if (!p.ms) continue;
      expect(p.ms).toBe(p.ciclos * marcha.cicloMs);
      const px = Math.abs(p.destino.x - p.desde.x) * caja.ancho + Math.abs(p.destino.y - p.desde.y) * caja.alto;
      expect(px / (p.ms / 1000)).toBeCloseTo(marcha.zancadaPx / (marcha.cicloMs / 1000), 6);
      expect(p.pausaMs).toBeGreaterThanOrEqual(500);
    }
  });
  it("un tramo son 2–4 ciclos: nunca de pared a pared", () => {
    for (const p of pasear(800, 17)) {
      if (p.destino.y === p.desde.y && p.ms) expect(p.ciclos).toBeLessThanOrEqual(CICLOS.max);
    }
  });
  it("con otra etapa (zancada distinta) la velocidad cambia con ella", () => {
    const rng = rngConSemilla(3);
    const lenta = planificarPaseo({ x: 0.2, y: 0.5 }, rng, caja, todas, 1, { cicloMs: 1000, zancadaPx: 20 });
    expect(lenta.ms % 1000).toBe(0);
  });

  // Fran: "está mucho rato celebrando y camina poco". Se MIDE el reparto.
  it("pasa la mayor parte del tiempo caminando", () => {
    const pasos = pasear(3000, 21);
    const andando = pasos.reduce((a, p) => a + p.ms, 0);
    const parada = pasos.reduce((a, p) => a + p.pausaMs, 0);
    expect(andando / (andando + parada)).toBeGreaterThan(0.6);
  });
  it("celebra solo de vez en cuando", () => {
    const pasos = pasear(3000, 22);
    const celebra = pasos.filter(p => p.pausa.tipo === "feliz").reduce((a, p) => a + p.pausaMs, 0);
    const total = pasos.reduce((a, p) => a + p.ms + p.pausaMs, 0);
    expect(celebra / total).toBeLessThan(0.12);
  });
  it("la pausa normal es quieta, no una celebración", () => {
    const tipos = pasear(1000, 23).map(p => p.pausa.tipo);
    expect(tipos.filter(x => x === "quieto").length / tipos.length).toBeGreaterThan(0.8);
  });

  it("sin sprites de caminar, usa lo que haya", () => {
    const p = planificarPaseo({ x: 0.5, y: 0.6 }, rngConSemilla(1), caja, new Set(["idle"]), 1, marcha);
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

describe("marchaDe", () => {
  it("el ciclo sale de frames/fps y la zancada del ancho del cuerpo", () => {
    const st = { anims: { caminar_derecha: { frames: 8, fps: 10 } }, cuerpo: { x0: 0.2, x1: 0.8 } };
    expect(marchaDe(st, 100)).toEqual({ cicloMs: 800, zancadaPx: 42 });
  });
  it("sin animación de caminar, valores por defecto", () => {
    expect(marchaDe({ anims: { idle: { frames: 4, fps: 6 } } }, 100).cicloMs).toBe(800);
  });
});

describe("elegirSprite: una sola decisión", () => {
  const anims = new Set(["feliz", "caminar_frente", "caminar_derecha", "alegria"]);
  it("dormir gana a un paseo que seguía activo", () => {
    expect(elegirSprite({ modo: "durmiendo", caricia: null, animId: "caminar_derecha", anims }).id).toBeNull();
  });
  it("la caricia gana a todo", () => {
    expect(elegirSprite({ modo: "libre", caricia: "alegria", animId: "caminar_derecha", anims }).id).toBe("alegria");
  });
  it("libre y sin paseo: de pie, no celebrando", () => {
    expect(elegirSprite({ modo: "libre", caricia: null, animId: null, anims })).toMatchObject({ id: "caminar_frente", quieto: true });
  });
  it("libre y paseando: la animación del paseo", () => {
    expect(elegirSprite({ modo: "libre", caricia: null, animId: "caminar_derecha", anims }).id).toBe("caminar_derecha");
  });
});
