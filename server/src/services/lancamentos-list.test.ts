import { describe, it, expect } from "vitest";
import { montarWhereLancamentos, normalizarPaginacao } from "./lancamentos-list.js";

// Testa o núcleo PURO da listagem: montagem do `where` (data de caixa via OR,
// busca textual via OR, combinação por AND) e normalização da paginação.

const FROM = new Date(Date.UTC(2026, 4, 1)); // 01/05/2026
const TO = new Date(Date.UTC(2026, 4, 31)); // 31/05/2026

describe("montarWhereLancamentos", () => {
  it("sem filtros → só exclui estornado, sem AND", () => {
    const w = montarWhereLancamentos({});
    expect(w.estornado).toBe(false);
    expect(w.AND).toBeUndefined();
    expect(w.natureza).toBeUndefined();
    expect(w.situacao).toBeUndefined();
    expect(w.categoriaId).toBeUndefined();
  });

  it("natureza / situacao / categoriaId viram filtros diretos", () => {
    const w = montarWhereLancamentos({ natureza: "DEBITO", situacao: "LIQUIDADO", categoriaId: 7 });
    expect(w.natureza).toBe("DEBITO");
    expect(w.situacao).toBe("LIQUIDADO");
    expect(w.categoriaId).toBe(7);
  });

  it("from+to → AND com OR de data de caixa (liquidacao no range OU competencia no range)", () => {
    const w = montarWhereLancamentos({ from: FROM, to: TO });
    const and = w.AND as Array<Record<string, unknown>>;
    expect(Array.isArray(and)).toBe(true);
    expect(and).toHaveLength(1);
    expect(and[0]).toEqual({
      OR: [
        { dataLiquidacao: { not: null, gte: FROM, lte: TO } },
        { dataLiquidacao: null, dataCompetencia: { gte: FROM, lte: TO } },
      ],
    });
  });

  it("só from → range só com gte; só to → range só com lte", () => {
    const wFrom = montarWhereLancamentos({ from: FROM });
    expect(wFrom.AND).toEqual([
      {
        OR: [
          { dataLiquidacao: { not: null, gte: FROM } },
          { dataLiquidacao: null, dataCompetencia: { gte: FROM } },
        ],
      },
    ]);
    const wTo = montarWhereLancamentos({ to: TO });
    expect(wTo.AND).toEqual([
      {
        OR: [
          { dataLiquidacao: { not: null, lte: TO } },
          { dataLiquidacao: null, dataCompetencia: { lte: TO } },
        ],
      },
    ]);
  });

  it("q → AND com OR (descricao contains + fornecedor.nome contains, case-insensitive); trim aplicado", () => {
    const w = montarWhereLancamentos({ q: "  nutron  " });
    expect(w.AND).toEqual([
      {
        OR: [
          { descricao: { contains: "nutron", mode: "insensitive" } },
          { clienteFornecedor: { nome: { contains: "nutron", mode: "insensitive" } } },
        ],
      },
    ]);
  });

  it("q vazio/só espaços → ignorado (sem AND)", () => {
    expect(montarWhereLancamentos({ q: "   " }).AND).toBeUndefined();
    expect(montarWhereLancamentos({ q: "" }).AND).toBeUndefined();
  });

  it("propriedadeId → filtro direto (escopo do sítio)", () => {
    const w = montarWhereLancamentos({ propriedadeId: 2 });
    expect(w.propriedadeId).toBe(2);
    expect(w.estornado).toBe(false);
  });

  it("propriedadeId null/ausente → sem filtro de sítio (consolidado)", () => {
    expect(montarWhereLancamentos({ propriedadeId: null }).propriedadeId).toBeUndefined();
    expect(montarWhereLancamentos({}).propriedadeId).toBeUndefined();
  });

  it("from+to + natureza + q combinam: natureza direto, AND com 2 grupos OR (data, depois busca)", () => {
    const w = montarWhereLancamentos({ from: FROM, to: TO, natureza: "CREDITO", q: "cocamar" });
    expect(w.natureza).toBe("CREDITO");
    expect(w.estornado).toBe(false);
    const and = w.AND as Array<Record<string, unknown>>;
    expect(and).toHaveLength(2);
    // 1º grupo: data de caixa
    expect(and[0]).toHaveProperty("OR");
    expect((and[0].OR as unknown[])[0]).toEqual({ dataLiquidacao: { not: null, gte: FROM, lte: TO } });
    // 2º grupo: busca textual
    expect(and[1]).toEqual({
      OR: [
        { descricao: { contains: "cocamar", mode: "insensitive" } },
        { clienteFornecedor: { nome: { contains: "cocamar", mode: "insensitive" } } },
      ],
    });
  });
});

describe("normalizarPaginacao", () => {
  it("default: limit 50, offset 0", () => {
    expect(normalizarPaginacao({})).toEqual({ limit: 50, offset: 0 });
  });
  it("clampa limit em [1, 200] e offset em [0, ∞)", () => {
    expect(normalizarPaginacao({ limit: 999 })).toEqual({ limit: 200, offset: 0 });
    expect(normalizarPaginacao({ limit: 0 })).toEqual({ limit: 1, offset: 0 });
    expect(normalizarPaginacao({ limit: 25, offset: 100 })).toEqual({ limit: 25, offset: 100 });
    expect(normalizarPaginacao({ offset: -5 })).toEqual({ limit: 50, offset: 0 });
  });
});
