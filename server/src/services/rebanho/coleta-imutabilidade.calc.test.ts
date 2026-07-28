import { describe, expect, it } from "vitest";
import { podeEditarEstrutura, podeExcluirColeta } from "./coleta-imutabilidade.calc.js";

describe("podeEditarEstrutura", () => {
  it("permite editar antes de existir embrião", () => {
    expect(podeEditarEstrutura({ temEmbrioes: false })).toBe(true);
  });

  it("trava estrutura após existir embrião", () => {
    expect(podeEditarEstrutura({ temEmbrioes: true })).toBe(false);
  });
});

describe("podeExcluirColeta", () => {
  it("permite excluir coleta sem fertilizações nem embriões", () => {
    expect(podeExcluirColeta({ temFertilizacoes: false, temEmbrioes: false })).toBe(true);
  });

  it.each([{ temFertilizacoes: true, temEmbrioes: false }, { temFertilizacoes: false, temEmbrioes: true }, { temFertilizacoes: true, temEmbrioes: true }])("recusa exclusão quando há dependentes: %o", (input) => {
    expect(podeExcluirColeta(input)).toBe(false);
  });
});
