import { describe, it, expect } from "vitest";
import { recomputarProducaoAnimal, ratearProducao, producao305De, selecionarProducao305 } from "./producao.recompute.js";

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

describe("selecionarProducao305", () => {
  it("oficial presente vence a estimativa", () => {
    expect(selecionarProducao305(9954, 8540)).toBe(9954);
  });
  it("oficial ausente cai na estimativa", () => {
    expect(selecionarProducao305(null, 8540)).toBe(8540);
    expect(selecionarProducao305(undefined, 8540)).toBe(8540);
  });
  it("oficial zero é um valor válido e vence (não confundir com ausência)", () => {
    expect(selecionarProducao305(0, 8540)).toBe(0);
  });
  it("sem oficial nem estimativa → null", () => {
    expect(selecionarProducao305(null, null)).toBeNull();
  });
});
