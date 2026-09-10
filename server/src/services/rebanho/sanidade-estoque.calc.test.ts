import { describe, it, expect } from "vitest";
import { planejarBaixaSanidade } from "./sanidade-estoque.calc.js";

describe("planejarBaixaSanidade", () => {
  const produtoId = "00000000-0000-4000-8000-000000000007";

  it("APLICACAO com produtoId e quantidade > 0 → planeja SAIDA com valor = qtd × custo", () => {
    const r = planejarBaixaSanidade({ tipo: "APLICACAO", produtoId, quantidadeUsada: 3, custoUnitario: 12.5 });
    expect(r).toEqual({ produtoId, quantidade: 3, custoUnitario: 12.5, valorTotal: 37.5 });
  });

  it("VACINA também gera baixa (é consumo de estoque)", () => {
    const r = planejarBaixaSanidade({ tipo: "VACINA", produtoId, quantidadeUsada: 2, custoUnitario: 8 });
    expect(r).toEqual({ produtoId, quantidade: 2, custoUnitario: 8, valorTotal: 16 });
  });

  it("sem produtoId → não planeja baixa (produto de texto livre, sem vínculo de estoque)", () => {
    expect(planejarBaixaSanidade({ tipo: "APLICACAO", produtoId: null, quantidadeUsada: 3, custoUnitario: 10 })).toBeNull();
  });

  it("quantidade nula ou 0 → não planeja baixa", () => {
    expect(planejarBaixaSanidade({ tipo: "APLICACAO", produtoId, quantidadeUsada: null, custoUnitario: 10 })).toBeNull();
    expect(planejarBaixaSanidade({ tipo: "APLICACAO", produtoId, quantidadeUsada: 0, custoUnitario: 10 })).toBeNull();
  });

  it("quantidade negativa → não planeja baixa (entrada nunca sai da sanidade)", () => {
    expect(planejarBaixaSanidade({ tipo: "APLICACAO", produtoId, quantidadeUsada: -2, custoUnitario: 10 })).toBeNull();
  });

  it("tipos que não consomem estoque (EXAME/MASTITE/OCORRENCIA) → não planejam baixa", () => {
    for (const tipo of ["EXAME", "MASTITE", "OCORRENCIA"] as const) {
      expect(planejarBaixaSanidade({ tipo, produtoId, quantidadeUsada: 3, custoUnitario: 10 })).toBeNull();
    }
  });

  it("custo unitário nulo → valor 0 (baixa física ainda ocorre, custo desconhecido)", () => {
    const r = planejarBaixaSanidade({ tipo: "APLICACAO", produtoId, quantidadeUsada: 3, custoUnitario: null });
    expect(r).toEqual({ produtoId, quantidade: 3, custoUnitario: 0, valorTotal: 0 });
  });

  it("arredonda o valor total a 2 casas", () => {
    // 2.5 × 3.333 = 8.3325 → 8.33 (arredonda p/ baixo na 3ª casa)
    const r = planejarBaixaSanidade({ tipo: "APLICACAO", produtoId, quantidadeUsada: 2.5, custoUnitario: 3.333 });
    expect(r?.valorTotal).toBe(8.33);
  });
});
