import { describe, expect, it } from "vitest";
import { arredondarDecimal, arredondarDinheiro, dinheiro, dividirDecimais, multiplicarDecimais, paraCentavos, somar, somarDecimais } from "./decimal.js";

describe("decimal exato", () => {
  it("arredonda meio para longe do zero, sem erro de ponto flutuante", () => {
    expect(arredondarDinheiro(1.005)).toBe(1.01);
    expect(arredondarDinheiro(-1.005)).toBe(-1.01);
    expect(arredondarDinheiro(0.335)).toBe(0.34);
    expect(arredondarDinheiro("100.004")).toBe(100);
    expect(arredondarDecimal(1e-7, 4)).toBe(0);
    expect(arredondarDecimal(1.5e21, 2)).toBe(1.5e21);
  });

  it("soma e multiplica sem perder centavos", () => {
    expect(somarDecimais([0.1, 0.2], 2)).toBe(0.3);
    expect(somarDecimais([0.1, 0.2])).toBe(0.3);
    expect(multiplicarDecimais(1.005, 1.005, 2)).toBe(1.01);
    expect(multiplicarDecimais(0.335, 3, 2)).toBe(1.01);
  });

  it("divide com arredondamento só no final", () => {
    expect(dividirDecimais(100, 3, 4)).toBe(33.3333);
    expect(dividirDecimais(200, 3, 4)).toBe(66.6667);
    expect(dividirDecimais(5, 20, 2, 120)).toBe(30);
    expect(() => dividirDecimais(1, 0, 2)).toThrow(RangeError);
  });

  it("converte em centavos inteiros", () => {
    expect(paraCentavos("100.00")).toBe(10000);
    expect(paraCentavos(0.335)).toBe(34);
    expect(paraCentavos(7)).toBe(700);
  });

  it("dinheiro/somar formatam em texto de 2 casas, sem conta em number", () => {
    expect(dinheiro(1)).toBe("1.00");
    expect(dinheiro("1234.5")).toBe("1234.50");
    expect(dinheiro(0.335)).toBe("0.34");
    expect(somar("10.00", 0.1)).toBe("10.10");
    expect(somar("10.00", -0.005)).toBe("10.00");
  });
});
