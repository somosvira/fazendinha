import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  produtoFindMany: vi.fn(),
  movimentoFindMany: vi.fn(),
  obterCustosMedios: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    produto: { findMany: mocks.produtoFindMany },
    movimentoEstoque: { findMany: mocks.movimentoFindMany },
  },
}));
vi.mock("../estoque/estoque.js", () => ({ obterCustosMedios: mocks.obterCustosMedios }));

import { Prisma } from "@prisma/client";
import { precoPorAplicacao } from "./custo-sanidade.js";
import { escolherCustoSanidadeAnimal, somarCustoSanidadeExato } from "./insights.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.produtoFindMany.mockResolvedValue([]);
  mocks.movimentoFindMany.mockResolvedValue([]);
  mocks.obterCustosMedios.mockResolvedValue(new Map());
});

describe("somarCustoSanidadeExato", () => {
  it("soma só as aplicações com custo apurado, ignorando null", () => {
    const precoDe = (a: { produtoId: number | null }) => (a.produtoId === 1 ? 12.4 : null);
    const total = somarCustoSanidadeExato(
      [{ produtoId: 1, produto: "A" }, { produtoId: 2, produto: "B" }, { produtoId: 1, produto: "A" }],
      precoDe,
    );
    expect(total).toBe(24.8);
  });

  it("nenhuma aplicação precificada → 0", () => {
    const total = somarCustoSanidadeExato([{ produtoId: null, produto: "X" }], () => null);
    expect(total).toBe(0);
  });
});

describe("escolherCustoSanidadeAnimal", () => {
  it("usa o custo exato quando > 0", () => {
    expect(escolherCustoSanidadeAnimal(24.8, 100)).toBe(24.8);
  });

  it("cai no rateio quando não há custo exato apurado", () => {
    expect(escolherCustoSanidadeAnimal(0, 37.5)).toBe(37.5);
  });

  it("arredonda a 2 casas", () => {
    expect(escolherCustoSanidadeAnimal(10.005, 0)).toBe(10.01);
  });
});

// Regressão do bug: uma aplicação de 20mL a R$0,62/mL devia custar R$12,40, não
// R$0,62 (o preço unitário sem multiplicar pela quantidade). Cobre a integração
// real entre insights.ts e precoPorAplicacao (custo-sanidade.ts).
describe("custo de sanidade do animal usa quantidade, não só o preço unitário", () => {
  it("com movimentoEstoqueId confirmado, usa o valorTotal já baixado do estoque", async () => {
    mocks.movimentoFindMany.mockResolvedValue([{ id: 501, valorTotal: new Prisma.Decimal("12.40") }]);
    const aplics = [{ produtoId: 3, produto: "Antibiótico", quantidadeUsada: new Prisma.Decimal(20), movimentoEstoqueId: 501 }];

    const precoDe = await precoPorAplicacao(aplics, 7);
    const exato = somarCustoSanidadeExato(aplics, precoDe);

    expect(exato).toBe(12.4);
    expect(escolherCustoSanidadeAnimal(exato, 999)).toBe(12.4);
  });

  it("sem movimento mas com produtoId + quantidadeUsada, multiplica quantidade × custo médio", async () => {
    mocks.obterCustosMedios.mockResolvedValue(new Map([[3, new Prisma.Decimal("0.62")]]));
    const aplics = [{ produtoId: 3, produto: "Antibiótico", quantidadeUsada: new Prisma.Decimal(20), movimentoEstoqueId: null }];

    const precoDe = await precoPorAplicacao(aplics, 7);
    const exato = somarCustoSanidadeExato(aplics, precoDe);

    expect(exato).toBe(12.4); // 0,62 × 20, não 0,62
  });

  it("evento legado só com texto (sem produtoId nem quantidade) cai no rateio", async () => {
    const aplics = [{ produtoId: null, produto: "Vacina antiga", quantidadeUsada: null, movimentoEstoqueId: null }];

    const precoDe = await precoPorAplicacao(aplics, 7);
    const exato = somarCustoSanidadeExato(aplics, precoDe);

    expect(exato).toBe(0);
    expect(escolherCustoSanidadeAnimal(exato, 50)).toBe(50);
  });
});
