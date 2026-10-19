import { describe, expect, it } from "vitest";
import { deslocarCalendario } from "./calendario.calc.js";
describe("calendário comum de protocolos", () => {
  it("preserva data sanitária e instante efetivo de IATF sem inventar hora no legado", () => {
    expect(deslocarCalendario(new Date("2026-01-01"), 11, "DIAS", "DIA").toISOString()).toBe("2026-01-12T00:00:00.000Z");
    expect(deslocarCalendario(new Date("2026-01-02T14:10:00Z"), 11, "DIAS", "HORA").toISOString()).toBe("2026-01-13T14:10:00.000Z");
    expect(deslocarCalendario(new Date("2026-01-02T14:10:00Z"), 12.5, "HORAS", "HORA").toISOString()).toBe("2026-01-03T02:40:00.000Z");
  });
  it("recusa precisão horária em um planejamento que só conhece a data", () => {
    expect(() => deslocarCalendario(new Date("2026-01-01"), 0.5, "DIAS", "DIA")).toThrow("dias inteiros");
    expect(() => deslocarCalendario(new Date("2026-01-01"), 1, "HORAS", "DIA")).toThrow("dias inteiros");
  });
});
