import { describe, expect, it } from "vitest";
import { composicaoValida, fracaoReduzida, juntarComposicoes, parcelaInformada, respeitaHerdanca, somaFracoes } from "./composicao";

describe("parcela herdada", () => {
  const fixa = [{ racaId: "ho", fracao64: 32 }];
  it("permite completar a metade desconhecida com a mesma raça", () => {
    expect(juntarComposicoes(fixa, [{ racaId: "ho", fracao64: 16 }, { racaId: "go", fracao64: 16 }]))
      .toEqual([{ racaId: "ho", fracao64: 48 }, { racaId: "go", fracao64: 16 }]);
    expect(parcelaInformada([{ racaId: "ho", fracao64: 48 }, { racaId: "go", fracao64: 16 }], fixa))
      .toEqual([{ racaId: "ho", fracao64: 16 }, { racaId: "go", fracao64: 16 }]);
  });
  it("identifica registros antigos divergentes", () => {
    expect(respeitaHerdanca([{ racaId: "go", fracao64: 64 }], fixa)).toBe(false);
  });
});

describe("composicao", () => {
  it("soma frações", () => {
    expect(somaFracoes([{ racaId: "a", fracao64: 32 }, { racaId: "b", fracao64: 16 }])).toBe(48);
    expect(somaFracoes([])).toBe(0);
  });

  it("valida soma <= 64 e sem raça repetida", () => {
    expect(composicaoValida([{ racaId: "a", fracao64: 32 }, { racaId: "b", fracao64: 32 }])).toBe(true);
    expect(composicaoValida([{ racaId: "a", fracao64: 40 }, { racaId: "b", fracao64: 32 }])).toBe(false);
    expect(composicaoValida([{ racaId: "a", fracao64: 32 }, { racaId: "a", fracao64: 16 }])).toBe(false);
    expect(composicaoValida([{ racaId: "a", fracao64: 0 }])).toBe(false);
    expect(composicaoValida([{ racaId: "a", fracao64: 65 }])).toBe(false);
  });
});

describe("fracaoReduzida", () => {
  it("reduz a fração em 64 avos", () => {
    expect(fracaoReduzida(48)).toBe("3/4");
    expect(fracaoReduzida(40)).toBe("5/8");
    expect(fracaoReduzida(52)).toBe("13/16");
    expect(fracaoReduzida(64)).toBe("1/1");
  });
});
