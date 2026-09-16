import { describe, it, expect } from "vitest";
import {
  interpretVersion, interpretTeam, interpretProbe, interpretDatos,
  interpretCalendario, diasDeRetraso, resumen, clearFootballCache,
  PASOS, OK, AVISO, FALLO,
} from "../lib/teamDiagnostics.js";

describe("interpretVersion", () => {
  it("coincide → todo bien", () => {
    expect(interpretVersion("5.34.0", "5.34.0").estado).toBe(OK);
  });

  // El caso que más veces produce "lo hice todo y no veo nada": la PWA sigue
  // ejecutando el bundle viejo aunque el despliegue haya ido bien.
  it("distinta → fallo con acción de actualizar", () => {
    const r = interpretVersion("5.31.0", "5.34.0");
    expect(r.estado).toBe(FALLO);
    expect(r.accion).toBe("actualizar");
    expect(r.detalle).toContain("5.31.0");
    expect(r.detalle).toContain("5.34.0");
  });

  it("sin respuesta del servidor avisa pero no acusa", () => {
    expect(interpretVersion("5.34.0", null).estado).toBe(AVISO);
  });
});

describe("interpretTeam", () => {
  it("sin equipo es un fallo accionable", () => {
    const r = interpretTeam(null);
    expect(r.estado).toBe(FALLO);
    expect(r.accion).toBe("elegir-equipo");
  });
  it("con equipo dice cuál", () => {
    const r = interpretTeam({ short: "Barça", league: "es.1" });
    expect(r.estado).toBe(OK);
    expect(r.detalle).toContain("Barça");
  });
});

describe("interpretProbe", () => {
  it("sin respuesta → no desplegada", () => {
    expect(interpretProbe({ fallo: "red" })).toMatchObject({ estado: FALLO, accion: "desplegar" });
    expect(interpretProbe(null).estado).toBe(FALLO);
  });

  it("desplegada sin clave manda a poner el secreto", () => {
    const r = interpretProbe({ data: { error: "sin_clave" } });
    expect(r.estado).toBe(FALLO);
    expect(r.accion).toBe("clave");
  });

  it("código antiguo se distingue de código roto", () => {
    const r = interpretProbe({ data: { error: "accion_desconocida" } });
    expect(r.estado).toBe(AVISO);          // funciona, solo está desactualizada
    expect(r.accion).toBe("desplegar");
  });

  it("todo bien de punta a punta", () => {
    const r = interpretProbe({ data: { ok: true, hasKey: true, upstream: { probado: true, ok: true, status: 200 } } });
    expect(r.estado).toBe(OK);
  });

  // El caso invisible hasta ahora: la clave está, pero caducada. Sin este
  // diagnóstico era indistinguible de "la función no existe".
  it("clave rechazada por football-data pide clave nueva", () => {
    const r = interpretProbe({ data: { ok: true, hasKey: true, upstream: { probado: true, ok: false, status: 403 } } });
    expect(r.estado).toBe(FALLO);
    expect(r.accion).toBe("clave-nueva");
    expect(r.detalle).toMatch(/caducada|rechaza/i);
  });

  it("rate limit es temporal, no un fallo que arreglar", () => {
    const r = interpretProbe({ data: { ok: true, hasKey: true, upstream: { probado: true, ok: false, status: 429 } } });
    expect(r.estado).toBe(AVISO);
    expect(r.accion).toBeUndefined();
  });
});

describe("diasDeRetraso", () => {
  it("cuenta días de calendario", () => {
    expect(diasDeRetraso("2026-09-07", "2026-09-15")).toBe(8);
    expect(diasDeRetraso("2026-09-15", "2026-09-15")).toBe(0);
  });
  // Cruce de mes y de año: la resta ingenua de números falla aquí.
  it("cruza meses y años", () => {
    expect(diasDeRetraso("2026-08-31", "2026-09-01")).toBe(1);
    expect(diasDeRetraso("2025-12-31", "2026-01-01")).toBe(1);
  });
  it("sin fecha devuelve null en vez de inventar", () => {
    expect(diasDeRetraso(null, "2026-09-15")).toBeNull();
  });
});

describe("interpretDatos", () => {
  it("en vivo es correcto", () => {
    expect(interpretDatos({ source: "live" }, "2026-09-16").estado).toBe(OK);
  });
  it("respaldo cuantifica el retraso", () => {
    const r = interpretDatos({ source: "openfootball", staleUntil: "2026-09-07" }, "2026-09-16");
    expect(r.estado).toBe(FALLO);
    expect(r.detalle).toContain("9 días");
  });
  it("un solo día se dice en singular", () => {
    const r = interpretDatos({ source: "openfootball", staleUntil: "2026-09-15" }, "2026-09-16");
    expect(r.detalle).toContain("1 día");
    expect(r.detalle).not.toContain("1 días");
  });
  it("sin ninguna fuente", () => {
    expect(interpretDatos({ source: "none" }, "2026-09-16").accion).toBe("reintentar");
  });
});

describe("interpretCalendario", () => {
  it("con el aviso apagado lo dice", () => {
    const r = interpretCalendario({ autoSuggest: false, enCalendario: 2, disponibles: 5 });
    expect(r.estado).toBe(AVISO);
    expect(r.detalle).toContain("2");
  });
  it("hay partidos y ninguno añadido → propone ir a añadirlos", () => {
    const r = interpretCalendario({ autoSuggest: true, enCalendario: 0, disponibles: 5 });
    expect(r.accion).toBe("ir-partidos");
  });
  it("con partidos añadidos, correcto", () => {
    expect(interpretCalendario({ autoSuggest: true, enCalendario: 3, disponibles: 5 }).estado).toBe(OK);
  });
});

describe("resumen", () => {
  it("prioriza los fallos sobre los avisos", () => {
    const r = resumen([{ estado: OK }, { estado: AVISO }, { estado: FALLO }, { estado: FALLO }]);
    expect(r.estado).toBe(FALLO);
    expect(r.texto).toContain("2");
  });
  it("un solo fallo se dice en singular", () => {
    expect(resumen([{ estado: FALLO }]).texto).toContain("1 cosa que arreglar");
  });
  it("solo avisos no alarma", () => {
    expect(resumen([{ estado: OK }, { estado: AVISO }]).estado).toBe(AVISO);
  });
  it("todo bien", () => {
    expect(resumen([{ estado: OK }]).estado).toBe(OK);
  });
  it("sin checks no revienta", () => {
    expect(resumen().estado).toBe(OK);
  });
});

describe("PASOS", () => {
  // Si una interpretación devuelve una acción sin texto, la UI enseñaría un
  // hueco justo cuando más falta hace saber qué hacer.
  it("toda acción devuelta por las interpretaciones tiene instrucciones", () => {
    const acciones = [
      interpretVersion("1.0.0", "2.0.0"),
      interpretTeam(null),
      interpretProbe({ fallo: "red" }),
      interpretProbe({ data: { error: "sin_clave" } }),
      interpretProbe({ data: { error: "accion_desconocida" } }),
      interpretProbe({ data: { ok: true, upstream: { probado: true, ok: false, status: 403 } } }),
      interpretDatos({ source: "openfootball", staleUntil: "2026-09-01" }, "2026-09-16"),
      interpretDatos({ source: "none" }, "2026-09-16"),
      interpretCalendario({ autoSuggest: true, enCalendario: 0, disponibles: 3 }),
    ].map(r => r.accion).filter(Boolean);
    expect(acciones.length).toBeGreaterThan(5);
    for (const a of acciones) expect(PASOS[a], `falta el texto de "${a}"`).toBeTruthy();
  });

  it("ningún paso menciona una terminal ni un comando", () => {
    // Regla de CLAUDE.md §5 (16/09): el usuario no tiene terminal.
    for (const [k, txt] of Object.entries(PASOS)) {
      expect(txt.toLowerCase(), k).not.toMatch(/terminal|npm install|supabase functions deploy|\bcli\b/);
    }
  });
});

describe("clearFootballCache", () => {
  it("borra solo las claves de fútbol", () => {
    const store = new Map([
      ["mp-fapi-st-es.1", "x"], ["mp-fapi-tm-barcelona", "y"],
      ["mp-data-backup", "no tocar"], ["theme", "no tocar"],
    ]);
    const fake = {
      get length() { return store.size; },
      key: i => [...store.keys()][i],
      removeItem: k => store.delete(k),
    };
    expect(clearFootballCache(fake)).toBe(2);
    expect([...store.keys()].sort()).toEqual(["mp-data-backup", "theme"]);
  });

  it("no revienta si el almacenamiento lanza (modo privado)", () => {
    const roto = { get length() { throw new Error("denied"); } };
    expect(() => clearFootballCache(roto)).not.toThrow();
  });
});
