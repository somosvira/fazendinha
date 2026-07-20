import { describe, expect, it } from "vitest";
import { resumoComposicao, type ItemComposicao } from "./composicao-produto.calc.js";

const i = (proporcao: number): ItemComposicao => ({ proporcao });

describe("resumoComposicao", () => {
  it("vazio → soma 0, não ok, 0 ingredientes", () => {
    const r = resumoComposicao([]);
    expect(r.soma).toBe(0);
    expect(r.somaOk).toBe(false);
    expect(r.nIngredientes).toBe(0);
  });

  it("soma exata de 100 → ok", () => {
    const r = resumoComposicao([i(60), i(40)]);
    expect(r.soma).toBe(100);
    expect(r.somaOk).toBe(true);
    expect(r.nIngredientes).toBe(2);
  });

  it("tolera pequeno arredondamento (±0.5) como ok", () => {
    expect(resumoComposicao([i(33.3), i(33.3), i(33.4)]).somaOk).toBe(true);
    expect(resumoComposicao([i(50), i(49.6)]).somaOk).toBe(true); // 99.6
  });

  it("fora da tolerância → não ok", () => {
    expect(resumoComposicao([i(50), i(45)]).somaOk).toBe(false); // 95
    expect(resumoComposicao([i(60), i(50)]).somaOk).toBe(false); // 110
  });

  it("arredonda a soma para 3 casas", () => {
    expect(resumoComposicao([i(33.333), i(33.333), i(33.334)]).soma).toBe(100);
  });
});
