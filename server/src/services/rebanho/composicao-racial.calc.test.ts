import { describe, expect, it } from "vitest";
import { agruparPorGrau, extrairFracao, PURO } from "./composicao-racial.calc.js";

describe("extrairFracao", () => {
  it("extrai a fração no início do grau de sangue", () => {
    expect(extrairFracao("5/8 GL, HO")).toBe("5/8");
    expect(extrairFracao("1/2 HO")).toBe("1/2");
    expect(extrairFracao("15/16 GL, HO")).toBe("15/16");
  });
  it("null/vazio/sem fração → PURO", () => {
    expect(extrairFracao(null)).toBe(PURO);
    expect(extrairFracao("")).toBe(PURO);
    expect(extrairFracao("Holandês")).toBe(PURO);
  });
});

const a = (grauSangue: string | null) => ({ grauSangue });

describe("agruparPorGrau", () => {
  it("rebanho vazio → distribuição vazia, total 0", () => {
    expect(agruparPorGrau([])).toEqual({ total: 0, distribuicao: [] });
  });

  it("agrupa por fração e conta", () => {
    const r = agruparPorGrau([a("1/2 HO"), a("1/2 GL"), a("3/4 HO"), a(null)]);
    expect(r.total).toBe(4);
    const map = Object.fromEntries(r.distribuicao.map((d) => [d.grau, d.quantidade]));
    expect(map).toEqual({ "1/2": 2, "3/4": 1, [PURO]: 1 });
  });

  it("ordena por quantidade desc (empate: alfabético)", () => {
    const r = agruparPorGrau([a("1/2 HO"), a("3/4 HO"), a("3/4 GL"), a("3/4 X"), a("5/8 HO")]);
    expect(r.distribuicao.map((d) => d.grau)).toEqual(["3/4", "1/2", "5/8"]);
  });

  it("calcula o percentual (arredondado, soma ~100)", () => {
    const r = agruparPorGrau([a("1/2 HO"), a("1/2 HO"), a("3/4 HO"), a("3/4 HO")]);
    const pcts = Object.fromEntries(r.distribuicao.map((d) => [d.grau, d.pct]));
    expect(pcts["1/2"]).toBe(50);
    expect(pcts["3/4"]).toBe(50);
  });

  it("null e sem-fração caem no mesmo balde PURO", () => {
    const r = agruparPorGrau([a(null), a("Gir"), a("puro")]);
    expect(r.distribuicao).toEqual([{ grau: PURO, quantidade: 3, pct: 100 }]);
  });
});
