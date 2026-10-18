import { describe, expect, it } from "vitest";
import { normalizarConsulta, hojeBrasil } from "./consulta.schema.js";
const base = { assunto: "resumo", inicio: null, fim: null, compararInicio: null, compararFim: null, categoria: null };

describe("recortes do assistente", () => {
  it("usa a data brasileira e mês até hoje", () => {
    expect(hojeBrasil(new Date("2026-10-01T01:00:00Z"))).toBe("2026-09-30");
    expect(normalizarConsulta(base, "2026-09-30")).toMatchObject({ inicio: "2026-09-01", fim: "2026-09-30" });
  });
  it("pendência sem período cobre todos os vencimentos", () => {
    expect(normalizarConsulta({ ...base, assunto: "pagar" }).inicio).toBeNull();
  });
  it.each([
    { inicio: "2026-02-30", fim: "2026-03-01" },
    { inicio: "2026-03-01", fim: null },
    { inicio: "2026-03-02", fim: "2026-03-01" },
    { inicio: "2020-01-01", fim: "2026-03-01" },
    { compararInicio: "2026-03-01" },
    { assunto: "pagar", compararInicio: "2026-02-01", compararFim: "2026-02-28" },
    { assunto: "saldos", inicio: "2026-02-01", fim: "2026-02-28" },
    { categoria: "Ração" },
    { sql: "SELECT 1" },
  ])("recusa recorte inválido ou não suportado: %j", alteracao => {
    expect(() => normalizarConsulta({ ...base, ...alteracao })).toThrow();
  });
});
