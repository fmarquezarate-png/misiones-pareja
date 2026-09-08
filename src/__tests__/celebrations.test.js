import { describe, it, expect } from "vitest";
import { pushCelebration, shiftCelebration, mergeCongrat, celebrationKey, PRIORITY } from "../lib/celebrations.js";

const congrat = (before, after) => ({ kind: "congrat", payload: { beforePct: before, afterPct: after, delta: after - before, mission: { id: `m${after}` } } });
const juntos = (id) => ({ kind: "juntos", payload: { mission: { id } } });
const special = { kind: "special", payload: { type: "anniversary", years: 3 } };
const empty = { current: null, queue: [] };

describe("pushCelebration", () => {
  it("con la pantalla libre, muestra la que llega", () => {
    expect(pushCelebration(empty, congrat(0, 20)).current.kind).toBe("congrat");
  });

  it("dos avisos de progreso se FUSIONAN: la barra va del inicio original al nuevo total", () => {
    const s1 = pushCelebration(empty, congrat(10, 30));
    const s2 = pushCelebration(s1, congrat(30, 55));
    expect(s2.current.payload.beforePct).toBe(10);
    expect(s2.current.payload.afterPct).toBe(55);
    expect(s2.current.payload.delta).toBe(45);
    expect(s2.queue).toHaveLength(0);
  });

  it("la fusión mantiene la misma key → React no re-monta ni corta la animación", () => {
    const s1 = pushCelebration(empty, congrat(10, 30));
    const s2 = pushCelebration(s1, congrat(30, 55));
    expect(celebrationKey(s2.current)).toBe(celebrationKey(s1.current));
  });

  it("un 'juntos' desplaza a un aviso de progreso", () => {
    const s = pushCelebration(pushCelebration(empty, congrat(0, 20)), juntos("a"));
    expect(s.current.kind).toBe("juntos");
    expect(s.queue).toHaveLength(0);
  });

  it("con un 'juntos' en pantalla, el aviso de progreso se descarta (no se apila)", () => {
    const s1 = pushCelebration(empty, juntos("a"));
    const s2 = pushCelebration(s1, congrat(0, 20));
    expect(s2).toBe(s1);
  });

  it("dos 'juntos' se encolan, no se pisan", () => {
    const s = pushCelebration(pushCelebration(empty, juntos("a")), juntos("b"));
    expect(s.current.payload.mission.id).toBe("a");
    expect(s.queue).toHaveLength(1);
    expect(s.queue[0].payload.mission.id).toBe("b");
  });

  it("la cola tiene tope: marcar diez seguidas no encadena diez pantallas", () => {
    let s = pushCelebration(empty, juntos("a"));
    for (const id of ["b", "c", "d", "e"]) s = pushCelebration(s, juntos(id));
    expect(s.queue).toHaveLength(1);
  });

  it("el día especial interrumpe lo que haya y vacía la cola", () => {
    let s = pushCelebration(pushCelebration(empty, juntos("a")), juntos("b"));
    s = pushCelebration(s, special);
    expect(s.current.kind).toBe("special");
    expect(s.queue).toHaveLength(0);
  });

  it("nada interrumpe al día especial", () => {
    const s1 = pushCelebration(empty, special);
    expect(pushCelebration(s1, congrat(0, 20))).toBe(s1);
    expect(pushCelebration(s1, juntos("a"))).toBe(s1);
  });

  it("ignora entradas sin tipo", () => {
    expect(pushCelebration(empty, null)).toBe(empty);
    expect(pushCelebration(empty, {})).toBe(empty);
  });
});

describe("shiftCelebration", () => {
  it("pasa la siguiente de la cola al terminar", () => {
    const s = pushCelebration(pushCelebration(empty, juntos("a")), juntos("b"));
    const after = shiftCelebration(s);
    expect(after.current.payload.mission.id).toBe("b");
    expect(after.queue).toHaveLength(0);
  });

  it("con la cola vacía deja la pantalla libre", () => {
    expect(shiftCelebration(pushCelebration(empty, congrat(0, 20)))).toEqual(empty);
    expect(shiftCelebration()).toEqual(empty);
  });
});

describe("mergeCongrat", () => {
  it("conserva el punto de partida y recalcula el salto", () => {
    expect(mergeCongrat({ beforePct: 10, afterPct: 30 }, { beforePct: 30, afterPct: 62, delta: 32 }))
      .toMatchObject({ beforePct: 10, afterPct: 62, delta: 52 });
  });
});

describe("celebrationKey", () => {
  it("es estable por tipo salvo en 'juntos', que distingue por misión", () => {
    expect(celebrationKey(congrat(0, 20))).toBe("congrat");
    expect(celebrationKey(special)).toBe("special");
    expect(celebrationKey(juntos("a"))).not.toBe(celebrationKey(juntos("b")));
    expect(celebrationKey(null)).toBe(null);
  });
});

describe("PRIORITY", () => {
  it("ordena día especial > juntos > progreso", () => {
    expect(PRIORITY.special).toBeGreaterThan(PRIORITY.juntos);
    expect(PRIORITY.juntos).toBeGreaterThan(PRIORITY.congrat);
  });
});
