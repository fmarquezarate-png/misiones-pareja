import { describe, it, expect } from "vitest";
import { TARJETAS, sanearPanel, PANEL_DEFECTO, tarjetasDisponibles, moverTarjeta, acotarMeta, nuevaVersionMetas, tarjetaDe, formatoDetalle } from "../lib/saludPanel.js";
import { METAS_POR_DEFECTO, simular, metasEn } from "../lib/pet.js";

describe("sanearPanel: la configuración guardada no es de fiar", () => {
  it("vacío o basura → valores por defecto", () => {
    expect(sanearPanel(undefined)).toEqual(PANEL_DEFECTO);
    expect(sanearPanel({ tarjetas: [], dias: 99, secciones: 5 })).toEqual(PANEL_DEFECTO);
    expect(sanearPanel({ tarjetas: "sueno" }).tarjetas).toEqual(PANEL_DEFECTO.tarjetas);
  });
  it("quita ids desconocidos y repetidos, conserva el orden", () => {
    expect(sanearPanel({ tarjetas: ["pasos", "nada", "sueno", "pasos"] }).tarjetas).toEqual(["pasos", "sueno"]);
  });
  it("periodo solo 7, 14 o 30; secciones apagables", () => {
    expect(sanearPanel({ dias: 14 }).dias).toBe(14);
    expect(sanearPanel({ dias: 10 }).dias).toBe(7);
    expect(sanearPanel({ secciones: { noche: false } }).secciones).toEqual({ metas: true, noche: false, entreno: true, deporte: true, tipos: true, estadisticas: true });
  });
  it("todas las tarjetas por defecto existen en el registro", () => {
    for (const id of PANEL_DEFECTO.tarjetas) expect(TARJETAS[id]).toBeTruthy();
  });
});

describe("tarjetas", () => {
  it("solo se ofrecen las que tienen datos; las fijas primero y luego cualquier otra métrica", () => {
    const dias = (metric, n, unit = null) => Array.from({ length: n }, (_, i) => ({ metric, day: `2026-09-${String(i + 1).padStart(2, "0")}`, value: 1, unit }));
    const filas = [...dias("sleep_asleep", 3), ...dias("weight_body_mass", 2), ...dias("flights_climbed", 9), ...dias("walking_speed", 6, "km/hr"), ...dias("vo2_max", 2), ...dias("hr_pico_hasta", 9)];
    // Genéricas: ≥ 5 días, ordenadas por cantidad; marcas internas (hr_pico_*) fuera.
    expect(tarjetasDisponibles(filas)).toEqual(["sueno", "peso", "m:flights_climbed", "m:walking_speed"]);
  });
  it("una tarjeta genérica sabe su nombre, icono, formato y dirección", () => {
    const t = tarjetaDe("m:walking_speed", { walking_speed: "km/hr" });
    expect(t.nombre).toBe("Velocidad al caminar");
    expect(t.mejorSi).toBe("sube");
    expect(formatoDetalle("m:walking_speed", { walking_speed: "km/hr" })(4.56)).toBe("4,6 km/hr");
    expect(tarjetaDe("m:wake_min").formato(445)).toBe("07:25");
    expect(tarjetaDe("m:step_count")).not.toBeNull();
    expect(tarjetaDe("nada")).toBeNull();
  });
  it("sanear acepta tarjetas genéricas válidas y quita las raras", () => {
    const p = sanearPanel({ tarjetas: ["sueno", "m:flights_climbed", "m:hr_pico_hasta", "m:step_count", "m:<script>", "inventada"] });
    expect(p.tarjetas).toEqual(["sueno", "m:flights_climbed"]);
  });
  it("mover arriba/abajo respeta los bordes", () => {
    expect(moverTarjeta(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moverTarjeta(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moverTarjeta(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
  it("cada tarjeta tiene formato, unidad larga y preguntas", () => {
    for (const t of Object.values(TARJETAS)) {
      expect(typeof t.formato(7.5)).toBe("string");
      expect(t.unidadLarga).toBeTruthy();
      expect(t.sugerencias.length).toBeGreaterThan(0);
    }
  });
});

describe("metas editables", () => {
  it("acota a límites razonables y a su paso", () => {
    expect(acotarMeta("pasos", 999999)).toBe(30000);
    expect(acotarMeta("pasos", 100)).toBe(2000);
    expect(acotarMeta("pasos", 8123)).toBe(8000);
    expect(acotarMeta("sueno", "7.3")).toBe(7.25);
    expect(acotarMeta("pasos", "abc")).toBeNull();
    expect(acotarMeta("desconocida", 5)).toBeNull();
  });
  it("una versión nueva guarda la anterior con su fecha y no muta nada", () => {
    const pet = { nacimiento: "2026-09-01", metas: METAS_POR_DEFECTO };
    const antes = JSON.stringify(pet);
    const r = nuevaVersionMetas(pet, { pasos: 10000 }, "2026-10-10");
    expect(JSON.stringify(pet)).toBe(antes);
    expect(r.metas.find(m => m.tipo === "pasos").objetivo).toBe(10000);
    expect(r.metasHistorial).toHaveLength(2);
    expect(metasEn(r.metasHistorial, "2026-09-15").find(m => m.tipo === "pasos").objetivo).toBe(8000);
    expect(metasEn(r.metasHistorial, "2026-10-10").find(m => m.tipo === "pasos").objetivo).toBe(10000);
  });
  it("varios retoques el mismo día = una sola versión", () => {
    let pet = { nacimiento: "2026-09-01", metas: METAS_POR_DEFECTO };
    pet = { ...pet, ...nuevaVersionMetas(pet, { pasos: 9000 }, "2026-10-10") };
    pet = { ...pet, ...nuevaVersionMetas(pet, { pasos: 9500 }, "2026-10-10") };
    expect(pet.metasHistorial).toHaveLength(2);
    expect(pet.metasHistorial.at(-1).metas.find(m => m.tipo === "pasos").objetivo).toBe(9500);
  });
  it("el motor acepta la versión guardada", () => {
    const pet = { nacimiento: "2026-09-01", metas: METAS_POR_DEFECTO };
    const r = nuevaVersionMetas(pet, { pasos: 12000 }, "2026-10-10");
    expect(() => simular({ nacimiento: pet.nacimiento, metas: r.metas, metasHistorial: r.metasHistorial, hoy: "2026-10-20" })).not.toThrow();
  });
});
