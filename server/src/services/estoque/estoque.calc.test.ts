import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { saldoProduto, custoVacaDia, custoMedioProduto, valorSaida, type MovIn, type MovCustoIn } from "./estoque.calc.js";

const HOJE = "2026-06-17";

describe("saldoProduto", () => {
  it("entrada soma e saída subtrai (saldo + valor)", () => {
    const movs: MovIn[] = [
      { tipo: "ENTRADA", quantidade: 100, valorTotal: 200, data: HOJE },
      { tipo: "SAIDA", quantidade: 30, valorTotal: 60, data: HOJE },
    ];
    expect(saldoProduto(movs)).toEqual({ saldo: 70, valor: 140 });
  });

  it("lista vazia → saldo e valor zero", () => {
    expect(saldoProduto([])).toEqual({ saldo: 0, valor: 0 });
  });

  it("AJUSTE com quantidade negativa subtrai (mesmo sinal no valor)", () => {
    const movs: MovIn[] = [
      { tipo: "ENTRADA", quantidade: 100, valorTotal: 200, data: HOJE },
      { tipo: "AJUSTE", quantidade: -10, valorTotal: -20, data: HOJE },
    ];
    expect(saldoProduto(movs)).toEqual({ saldo: 90, valor: 180 });
  });
});

describe("custoVacaDia", () => {
  it("consumo ÷ (vacas × dias)", () => {
    // 2100 / (7 * 30) = 10
    expect(custoVacaDia([{ valorTotal: 2100, data: HOJE }], 7, HOJE, 30)).toBe(10);
  });

  it("vacas em lactação = 0 → null", () => {
    expect(custoVacaDia([{ valorTotal: 2100, data: HOJE }], 0, HOJE, 30)).toBeNull();
  });

  it("saída fora do período (mais de 30 dias atrás) é ignorada", () => {
    const antiga = "2026-04-01"; // > 30 dias antes de 2026-06-17
    expect(custoVacaDia([{ valorTotal: 2100, data: antiga }], 7, HOJE, 30)).toBe(0);
  });
});

describe("custoMedioProduto", () => {
  const D = (v: number | string) => new Prisma.Decimal(v);
  const compra = (q: number, v: number, extra: Partial<MovCustoIn> = {}): MovCustoIn => ({ tipo: "ENTRADA", origem: "COMPRA", status: "CONFIRMADO", reversaoDeId: null, quantidade: D(q), valorTotal: D(v), ...extra });

  it("sem entradas → custo null", () => {
    const r = custoMedioProduto([]);
    expect(r.custoMedio).toBeNull();
    expect(r.quantidade.toNumber()).toBe(0);
    expect(r.valor.toNumber()).toBe(0);
  });

  it("duas compras 10×5 + 10×7 → 6", () => {
    const r = custoMedioProduto([compra(10, 50), compra(10, 70)]);
    expect(r.custoMedio?.toNumber()).toBe(6);
    expect(r.quantidade.toNumber()).toBe(20);
    expect(r.valor.toNumber()).toBe(120);
  });

  it("compra estornada (original REVERTIDO + inverso) é ignorada", () => {
    const r = custoMedioProduto([
      compra(10, 50),
      compra(10, 70, { status: "REVERTIDO" }),
      { tipo: "SAIDA", origem: "AJUSTE_INVENTARIO", status: "CONFIRMADO", reversaoDeId: 2, quantidade: D(10), valorTotal: D(70) },
    ]);
    expect(r.custoMedio?.toNumber()).toBe(5);
  });

  it("inverso de entrada com reversaoDeId nunca entra, mesmo se ENTRADA", () => {
    expect(custoMedioProduto([compra(10, 50), compra(10, 90, { reversaoDeId: 1 })]).custoMedio?.toNumber()).toBe(5);
  });

  it("AJUSTE negativo é ignorado", () => {
    const r = custoMedioProduto([compra(10, 50), { tipo: "AJUSTE", origem: "AJUSTE_INVENTARIO", status: "CONFIRMADO", reversaoDeId: null, quantidade: D(-5), valorTotal: D(-100) }]);
    expect(r.custoMedio?.toNumber()).toBe(5);
    expect(r.quantidade.toNumber()).toBe(10);
  });

  it("AJUSTE positivo com valor entra na média; sem valor, não", () => {
    const ajuste = (q: number, v: number): MovCustoIn => ({ tipo: "AJUSTE", origem: "AJUSTE_INVENTARIO", status: "CONFIRMADO", reversaoDeId: null, quantidade: D(q), valorTotal: D(v) });
    expect(custoMedioProduto([compra(10, 50), ajuste(10, 110)]).custoMedio?.toNumber()).toBe(8);
    expect(custoMedioProduto([compra(10, 50), ajuste(10, 0)]).custoMedio?.toNumber()).toBe(5);
  });

  it("saídas e entradas de outras origens não afetam", () => {
    const r = custoMedioProduto([
      compra(10, 50),
      { tipo: "SAIDA", origem: "NUTRICAO", status: "CONFIRMADO", reversaoDeId: null, quantidade: D(4), valorTotal: D(99) },
      { tipo: "SAIDA", origem: "COMPRA", status: "CONFIRMADO", reversaoDeId: null, quantidade: D(4), valorTotal: D(99) },
      compra(10, 999, { origem: "DEVOLUCAO" }),
    ]);
    expect(r.custoMedio?.toNumber()).toBe(5);
  });

  it("bonificação, produção e inventário inicial entram", () => {
    const r = custoMedioProduto([compra(1, 3, { origem: "BONIFICACAO" }), compra(1, 6, { origem: "PRODUCAO" }), compra(1, 9, { origem: "INVENTARIO_INICIAL" })]);
    expect(r.custoMedio?.toNumber()).toBe(6);
  });
});

describe("valorSaida", () => {
  it("quantidade × custo com 2 casas; sem custo → 0", () => {
    expect(valorSaida(3, new Prisma.Decimal("3.3333")).valorTotal.toNumber()).toBe(10);
    expect(valorSaida(3, null)).toEqual({ custoUnitario: new Prisma.Decimal(0), valorTotal: new Prisma.Decimal(0) });
  });
});
