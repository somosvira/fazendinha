import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { montarWhereLancamentos, normalizarPaginacao, parseValorTermo } from "./lancamentos-list.js";

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

  it("q → AND com OR (descricao + fornecedor.nome + categoria.nome contains, case-insensitive); trim aplicado", () => {
    const w = montarWhereLancamentos({ q: "  nutron  " });
    expect(w.AND).toEqual([
      {
        OR: [
          { descricao: { contains: "nutron", mode: "insensitive" } },
          { clienteFornecedor: { nome: { contains: "nutron", mode: "insensitive" } } },
          { categoria: { nome: { contains: "nutron", mode: "insensitive" } } },
        ],
      },
    ]);
  });

  it("q numérico → OR ganha cláusula valor exato (Decimal), além do texto", () => {
    const w = montarWhereLancamentos({ q: "1500,50" });
    const and = w.AND as Array<Record<string, unknown>>;
    expect(and).toHaveLength(1);
    const or = and[0].OR as Array<Record<string, unknown>>;
    expect(or).toHaveLength(4);
    // Últimas cláusulas: texto contains em cada campo textual + valor exato.
    expect(or[3]).toEqual({ valor: new Prisma.Decimal(1500.5) });
  });

  it("q numérico simples (só dígitos) → valor tratado como inteiro", () => {
    const w = montarWhereLancamentos({ q: "500" });
    const or = (w.AND as Array<Record<string, unknown>>)[0].OR as Array<Record<string, unknown>>;
    expect(or[3]).toEqual({ valor: new Prisma.Decimal(500) });
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
    // 2º grupo: busca textual (sem valor — "cocamar" não parseia como número)
    expect(and[1]).toEqual({
      OR: [
        { descricao: { contains: "cocamar", mode: "insensitive" } },
        { clienteFornecedor: { nome: { contains: "cocamar", mode: "insensitive" } } },
        { categoria: { nome: { contains: "cocamar", mode: "insensitive" } } },
      ],
    });
  });
});

describe("parseValorTermo", () => {
  it("dígitos puros → número", () => {
    expect(parseValorTermo("1500")).toBe(1500);
    expect(parseValorTermo("  500  ")).toBe(500);
  });
  it("BR com vírgula decimal → número correto", () => {
    expect(parseValorTermo("1500,50")).toBe(1500.5);
    expect(parseValorTermo("1.500,50")).toBe(1500.5);
    expect(parseValorTermo("1.234.567,89")).toBe(1234567.89);
  });
  it("prefixo R$ e espaços internos são tolerados", () => {
    expect(parseValorTermo("R$ 1.500,00")).toBe(1500);
    expect(parseValorTermo("r$1500")).toBe(1500);
  });
  it("ponto decimal (estilo EN) sem vírgula", () => {
    expect(parseValorTermo("1500.50")).toBe(1500.5);
  });
  it("termos não-numéricos → null", () => {
    expect(parseValorTermo("nutron")).toBe(null);
    expect(parseValorTermo("cocamar 500")).toBe(null); // tem letra
    expect(parseValorTermo("")).toBe(null);
    expect(parseValorTermo("   ")).toBe(null);
  });
  it("zero e negativos → null (não faz sentido buscar)", () => {
    expect(parseValorTermo("0")).toBe(null);
    expect(parseValorTermo("-100")).toBe(null); // hífen falha regex
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
