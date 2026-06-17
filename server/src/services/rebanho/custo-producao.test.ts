import { describe, it, expect } from "vitest";
import { quebrarPorCategoria } from "./custo-producao.js";

describe("quebrarPorCategoria", () => {
  it("lista vazia → total 0, linhas []", () => {
    expect(quebrarPorCategoria([])).toEqual({ total: 0, linhas: [] });
  });

  it("soma por categoria, ordena por valor desc e calcula pct sobre o total", () => {
    const q = quebrarPorCategoria([
      { categoria: "Ração", valor: 100 },
      { categoria: "Ração", valor: 100 },
      { categoria: "Pessoal", valor: 100 },
    ]);
    expect(q.total).toBe(300);
    expect(q.linhas).toEqual([
      { categoria: "Ração", valor: 200, pct: 66.7 },
      { categoria: "Pessoal", valor: 100, pct: 33.3 },
    ]);
  });

  it("total 0 → pct 0 (não divide por zero)", () => {
    const q = quebrarPorCategoria([
      { categoria: "Ração", valor: 0 },
      { categoria: "Pessoal", valor: 0 },
    ]);
    expect(q.total).toBe(0);
    expect(q.linhas.every((l) => l.pct === 0)).toBe(true);
  });
});
