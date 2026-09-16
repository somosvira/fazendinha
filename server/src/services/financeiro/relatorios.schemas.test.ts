import { describe, expect, it } from "vitest";
import { configuracaoRelatorioFinanceiroSchema, rascunhoRelatorioFinanceiroSchema } from "./relatorios.schemas.js";

const base = { nome: "Fluxo de maio", dataInicio: "2026-05-01", dataFim: "2026-05-31" };

describe("configuração de relatório financeiro", () => {
  it("aceita multisseleção de tipos, situação, centros, categorias e classificação", () => {
    expect(configuracaoRelatorioFinanceiroSchema.parse({
      ...base, regime: "realizado", tipos: ["COMPRA_ESTOQUE", "VENDA"], status: ["CONFIRMADA"],
      centroCustoIds: [0, 2], categoriaIds: [3, 3, 0], classificacoes: ["INVESTIMENTO", "SEM_CLASSIFICACAO"],
    })).toMatchObject({ regime: "realizado", tipos: ["COMPRA_ESTOQUE", "VENDA"], centroCustoIds: [0, 2], categoriaIds: [3, 0], classificacoes: ["INVESTIMENTO", "SEM_CLASSIFICACAO"] });
  });

  it("assume regime completo e dimensões livres por padrão", () => {
    expect(configuracaoRelatorioFinanceiroSchema.parse(base)).toMatchObject({ regime: "ambos", tipos: [], status: [], centroCustoIds: [], categoriaIds: [], classificacoes: [] });
  });

  it("recusa valores que não existem no domínio de operações", () => {
    expect(configuracaoRelatorioFinanceiroSchema.safeParse({ ...base, status: ["RASCUNHO"] }).success).toBe(false);
    expect(configuracaoRelatorioFinanceiroSchema.safeParse({ ...base, tipos: ["TRANSFERENCIA_FINANCEIRA"] }).success).toBe(false);
  });

  it("rejeita intervalo invertido, data inexistente e período acima do limite", () => {
    expect(configuracaoRelatorioFinanceiroSchema.safeParse({ ...base, dataInicio: "2026-06-01" }).success).toBe(false);
    expect(configuracaoRelatorioFinanceiroSchema.safeParse({ ...base, dataFim: "2026-02-30" }).success).toBe(false);
    expect(configuracaoRelatorioFinanceiroSchema.safeParse({ ...base, dataInicio: "2024-01-01", dataFim: "2026-01-31" }).success).toBe(false);
  });

  it("exige nome", () => {
    expect(configuracaoRelatorioFinanceiroSchema.safeParse({ ...base, nome: "  " }).success).toBe(false);
  });
});

describe("rascunho da configuração", () => {
  it("aceita configuração incompleta enquanto o usuário edita", () => {
    expect(rascunhoRelatorioFinanceiroSchema.safeParse({ nome: "", dataInicio: "2026-06-01", dataFim: "" }).success).toBe(true);
  });
});
