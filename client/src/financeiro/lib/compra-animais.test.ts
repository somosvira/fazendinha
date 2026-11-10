import { describe, expect, it } from "vitest";
import { formatarCentavos, itemPrecoAnimal, paraEscalado, precoMedioDoLote, ratearValorLote, reaisParaCentavos, valoresDosAnimais } from "./compra-animais";

describe("preço do animal por cabeça, kg e arroba", () => {
  it("por cabeça, a quantidade é 1 e o valor é o preço", () => {
    expect(itemPrecoAnimal({ unidade: "CABECA", preco: "4500" })).toEqual({ quantidade: "1", unidade: "cab", centavos: 450000, valorTotal: "4500.00" });
    expect(itemPrecoAnimal({ unidade: "CABECA", preco: "4500,5" })?.valorTotal).toBe("4500.50");
  });

  it("por kg, o valor é o peso pago × o preço", () => {
    expect(itemPrecoAnimal({ unidade: "KG", preco: "12", pesoPagoKg: "380" })).toEqual({ quantidade: "380", unidade: "kg", centavos: 456000, valorTotal: "4560.00" });
    expect(itemPrecoAnimal({ unidade: "KG", preco: "12.3456", pesoPagoKg: "412.5" })?.valorTotal).toBe("5092.56");
  });

  it("por arroba, a quantidade é o peso pago ÷ 15 e o valor segue o peso (450 kg a R$ 300/@ = 30 @ = R$ 9.000)", () => {
    expect(itemPrecoAnimal({ unidade: "ARROBA", preco: "300", pesoPagoKg: "450" })).toEqual({ quantidade: "30", unidade: "@", centavos: 900000, valorTotal: "9000.00" });
    // 400 kg = 26,667 @ (3 casas), mas o valor usa o peso exato: 400 × 300 ÷ 15 = 8.000
    expect(itemPrecoAnimal({ unidade: "ARROBA", preco: "300", pesoPagoKg: "400" })).toEqual({ quantidade: "26.667", unidade: "@", centavos: 800000, valorTotal: "8000.00" });
  });

  it("arredonda meio-para-cima sem erro de ponto flutuante", () => {
    expect(itemPrecoAnimal({ unidade: "KG", preco: "1.005", pesoPagoKg: "1" })?.valorTotal).toBe("1.01");
    expect(itemPrecoAnimal({ unidade: "CABECA", preco: "10.005" })?.valorTotal).toBe("10.01");
    expect(itemPrecoAnimal({ unidade: "KG", preco: "0.0004", pesoPagoKg: "1" })?.valorTotal).toBe("0.00");
  });

  it("devolve null sem preço válido ou, em kg/arroba, sem peso pago", () => {
    expect(itemPrecoAnimal({ unidade: "CABECA", preco: "" })).toBeNull();
    expect(itemPrecoAnimal({ unidade: "CABECA", preco: "-3" })).toBeNull();
    expect(itemPrecoAnimal({ unidade: "KG", preco: "12", pesoPagoKg: "" })).toBeNull();
    expect(itemPrecoAnimal({ unidade: "ARROBA", preco: "300", pesoPagoKg: "0" })).toBeNull();
  });

  it("aceita preço zero (a tela exige valor positivo antes de confirmar)", () => {
    expect(itemPrecoAnimal({ unidade: "CABECA", preco: "0" })?.centavos).toBe(0);
  });
});

describe("valor do lote", () => {
  it("divide em centavos e deixa a sobra no último animal (7 garrotes por R$ 10.000)", () => {
    const partes = ratearValorLote(1_000_000, 7);
    expect(partes.slice(0, 6)).toEqual(Array(6).fill(142857));
    expect(partes[6]).toBe(142858);
    expect(partes.reduce((soma, parte) => soma + parte, 0)).toBe(1_000_000);
    expect(partes.map(formatarCentavos)[6]).toBe("1428.58");
  });

  it("não perde nem cria centavos em nenhuma divisão", () => {
    for (const total of [1, 2, 99, 100, 123456, 999_999_999]) for (const n of [1, 2, 3, 7, 11]) {
      expect(ratearValorLote(total, n).reduce((soma, parte) => soma + parte, 0)).toBe(total);
    }
  });

  it("valor zero ou sem animais não gera partes inválidas", () => {
    expect(ratearValorLote(0, 3)).toEqual([0, 0, 0]);
    expect(ratearValorLote(1000, 0)).toEqual([]);
    expect(ratearValorLote(-1, 2)).toEqual([]);
  });

  it("o preço médio é o total ÷ animais, arredondado só para exibir", () => {
    expect(precoMedioDoLote(1_000_000, 7)).toBe(142857);
    expect(precoMedioDoLote(1000, 0)).toBeNull();
  });

  it("valoresDosAnimais usa o rateio no lote, com item por cabeça", () => {
    const valores = valoresDosAnimais("LOTE", "10000", Array.from({ length: 7 }, () => ({ preco: "" })));
    expect(valores.map((valor) => valor?.valorTotal)).toEqual(["1428.57", "1428.57", "1428.57", "1428.57", "1428.57", "1428.57", "1428.58"]);
    expect(valores.every((valor) => valor?.unidade === "cab" && valor.quantidade === "1")).toBe(true);
  });

  it("valoresDosAnimais sem valor do lote deixa todos pendentes", () => {
    expect(valoresDosAnimais("LOTE", "", [{ preco: "" }, { preco: "" }])).toEqual([null, null]);
  });

  it("valoresDosAnimais por kg calcula cada animal com o seu peso e preço", () => {
    const valores = valoresDosAnimais("KG", "", [{ preco: "12", pesoPago: "300" }, { preco: "12", pesoPago: "" }, { preco: "13", pesoPago: "250.5" }]);
    expect(valores.map((valor) => valor?.valorTotal ?? null)).toEqual(["3600.00", null, "3256.50"]);
  });
});

describe("conversões", () => {
  it("reais digitados viram centavos", () => {
    expect(reaisParaCentavos("1428,57")).toBe(142857);
    expect(reaisParaCentavos("10")).toBe(1000);
    expect(reaisParaCentavos("0.005")).toBe(1);
    expect(reaisParaCentavos("")).toBeNull();
    expect(reaisParaCentavos("abc")).toBeNull();
  });
  it("paraEscalado rejeita negativos e notação científica", () => {
    expect(paraEscalado("-1", 2)).toBeNull();
    expect(paraEscalado("1e3", 2)).toBeNull();
    expect(paraEscalado("12.", 2)).toBe(1200n);
  });
});
