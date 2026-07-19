import { describe, it, expect } from "vitest";
import { recomputarProducaoAnimal, ratearProducao, producao305De, selecionarProducao305, quedaProducaoPct, LIMIAR_QUEDA_PCT } from "./producao.recompute.js";

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

  it("queda IMATERIAL (ruído) não vira 'descendo' — fica 'estavel'", () => {
    // recentes avg(29.9, 30) = 29.95; anteriores avg(30, 30) = 30 → queda 0.17% < limiar
    const r = recomputarProducaoAnimal(
      [
        { data: "2026-06-15", pesoTotal: 29.9 },
        { data: "2026-06-08", pesoTotal: 30 },
        { data: "2026-06-01", pesoTotal: 30 },
        { data: "2026-05-25", pesoTotal: 30 },
      ],
      true,
    );
    expect(r.producaoTendencia).toBe("estavel");
  });

  it("queda MATERIAL (≥ limiar) vira 'descendo'", () => {
    // recentes avg(24, 26) = 25; anteriores avg(30, 30) = 30 → queda 16.7% ≥ limiar
    const r = recomputarProducaoAnimal(
      [
        { data: "2026-06-15", pesoTotal: 24 },
        { data: "2026-06-08", pesoTotal: 26 },
        { data: "2026-06-01", pesoTotal: 30 },
        { data: "2026-05-25", pesoTotal: 30 },
      ],
      true,
    );
    expect(r.producaoTendencia).toBe("descendo");
  });

  it("subida material continua 'subindo' (limiar só filtra queda)", () => {
    const r = recomputarProducaoAnimal(
      [
        { data: "2026-06-15", pesoTotal: 34 },
        { data: "2026-06-08", pesoTotal: 32 },
        { data: "2026-06-01", pesoTotal: 28 },
        { data: "2026-05-25", pesoTotal: 28 },
      ],
      true,
    );
    expect(r.producaoTendencia).toBe("subindo");
  });
});

describe("quedaProducaoPct", () => {
  it("sem controles suficientes (< 2) → null", () => {
    expect(quedaProducaoPct([])).toBeNull();
    expect(quedaProducaoPct([{ data: "2026-06-15", pesoTotal: 30 }])).toBeNull();
  });

  it("queda percentual = (anteriores − recentes) / anteriores × 100, positiva quando cai", () => {
    // recentes avg(24,26)=25; anteriores avg(30,30)=30 → (30−25)/30 = 16.7%
    const q = quedaProducaoPct([
      { data: "2026-06-15", pesoTotal: 24 },
      { data: "2026-06-08", pesoTotal: 26 },
      { data: "2026-06-01", pesoTotal: 30 },
      { data: "2026-05-25", pesoTotal: 30 },
    ]);
    expect(q).toBeCloseTo(16.7, 1);
  });

  it("subida → queda negativa (a produção não caiu)", () => {
    // recentes avg(34,32)=33; anteriores avg(28,28)=28 → (28−33)/28 = −17.9%
    const q = quedaProducaoPct([
      { data: "2026-06-15", pesoTotal: 34 },
      { data: "2026-06-08", pesoTotal: 32 },
      { data: "2026-06-01", pesoTotal: 28 },
      { data: "2026-05-25", pesoTotal: 28 },
    ]);
    expect(q).toBeLessThan(0);
  });

  it("2 controles (caso degenerado): recentes = média dos 2; anteriores = o mais antigo", () => {
    // com só 2, recentes = avg(27,30) = 28.5; anteriores = 30 → (30−28.5)/30 = 5%
    // (mesma semântica que recomputarProducaoAnimal já usa para 2 controles)
    const q = quedaProducaoPct([
      { data: "2026-06-15", pesoTotal: 27 },
      { data: "2026-06-08", pesoTotal: 30 },
    ]);
    expect(q).toBeCloseTo(5, 1);
  });

  it("LIMIAR_QUEDA_PCT é um número positivo (materialidade da queda)", () => {
    expect(LIMIAR_QUEDA_PCT).toBeGreaterThan(0);
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
