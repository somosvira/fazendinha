import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calcularAtribuicao } from "./atribuicao.calc.js";

describe("atribuição nutricional por permanência", () => {
  it("conserva quantidades e centavos, distribuindo resíduos por UUID independentemente da ordem", () => {
    const participantes = [{ animalId: "c", dias: 1 }, { animalId: "a", dias: 1 }, { animalId: "b", dias: 1 }];
    const itens = [{ produtoId: "racao", unidade: "KG", quantidadeConfirmada: "1", custoConhecido: "0.05" }];
    const resultado = calcularAtribuicao(participantes, 3, itens);
    expect(resultado.participacoes.map((p) => [p.animalId, p.itens[0].quantidadeAtribuida, p.custoConhecido])).toEqual([
      ["a", "0.334", "0.02"], ["b", "0.333", "0.02"], ["c", "0.333", "0.01"],
    ]);
    expect(calcularAtribuicao([...participantes].reverse(), 3, itens)).toEqual(resultado);
  });
  it("atribui consumo conferido, distingue custo ausente e não soma unidades diferentes", () => {
    const resultado = calcularAtribuicao([{ animalId: "a", dias: 10 }, { animalId: "b", dias: 5 }], 15, [
      { produtoId: "racao", unidade: "KG", quantidadeConfirmada: "320", custoConhecido: "640" },
      { produtoId: "liquido", unidade: "L", quantidadeConfirmada: "3", custoConhecido: null },
    ]);
    expect(resultado.custoConhecido).toBe("640.00");
    expect(resultado.coberturaCustoCompleta).toBe(false);
    expect(resultado.participacoes[0].itens[1]).toEqual({ produtoId: "liquido", unidade: "L", quantidadeAtribuida: "2.000", quantidadePorDia: "0.200000", custoConhecido: null });
    expect(resultado.participacoes.reduce((s, p) => s.plus(p.custoConhecido!), new Prisma.Decimal(0)).toFixed(2)).toBe("640.00");
  });
  it("atribui resíduos aos maiores restos, não simplesmente aos primeiros IDs", () => {
    const resultado = calcularAtribuicao([{ animalId: "a", dias: 3 }, { animalId: "b", dias: 1 }, { animalId: "c", dias: 2 }], 6,
      [{ produtoId: "racao", unidade: "KG", quantidadeConfirmada: "0.005", custoConhecido: "0.05" }]);
    expect(resultado.participacoes.map((p) => [p.animalId, p.itens[0].quantidadeAtribuida, p.custoConhecido])).toEqual([
      ["a", "0.002", "0.02"], ["b", "0.001", "0.01"], ["c", "0.002", "0.02"],
    ]);
  });
  it("preserva zero conhecido e ausência de qualquer base de custo", () => {
    const participantes = [{ animalId: "a", dias: 1 }];
    expect(calcularAtribuicao(participantes, 1, [{ produtoId: "p", unidade: "KG", quantidadeConfirmada: "0", custoConhecido: "0" }]).custoConhecido).toBe("0.00");
    expect(calcularAtribuicao(participantes, 1, [{ produtoId: "p", unidade: "KG", quantidadeConfirmada: "1", custoConhecido: null }]).custoConhecido).toBeNull();
  });
  it("recusa denominador inconsistente ou participante duplicado", () => {
    expect(() => calcularAtribuicao([{ animalId: "a", dias: 1 }], 2, [])).toThrow();
    expect(() => calcularAtribuicao([{ animalId: "a", dias: 1 }, { animalId: "a", dias: 1 }], 2, [])).toThrow();
  });
});
