import { describe, expect, it } from "vitest";
import { composicaoValida, somaFracoes } from "./composicao";

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
