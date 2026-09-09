import { describe, it, expect } from "vitest";
import { humanDate, humanDateTime, parseLocalDate } from "../lib/dateLabel.js";

// Martes 8 de septiembre de 2026
const HOY = new Date(2026, 8, 8, 15, 30);

describe("parseLocalDate", () => {
  it("construye la fecha en LOCAL, no en UTC", () => {
    // new Date('2026-09-12') es medianoche UTC → en husos negativos cae al 11.
    const d = parseLocalDate("2026-09-12");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });

  it("rechaza lo que no es una fecha", () => {
    for (const bad of ["", null, undefined, "hoy", "12/09/2026", "2026-9-12", "2026-13-01", "2026-02-31"]) {
      expect(parseLocalDate(bad)).toBe(null);
    }
  });
});

describe("humanDate", () => {
  it("usa palabras para los días cercanos", () => {
    expect(humanDate("2026-09-08", HOY)).toBe("hoy");
    expect(humanDate("2026-09-09", HOY)).toBe("mañana");
    expect(humanDate("2026-09-07", HOY)).toBe("ayer");
  });

  it("dentro de la semana próxima basta el día: no repite el mes", () => {
    expect(humanDate("2026-09-11", HOY)).toBe("vie 11");
    expect(humanDate("2026-09-14", HOY)).toBe("lun 14");
  });

  it("más allá de una semana añade el mes", () => {
    expect(humanDate("2026-09-15", HOY)).toBe("mar 15 sep");
    expect(humanDate("2026-10-02", HOY)).toBe("vie 2 oct");
  });

  it("hacia atrás (más de un día) también lleva mes", () => {
    expect(humanDate("2026-09-01", HOY)).toBe("mar 1 sep");
  });

  it("otro año lleva el año y no el día de la semana", () => {
    expect(humanDate("2027-01-03", HOY)).toBe("3 ene 2027");
    expect(humanDate("2025-12-24", HOY)).toBe("24 dic 2025");
  });

  it("nunca se come el dato: si no puede formatear, devuelve lo que había", () => {
    expect(humanDate("no-es-fecha", HOY)).toBe("no-es-fecha");
    expect(humanDate(null, HOY)).toBe("");
  });

  it("cruza fin de mes y de año sin descuadrarse", () => {
    const finDeAnio = new Date(2026, 11, 31, 10, 0);
    expect(humanDate("2027-01-01", finDeAnio)).toBe("mañana");
    expect(humanDate("2026-12-30", finDeAnio)).toBe("ayer");
  });

  it("es estable en el mismo día sin importar la hora", () => {
    const manana = new Date(2026, 8, 8, 0, 1);
    const noche  = new Date(2026, 8, 8, 23, 59);
    expect(humanDate("2026-09-08", manana)).toBe("hoy");
    expect(humanDate("2026-09-08", noche)).toBe("hoy");
  });
});

describe("humanDateTime", () => {
  it("junta fecha y hora", () => {
    expect(humanDateTime("2026-09-09", "18:30", HOY)).toBe("mañana · 18:30");
  });
  it("sin hora, solo la fecha", () => {
    expect(humanDateTime("2026-09-09", null, HOY)).toBe("mañana");
    expect(humanDateTime("2026-09-09", "", HOY)).toBe("mañana");
  });
});
