import { describe, it, expect } from "vitest";
import { nudgeMessage, NUDGE_INTENTS } from "../lib/nudge.js";

const mission = { emoji: "🧹", title: "Limpiar la cocina" };

describe("nudgeMessage", () => {
  it("intent 'mine' pregunta si se encarga", () => {
    const m = nudgeMessage("mine", "Fran", mission);
    expect(m).toContain("Fran");
    expect(m).toContain("¿te encargas");
    expect(m).toContain("«Limpiar la cocina»");
    expect(m).toContain("🙏");
  });

  it("intent 'thanks' agradece", () => {
    expect(nudgeMessage("thanks", "Ana", mission)).toBe("Ana te agradece por 🧹 «Limpiar la cocina» 💜");
  });

  it("intent 'remind' recuerda", () => {
    expect(nudgeMessage("remind", "Fran", mission)).toBe("Fran te recuerda: 🧹 «Limpiar la cocina» ⏰");
  });

  it("intent desconocido cae en 'recuerda' (default seguro)", () => {
    expect(nudgeMessage("xxx", "Fran", mission)).toContain("te recuerda");
  });

  it("tolera nombre y misión faltantes sin romper", () => {
    const m = nudgeMessage("mine", "", {});
    expect(m).toContain("Tu pareja");
    expect(m).toContain("🎯"); // emoji por defecto
  });

  it("hay exactamente 3 intenciones con id/label/emoji", () => {
    expect(NUDGE_INTENTS).toHaveLength(3);
    for (const i of NUDGE_INTENTS) {
      expect(i.id && i.label && i.emoji).toBeTruthy();
    }
  });
});
