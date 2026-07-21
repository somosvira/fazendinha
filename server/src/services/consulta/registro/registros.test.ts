// Sanidade dos registros declarativos: todo where() produz condição não vazia,
// enums batem com os do Prisma Client, defaults existem e as razões apontam
// para entidades/métricas reais. Pega registro quebrado no CI, sem banco.

import { describe, it, expect } from "vitest";
import { CategoriaAnimal, Natureza, SexoAnimal, StatusAnimal, StatusReprodutivo } from "@prisma/client";
import { DOMINIOS, obterDominio } from "./index.js";
import type { OperadorFiltro } from "../tipos.js";

describe("sanidade dos registros", () => {
  for (const [nomeDominio, dom] of Object.entries(DOMINIOS)) {
    describe(`domínio ${nomeDominio}`, () => {
      for (const [nomeEntidade, def] of Object.entries(dom.entidades)) {
        it(`entidade '${nomeEntidade}' tem regimeDefault válido`, () => {
          expect(def.regimes[def.regimeDefault]).toBeDefined();
        });

        it(`entidade '${nomeEntidade}': todo where(op) produz condição não vazia`, () => {
          for (const [nomeDim, dim] of Object.entries(def.dimensoes)) {
            for (const op of dim.operadores) {
              const valor = op === "em" ? [dim.valores?.[0] ?? "x"] : (dim.valores?.[0] ?? "x");
              const cond = dim.where(op as OperadorFiltro, valor);
              expect(Object.keys(cond).length, `${nomeDim}.where('${op}')`).toBeGreaterThan(0);
            }
          }
        });

        it(`entidade '${nomeEntidade}': métricas não-contagem têm extrator de valor`, () => {
          for (const [nomeMet, met] of Object.entries(def.metricas)) {
            if (met.agregacao !== "contagem")
              expect(met.valor, `métrica ${nomeMet} (${met.agregacao})`).toBeTypeOf("function");
          }
        });
      }

      it("razões apontam para entidades/métricas/dimensões existentes", () => {
        for (const [nomeRazao, rz] of Object.entries(dom.razoes ?? {})) {
          for (const lado of [rz.numerador, rz.denominador]) {
            const domLado = obterDominio(lado.dominio);
            const defLado = domLado.entidades[lado.entidade];
            expect(defLado, `${nomeRazao}: entidade ${lado.dominio}.${lado.entidade}`).toBeDefined();
            expect(defLado.metricas[lado.metrica], `${nomeRazao}: métrica ${lado.metrica}`).toBeDefined();
            if (lado.regime) expect(defLado.regimes[lado.regime]).toBeDefined();
            for (const d of lado.aceitaFiltros ?? [])
              expect(defLado.dimensoes[d], `${nomeRazao}: aceitaFiltros '${d}'`).toBeDefined();
            for (const f of lado.filtrosFixos ?? [])
              expect(defLado.dimensoes[f.dimensao], `${nomeRazao}: filtroFixo '${f.dimensao}'`).toBeDefined();
          }
        }
      });
    });
  }

  it("enums dos registros batem com os do Prisma Client", () => {
    const fin = DOMINIOS.financeiro.entidades.lancamento;
    expect(fin.dimensoes.natureza.valores).toEqual(Object.values(Natureza));

    const animal = DOMINIOS.rebanho.entidades.animal;
    expect(animal.dimensoes.categoria.valores).toEqual(Object.values(CategoriaAnimal));
    expect(animal.dimensoes.sexo.valores).toEqual(Object.values(SexoAnimal));
    expect(animal.dimensoes.status.valores).toEqual(Object.values(StatusAnimal));
    expect(animal.dimensoes.statusReprodutivo.valores).toEqual(Object.values(StatusReprodutivo));
  });

  it("regime de caixa do financeiro é o mesmo do Dashboard", () => {
    const lanc = DOMINIOS.financeiro.entidades.lancamento;
    expect(lanc.regimes.realizado.filtrosFixos).toEqual({ situacao: "LIQUIDADO", estornado: false });
    expect(lanc.regimes.realizado.campoData).toBe("dataLiquidacao");
    expect(lanc.regimes.a_vencer.filtrosFixos).toEqual({ situacao: "ABERTO", estornado: false });
    expect(lanc.regimes.a_vencer.campoData).toBe("dataVencimento");
  });

  it("rótulo individual do rebanho prioriza número e preserva zeros", () => {
    const dimensao = DOMINIOS.rebanho.entidades.animal.dimensoes.animal;
    expect(dimensao.rotulo).toBeTypeOf("function");
    expect(dimensao.rotulo!({ numero: "0042", nome: "Jurema" })).toBe("#0042 · Jurema");
    expect(dimensao.rotulo!({ numero: "0042", nome: null })).toBe("#0042");
  });
});
