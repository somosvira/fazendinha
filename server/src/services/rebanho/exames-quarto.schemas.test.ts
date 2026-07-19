import { describe, it, expect } from "vitest";
import { registrarExameQuartoSchema } from "./exames-quarto.schemas.js";

describe("registrarExameQuartoSchema", () => {
  it("aceita uma passada CMT das 4 tetas", () => {
    const r = registrarExameQuartoSchema.safeParse({
      data: "2026-07-19",
      quartos: [
        { quarto: "AE", scoreCmt: "NEGATIVO" },
        { quarto: "AD", scoreCmt: "TRACOS" },
        { quarto: "PE", scoreCmt: "DUAS_CRUZES", ccs: 800 },
        { quarto: "PD", scoreCmt: "NEGATIVO" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("aceita um único quarto clínico", () => {
    const r = registrarExameQuartoSchema.safeParse({
      data: "2026-07-19",
      quartos: [{ quarto: "PE", clinica: true, severidade: "grave", resultadoCultivo: "S. aureus" }],
    });
    expect(r.success).toBe(true);
  });

  it("rejeita quarto repetido na mesma passada", () => {
    const r = registrarExameQuartoSchema.safeParse({
      data: "2026-07-19",
      quartos: [{ quarto: "PE", scoreCmt: "NEGATIVO" }, { quarto: "PE", scoreCmt: "TRES_CRUZES" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejeita data mal formatada e lista vazia", () => {
    expect(registrarExameQuartoSchema.safeParse({ data: "19/07/2026", quartos: [{ quarto: "AE" }] }).success).toBe(false);
    expect(registrarExameQuartoSchema.safeParse({ data: "2026-07-19", quartos: [] }).success).toBe(false);
  });

  it("rejeita quarto inválido e CCS acima do teto", () => {
    expect(registrarExameQuartoSchema.safeParse({ data: "2026-07-19", quartos: [{ quarto: "XX" }] }).success).toBe(false);
    expect(registrarExameQuartoSchema.safeParse({ data: "2026-07-19", quartos: [{ quarto: "AE", ccs: 99999 }] }).success).toBe(false);
  });
});
