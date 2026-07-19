import { describe, it, expect } from "vitest";
import {
  avaliarDescarte, avaliarReproducao, avaliarMastite, avaliarQueda, montarSugestoes,
  CCS_LIMITE, DEL_FASE_QUEDA, META_IEP, PISO_IMPACTO,
  type AnimalSugestao, type SugestoesConfig,
} from "./sugestoes.calc.js";

const cfg: SugestoesConfig = { pevDias: 60, precoLeite: 2, custoVacaDia: 10 };

// Animal "neutro" (nenhum gatilho liga); cada teste sobrescreve o que precisa.
function animal(p: Partial<AnimalSugestao> & { animalId: number }): AnimalSugestao {
  return {
    numero: String(p.animalId), nome: null,
    score: 70, classificacao: "MUITO_BOA",
    producaoDia: 20, ccs: 150, ccsTendencia: "estavel", producaoTendencia: "estavel",
    statusReprodutivo: "PRENHE", del: 100, margemDiaEstimada: 15, mastites12m: 0,
    ...p,
  };
}

describe("avaliarDescarte", () => {
  it("classificação DESCARTE liga; impacto = margem drenada (positiva)", () => {
    const s = avaliarDescarte(animal({ animalId: 1, classificacao: "DESCARTE", margemDiaEstimada: -4 }));
    expect(s?.tipo).toBe("DESCARTE");
    expect(s?.impactoDiaEstimado).toBe(4);
    expect(s?.prazoDias).toBeNull();
  });
  it("ATENCAO só liga com margem <= 0", () => {
    expect(avaliarDescarte(animal({ animalId: 2, classificacao: "ATENCAO", margemDiaEstimada: 5 }))).toBeNull();
    expect(avaliarDescarte(animal({ animalId: 3, classificacao: "ATENCAO", margemDiaEstimada: 0 }))?.tipo).toBe("DESCARTE");
    expect(avaliarDescarte(animal({ animalId: 4, classificacao: "ATENCAO", margemDiaEstimada: -2 }))?.impactoDiaEstimado).toBe(2);
  });
  it("margem positiva com DESCARTE → impacto 0 (drena nada), ainda gera card", () => {
    const s = avaliarDescarte(animal({ animalId: 5, classificacao: "DESCARTE", margemDiaEstimada: 3 }));
    expect(s?.impactoDiaEstimado).toBe(0);
  });
  it("classe boa não liga", () => {
    expect(avaliarDescarte(animal({ animalId: 6, classificacao: "BOA", margemDiaEstimada: -10 }))).toBeNull();
  });
});

describe("avaliarReproducao", () => {
  it("vazia além do PEV liga; impacto = custoVacaDia; prazo = META_IEP - del", () => {
    const s = avaliarReproducao(animal({ animalId: 1, statusReprodutivo: "VAZIA", del: 90 }), cfg);
    expect(s?.tipo).toBe("REPRODUCAO");
    expect(s?.impactoDiaEstimado).toBe(10);
    expect(s?.prazoDias).toBe(META_IEP - 90);
  });
  it("del no PEV (não > PEV) não liga", () => {
    expect(avaliarReproducao(animal({ animalId: 2, statusReprodutivo: "VAZIA", del: 60 }), cfg)).toBeNull();
  });
  it("prenhe não liga", () => {
    expect(avaliarReproducao(animal({ animalId: 3, statusReprodutivo: "PRENHE", del: 200 }), cfg)).toBeNull();
  });
  it("custoVacaDia null → impacto 0", () => {
    const s = avaliarReproducao(animal({ animalId: 4, statusReprodutivo: "VAZIA", del: 120 }), { ...cfg, custoVacaDia: null });
    expect(s?.impactoDiaEstimado).toBe(0);
  });
});

describe("avaliarMastite", () => {
  const base = { statusReprodutivo: "VAZIA", ccs: CCS_LIMITE + 100, ccsTendencia: "subindo", mastites12m: 2, producaoDia: 20 };
  it("CCS alta + subindo + >=2 mastites liga; impacto = 15% da receita/dia", () => {
    const s = avaliarMastite(animal({ animalId: 1, ...base }), cfg);
    expect(s?.tipo).toBe("MASTITE");
    // receita/dia = 20*2 = 40; 15% = 6
    expect(s?.impactoDiaEstimado).toBe(6);
  });
  it("CCS na fronteira (== limite) não liga", () => {
    expect(avaliarMastite(animal({ animalId: 2, ...base, ccs: CCS_LIMITE }), cfg)).toBeNull();
  });
  it("CCS caindo não liga", () => {
    expect(avaliarMastite(animal({ animalId: 3, ...base, ccsTendencia: "caindo" }), cfg)).toBeNull();
  });
  it("só 1 mastite não liga", () => {
    expect(avaliarMastite(animal({ animalId: 4, ...base, mastites12m: 1 }), cfg)).toBeNull();
  });
});

describe("avaliarQueda", () => {
  it("descendo antes do DEL de fase liga; impacto = 10% da receita/dia", () => {
    const s = avaliarQueda(animal({ animalId: 1, producaoTendencia: "descendo", del: 120, producaoDia: 25 }), cfg);
    expect(s?.tipo).toBe("QUEDA_PRODUCAO");
    // receita/dia = 25*2 = 50; 10% = 5
    expect(s?.impactoDiaEstimado).toBe(5);
  });
  it("DEL >= fase (fim natural) não liga", () => {
    expect(avaliarQueda(animal({ animalId: 2, producaoTendencia: "descendo", del: DEL_FASE_QUEDA }), cfg)).toBeNull();
    expect(avaliarQueda(animal({ animalId: 3, producaoTendencia: "descendo", del: DEL_FASE_QUEDA + 30 }), cfg)).toBeNull();
  });
  it("estável não liga", () => {
    expect(avaliarQueda(animal({ animalId: 4, producaoTendencia: "estavel", del: 100 }), cfg)).toBeNull();
  });
});

describe("montarSugestoes", () => {
  it("ordena por impacto desc, agrega totalPorTipo e impactoDiaTotal", () => {
    const pool = [
      animal({ animalId: 1, classificacao: "DESCARTE", margemDiaEstimada: -8 }),           // descarte, impacto 8
      animal({ animalId: 2, statusReprodutivo: "VAZIA", del: 100 }),                        // repro, impacto 10
      animal({ animalId: 3, statusReprodutivo: "VAZIA", del: 100, ccs: 900, ccsTendencia: "subindo", mastites12m: 3, producaoDia: 30 }), // repro(10)+mastite(9)
    ];
    const out = montarSugestoes(pool, cfg);
    // impactos: 10 (repro#2), 10 (repro#3), 9 (mastite#3), 8 (descarte#1)
    expect(out.sugestoes.map((s) => s.impactoDiaEstimado)).toEqual([10, 10, 9, 8]);
    expect(out.totalPorTipo).toEqual({ DESCARTE: 1, REPRODUCAO: 2, MASTITE: 1, QUEDA_PRODUCAO: 0 });
    expect(out.impactoDiaTotal).toBe(37);
  });

  it("animal com 2 gatilhos gera 2 cards", () => {
    const pool = [
      animal({ animalId: 9, classificacao: "DESCARTE", margemDiaEstimada: -5, statusReprodutivo: "VAZIA", del: 150 }),
    ];
    const out = montarSugestoes(pool, cfg);
    expect(out.sugestoes.map((s) => s.tipo).sort()).toEqual(["DESCARTE", "REPRODUCAO"]);
  });

  it("corta sugestões abaixo do piso de impacto", () => {
    // descarte com margem positiva → impacto 0 < PISO → cortado
    const pool = [animal({ animalId: 1, classificacao: "DESCARTE", margemDiaEstimada: 5 })];
    const out = montarSugestoes(pool, cfg);
    expect(PISO_IMPACTO).toBeGreaterThan(0);
    expect(out.sugestoes).toEqual([]);
    expect(out.impactoDiaTotal).toBe(0);
  });

  it("pool vazio → tudo zero", () => {
    const out = montarSugestoes([], cfg);
    expect(out.sugestoes).toEqual([]);
    expect(out.impactoDiaTotal).toBe(0);
    expect(out.totalPorTipo).toEqual({ DESCARTE: 0, REPRODUCAO: 0, MASTITE: 0, QUEDA_PRODUCAO: 0 });
  });
});
