import { describe, expect, it } from "vitest";
import {
  entradaDeNovaOperacao,
  isNovaOperacaoFinanceira,
  isNovoRelatorioFinanceiro,
  isSubrotaFinanceira,
  URL_NOVA_OPERACAO,
  parseOperacaoFinanceiraId,
  parseContaFinanceiraId,
  parseRelatorioFinanceiroId,
  pathToTab,
  tabToPath,
} from "./router";

describe("roteamento da pecuária", () => {
  it("reconhece o detalhe de uma operação financeira", () => {
    expect(pathToTab("/financeiro/operacoes/42")).toBe("lancar");
    expect(parseOperacaoFinanceiraId("/financeiro/operacoes/42")).toBe(42);
    expect(parseOperacaoFinanceiraId("/financeiro/operacoes")).toBeNull();
  });
  it("marca as entradas de histórico criadas pelo atalho de nova operação", () => {
    expect(isNovaOperacaoFinanceira(URL_NOVA_OPERACAO)).toBe(true);
    expect(entradaDeNovaOperacao({ novaOperacao: true })).toBe(true);
    expect(entradaDeNovaOperacao(null)).toBe(false);
    expect(entradaDeNovaOperacao({ novaOperacao: "sim" })).toBe(false);
  });
  it("reconhece a página independente de nova operação", () => {
    expect(pathToTab("/financeiro/operacoes/nova")).toBe("lancar");
    expect(isNovaOperacaoFinanceira("/financeiro/operacoes/nova")).toBe(true);
    expect(parseOperacaoFinanceiraId("/financeiro/operacoes/nova")).toBeNull();
  });
  it("mantém novo relatório e detalhe de relatório na aba de relatórios", () => {
    expect(pathToTab("/financeiro/relatorios/novo")).toBe("relatorio");
    expect(isNovoRelatorioFinanceiro("/financeiro/relatorios/novo/")).toBe(true);
    expect(pathToTab("/financeiro/relatorios/12")).toBe("relatorio");
    expect(parseRelatorioFinanceiroId("/financeiro/relatorios/12")).toBe(12);
    expect(parseRelatorioFinanceiroId("/financeiro/relatorios/novo")).toBeNull();
    expect(parseRelatorioFinanceiroId("/financeiro/relatorios/0")).toBeNull();
  });
  it("preserva subpáginas financeiras só na aba dona delas", () => {
    expect(isSubrotaFinanceira("relatorio", "/financeiro/relatorios/novo")).toBe(true);
    expect(isSubrotaFinanceira("relatorio", "/financeiro/relatorios/3")).toBe(true);
    expect(isSubrotaFinanceira("lancar", "/financeiro/operacoes/nova")).toBe(true);
    expect(isSubrotaFinanceira("caixinha", "/financeiro/contas/2")).toBe(true);
    expect(isSubrotaFinanceira("dashboard", "/financeiro/relatorios/3")).toBe(false);
    expect(isSubrotaFinanceira("relatorio", "/financeiro/relatorios")).toBe(false);
  });
  it("publica contas e extratos como uma área financeira própria", () => {
    expect(tabToPath("caixinha")).toBe("/financeiro/contas");
    expect(pathToTab("/financeiro/contas")).toBe("caixinha");
    expect(pathToTab("/caixinha")).toBe("caixinha");
  });
  it("ancora relatórios no módulo financeiro e mantém endereços antigos compatíveis", () => {
    expect(tabToPath("relatorio")).toBe("/financeiro/relatorios");
    expect(pathToTab("/financeiro/relatorios")).toBe("relatorio");
    expect(pathToTab("/relatorios")).toBe("relatorio");
    expect(pathToTab("/relatorio")).toBe("relatorio");
  });
  it("converte a aba do rebanho v1 para o pathname canônico", () => {
    expect(tabToPath("pec-rebanho")).toBe("/pecuaria/rebanho");
    expect(pathToTab("/pecuaria/rebanho")).toBe("pec-rebanho");
    expect(pathToTab("/pecuaria")).toBe("pec-rebanho");
  });

  it("redireciona os endereços do módulo legado (rebanho/corte) para o rebanho v1", () => {
    expect(pathToTab("/rebanho")).toBe("pec-rebanho");
    expect(pathToTab("/rebanho/reproducao")).toBe("pec-rebanho");
    expect(pathToTab("/corte/lote")).toBe("pec-rebanho");
    expect(pathToTab("/pecuaria/lotes/pesagens")).toBe("pec-rebanho");
    expect(pathToTab("/pecuaria/reproducao")).toBe("pec-rebanho");
  });

  it("não transforma uma subrota desconhecida em uma aba válida", () => {
    expect(pathToTab("/equipe/admin")).toBeNull();
  });

  it("mantém filtros financeiros na aba financeira", () => {
    expect(pathToTab("/gastos")).toBe("gastos");
  });
});

it("reconhece URLs de contas e rejeita IDs inválidos", () => {
  expect(pathToTab("/financeiro/contas/21")).toBe("caixinha");
  expect(parseContaFinanceiraId("/financeiro/contas/21/")).toBe(21);
  expect(parseContaFinanceiraId("/financeiro/contas/0")).toBeNull();
  expect(parseContaFinanceiraId("/financeiro/contas/abc")).toBeNull();
});

it("redireciona a rota do assistente enquanto a feature está inativa", () => {
  expect(pathToTab("/ia")).toBe("dashboard");
});
