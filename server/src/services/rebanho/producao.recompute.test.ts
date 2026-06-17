import { describe, it, expect } from "vitest";
import { recomputarProducaoAnimal, ratearProducao, producao305De } from "./producao.recompute.js";

describe("recomputarProducaoAnimal", () => {
  it("sem controles → tudo null", () => {
    expect(recomputarProducaoAnimal([], true)).toEqual({ producaoMediaDia: null, producao305: null, producaoTendencia: null });
  });

  it("1 controle (28) com lactação aberta → media 28, 305 = 8540, tendência null", () => {
    const r = recomputarProducaoAnimal([{ data: "2026-06-15", pesoTotal: 28 }], true);
    expect(r.producaoMediaDia).toBe(28);
    expect(r.producao305).toBe(8540);
    expect(r.producaoTendencia).toBeNull();
  });

  it("3 controles subindo → media 28, tendência 'subindo', 305 = 8540", () => {
    const r = recomputarProducaoAnimal(
      [
        { data: "2026-06-15", pesoTotal: 30 },
        { data: "2026-06-08", pesoTotal: 28 },
        { data: "2026-06-01", pesoTotal: 26 },
      ],
      true,
    );
    expect(r.producaoMediaDia).toBe(28);
    expect(r.producaoTendencia).toBe("subindo");
    expect(r.producao305).toBe(8540);
  });

  it("lactação fechada → producao305 null mesmo com média", () => {
    const r = recomputarProducaoAnimal([{ data: "2026-06-15", pesoTotal: 28 }], false);
    expect(r.producaoMediaDia).toBe(28);
    expect(r.producao305).toBeNull();
  });
});

describe("ratearProducao", () => {
  it("900 / 30 = 30", () => {
    expect(ratearProducao(900, 30)).toBe(30);
  });
  it("900 / 0 = null", () => {
    expect(ratearProducao(900, 0)).toBeNull();
  });
});

describe("producao305De", () => {
  it("lactação aberta e media não-nula → round(media * 305)", () => {
    expect(producao305De(28, true)).toBe(8540);
  });
  it("lactação fechada → null", () => {
    expect(producao305De(28, false)).toBeNull();
  });
  it("media null → null", () => {
    expect(producao305De(null, true)).toBeNull();
  });
});
