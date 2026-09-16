import { describe, it, expect } from "vitest";
import {
  esEnVivo, estadoEnVivo, marcadorEnVivo, pollDelay, RITMO,
  kickoffTs, cuentaAtras, ordenarEnVivo, dedupe, frescura, CADUCA_MS,
  proximaVentana, miPartidoEnVivo,
} from "../lib/live.js";

describe("esEnVivo / estadoEnVivo", () => {
  it("reconoce los estados de partido en curso", () => {
    expect(esEnVivo("IN_PLAY")).toBe(true);
    expect(esEnVivo("PAUSED")).toBe(true);
    expect(esEnVivo("FINISHED")).toBe(false);
    expect(esEnVivo("SCHEDULED")).toBe(false);
    expect(esEnVivo(undefined)).toBe(false);
  });

  it("el descanso se dice como descanso, no como 'en juego'", () => {
    const e = estadoEnVivo({ status: "PAUSED" });
    expect(e.vivo).toBe(true);
    expect(e.texto).toBe("Descanso");
    expect(e.pulso).toBe(false);      // parado: el punto no late
  });

  // El minuto solo llega en los planes de pago. Estimarlo desde la hora de
  // inicio sería inventarse un dato — la regla de CLAUDE.md §5.
  it("sin minuto publicado dice 'En juego', no un número inventado", () => {
    expect(estadoEnVivo({ status: "IN_PLAY" }).texto).toBe("En juego");
    expect(estadoEnVivo({ status: "IN_PLAY", minute: null }).texto).toBe("En juego");
  });

  it("con minuto publicado lo pinta", () => {
    expect(estadoEnVivo({ status: "IN_PLAY", minute: 67 }).texto).toBe("67'");
    expect(estadoEnVivo({ status: "IN_PLAY", minute: 0 }).texto).toBe("0'");
  });

  it("traduce los estados raros en vez de enseñar el código en inglés", () => {
    expect(estadoEnVivo({ status: "POSTPONED" }).texto).toBe("Aplazado");
    expect(estadoEnVivo({ status: "FINISHED" }).texto).toBe("Final");
    expect(estadoEnVivo({ status: "LO_QUE_SEA" }).texto).toBe("Por jugar");
  });
});

describe("marcadorEnVivo", () => {
  it("lee el marcador normalizado", () => {
    expect(marcadorEnVivo({ status: "IN_PLAY", ft: [2, 1] })).toEqual([2, 1]);
  });
  // Un partido en juego sin marcador publicado va 0-0: eso no es inventar.
  it("en juego sin marcador aún es 0-0", () => {
    expect(marcadorEnVivo({ status: "IN_PLAY", ft: null })).toEqual([0, 0]);
  });
  it("un partido no empezado no tiene marcador", () => {
    expect(marcadorEnVivo({ status: "SCHEDULED", ft: null })).toBeNull();
  });
  it("un 0-0 real se distingue de 'sin datos'", () => {
    expect(marcadorEnVivo({ status: "IN_PLAY", ft: [0, 0] })).toEqual([0, 0]);
  });
});

describe("pollDelay", () => {
  const ahora = Date.parse("2026-09-16T20:00:00");

  // Lo más importante: con la pestaña oculta NO se gasta cuota. Sin esto,
  // una PWA en segundo plano agota las 10 peticiones/minuto del plan.
  it("pestaña oculta = no sondear", () => {
    expect(pollDelay({ hayEnVivo: true, visible: false, ahora })).toBe(RITMO.dormido);
    expect(pollDelay({ hayEnVivo: true, visible: false, ahora })).toBe(0);
  });

  it("con algo en juego, el ritmo rápido", () => {
    expect(pollDelay({ hayEnVivo: true, visible: true, ahora })).toBe(RITMO.enVivo);
  });

  it("nada en juego y nada a la vista: ritmo de reposo", () => {
    expect(pollDelay({ hayEnVivo: false, proximoTs: null, ahora })).toBe(RITMO.reposo);
  });

  it("saque inicial cercano: ritmo intermedio", () => {
    const en10min = ahora + 10 * 60e3;
    expect(pollDelay({ hayEnVivo: false, proximoTs: en10min, ahora })).toBe(RITMO.inminente);
  });

  it("un partido dentro de tres horas todavía no acelera", () => {
    expect(pollDelay({ hayEnVivo: false, proximoTs: ahora + 3 * 3600e3, ahora })).toBe(RITMO.reposo);
  });

  // Justo tras el pitido inicial el estado tarda en propagarse: si se volviera
  // al ritmo de reposo se tardarían 5 minutos en ver que el partido empezó.
  it("recién empezado sigue en ritmo intermedio aunque aún no conste en vivo", () => {
    expect(pollDelay({ hayEnVivo: false, proximoTs: ahora - 5 * 60e3, ahora })).toBe(RITMO.inminente);
  });

  it("horas después del partido vuelve al reposo", () => {
    expect(pollDelay({ hayEnVivo: false, proximoTs: ahora - 5 * 3600e3, ahora })).toBe(RITMO.reposo);
  });

  it("nunca devuelve un ritmo por debajo del límite razonable", () => {
    for (const v of Object.values(RITMO)) expect(v === 0 || v >= 30e3).toBe(true);
  });
});

describe("kickoffTs", () => {
  it("combina fecha y hora en hora local", () => {
    const ts = kickoffTs({ date: "2026-09-16", time: "21:00" });
    const d = new Date(ts);
    expect(d.getHours()).toBe(21);
    expect(d.getDate()).toBe(16);
  });
  // `new Date("2026-09-16")` sería medianoche UTC y en husos negativos daría
  // el día anterior — está prohibido en el proyecto (CLAUDE.md §5).
  it("sin hora publicada usa medianoche LOCAL, no UTC", () => {
    const d = new Date(kickoffTs({ date: "2026-09-16" }));
    expect(d.getDate()).toBe(16);
    expect(d.getHours()).toBe(0);
  });
  it("sin fecha devuelve null", () => {
    expect(kickoffTs({})).toBeNull();
    expect(kickoffTs(null)).toBeNull();
    expect(kickoffTs({ date: "basura" })).toBeNull();
  });
});

describe("cuentaAtras", () => {
  const t0 = Date.parse("2026-09-16T12:00:00");
  it("minutos", () => {
    expect(cuentaAtras(t0 + 25 * 60e3, t0)).toBe("en 25 min");
  });
  it("horas y minutos", () => {
    expect(cuentaAtras(t0 + (2 * 60 + 15) * 60e3, t0)).toBe("en 2 h 15 min");
  });
  it("horas exactas sin el 'y 0 min'", () => {
    expect(cuentaAtras(t0 + 3 * 3600e3, t0)).toBe("en 3 h");
  });
  it("mañana y días", () => {
    expect(cuentaAtras(t0 + 26 * 3600e3, t0)).toBe("mañana");
    expect(cuentaAtras(t0 + 4 * 24 * 3600e3, t0)).toBe("en 4 días");
  });
  it("ya empezado", () => {
    expect(cuentaAtras(t0 - 60e3, t0)).toBe("empieza ya");
    expect(cuentaAtras(t0, t0)).toBe("empieza ya");
  });
  // Sin hora publicada no se finge precisión al minuto.
  it("sin hora publicada solo dice el día", () => {
    expect(cuentaAtras(t0 + 5 * 3600e3, t0, { conHora: false })).toBe("hoy");
  });
  it("sin fecha devuelve null en vez de un texto vacío", () => {
    expect(cuentaAtras(null, t0)).toBeNull();
  });
});

describe("ordenarEnVivo", () => {
  const partidos = [
    { home: "Villarreal", homeId: "villarreal", awayId: "sevilla", ft: [0, 0], status: "IN_PLAY" },
    { home: "Barcelona", homeId: "barcelona", awayId: "getafe", ft: [1, 0], status: "IN_PLAY" },
    { home: "Atletico", homeId: "atletico", awayId: "betis", ft: [3, 2], status: "IN_PLAY" },
  ];
  it("mi equipo siempre primero, aunque tenga menos goles", () => {
    expect(ordenarEnVivo(partidos, "barcelona")[0].homeId).toBe("barcelona");
  });
  it("el resto, por goles", () => {
    const r = ordenarEnVivo(partidos, "barcelona");
    expect(r.slice(1).map(m => m.homeId)).toEqual(["atletico", "villarreal"]);
  });
  it("sin equipo elegido no revienta", () => {
    expect(ordenarEnVivo(partidos, null)).toHaveLength(3);
  });
  it("no muta la lista original", () => {
    const orig = [...partidos];
    ordenarEnVivo(partidos, "barcelona");
    expect(partidos).toEqual(orig);
  });
});

describe("dedupe", () => {
  // El partido de mi equipo llega por las DOS consultas (equipo y liga):
  // sin esto saldría dos veces, uno debajo del otro.
  it("quita el partido repetido por id", () => {
    const r = dedupe([{ id: 7, home: "A" }, { id: 7, home: "A" }, { id: 8, home: "B" }]);
    expect(r).toHaveLength(2);
  });
  it("sin id, desempata por fecha y equipos", () => {
    const m = { date: "2026-09-16", home: "A", away: "B" };
    expect(dedupe([m, { ...m }])).toHaveLength(1);
  });
  it("dos partidos distintos el mismo día se conservan", () => {
    expect(dedupe([
      { date: "2026-09-16", home: "A", away: "B" },
      { date: "2026-09-16", home: "C", away: "D" },
    ])).toHaveLength(2);
  });
});

describe("proximaVentana", () => {
  const hoy = "2026-09-16";
  const a = (h, m = 0, s = 0) => Date.parse(`2026-09-16T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
  const partido = (time, status) => ({ date: hoy, time, status });

  it("dentro del partido: toca sondear", () => {
    const v = proximaVentana([partido("21:00", "SCHEDULED")], a(21, 30));
    expect(v.dentro).toBe(true);
    expect(v.esperaMs).toBe(RITMO.enVivo);
  });

  it("se abre 10 min antes del saque inicial", () => {
    expect(proximaVentana([partido("21:00")], a(20, 55)).dentro).toBe(true);
    expect(proximaVentana([partido("21:00")], a(20, 45)).dentro).toBe(false);
  });

  it("se cierra 2 h 45 después", () => {
    expect(proximaVentana([partido("21:00")], a(23, 30)).dentro).toBe(true);
    expect(proximaVentana([partido("21:00")], a(23, 50)).dentro).toBe(false);
  });

  // Lo importante del coste: en un día cualquiera el inicio NO pide nada.
  it("sin partidos cercanos duerme al máximo", () => {
    const v = proximaVentana([{ date: "2026-09-23", time: "21:00" }], a(12));
    expect(v.dentro).toBe(false);
    expect(v.esperaMs).toBe(60 * 60e3);
  });

  it("sin ningún partido tampoco sondea", () => {
    const v = proximaVentana([], a(12));
    expect(v).toMatchObject({ dentro: false, kickoffTs: null });
    expect(v.esperaMs).toBe(60 * 60e3);
  });

  it("despierta justo cuando se abre la ventana, no antes", () => {
    const v = proximaVentana([partido("21:00")], a(20, 30));
    expect(v.dentro).toBe(false);
    expect(v.esperaMs).toBe(20 * 60e3);   // 20:30 → 20:50
  });

  it("nunca despierta más de una vez por minuto", () => {
    const v = proximaVentana([partido("21:00")], a(20, 49, 30));
    expect(v.esperaMs).toBeGreaterThanOrEqual(60e3);
  });

  // Un partido ya jugado no debe reabrir la ventana cada vez que se mira.
  it("un partido terminado, aplazado o cancelado no abre ventana", () => {
    for (const st of ["FINISHED", "POSTPONED", "CANCELLED"]) {
      expect(proximaVentana([partido("21:00", st)], a(21, 30)).dentro).toBe(false);
    }
  });

  it("con varios partidos, se queda con el primero que venga", () => {
    const v = proximaVentana([
      { date: "2026-09-20", time: "21:00" },
      { date: "2026-09-17", time: "19:00" },
    ], a(12));
    expect(new Date(v.kickoffTs).getDate()).toBe(17);
  });

  it("un partido sin hora publicada no rompe el cálculo", () => {
    expect(() => proximaVentana([{ date: "2026-09-20" }], a(12))).not.toThrow();
  });
});

describe("miPartidoEnVivo", () => {
  const enJuego = { homeId: "barcelona", awayId: "getafe", status: "IN_PLAY", ft: [1, 0], id: 1 };

  it("encuentra el partido de mi equipo esté en `mine` o en `others`", () => {
    expect(miPartidoEnVivo({ source: "live", mine: [enJuego], others: [] }, "barcelona")).toBe(enJuego);
    expect(miPartidoEnVivo({ source: "live", mine: [], others: [enJuego] }, "barcelona")).toBe(enJuego);
  });

  it("ignora los partidos de otros equipos", () => {
    const ajeno = { homeId: "sevilla", awayId: "betis", status: "IN_PLAY", id: 2 };
    expect(miPartidoEnVivo({ source: "live", mine: [], others: [ajeno] }, "barcelona")).toBeNull();
  });

  // El corazón de la petición: el inicio solo cambia MIENTRAS se juega.
  it("un partido terminado ya no cuenta como en vivo", () => {
    const fin = { ...enJuego, status: "FINISHED" };
    expect(miPartidoEnVivo({ source: "live", mine: [fin], others: [] }, "barcelona")).toBeNull();
  });

  it("el descanso sigue contando", () => {
    const desc = { ...enJuego, status: "PAUSED" };
    expect(miPartidoEnVivo({ source: "live", mine: [desc], others: [] }, "barcelona")).toBe(desc);
  });

  it("sin conexión en vivo no se enseña nada", () => {
    expect(miPartidoEnVivo({ source: "none", mine: [], others: [] }, "barcelona")).toBeNull();
    expect(miPartidoEnVivo(null, "barcelona")).toBeNull();
  });

  it("sin equipo elegido no se enseña nada", () => {
    expect(miPartidoEnVivo({ source: "live", mine: [enJuego], others: [] }, null)).toBeNull();
  });
});

describe("frescura", () => {
  const ahora = Date.parse("2026-09-16T20:00:00");
  it("recién pedido", () => {
    expect(frescura(ahora - 3e3, ahora)).toEqual({ fresco: true, texto: "ahora mismo" });
  });
  it("segundos", () => {
    expect(frescura(ahora - 30e3, ahora).texto).toBe("hace 30 s");
  });
  // Pasado el umbral, el marcador puede haberse quedado atrás: se avisa en vez
  // de pintarlo como si fuera de ahora mismo.
  it("pasado el umbral deja de considerarse fresco", () => {
    expect(frescura(ahora - CADUCA_MS - 1e3, ahora).fresco).toBe(false);
    expect(frescura(ahora - 60e3, ahora).fresco).toBe(true);
  });
  it("sin dato nunca dice que es fresco", () => {
    expect(frescura(null, ahora)).toEqual({ fresco: false, texto: "sin datos" });
  });
});
