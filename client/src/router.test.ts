import { describe, expect, it } from "vitest";
import {
  buildRotaWorklistRebanho,
  entradaDeNovaOperacao,
  isNovaOperacaoFinanceira,
  isNovoRelatorioFinanceiro,
  isSubrotaFinanceira,
  URL_NOVA_OPERACAO,
  parseOperacaoFinanceiraId,
  parseContaFinanceiraId,
  parseRelatorioFinanceiroId,
  parseRotaWorklistRebanho,
  pathToTab,
  tabToPath,
} from "./router";

describe("roteamento do estoque", () => {
  it("mapeia a aba estoque para /estoque e volta", () => {
    expect(tabToPath("estoque")).toBe("/estoque");
    expect(pathToTab("/estoque")).toBe("estoque");
  });
});

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
  it.each([
    ["reb-dashboard", "/pecuaria/dashboard"],
    ["reb-reproducao", "/pecuaria/reproducao"],
    ["reb-acasalamento", "/pecuaria/acasalamento"],
    ["reb-sanidade", "/pecuaria/sanidade"],
    ["cor-lote", "/pecuaria/lotes"],
    ["cor-pesagem", "/pecuaria/lotes/pesagens"],
  ] as const)("converte %s para o pathname canônico", (tab, path) => {
    expect(tabToPath(tab)).toBe(path);
    expect(pathToTab(path)).toBe(tab);
  });

  it.each([
    ["secagem-atrasada", "/pecuaria/reproducao?worklist=secagem-atrasada"],
    ["vazia-pos-pev", "/pecuaria/reproducao?worklist=vazia-pos-pev"],
    ["dg-pendente", "/pecuaria/reproducao?worklist=dg-pendente"],
    ["parto-proximo", "/pecuaria/reproducao?worklist=parto-proximo"],
    ["ccs-alta", "/pecuaria/sanidade?worklist=ccs-alta"],
  ] as const)("monta e interpreta a worklist %s", (chave, url) => {
    expect(buildRotaWorklistRebanho(chave)).toBe(url);
    const parsed = new URL(url, "https://rio-novo.test");
    expect(parseRotaWorklistRebanho(parsed.pathname, parsed.search)).toEqual({
      chave,
      tab: chave === "ccs-alta" ? "sanidade" : "reproducao",
    });
  });

  it("rejeita chave inválida e chave válida na aba errada", () => {
    expect(parseRotaWorklistRebanho("/rebanho/reproducao", "?worklist=desconhecida")).toBeNull();
    expect(parseRotaWorklistRebanho("/rebanho/sanidade", "?worklist=dg-pendente")).toBeNull();
    expect(parseRotaWorklistRebanho("/rebanho/reproducao", "?worklist=ccs-alta")).toBeNull();
    expect(buildRotaWorklistRebanho("ccs-alta", "reproducao")).toBeNull();
  });

  it("mantém os endereços antigos de rebanho e corte como aliases", () => {
    expect(pathToTab("/rebanho/reproducao")).toBe("reb-reproducao");
    expect(pathToTab("/corte/lote")).toBe("cor-lote");
  });

  it("não transforma uma subrota desconhecida em uma aba válida", () => {
    expect(pathToTab("/pecuaria/nao-existe")).toBeNull();
    expect(pathToTab("/equipe/admin")).toBeNull();
  });

  it("não confunde filtros financeiros com worklists do rebanho", () => {
    expect(parseRotaWorklistRebanho("/gastos", "?status=vencidas")).toBeNull();
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
