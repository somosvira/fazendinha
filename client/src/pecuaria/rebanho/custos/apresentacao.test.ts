import { describe, expect, it } from "vitest";
import { descricaoCusto, ultimosDozeMeses } from "./apresentacao";
import { isoDate } from "../../../components/DateRangePicker";

describe("apresentação de custos", () => {
  it("usa dias civis inclusivos, inclusive em ano bissexto", () => {
    const periodo = ultimosDozeMeses(new Date(2024, 1, 29, 23, 30));
    expect(isoDate(periodo.start!)).toBe("2023-03-01");
    expect(isoDate(periodo.end!)).toBe("2024-02-29");
  });
  it("altera somente o formato técnico gerado da tentativa", () => {
    expect(descricaoCusto("Tentativa IA · ciclo 2 · 1")).toBe("Tentativa IA · ordem 1");
    expect(descricaoCusto("Exame do ciclo 2")).toBe("Exame do ciclo 2");
    expect(descricaoCusto("Tentativa IA · ciclo 2 · 1 · observação")).toBe("Tentativa IA · ciclo 2 · 1 · observação");
  });
});
