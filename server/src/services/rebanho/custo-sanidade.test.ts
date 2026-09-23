import { beforeEach, describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  produtoFindMany: vi.fn(),
  movimentoFindMany: vi.fn(),
  obterBasesCusto: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    produto: { findMany: mocks.produtoFindMany },
    movimentoEstoque: { findMany: mocks.movimentoFindMany },
  },
}));
vi.mock("../estoque/estoque.js", () => ({ obterBasesCusto: mocks.obterBasesCusto }));

import { custoMedioPorAplicacao, iniciarAnimalAplic, precoPorAplicacao, ratearCustoSanidade } from "./custo-sanidade.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.produtoFindMany.mockResolvedValue([]);
  mocks.movimentoFindMany.mockResolvedValue([]);
  mocks.obterBasesCusto.mockResolvedValue(new Map());
});

describe("iniciarAnimalAplic", () => {
  it("mantém nome ausente como null para não repetir o número", () => {
    expect(iniciarAnimalAplic("0942", null)).toEqual({ numero: "0942", nome: null, n: 0 });
  });
});

describe("ratearCustoSanidade", () => {
  it("rateia por volume e ordena por custo desc", () => {
    const r = ratearCustoSanidade(1000, [
      { numero: "1", nome: "A", n: 3 },
      { numero: "2", nome: "B", n: 1 },
    ]);
    expect(r.totalAplicacoes).toBe(4);
    expect(r.custoPorAplicacao).toBe(250);
    expect(r.animais[0]).toEqual({ numero: "1", nome: "A", n: 3, custoEstimado: 750 });
    expect(r.animais[1].custoEstimado).toBe(250);
  });

  it("zero aplicações → custoPorAplicacao 0, sem divisão por zero", () => {
    const r = ratearCustoSanidade(1000, []);
    expect(r.custoPorAplicacao).toBe(0);
    expect(r.animais).toEqual([]);
    expect(r.totalAplicacoes).toBe(0);
  });
});

describe("precoPorAplicacao (custo real de cada aplicação)", () => {
  // 25.000 mL por R$ 11,25: custo real 0,00045/mL, exibido como 0,0005.
  const baseMl = { quantidade: new Prisma.Decimal(25000), valor: new Prisma.Decimal("11.25") };

  it("movimento confirmado com valorTotal 0 (baixa sem base) não é 'custo R$ 0,00' — sem base atual, devolve null", async () => {
    const aplic = { produtoId: 3, produto: "Antibiótico", quantidadeUsada: new Prisma.Decimal(20), movimentoEstoqueId: 501 };
    mocks.movimentoFindMany.mockResolvedValue([{ id: 501, valorTotal: new Prisma.Decimal(0) }]);
    const precoDe = await precoPorAplicacao([aplic], 7);
    expect(mocks.movimentoFindMany).toHaveBeenCalled();
    expect(precoDe(aplic)).toBeNull();
  });

  it("movimento com valorTotal 0 cai no caminho quantidade × base, como se não houvesse movimento", async () => {
    const aplic = { produtoId: 3, produto: "Antibiótico", quantidadeUsada: new Prisma.Decimal(10000), movimentoEstoqueId: 501 };
    mocks.movimentoFindMany.mockResolvedValue([{ id: 501, valorTotal: new Prisma.Decimal(0) }]);
    mocks.obterBasesCusto.mockResolvedValue(new Map([[3, baseMl]]));
    const precoDe = await precoPorAplicacao([aplic], 7);
    expect(precoDe(aplic)).toBe(4.5);
  });

  it("movimento com valor > 0 prevalece sobre a base", async () => {
    const aplic = { produtoId: 3, produto: "Antibiótico", quantidadeUsada: new Prisma.Decimal(10000), movimentoEstoqueId: 501 };
    mocks.movimentoFindMany.mockResolvedValue([{ id: 501, valorTotal: new Prisma.Decimal("4.10") }]);
    mocks.obterBasesCusto.mockResolvedValue(new Map([[3, baseMl]]));
    const precoDe = await precoPorAplicacao([aplic], 7);
    expect(precoDe(aplic)).toBe(4.1);
  });

  it("movimento REVERTIDO (fora do findMany de CONFIRMADO) continua null, mesmo com base", async () => {
    const aplic = { produtoId: 3, produto: "Antibiótico", quantidadeUsada: new Prisma.Decimal(10000), movimentoEstoqueId: 501 };
    mocks.movimentoFindMany.mockResolvedValue([]);
    mocks.obterBasesCusto.mockResolvedValue(new Map([[3, baseMl]]));
    const precoDe = await precoPorAplicacao([aplic], 7);
    expect(mocks.movimentoFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: [501] }, status: "CONFIRMADO" }) }));
    expect(precoDe(aplic)).toBeNull();
  });

  it("sem movimento, quantidade × base não-redonda dá o valor exato, não o custo médio arredondado × quantidade", async () => {
    const aplic = { produtoId: 3, produto: "Antibiótico", quantidadeUsada: new Prisma.Decimal(10000), movimentoEstoqueId: null };
    mocks.obterBasesCusto.mockResolvedValue(new Map([[3, baseMl]]));
    const precoDe = await precoPorAplicacao([aplic], 7);
    expect(precoDe(aplic)).toBe(4.5); // 10.000 × 11,25 ÷ 25.000 — não 10.000 × 0,0005 = 5,00
    const custoMedioDe = await custoMedioPorAplicacao([aplic], 7);
    expect(custoMedioDe(aplic)).toBe(0.0005); // exibição continua a 4 casas
  });

  it("sem movimento nem base de custo → null", async () => {
    const aplic = { produtoId: 3, produto: "Antibiótico", quantidadeUsada: 5, movimentoEstoqueId: null };
    const precoDe = await precoPorAplicacao([aplic], 7);
    expect(precoDe(aplic)).toBeNull();
  });
});
