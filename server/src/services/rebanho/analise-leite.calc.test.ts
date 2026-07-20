import { describe, expect, it } from "vitest";
import { agregarAnaliseLeite, classificarCCS, LIMIAR_CCS_ATENCAO, LIMIAR_CCS_ALARME, type LeituraLeite } from "./analise-leite.calc.js";

describe("classificarCCS", () => {
  it("classifica pelas faixas (excelente < 200 ≤ atenção < 400 ≤ alarme)", () => {
    expect(classificarCCS(150)).toBe("EXCELENTE");
    expect(classificarCCS(199)).toBe("EXCELENTE");
    expect(classificarCCS(200)).toBe("ATENCAO");
    expect(classificarCCS(399)).toBe("ATENCAO");
    expect(classificarCCS(400)).toBe("ALARME");
    expect(classificarCCS(1200)).toBe("ALARME");
  });
  it("limiares expostos batem com as faixas", () => {
    expect(LIMIAR_CCS_ATENCAO).toBe(200);
    expect(LIMIAR_CCS_ALARME).toBe(400);
  });
});

const leitura = (animalId: number, data: string, ccs: number | null, gordura: number | null = null, proteina: number | null = null): LeituraLeite =>
  ({ animalId, data, ccs, gordura, proteina });

describe("agregarAnaliseLeite", () => {
  it("sem leituras → tudo zerado/vazio", () => {
    const r = agregarAnaliseLeite([]);
    expect(r.totalLeituras).toBe(0);
    expect(r.tendenciaCCS).toEqual([]);
    expect(r.ccsMedioAtual).toBeNull();
    expect(r.distribuicao).toEqual({ EXCELENTE: 0, ATENCAO: 0, ALARME: 0 });
  });

  it("agrupa CCS por mês (YYYY-MM) e tira a média do rebanho", () => {
    const r = agregarAnaliseLeite([
      leitura(1, "2026-05-10", 100),
      leitura(2, "2026-05-20", 300),
      leitura(1, "2026-06-05", 500),
    ]);
    expect(r.tendenciaCCS).toEqual([
      { mes: "2026-05", ccsMedio: 200, leituras: 2 },
      { mes: "2026-06", ccsMedio: 500, leituras: 1 },
    ]);
  });

  it("distribuição por faixa usa a leitura MAIS RECENTE de cada animal", () => {
    const r = agregarAnaliseLeite([
      leitura(1, "2026-05-01", 800), // antiga (alarme) — ignorada
      leitura(1, "2026-06-01", 150), // recente (excelente) — conta
      leitura(2, "2026-06-01", 300), // atenção
      leitura(3, "2026-06-01", 900), // alarme
    ]);
    expect(r.distribuicao).toEqual({ EXCELENTE: 1, ATENCAO: 1, ALARME: 1 });
    expect(r.animaisComLeitura).toBe(3);
  });

  it("ccsMedioAtual = média das leituras mais recentes por animal", () => {
    const r = agregarAnaliseLeite([
      leitura(1, "2026-06-01", 100),
      leitura(2, "2026-06-01", 300),
    ]);
    expect(r.ccsMedioAtual).toBe(200);
  });

  it("médias de gordura/proteína ignoram leituras nulas", () => {
    const r = agregarAnaliseLeite([
      leitura(1, "2026-06-01", 100, 3.5, 3.2),
      leitura(2, "2026-06-01", 200, 3.7, null),
      leitura(3, "2026-06-01", 300, null, 3.0),
    ]);
    expect(r.gorduraMedia).toBeCloseTo(3.6, 5); // (3.5+3.7)/2
    expect(r.proteinaMedia).toBeCloseTo(3.1, 5); // (3.2+3.0)/2
  });

  it("leituras sem CCS não entram na tendência nem na distribuição", () => {
    const r = agregarAnaliseLeite([
      leitura(1, "2026-06-01", null, 3.5),
      leitura(2, "2026-06-01", 200),
    ]);
    expect(r.totalLeituras).toBe(2);
    expect(r.tendenciaCCS).toEqual([{ mes: "2026-06", ccsMedio: 200, leituras: 1 }]);
    expect(r.animaisComLeitura).toBe(1);
  });

  it("piores animais: top por CCS da leitura mais recente, desc", () => {
    const r = agregarAnaliseLeite([
      leitura(1, "2026-06-01", 150),
      leitura(2, "2026-06-01", 900),
      leitura(3, "2026-06-01", 500),
    ]);
    expect(r.pioresAnimais.map((a) => a.animalId)).toEqual([2, 3, 1]);
    expect(r.pioresAnimais[0].ccs).toBe(900);
  });
});
