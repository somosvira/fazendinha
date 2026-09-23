import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { planejarBaixaSanidade } from "./sanidade-estoque.calc.js";

const D = (v: number | string) => new Prisma.Decimal(v);
// Base do custo médio com custo unitário = v (quantidade 1).
const base = (v: number | string, q: number | string = 1) => ({ quantidade: D(q), valor: D(v) });
const num = (r: ReturnType<typeof planejarBaixaSanidade>) => r && { produtoId: r.produtoId, quantidade: r.quantidade.toNumber(), custoUnitario: r.custoUnitario.toNumber(), valorTotal: r.valorTotal.toNumber() };

describe("planejarBaixaSanidade", () => {
  it("APLICACAO com produtoId e quantidade > 0 → planeja SAIDA com valor = qtd × custo", () => {
    const r = planejarBaixaSanidade({ tipo: "APLICACAO", produtoId: 7, temEstoque: true, quantidadeUsada: 3, baseCusto: base(12.5) });
    expect(num(r)).toEqual({ produtoId: 7, quantidade: 3, custoUnitario: 12.5, valorTotal: 37.5 });
  });

  it("VACINA também gera baixa (é consumo de estoque)", () => {
    const r = planejarBaixaSanidade({ tipo: "VACINA", produtoId: 4, temEstoque: true, quantidadeUsada: 2, baseCusto: base(8) });
    expect(num(r)).toEqual({ produtoId: 4, quantidade: 2, custoUnitario: 8, valorTotal: 16 });
  });

  it("sem produtoId → não planeja baixa (produto de texto livre, sem vínculo de estoque)", () => {
    expect(planejarBaixaSanidade({ tipo: "APLICACAO", produtoId: null, temEstoque: true, quantidadeUsada: 3, baseCusto: base(10) })).toBeNull();
  });

  it("produto sem estoque no sítio (nenhuma entrada/ajuste) → não planeja baixa", () => {
    expect(planejarBaixaSanidade({ tipo: "APLICACAO", produtoId: 7, temEstoque: false, quantidadeUsada: 3, baseCusto: base(10) })).toBeNull();
    expect(planejarBaixaSanidade({ tipo: "VACINA", produtoId: 7, temEstoque: false, quantidadeUsada: 3, baseCusto: null })).toBeNull();
  });

  it("quantidade nula ou 0 → não planeja baixa", () => {
    expect(planejarBaixaSanidade({ tipo: "APLICACAO", produtoId: 7, temEstoque: true, quantidadeUsada: null, baseCusto: base(10) })).toBeNull();
    expect(planejarBaixaSanidade({ tipo: "APLICACAO", produtoId: 7, temEstoque: true, quantidadeUsada: 0, baseCusto: base(10) })).toBeNull();
  });

  it("quantidade negativa → não planeja baixa (entrada nunca sai da sanidade)", () => {
    expect(planejarBaixaSanidade({ tipo: "APLICACAO", produtoId: 7, temEstoque: true, quantidadeUsada: -2, baseCusto: base(10) })).toBeNull();
  });

  it("tipos que não consomem estoque (EXAME/MASTITE/OCORRENCIA) → não planejam baixa", () => {
    for (const tipo of ["EXAME", "MASTITE", "OCORRENCIA"] as const) {
      expect(planejarBaixaSanidade({ tipo, produtoId: 7, temEstoque: true, quantidadeUsada: 3, baseCusto: base(10) })).toBeNull();
    }
  });

  it("custo unitário nulo → valor 0 (baixa física ainda ocorre, custo desconhecido)", () => {
    const r = planejarBaixaSanidade({ tipo: "APLICACAO", produtoId: 7, temEstoque: true, quantidadeUsada: 3, baseCusto: null });
    expect(num(r)).toEqual({ produtoId: 7, quantidade: 3, custoUnitario: 0, valorTotal: 0 });
  });

  it("arredonda o valor total a 2 casas", () => {
    // 2.5 × 3333 ÷ 1000 = 8.3325 → 8.33 (arredonda p/ baixo na 3ª casa)
    const r = planejarBaixaSanidade({ tipo: "APLICACAO", produtoId: 7, temEstoque: true, quantidadeUsada: 2.5, baseCusto: base(3333, 1000) });
    expect(r?.valorTotal.toNumber()).toBe(8.33);
  });

  it("produto em mL não infla o valor pelo custo unitário arredondado", () => {
    // 25.000 mL por R$ 11,25 → 10.000 mL = R$ 4,50 (custo arredondado daria 5,00)
    const r = planejarBaixaSanidade({ tipo: "APLICACAO", produtoId: 7, temEstoque: true, quantidadeUsada: 10000, baseCusto: base("11.25", 25000) });
    expect(r?.valorTotal.toNumber()).toBe(4.5);
  });
});
