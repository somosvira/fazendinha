import { describe, it, expect } from "vitest";
import { agruparChuva } from "./chuva.calc.js";

describe("agruparChuva", () => {
  it("acumula por mês em ordem crescente (YYYY-MM)", () => {
    const r = agruparChuva([
      { data: "2026-03-10", mm: 12.5 },
      { data: "2026-01-05", mm: 8 },
      { data: "2026-01-20", mm: 2.5 },
      { data: "2026-03-01", mm: 0 }, // dia sem chuva (mm=0) não conta como "dia com chuva"
    ]);
    expect(r.meses.map((m) => m.mes)).toEqual(["2026-01", "2026-03"]);
    expect(r.meses).toEqual([
      { mes: "2026-01", total: 10.5, dias: 2 },
      { mes: "2026-03", total: 12.5, dias: 1 },
    ]);
  });

  it("total = soma de todos os mm; diasComChuva conta só mm > 0", () => {
    const r = agruparChuva([
      { data: "2026-05-01", mm: 5 },
      { data: "2026-05-02", mm: 0 },
      { data: "2026-05-03", mm: 3.2 },
    ]);
    expect(r.total).toBe(8.2);
    expect(r.diasComChuva).toBe(2);
  });

  it("arredonda somas a 1 casa (evita ruído de ponto flutuante)", () => {
    const r = agruparChuva([
      { data: "2026-02-01", mm: 0.1 },
      { data: "2026-02-02", mm: 0.2 },
    ]);
    expect(r.meses[0].total).toBe(0.3);
    expect(r.total).toBe(0.3);
  });

  it("vazio → zeros", () => {
    const r = agruparChuva([]);
    expect(r).toEqual({ meses: [], total: 0, diasComChuva: 0 });
  });

  it("agrupa vários dias no mesmo mês e soma o acumulado", () => {
    const r = agruparChuva([
      { data: "2026-04-01", mm: 10 },
      { data: "2026-04-15", mm: 20 },
      { data: "2026-04-30", mm: 5 },
    ]);
    expect(r.meses).toEqual([{ mes: "2026-04", total: 35, dias: 3 }]);
    expect(r.total).toBe(35);
    expect(r.diasComChuva).toBe(3);
  });
});
