import { describe, it, expect } from "vitest";
import { daysUntilMMDD, upcomingDates, daysUntilLabel } from "../lib/importantDates.js";

const today = new Date(2026, 7, 3); // 3 de agosto de 2026

describe("daysUntilMMDD", () => {
  it("hoy = 0", () => {
    expect(daysUntilMMDD("08-03", today)).toBe(0);
  });
  it("mañana = 1", () => {
    expect(daysUntilMMDD("08-04", today)).toBe(1);
  });
  it("una fecha ya pasada este año salta al próximo año", () => {
    expect(daysUntilMMDD("08-01", today)).toBe(363); // 2027-08-01
  });
  it("formato inválido → null", () => {
    expect(daysUntilMMDD("", today)).toBeNull();
    expect(daysUntilMMDD("99-99", today)).toBeNull();
    expect(daysUntilMMDD(undefined, today)).toBeNull();
  });
});

describe("upcomingDates", () => {
  it("incluye cumpleaños de la pareja con nombre", () => {
    const items = upcomingDates({ settings: { person1: "Fran", person1Birthday: "08-10" } }, today, 30);
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Cumpleaños de Fran");
    expect(items[0].daysUntil).toBe(7);
  });

  it("aniversario calcula los años en la próxima ocurrencia", () => {
    const items = upcomingDates({ settings: { anniversaryDate: "2020-08-15" } }, today, 30);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("anniversary");
    expect(items[0].years).toBe(6); // 2026 - 2020
    expect(items[0].daysUntil).toBe(12);
  });

  it("ordena por cercanía y respeta la ventana", () => {
    const items = upcomingDates({
      settings: { person1: "A", person1Birthday: "08-20", person2: "B", person2Birthday: "08-05" },
      birthdays: [{ id: "x", name: "Lejos", date: "12-25" }],
    }, today, 30);
    expect(items.map(i => i.label)).toEqual(["Cumpleaños de B", "Cumpleaños de A"]);
    // 12-25 queda fuera de la ventana de 30 días
    expect(items.find(i => i.label === "Lejos")).toBeUndefined();
  });

  it("mezcla array libre + settings", () => {
    const items = upcomingDates({
      settings: { anniversaryDate: "2021-08-04" },
      birthdays: [{ id: "y", name: "Mamá", emoji: "🎈", date: "08-06" }],
    }, today, 30);
    expect(items.map(i => i.kind)).toEqual(["anniversary", "birthday"]);
    expect(items[1].emoji).toBe("🎈");
  });

  it("sin datos → lista vacía", () => {
    expect(upcomingDates({}, today, 30)).toEqual([]);
    expect(upcomingDates(undefined, today, 30)).toEqual([]);
  });
});

describe("daysUntilLabel", () => {
  it("hoy / mañana / en N días", () => {
    expect(daysUntilLabel(0)).toBe("¡Hoy!");
    expect(daysUntilLabel(1)).toBe("Mañana");
    expect(daysUntilLabel(5)).toBe("En 5 días");
  });
});
