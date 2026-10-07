import { describe, expect, it } from "vitest";
import { estimativaConferida, somarEstimativas } from "./conferencia.calc";
describe("estimativas da conferência", () => {
  it("recalcula MS e custo proporcional à quantidade conferida com centavos", () => {
    expect(estimativaConferida("297", "330", "320", 3)).toBe("288.000");
    expect(estimativaConferida("660.00", "330", "320", 2)).toBe("640.00");
    expect(estimativaConferida("0.05", "3", "1", 2)).toBe("0.02");
    expect(estimativaConferida("1e-7", "0.001", "1e2", 3)).toBe("0.010");
    expect(estimativaConferida("0.05", "1", ".5", 2)).toBe("0.03");
  });
  it("mantém ausência, distingue zero conferido e soma apenas parcelas conhecidas", () => {
    expect(estimativaConferida(null, "330", "320", 2)).toBeNull();
    expect(estimativaConferida(null, "330", "0", 2)).toBe("0.00");
    expect(estimativaConferida("1", "330", "", 2)).toBeNull();
    expect(somarEstimativas(["0.01", null, "0.02"], 2)).toBe("0.03");
  });
});
