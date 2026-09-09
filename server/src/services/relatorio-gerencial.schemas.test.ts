import { describe, expect, it } from "vitest";
import { relatorioGerencialQuerySchema } from "./relatorio-gerencial.schemas.js";

describe("relatorioGerencialQuerySchema", () => {
  it("aceita período válido e assume regime ambos", () => {
    const r = relatorioGerencialQuerySchema.parse({ inicio: "2026-01-01", fim: "2026-03-31" });
    expect(r).toEqual({ inicio: "2026-01-01", fim: "2026-03-31", regime: "ambos" });
  });

  it("aceita os três regimes", () => {
    for (const regime of ["realizado", "previsto", "ambos"]) {
      expect(relatorioGerencialQuerySchema.parse({ inicio: "2026-01-01", fim: "2026-01-31", regime }).regime).toBe(regime);
    }
    expect(relatorioGerencialQuerySchema.safeParse({ inicio: "2026-01-01", fim: "2026-01-31", regime: "tudo" }).success).toBe(false);
  });

  it("exige as duas datas em YYYY-MM-DD", () => {
    expect(relatorioGerencialQuerySchema.safeParse({ inicio: "2026-01-01" }).success).toBe(false);
    expect(relatorioGerencialQuerySchema.safeParse({ inicio: "01/01/2026", fim: "2026-01-31" }).success).toBe(false);
  });

  it("recusa início depois do fim", () => {
    const r = relatorioGerencialQuerySchema.safeParse({ inicio: "2026-02-01", fim: "2026-01-31" });
    expect(r.success).toBe(false);
  });

  it("limita o período a 24 meses", () => {
    expect(relatorioGerencialQuerySchema.safeParse({ inicio: "2024-01-01", fim: "2025-12-31" }).success).toBe(true);
    expect(relatorioGerencialQuerySchema.safeParse({ inicio: "2024-01-01", fim: "2026-01-01" }).success).toBe(false);
  });
});
