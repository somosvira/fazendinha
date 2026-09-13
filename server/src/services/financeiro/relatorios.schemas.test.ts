import { describe, expect, it } from "vitest";
import { configuracaoRelatorioFinanceiroSchema } from "./relatorios.schemas.js";

describe("configuração de relatório financeiro", () => {
  it("aceita múltiplos tipos, status e centros de custo", () => {
    expect(configuracaoRelatorioFinanceiroSchema.parse({
      nome: "Fluxo de maio", dataInicio: "2026-05-01", dataFim: "2026-05-31",
      tipos: ["COMPRA_ESTOQUE", "VENDA"], status: ["CONFIRMADA"], centroCustoIds: [1, 2],
    })).toMatchObject({ nome: "Fluxo de maio", tipos: ["COMPRA_ESTOQUE", "VENDA"] });
  });

  it("rejeita intervalo invertido", () => {
    expect(configuracaoRelatorioFinanceiroSchema.safeParse({ nome: "Fluxo", dataInicio: "2026-06-01", dataFim: "2026-05-31" }).success).toBe(false);
  });
});
