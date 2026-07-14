import { describe, it, expect } from "vitest";
import { traduzir, whereComPeriodo, mesclarSelect } from "./tradutor.js";
import { validarConsulta } from "./validacao.js";
import { financeiro } from "./registro/financeiro.js";
import { obterDominio } from "./registro/index.js";
import type { ConsultaEntidade } from "./tipos.js";

const lancamento = financeiro.entidades.lancamento;
const consulta = (input: unknown): ConsultaEntidade =>
  validarConsulta(financeiro, input, obterDominio) as ConsultaEntidade;

describe("traduzir", () => {
  it("regime default aplica o regime de caixa implícito (LIQUIDADO + estornado=false)", () => {
    const plano = traduzir(
      lancamento,
      consulta({ entidade: "lancamento", metricas: ["valorTotal"], filtros: [{ dimensao: "natureza", operador: "igual", valor: "DEBITO" }] }),
      { propriedadeId: null },
    );
    expect(plano.whereBase).toEqual({ situacao: "LIQUIDADO", estornado: false, AND: [{ natureza: "DEBITO" }] });
    expect(plano.campoData).toBe("dataLiquidacao");
  });

  it("regime a_vencer troca para ABERTO por dataVencimento", () => {
    const plano = traduzir(
      lancamento,
      consulta({ entidade: "lancamento", regime: "a_vencer", metricas: ["valorTotal"], filtros: [{ dimensao: "natureza", operador: "igual", valor: "DEBITO" }] }),
      { propriedadeId: null },
    );
    expect(plano.whereBase).toEqual({ situacao: "ABERTO", estornado: false, AND: [{ natureza: "DEBITO" }] });
    expect(plano.campoData).toBe("dataVencimento");
  });

  it("propriedadeId entra pelo CONTEXTO, nunca pelo input", () => {
    const c = consulta({ entidade: "lancamento", metricas: ["valorTotal"], filtros: [{ dimensao: "natureza", operador: "igual", valor: "DEBITO" }] });
    const plano = traduzir(lancamento, c, { propriedadeId: 3 });
    expect(plano.whereBase).toMatchObject({ propriedadeId: 3 });
    // sem escopo no ctx, não há filtro de propriedade
    const semEscopo = traduzir(lancamento, c, { propriedadeId: null });
    expect(semEscopo.whereBase).not.toHaveProperty("propriedadeId");
  });

  it("múltiplos filtros viram fragmentos AND independentes", () => {
    const plano = traduzir(
      lancamento,
      consulta({
        entidade: "lancamento",
        metricas: ["valorTotal"],
        filtros: [
          { dimensao: "natureza", operador: "igual", valor: "DEBITO" },
          { dimensao: "categoria", operador: "contem", valor: "salário" },
          { dimensao: "grupoCategoria", operador: "igual", valor: "Pessoal" },
        ],
      }),
      { propriedadeId: null },
    );
    const and = plano.whereBase.AND as Record<string, unknown>[];
    expect(and).toHaveLength(3);
    expect(and[0]).toEqual({ natureza: "DEBITO" });
    expect(and[1]).toEqual({ categoria: { nome: { contains: "salário", mode: "insensitive" } } });
    expect(and[2]).toEqual({
      categoria: { grupoCategoria: { nome: { equals: "Pessoal", mode: "insensitive" } } },
    });
  });

  it("operador nao_contem vira exclusão por termo ('sem a rescisão')", () => {
    const plano = traduzir(
      lancamento,
      consulta({
        entidade: "lancamento",
        metricas: ["valorTotal"],
        filtros: [
          { dimensao: "natureza", operador: "igual", valor: "DEBITO" },
          { dimensao: "busca", operador: "nao_contem", valor: "rescisão" },
        ],
      }),
      { propriedadeId: null },
    );
    const and = plano.whereBase.AND as Record<string, unknown>[];
    expect(and[1]).toHaveProperty("NOT");
    const not = (and[1] as { NOT: { OR: unknown[] } }).NOT;
    expect(not.OR).toHaveLength(3); // categoria OU grupo OU centro de custo
  });

  it("select é o mínimo: dimensões agrupadas + métricas (deep-merge em 2 saltos)", () => {
    const plano = traduzir(
      lancamento,
      consulta({
        entidade: "lancamento",
        metricas: ["valorTotal"],
        agruparPor: ["natureza", "categoria"],
      }),
      { propriedadeId: null },
    );
    expect(plano.select).toEqual({ natureza: true, categoria: { select: { nome: true } }, valor: true });
  });

  it("contagem pura sem dimensões seleciona só o id", () => {
    const plano = traduzir(
      lancamento,
      consulta({ entidade: "lancamento", metricas: ["numLancamentos"] }),
      { propriedadeId: null },
    );
    expect(plano.select).toEqual({ id: true });
  });

  it("granularidadeTempo inclui o campo de data no select", () => {
    const plano = traduzir(
      lancamento,
      consulta({
        entidade: "lancamento",
        metricas: ["valorTotal"],
        filtros: [{ dimensao: "natureza", operador: "igual", valor: "DEBITO" }],
        granularidadeTempo: "mes",
      }),
      { propriedadeId: null },
    );
    expect(plano.select).toMatchObject({ dataLiquidacao: true });
  });
});

describe("whereComPeriodo", () => {
  it("aplica o período em UTC sobre o campo de data do regime", () => {
    const plano = traduzir(
      lancamento,
      consulta({ entidade: "lancamento", metricas: ["valorTotal"], filtros: [{ dimensao: "natureza", operador: "igual", valor: "DEBITO" }] }),
      { propriedadeId: null },
    );
    const where = whereComPeriodo(plano, "2026-01-01", "2026-06-30");
    expect(where.dataLiquidacao).toEqual({
      gte: new Date("2026-01-01T00:00:00.000Z"),
      lte: new Date("2026-06-30T00:00:00.000Z"),
    });
    // whereBase não é mutado (permite A/B com o mesmo plano)
    expect(plano.whereBase).not.toHaveProperty("dataLiquidacao");
  });
});

describe("mesclarSelect", () => {
  it("faz deep-merge de selects aninhados", () => {
    expect(
      mesclarSelect(
        { categoria: { select: { nome: true } } },
        { categoria: { select: { grupoCategoria: { select: { nome: true } } } } },
      ),
    ).toEqual({ categoria: { select: { nome: true, grupoCategoria: { select: { nome: true } } } } });
  });
});
