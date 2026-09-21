import { describe, expect, it } from "vitest";
import { deCentavos, paraCentavos, somarParcelas } from "./parcelas";

describe("paraCentavos", () => {
  it("converte um valor decimal simples", () => expect(paraCentavos("100.00")).toBe(10000));
  it("aceita vírgula e uma casa decimal", () => expect(paraCentavos("33,3")).toBe(3330));
  it("aceita valor inteiro sem casas decimais", () => expect(paraCentavos("75")).toBe(7500));
  it("rejeita texto que não é um número decimal válido", () => {
    expect(paraCentavos("")).toBeNull();
    expect(paraCentavos("abc")).toBeNull();
    expect(paraCentavos(undefined)).toBeNull();
  });
});

describe("deCentavos", () => {
  it("formata centavos como string decimal com duas casas", () => {
    expect(deCentavos(10000)).toBe("100.00");
    expect(deCentavos(3333)).toBe("33.33");
  });
});

describe("somarParcelas", () => {
  it("soma os valores em centavos sem depender de ponto flutuante", () =>
    expect(somarParcelas([{ valor: "33.34" }, { valor: "33.33" }, { valor: "33.33" }])).toBe(10000));
  it("ignora valores inválidos como zero", () => expect(somarParcelas([{ valor: "10.00" }, { valor: "" }])).toBe(1000));
});
