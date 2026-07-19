import { describe, it, expect } from "vitest";
import {
  pontosProducao, pontosCCS, pontosFertilidade, pontosIdade, pontosSaude, pontosRentab,
  classificar, scoreDoResumo, type ScoreInsumos,
} from "./score.calc.js";

describe("pontosProducao", () => {
  it("null/meta ausente/meta zero → 50 (neutro)", () => {
    expect(pontosProducao(null, 25)).toBe(50);
    expect(pontosProducao(20, null)).toBe(50);
    expect(pontosProducao(20, 0)).toBe(50);
  });
  it("proporção à meta, arredondada", () => {
    expect(pontosProducao(25, 25)).toBe(100);
    expect(pontosProducao(20, 25)).toBe(80);   // 80%
    expect(pontosProducao(15, 25)).toBe(60);
  });
  it("cap em 120 quando produz muito acima da meta", () => {
    expect(pontosProducao(40, 25)).toBe(120);  // 160% → cap
    expect(pontosProducao(30, 25)).toBe(120);  // 120% exato
    expect(pontosProducao(29, 25)).toBe(116);  // 116% < cap
  });
});

describe("pontosCCS", () => {
  it("null → 50", () => expect(pontosCCS(null)).toBe(50));
  it("faixas (limites inclusivos)", () => {
    expect(pontosCCS(200)).toBe(100);
    expect(pontosCCS(201)).toBe(70);
    expect(pontosCCS(400)).toBe(70);
    expect(pontosCCS(401)).toBe(40);
    expect(pontosCCS(750)).toBe(40);
    expect(pontosCCS(751)).toBe(10);
    expect(pontosCCS(1200)).toBe(10);
  });
});

describe("pontosFertilidade", () => {
  it("PRENHE → 90 (independe do IEP)", () => {
    expect(pontosFertilidade("PRENHE", null)).toBe(90);
    expect(pontosFertilidade("PRENHE", 500)).toBe(90);
  });
  it("sem IEP e não prenhe → 60", () => expect(pontosFertilidade("VAZIA", null)).toBe(60));
  it("faixas de IEP (menor = melhor)", () => {
    expect(pontosFertilidade("VAZIA", 380)).toBe(100);
    expect(pontosFertilidade("VAZIA", 381)).toBe(75);
    expect(pontosFertilidade("VAZIA", 420)).toBe(75);
    expect(pontosFertilidade("VAZIA", 421)).toBe(40);
  });
});

describe("pontosIdade", () => {
  const prime = { min: 3, max: 7 };
  it("null → 60", () => expect(pontosIdade(null, prime)).toBe(60));
  it("dentro do prime → 100", () => {
    expect(pontosIdade(3, prime)).toBe(100);
    expect(pontosIdade(5, prime)).toBe(100);
    expect(pontosIdade(7, prime)).toBe(100);
  });
  it("mais nova que o prime → 80", () => expect(pontosIdade(2, prime)).toBe(80));
  it("até 2 anos acima do prime → 75", () => {
    expect(pontosIdade(8, prime)).toBe(75);
    expect(pontosIdade(9, prime)).toBe(75);
  });
  it("bem mais velha → 50", () => expect(pontosIdade(10, prime)).toBe(50));
});

describe("pontosSaude", () => {
  it("zero ocorrências → 100", () => expect(pontosSaude(0)).toBe(100));
  it("penaliza 15 por ocorrência, piso 20", () => {
    expect(pontosSaude(1)).toBe(65);
    expect(pontosSaude(2)).toBe(50);
    expect(pontosSaude(4)).toBe(20);
    expect(pontosSaude(10)).toBe(20); // piso
  });
});

describe("pontosRentab", () => {
  it("null → 50", () => expect(pontosRentab(null)).toBe(50));
  it("faixas de margem", () => {
    expect(pontosRentab(0.30)).toBe(100);
    expect(pontosRentab(0.15)).toBe(75);
    expect(pontosRentab(0.14)).toBe(50);
    expect(pontosRentab(0)).toBe(50);
    expect(pontosRentab(-0.01)).toBe(20);
  });
});

describe("classificar", () => {
  it("fronteiras 85/70/55/40", () => {
    expect(classificar(85)).toEqual({ classificacao: "ELITE", estrelas: 5 });
    expect(classificar(84)).toEqual({ classificacao: "MUITO_BOA", estrelas: 4 });
    expect(classificar(70)).toEqual({ classificacao: "MUITO_BOA", estrelas: 4 });
    expect(classificar(69)).toEqual({ classificacao: "BOA", estrelas: 3 });
    expect(classificar(55)).toEqual({ classificacao: "BOA", estrelas: 3 });
    expect(classificar(54)).toEqual({ classificacao: "ATENCAO", estrelas: 2 });
    expect(classificar(40)).toEqual({ classificacao: "ATENCAO", estrelas: 2 });
    expect(classificar(39)).toEqual({ classificacao: "DESCARTE", estrelas: 1 });
    expect(classificar(0)).toEqual({ classificacao: "DESCARTE", estrelas: 1 });
  });
});

describe("scoreDoResumo", () => {
  const prime = { min: 3, max: 7 };

  it("animal perfeito → 100 (cap) e ELITE", () => {
    const insumos: ScoreInsumos = {
      producaoMediaDia: 30, metaProducao: 25, // 120 pts
      ccs: 150,                                // 100
      statusReprodutivo: "PRENHE", iepProjetado: null, // 90
      idadeAnos: 5, prime,                     // 100
      ocorrenciasRecentes: 0,                  // 100
      margem: 0.4,                             // 100
    };
    const s = scoreDoResumo(insumos);
    // 120*.3 + 100*.2 + 90*.2 + 100*.1 + 100*.1 + 100*.1 = 36+20+18+10+10+10 = 104 → cap 100
    expect(s.valor).toBe(100);
    expect(s.classificacao).toBe("ELITE");
    expect(s.estrelas).toBe(5);
    expect(s.fatores.map((f) => f.peso).reduce((a, b) => a + b)).toBe(100);
  });

  it("vaca ruim → score baixo e DESCARTE", () => {
    const insumos: ScoreInsumos = {
      producaoMediaDia: 8, metaProducao: 25,   // 32 pts
      ccs: 900,                                // 10
      statusReprodutivo: "VAZIA", iepProjetado: 500, // 40
      idadeAnos: 11, prime,                    // 50
      ocorrenciasRecentes: 3,                  // 35
      margem: -0.2,                            // 20
    };
    const s = scoreDoResumo(insumos);
    // 32*.3 + 10*.2 + 40*.2 + 50*.1 + 35*.1 + 20*.1 = 9.6+2+8+5+3.5+2 = 30.1 → round 30
    expect(s.valor).toBe(30);
    expect(s.classificacao).toBe("DESCARTE");
  });

  it("insumos neutros (tudo null) → valor 58, BOA", () => {
    const insumos: ScoreInsumos = {
      producaoMediaDia: null, metaProducao: null, // 50
      ccs: null,                                   // 50
      statusReprodutivo: null, iepProjetado: null, // 60
      idadeAnos: null, prime,                      // 60
      ocorrenciasRecentes: 0,                      // 100
      margem: null,                                // 50
    };
    const s = scoreDoResumo(insumos);
    // 50*.3 + 50*.2 + 60*.2 + 60*.1 + 100*.1 + 50*.1 = 15+10+12+6+10+5 = 58 → BOA
    expect(s.valor).toBe(58);
    expect(s.classificacao).toBe("BOA");
  });
});
