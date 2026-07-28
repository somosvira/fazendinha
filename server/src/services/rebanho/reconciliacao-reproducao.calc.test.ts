import { describe, expect, it } from "vitest";
import { haDivergencia, reconciliarContagens } from "./reconciliacao-reproducao.calc.js";

describe("reconciliarContagens", () => {
  it("calcula divergência por chave e ordena por magnitude", () => {
    const linhas = reconciliarContagens({ INSEMINACAO: 830, PARTO: 352 }, { INSEMINACAO: 832, PARTO: 352 });
    expect(linhas[0]).toEqual({ chave: "INSEMINACAO", observado: 830, baseline: 832, divergencia: -2 });
    expect(linhas.find((l) => l.chave === "PARTO")).toEqual({ chave: "PARTO", observado: 352, baseline: 352, divergencia: 0 });
  });

  it("inclui chaves presentes em apenas um lado como zero no outro", () => {
    const linhas = reconciliarContagens({ TE: 146 }, { COBERTURA: 61 });
    expect(linhas).toEqual(expect.arrayContaining([
      { chave: "TE", observado: 146, baseline: 0, divergencia: 146 },
      { chave: "COBERTURA", observado: 0, baseline: 61, divergencia: -61 },
    ]));
  });

  it("haDivergencia é true sse qualquer linha diverge", () => {
    expect(haDivergencia(reconciliarContagens({ A: 1 }, { A: 1 }))).toBe(false);
    expect(haDivergencia(reconciliarContagens({ A: 1 }, { A: 2 }))).toBe(true);
  });
});
