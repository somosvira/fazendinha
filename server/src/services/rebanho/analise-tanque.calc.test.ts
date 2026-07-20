import { describe, expect, it } from "vitest";
import { agregarTanque, type AnaliseTanqueLeitura } from "./analise-tanque.calc.js";

const a = (data: string, ccs: number | null, cbt: number | null = null, gordura: number | null = null, proteina: number | null = null): AnaliseTanqueLeitura =>
  ({ data, ccs, cbt, gordura, proteina });

describe("agregarTanque", () => {
  it("sem análises → tudo null/vazio", () => {
    const r = agregarTanque([]);
    expect(r.total).toBe(0);
    expect(r.ultima).toBeNull();
    expect(r.tendenciaCCS).toEqual([]);
    expect(r.tendenciaCBT).toEqual([]);
  });

  it("última = análise de data mais recente", () => {
    const r = agregarTanque([a("2026-05-01", 300, 50), a("2026-06-01", 250, 40)]);
    expect(r.ultima?.data).toBe("2026-06-01");
    expect(r.ultima?.ccs).toBe(250);
    expect(r.ultima?.cbt).toBe(40);
  });

  it("tendências ordenadas por data asc; ignora leituras sem o valor", () => {
    const r = agregarTanque([a("2026-06-01", 250, null), a("2026-05-01", 300, 50), a("2026-04-01", null, 60)]);
    expect(r.tendenciaCCS).toEqual([{ data: "2026-05-01", valor: 300 }, { data: "2026-06-01", valor: 250 }]);
    expect(r.tendenciaCBT).toEqual([{ data: "2026-04-01", valor: 60 }, { data: "2026-05-01", valor: 50 }]);
  });

  it("médias de gordura/proteína ignoram nulos", () => {
    const r = agregarTanque([a("2026-05-01", 300, 50, 3.6, 3.2), a("2026-06-01", 250, 40, 3.8, null)]);
    expect(r.gorduraMedia).toBeCloseTo(3.7, 5);
    expect(r.proteinaMedia).toBeCloseTo(3.2, 5);
  });

  it("conta o total de análises", () => {
    expect(agregarTanque([a("2026-05-01", 300), a("2026-06-01", 250)]).total).toBe(2);
  });
});
