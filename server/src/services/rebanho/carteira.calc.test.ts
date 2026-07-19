import { describe, it, expect } from "vitest";
import {
  agregarCarteira, simularDescarte, CLASSIFICACOES, type AnimalCarteira,
} from "./carteira.calc.js";

// Fábrica enxuta de animal materializado; defaults "neutros" sobrescritos por partial.
function animal(p: Partial<AnimalCarteira> & { animalId: number }): AnimalCarteira {
  return {
    numero: String(p.animalId),
    nome: null,
    score: 60,
    classificacao: "BOA",
    producaoDia: 20,
    ccs: 200,
    margemDiaEstimada: 10,
    ...p,
  };
}

const pool: AnimalCarteira[] = [
  animal({ animalId: 1, score: 90, classificacao: "ELITE",    producaoDia: 30, ccs: 150, margemDiaEstimada: 40 }),
  animal({ animalId: 2, score: 72, classificacao: "MUITO_BOA", producaoDia: 25, ccs: 220, margemDiaEstimada: 20 }),
  animal({ animalId: 3, score: 60, classificacao: "BOA",       producaoDia: 18, ccs: 300, margemDiaEstimada: 8 }),
  animal({ animalId: 4, score: 45, classificacao: "ATENCAO",   producaoDia: 12, ccs: 500, margemDiaEstimada: -2 }),
  animal({ animalId: 5, score: 30, classificacao: "DESCARTE",  producaoDia: 8,  ccs: 900, margemDiaEstimada: -15 }),
];

describe("agregarCarteira", () => {
  it("distribuição conta por faixa e cobre todas as 5 classes em ordem", () => {
    const c = agregarCarteira(pool);
    expect(c.distribuicao.map((d) => d.classificacao)).toEqual(CLASSIFICACOES);
    expect(c.distribuicao.map((d) => d.cabecas)).toEqual([1, 1, 1, 1, 1]);
    expect(c.distribuicao.every((d) => d.pctRebanho === 20)).toBe(true);
  });

  it("totalAnimais e margemDiaTotal somam", () => {
    const c = agregarCarteira(pool);
    expect(c.totalAnimais).toBe(5);
    // 40 + 20 + 8 - 2 - 15 = 51
    expect(c.margemDiaTotal).toBe(51);
  });

  it("scoreMedio é ponderado pela produção (não média simples)", () => {
    const c = agregarCarteira(pool);
    // Σ(score×prod) = 90*30+72*25+60*18+45*12+30*8 = 2700+1800+1080+540+240 = 6360
    // Σprod = 30+25+18+12+8 = 93 → 6360/93 = 68.39
    expect(c.scoreMedio).toBe(68.4);
    // média simples seria (90+72+60+45+30)/5 = 59.4 — confirmando que difere
    expect(c.scoreMedio).not.toBe(59.4);
  });

  it("ranking ordena por score e corta N", () => {
    const c = agregarCarteira(pool, 2);
    expect(c.ranking.melhores.map((a) => a.animalId)).toEqual([1, 2]);
    expect(c.ranking.piores.map((a) => a.animalId)).toEqual([5, 4]);
  });

  it("carteira vazia → zeros, listas vazias, sem quebrar", () => {
    const c = agregarCarteira([]);
    expect(c.totalAnimais).toBe(0);
    expect(c.scoreMedio).toBe(0);
    expect(c.margemDiaTotal).toBe(0);
    expect(c.ranking.melhores).toEqual([]);
    expect(c.distribuicao.every((d) => d.cabecas === 0 && d.pctRebanho === 0)).toBe(true);
  });
});

describe("simularDescarte", () => {
  it("descartar as piores (margem negativa) sobe a margem: delta > 0", () => {
    const sim = simularDescarte(pool, 2); // remove animais 5 e 4 (as piores por score)
    expect(sim.cabecas).toBe(2);
    expect(sim.n).toBe(2);
    // saem 8 + 12 = 20 L/dia
    expect(sim.litrosDiaSai).toBe(20);
    expect(sim.margemDiaAntes).toBe(51);
    // remanescente: 40 + 20 + 8 = 68
    expect(sim.margemDiaDepois).toBe(68);
    expect(sim.margemDiaDelta).toBe(17); // positivo — descarte melhora
    expect(sim.margemDiaDelta).toBeGreaterThan(0);
  });

  it("CCS médio cai ao remover as vacas de CCS alto", () => {
    const sim = simularDescarte(pool, 2);
    // antes: (150+220+300+500+900)/5 = 414
    expect(sim.ccsMedioAntes).toBe(414);
    // depois (remove 900 e 500): (150+220+300)/3 = 223.33 → round 223
    expect(sim.ccsMedioDepois).toBe(223);
    expect(sim.ccsMedioDepois!).toBeLessThan(sim.ccsMedioAntes!);
  });

  it("n = 0 → nada sai, delta 0", () => {
    const sim = simularDescarte(pool, 0);
    expect(sim.cabecas).toBe(0);
    expect(sim.litrosDiaSai).toBe(0);
    expect(sim.margemDiaDelta).toBe(0);
    expect(sim.margemDiaDepois).toBe(sim.margemDiaAntes);
  });

  it("n acima do total é clampado ao total", () => {
    const sim = simularDescarte(pool, 99);
    expect(sim.n).toBe(5);
    expect(sim.cabecas).toBe(5);
    expect(sim.margemDiaDepois).toBe(0);
    expect(sim.ccsMedioDepois).toBeNull(); // ninguém sobrou
    expect(sim.scoreMedioDepois).toBe(0);
  });

  it("n negativo é clampado a 0", () => {
    const sim = simularDescarte(pool, -3);
    expect(sim.n).toBe(0);
    expect(sim.cabecas).toBe(0);
  });

  it("carteira vazia → tudo zero/null, sem quebrar", () => {
    const sim = simularDescarte([], 3);
    expect(sim.n).toBe(0);
    expect(sim.margemDiaAntes).toBe(0);
    expect(sim.margemDiaDepois).toBe(0);
    expect(sim.ccsMedioAntes).toBeNull();
    expect(sim.scoreMedioDepois).toBe(0);
  });
});
