import { describe, expect, it } from "vitest";
import { consolidarOocitos, validarOocitos } from "./oocitos.calc.js";

describe("validarOocitos", () => {
  it("aceita combinações únicas com quantidade positiva", () => {
    expect(validarOocitos([{ qualidade: "A", viavel: true, quantidade: 8 }, { qualidade: "A", viavel: false, quantidade: 2 }])).toEqual({ valido: true, erro: null });
  });

  it("recusa quantidade zero ou negativa", () => {
    expect(validarOocitos([{ qualidade: "A", viavel: true, quantidade: 0 }])).toEqual({ valido: false, erro: "QUANTIDADE_INVALIDA" });
  });

  it("recusa qualidade vazia e combinação duplicada", () => {
    expect(validarOocitos([{ qualidade: " ", viavel: true, quantidade: 1 }]).erro).toBe("QUALIDADE_OBRIGATORIA");
    expect(validarOocitos([{ qualidade: "A", viavel: true, quantidade: 1 }, { qualidade: " a ", viavel: true, quantidade: 3 }]).erro).toBe("COMBINACAO_DUPLICADA");
  });
});

describe("consolidarOocitos", () => {
  it("soma total, viáveis, inviáveis e qualidade normalizada", () => {
    expect(consolidarOocitos([{ qualidade: " A ", viavel: true, quantidade: 8 }, { qualidade: "A", viavel: false, quantidade: 2 }, { qualidade: "B", viavel: true, quantidade: 5 }])).toEqual({ total: 15, viaveis: 13, inviaveis: 2, porQualidade: { A: 10, B: 5 } });
  });

  it("retorna zeros para lista vazia", () => {
    expect(consolidarOocitos([])).toEqual({ total: 0, viaveis: 0, inviaveis: 0, porQualidade: {} });
  });
});
