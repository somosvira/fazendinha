import { describe, expect, it } from "vitest";
import { alternar, configuracaoPadrao, erroPeriodo, mesclarRascunho, periodoMes, podeGerar, resumoConfiguracao, secoesDoRelatorio } from "./relatorios";

const hoje = new Date(2026, 8, 14);

describe("configuração do relatório financeiro", () => {
  it("parte do mês fechado anterior, só com operações confirmadas", () => {
    expect(configuracaoPadrao(hoje)).toMatchObject({ nome: "Relatório financeiro — agosto/2026", dataInicio: "2026-08-01", dataFim: "2026-08-31", regime: "ambos", status: ["CONFIRMADA"], categoriaIds: [] });
    expect(periodoMes(new Date(2026, 0, 10), -1)).toEqual({ dataInicio: "2025-12-01", dataFim: "2025-12-31", nome: "dezembro/2025" });
  });

  it("mescla rascunho parcial e descarta valores fora do domínio", () => {
    const base = configuracaoPadrao(hoje);
    expect(mesclarRascunho({ nome: "Pecuária", status: ["RASCUNHO", "CANCELADA"] as string[], categoriaIds: [3, 0], regime: "outro" as never }, base))
      .toMatchObject({ nome: "Pecuária", status: ["CANCELADA"], categoriaIds: [3, 0], regime: "ambos", dataInicio: base.dataInicio });
    expect(mesclarRascunho(null, base)).toBe(base);
  });

  it("valida o período em conjunto", () => {
    expect(erroPeriodo({ dataInicio: "2026-09-10", dataFim: "2026-09-01" })).toMatch("anterior");
    expect(erroPeriodo({ dataInicio: "2026-09-01", dataFim: "" })).toMatch("Informe");
    expect(erroPeriodo({ dataInicio: "2024-01-01", dataFim: "2026-01-01" })).toMatch("24 meses");
    expect(erroPeriodo({ dataInicio: "2024-02-01", dataFim: "2026-01-31" })).toBeNull();
  });

  it("só permite gerar com nome e período válido", () => {
    const base = configuracaoPadrao(hoje);
    expect(podeGerar(base)).toBe(true);
    expect(podeGerar({ ...base, nome: " " })).toBe(false);
    expect(podeGerar({ ...base, dataFim: "2026-07-01" })).toBe(false);
  });

  it("alterna itens da multisseleção", () => {
    expect(alternar([1, 2], 2)).toEqual([1]);
    expect(alternar([1], 0)).toEqual([1, 0]);
  });

  it("resume o que entra no documento com os nomes dos cadastros", () => {
    const config = { ...configuracaoPadrao(hoje), tipos: ["SERVICO"], centroCustoIds: [0, 2], categoriaIds: [3], classificacoes: ["INVESTIMENTO" as const] };
    const resumo = Object.fromEntries(resumoConfiguracao(config, { categorias: [{ id: 3, nome: "Nutrição" }], centrosCusto: [{ id: 2, nome: "Agronomia" }], tipos: { SERVICO: "Serviço" } }));
    expect(resumo).toMatchObject({ Período: "01/08/2026 a 31/08/2026", Tipos: "Serviço", "Centros de custo": "Sem centro de custo, Agronomia", Categorias: "Nutrição", Classificação: "Investimento", Situação: "Confirmada" });
  });

  it("lista as seções conforme a leitura e avisa que o saldo não é filtrado", () => {
    const base = configuracaoPadrao(hoje);
    expect(secoesDoRelatorio({ ...base, regime: "previsto" })).not.toContain("Saldo das contas");
    expect(secoesDoRelatorio({ ...base, regime: "previsto" })).toContain("Compromissos a pagar e a receber em aberto");
    expect(secoesDoRelatorio({ ...base, regime: "realizado", status: [] })).toContain("Saldo das contas");
    expect(secoesDoRelatorio({ ...base, regime: "realizado", categoriaIds: [3] })).toContain("Saldo das contas (sempre sem filtros)");
  });
});
