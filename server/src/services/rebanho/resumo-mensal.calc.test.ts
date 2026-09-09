import { describe, expect, it } from "vitest";
import { agregarEventosResumoMensal } from "./resumo-mensal.calc.js";

describe("agregarEventosResumoMensal", () => {
  it("conta partos, diagnósticos positivos e secagens", () => {
    expect(agregarEventosResumoMensal([
      { tipo: "PARTO", tipoParto: "1" },
      { tipo: "PARTO", tipoParto: "2" },
      { tipo: "DIAGNOSTICO", resultado: "positivo" },
      { tipo: "DIAGNOSTICO", resultado: "NEGATIVO" },
      { tipo: "SECAGEM" },
    ])).toEqual({ partos: 2, prenhezes: 1, secagens: 1 });
  });

  it("não apresenta aborto como parto", () => {
    expect(agregarEventosResumoMensal([
      { tipo: "PARTO", tipoParto: "3" },
      { tipo: "PARTO", tipoParto: "aborto" },
    ])).toEqual({ partos: 0, prenhezes: 0, secagens: 0 });
  });

  it("aceita variação de caixa no diagnóstico positivo", () => {
    expect(agregarEventosResumoMensal([
      { tipo: "DIAGNOSTICO", resultado: " Positivo " },
    ]).prenhezes).toBe(1);
  });
});

