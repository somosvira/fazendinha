import { describe, it, expect } from "vitest";
import { consumoEsperado, diasNoPeriodo, type ItemConsumo } from "./nutricao.consumo.calc.js";

describe("consumoEsperado", () => {
  const itens: ItemConsumo[] = [
    { produtoId: "produto-1", qtdPorCabecaDia: 12 }, // 12 kg de silagem
    { produtoId: "produto-2", qtdPorCabecaDia: 0.12 }, // 120 g de mineral
  ];

  it("multiplica qtd × cabeças × dias por item", () => {
    const r = consumoEsperado(itens, 50, 30);
    expect(r).toEqual([
      { produtoId: "produto-1", quantidade: 18000 }, // 12 × 50 × 30
      { produtoId: "produto-2", quantidade: 180 }, //  0.12 × 50 × 30
    ]);
  });

  it("contém ruído de float arredondando a 4 casas", () => {
    // 0.1 × 3 × 1 = 0.30000000000000004 em float
    const r = consumoEsperado([{ produtoId: "produto-9", qtdPorCabecaDia: 0.1 }], 3, 1);
    expect(r[0].quantidade).toBe(0.3);
  });

  it("zero cabeças ou zero dias → zero consumo", () => {
    expect(consumoEsperado(itens, 0, 30)[0].quantidade).toBe(0);
    expect(consumoEsperado(itens, 50, 0)[0].quantidade).toBe(0);
  });

  it("lista vazia → resultado vazio", () => {
    expect(consumoEsperado([], 50, 30)).toEqual([]);
  });

  it("rejeita cabeças ou dias negativos", () => {
    expect(() => consumoEsperado(itens, -1, 30)).toThrow();
    expect(() => consumoEsperado(itens, 50, -1)).toThrow();
  });
});

describe("diasNoPeriodo", () => {
  it("mesmo dia = 1 (inclusivo)", () => {
    expect(diasNoPeriodo("2026-07-01", "2026-07-01")).toBe(1);
  });

  it("mês cheio de julho = 31 dias", () => {
    expect(diasNoPeriodo("2026-07-01", "2026-07-31")).toBe(31);
  });

  it("atravessa virada de mês corretamente", () => {
    expect(diasNoPeriodo("2026-06-28", "2026-07-01")).toBe(4);
  });

  it("fim antes do início = 0 (janela inválida)", () => {
    expect(diasNoPeriodo("2026-07-10", "2026-07-01")).toBe(0);
  });
});
