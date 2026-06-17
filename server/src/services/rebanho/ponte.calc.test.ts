import { describe, it, expect } from "vitest";
import { resolverLancamentoDaEntrada } from "./ponte.calc.js";

// Base de ENTRADA com produto já mapeado (categoria 7 = "Ração", centro 2 = "Atividade Leiteira").
const baseEntrada = {
  tipo: "ENTRADA" as const,
  produtoCategoriaId: 7,
  produtoCentroCustoId: 2,
  mesFechado: false,
};

describe("resolverLancamentoDaEntrada", () => {
  it("SAIDA não gera lançamento", () => {
    expect(resolverLancamentoDaEntrada({ ...baseEntrada, tipo: "SAIDA" })).toEqual({ deveCriar: false });
  });

  it("AJUSTE não gera lançamento", () => {
    expect(resolverLancamentoDaEntrada({ ...baseEntrada, tipo: "AJUSTE" })).toEqual({ deveCriar: false });
  });

  it("ENTRADA com gerarLancamento=false não gera", () => {
    expect(resolverLancamentoDaEntrada({ ...baseEntrada, gerarLancamento: false })).toEqual({ deveCriar: false });
  });

  it("ENTRADA com gerarLancamento=true e produto mapeado gera com os defaults do produto", () => {
    expect(resolverLancamentoDaEntrada({ ...baseEntrada, gerarLancamento: true })).toEqual({
      deveCriar: true,
      categoriaId: 7,
      centroCustoId: 2,
    });
  });

  it("ENTRADA sem categoria (nem input nem produto) não gera + motivo", () => {
    expect(
      resolverLancamentoDaEntrada({ ...baseEntrada, produtoCategoriaId: null, produtoCentroCustoId: null }),
    ).toEqual({ deveCriar: false, motivo: "produto sem categoria/centro de custo" });
  });

  it("ENTRADA com produto sem centro de custo não gera + motivo", () => {
    expect(
      resolverLancamentoDaEntrada({ ...baseEntrada, produtoCentroCustoId: null }),
    ).toEqual({ deveCriar: false, motivo: "produto sem categoria/centro de custo" });
  });

  it("input sobrepõe os defaults do produto", () => {
    expect(
      resolverLancamentoDaEntrada({ ...baseEntrada, inputCategoriaId: 17, inputCentroCustoId: 4 }),
    ).toEqual({ deveCriar: true, categoriaId: 17, centroCustoId: 4 });
  });

  it("input preenche o que falta no produto", () => {
    expect(
      resolverLancamentoDaEntrada({
        ...baseEntrada,
        produtoCategoriaId: null,
        produtoCentroCustoId: null,
        inputCategoriaId: 17,
        inputCentroCustoId: 2,
      }),
    ).toEqual({ deveCriar: true, categoriaId: 17, centroCustoId: 2 });
  });

  it("mês fechado não gera + motivo (mesmo com produto mapeado)", () => {
    expect(resolverLancamentoDaEntrada({ ...baseEntrada, mesFechado: true })).toEqual({
      deveCriar: false,
      motivo: "mês fechado",
    });
  });
});
