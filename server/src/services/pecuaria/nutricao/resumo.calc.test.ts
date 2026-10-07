import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { somarConsumoMensal } from "./resumo.calc.js";

const item = (quantidade: string, unidade = "KG", semBaixa = false) => ({ produtoId: "produto", produto: { nome: "Ração" }, unidade,
  quantidadeConfirmada: new Prisma.Decimal(quantidade), modoEstoque: semBaixa ? "SEM_BAIXA_JUSTIFICADA" : "BAIXA_ESTOQUE",
  situacaoCusto: semBaixa ? "INCOMPLETO" : "CONHECIDO", movimentoEstoque: semBaixa ? null : { valorTotal: new Prisma.Decimal("0.10") } });

describe("soma mensal de consumos já confirmados", () => {
  it("soma decimais e animal-dias sem misturar unidades do mesmo produto", () => {
    const resumo = somarConsumoMensal([{ animalDias: 1, itens: [item("0.1")] }, { animalDias: 2, itens: [item("0.2"), item("1", "L")] }]);
    expect(resumo).toMatchObject({ fechamentos: 2, animalDias: 3, custoConhecido: "0.30", coberturaCustoCompleta: true });
    expect(resumo.itens.map((i) => [i.unidade, i.quantidadeConfirmada])).toEqual([["KG", "0.300"], ["L", "1.000"]]);
  });
  it("mantém custo desconhecido no consumo sem baixa, inclusive quantidade zero", () => {
    const resumo = somarConsumoMensal([{ animalDias: 1, itens: [item("1", "KG", true), item("0", "L", true)] }]);
    expect(resumo).toMatchObject({ custoConhecido: null, coberturaCustoCompleta: false });
    expect(resumo.itens[0].quantidadeConfirmada).toBe("1.000");
  });
  it("mostra somente subtotal conhecido quando parte não tem baixa", () => {
    expect(somarConsumoMensal([{ animalDias: 1, itens: [item("1"), item("2", "KG", true)] }])).toMatchObject({ custoConhecido: "0.10", coberturaCustoCompleta: false, itens: [{ quantidadeConfirmada: "3.000" }] });
  });
});
