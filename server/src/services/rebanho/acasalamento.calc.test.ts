import { describe, expect, it } from "vitest";
import { recomendar, type ReprodutorCand } from "./acasalamento.calc.js";

const b = (id: number, nome: string, ptaLeite: number | null, tpi: number | null = null, codigo: string | null = null): ReprodutorCand =>
  ({ id, nome, codigo, ptaLeite, tpi });

describe("recomendar", () => {
  it("catálogo vazio → []", () => {
    expect(recomendar({ paiNome: null }, [])).toEqual([]);
  });

  it("ordena por score desc (maior mérito primeiro)", () => {
    const r = recomendar({ paiNome: null }, [b(1, "A", 800, 2400), b(2, "B", 1200, 2900), b(3, "C", 1000, 2600)]);
    expect(r.map((x) => x.id)).toEqual([2, 3, 1]);
    expect(r[0].score).toBeGreaterThanOrEqual(r[1].score);
  });

  it("marca consanguíneo quando o touro é o pai da vaca (por nome, case-insensitive)", () => {
    const r = recomendar({ paiNome: "touro b" }, [b(1, "A", 800), b(2, "Touro B", 1200)]);
    const b2 = r.find((x) => x.id === 2)!;
    expect(b2.consanguineo).toBe(true);
    // consanguíneo vai para o fim (score zerado)
    expect(r[r.length - 1].id).toBe(2);
  });

  it("consanguíneo por código também é detectado", () => {
    const r = recomendar({ paiNome: "HOLUSA123" }, [b(1, "Fulano", 900, null, "HOLUSA123")]);
    expect(r[0].consanguineo).toBe(true);
  });

  it("sem PTAs → score 0 mas ainda lista (sem métrica de mérito)", () => {
    const r = recomendar({ paiNome: null }, [b(1, "A", null, null)]);
    expect(r).toHaveLength(1);
    expect(r[0].score).toBe(0);
  });

  it("normaliza: o melhor em todas as métricas tem score 1", () => {
    const r = recomendar({ paiNome: null }, [b(1, "A", 1000, 3000), b(2, "B", 500, 2000)]);
    const a = r.find((x) => x.id === 1)!;
    expect(a.score).toBeCloseTo(1, 5);
  });

  it("dá um motivo textual", () => {
    const r = recomendar({ paiNome: null }, [b(1, "A", 1000, 3000)]);
    expect(typeof r[0].motivo).toBe("string");
    expect(r[0].motivo.length).toBeGreaterThan(0);
  });
});
