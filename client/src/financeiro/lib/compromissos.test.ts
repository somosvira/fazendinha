import { describe, expect, it } from "vitest";
import { tituloCompromisso } from "./compromissos";

describe("tituloCompromisso", () => {
  it("identifica cada parcela quando há mais de uma", () => {
    expect(tituloCompromisso({ numeroParcela: 2, totalParcelas: 3, operacao: { descricao: "Compra de insumos", tipo: "COMPRA_ESTOQUE" } })).toBe("(2/3) Compra de insumos");
  });

  it("mantém o título limpo quando existe uma única parcela", () => {
    expect(tituloCompromisso({ numeroParcela: 1, totalParcelas: 1, operacao: { descricao: "Serviço veterinário", tipo: "SERVICO" } })).toBe("Serviço veterinário");
  });

  it("usa o tipo da operação quando não há descrição", () => {
    expect(tituloCompromisso({ numeroParcela: 1, totalParcelas: 2, operacao: { descricao: null, tipo: "COMPRA_ESTOQUE" } })).toBe("(1/2) compra estoque");
  });
});
