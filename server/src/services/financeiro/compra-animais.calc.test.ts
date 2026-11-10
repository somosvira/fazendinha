import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  CompraAnimaisCalcError,
  itemPrecoAnimal,
  ratearValorLote,
  UNIDADE_ITEM_ANIMAL,
  unidadePrecoDoItem,
} from "./compra-animais.calc.js";

function erroDe(fn: () => unknown) {
  try {
    fn();
  } catch (erro) {
    return erro as CompraAnimaisCalcError;
  }
  throw new Error("Esperava um erro");
}

describe("unidades de preço do animal", () => {
  it("converte unidade do item de volta para a unidade de preço", () => {
    expect(unidadePrecoDoItem("cab")).toBe("CABECA");
    expect(unidadePrecoDoItem("kg")).toBe("KG");
    expect(unidadePrecoDoItem("@")).toBe("ARROBA");
    expect(unidadePrecoDoItem("l")).toBeNull();
    expect(UNIDADE_ITEM_ANIMAL.ARROBA).toBe("@");
  });
});

describe("itemPrecoAnimal", () => {
  it("preço por cabeça gera quantidade 1", () => {
    const item = itemPrecoAnimal({ unidade: "CABECA", preco: "2500.456" });
    expect(item.quantidade.toString()).toBe("1");
    expect(item.unidade).toBe("cab");
    expect(item.valorUnitario.toString()).toBe("2500.456");
    expect(item.valorTotal.toString()).toBe("2500.46");
  });

  it("preço por kg multiplica pelo peso pago", () => {
    const item = itemPrecoAnimal({ unidade: "KG", preco: "12.5", pesoPagoKg: "430.5" });
    expect(item.unidade).toBe("kg");
    expect(item.quantidade.toString()).toBe("430.5");
    expect(item.valorUnitario.toString()).toBe("12.5");
    expect(item.valorTotal.toString()).toBe("5381.25");
  });

  it("preço por arroba converte o peso em arrobas", () => {
    const item = itemPrecoAnimal({ unidade: "ARROBA", preco: 300, pesoPagoKg: 450 });
    expect(item.unidade).toBe("@");
    expect(item.quantidade.toFixed(3)).toBe("30.000");
    expect(item.valorTotal.toFixed(2)).toBe("9000.00");
  });

  it("arroba calcula o total a partir do peso, não da quantidade arredondada", () => {
    const item = itemPrecoAnimal({ unidade: "ARROBA", preco: 310, pesoPagoKg: 437 });
    const esperado = new Prisma.Decimal(437).mul(310).div(15).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    expect(item.valorTotal.equals(esperado)).toBe(true);
    expect(item.quantidade.toString()).toBe("29.133");
    // Total pela quantidade já arredondada perderia centavos.
    expect(item.quantidade.mul(310).toDecimalPlaces(2).equals(esperado)).toBe(false);
  });

  it.each(["KG", "ARROBA"] as const)("%s exige peso pago", (unidade) => {
    for (const peso of [undefined, null, 0, "0", -5]) {
      const erro = erroDe(() => itemPrecoAnimal({ unidade, preco: 10, pesoPagoKg: peso }));
      expect(erro).toBeInstanceOf(CompraAnimaisCalcError);
      expect(erro.campo).toBe("pesoPagoKg");
      expect(erro.message).toBe("Informe o peso pago para preço por kg ou arroba");
    }
  });

  it("rejeita preço negativo ou não finito", () => {
    for (const preco of [-1, "-0.01", Number.NaN, Number.POSITIVE_INFINITY, "abc"]) {
      const erro = erroDe(() => itemPrecoAnimal({ unidade: "CABECA", preco }));
      expect(erro).toBeInstanceOf(CompraAnimaisCalcError);
      expect(erro.campo).toBe("preco");
      expect(erro.message).toBe("Informe um preço válido");
    }
  });

  it("aceita preço zero", () => {
    expect(itemPrecoAnimal({ unidade: "CABECA", preco: 0 }).valorTotal.toString()).toBe("0");
  });
});

describe("ratearValorLote", () => {
  it("10000 entre 7 dá seis de 1428.57 e o último 1428.58", () => {
    const partes = ratearValorLote("10000", 7);
    expect(partes.map((p) => p.toFixed(2))).toEqual([
      "1428.57", "1428.57", "1428.57", "1428.57", "1428.57", "1428.57", "1428.58",
    ]);
    expect(partes.reduce((s, p) => s.plus(p), new Prisma.Decimal(0)).toFixed(2)).toBe("10000.00");
  });

  it("total zero resulta em partes zeradas", () => {
    const partes = ratearValorLote(0, 3);
    expect(partes).toHaveLength(3);
    expect(partes.every((p) => p.isZero())).toBe(true);
  });

  it("um animal recebe o total inteiro", () => {
    const partes = ratearValorLote("1234.56", 1);
    expect(partes.map((p) => p.toFixed(2))).toEqual(["1234.56"]);
  });

  it("rejeita quantidade de animais inválida", () => {
    for (const n of [0, 1.5, -2, Number.NaN]) {
      const erro = erroDe(() => ratearValorLote(100, n));
      expect(erro).toBeInstanceOf(CompraAnimaisCalcError);
      expect(erro.campo).toBe("quantidadeAnimais");
    }
  });

  it("rejeita total negativo", () => {
    expect(() => ratearValorLote(-1, 2)).toThrow(CompraAnimaisCalcError);
  });

  it("a soma sempre fecha o total", () => {
    for (const total of ["0.01", "1", "99.99", "10000", "12345.67", "0.10", "777777.77"]) {
      for (const n of [1, 2, 3, 7, 10, 13, 100]) {
        const partes = ratearValorLote(total, n);
        expect(partes).toHaveLength(n);
        const soma = partes.reduce((s, p) => s.plus(p), new Prisma.Decimal(0));
        expect(soma.equals(new Prisma.Decimal(total))).toBe(true);
        expect(partes.every((p) => !p.isNegative() && p.decimalPlaces() <= 2)).toBe(true);
      }
    }
  });
});
