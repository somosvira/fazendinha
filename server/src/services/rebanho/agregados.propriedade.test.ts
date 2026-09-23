import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  animalFindMany: vi.fn(),
  grupoFindMany: vi.fn(),
  producaoFindMany: vi.fn(),
  eventoFindMany: vi.fn(),
  transacaoFindMany: vi.fn(),
  produtoFindMany: vi.fn(),
  categoriaFindMany: vi.fn(),
  movimentoFindMany: vi.fn(),
  obterConfig: vi.fn(),
  calcularCustoVacaDia: vi.fn(),
  obterCustosMedios: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    animal: { findMany: mocks.animalFindMany },
    grupo: { findMany: mocks.grupoFindMany },
    producaoLote: { findMany: mocks.producaoFindMany },
    eventoSanitario: { findMany: mocks.eventoFindMany },
    transacaoFinanceira: { findMany: mocks.transacaoFindMany },
    produto: { findMany: mocks.produtoFindMany },
    categoria: { findMany: mocks.categoriaFindMany },
    movimentoEstoque: { findMany: mocks.movimentoFindMany },
    centroCusto: { findMany: vi.fn().mockResolvedValue([{ id: 1 }]) },
  },
}));
vi.mock("./config.js", () => ({ obterConfig: mocks.obterConfig }));
vi.mock("../estoque/estoque.js", () => ({ calcularCustoVacaDia: mocks.calcularCustoVacaDia, obterCustosMedios: mocks.obterCustosMedios }));
vi.mock("../../env.js", () => ({ env: {} }));

import { agregarProducao } from "./producao.js";
import { agregarCustoProducao } from "./custo-producao.js";
import { agregarCustoSanidade } from "./custo-sanidade.js";
import { listarInsightsRebanho } from "./ia.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.obterConfig.mockResolvedValue({ producaoModo: "ORDENHA" });
  mocks.animalFindMany.mockResolvedValue([]);
  mocks.grupoFindMany.mockResolvedValue([]);
  mocks.producaoFindMany.mockResolvedValue([]);
  mocks.eventoFindMany.mockResolvedValue([]);
  mocks.transacaoFindMany.mockResolvedValue([]);
  mocks.produtoFindMany.mockResolvedValue([]);
  mocks.categoriaFindMany.mockResolvedValue([{ id: 99 }]);
  mocks.movimentoFindMany.mockResolvedValue([]);
  mocks.obterCustosMedios.mockResolvedValue(new Map());
  mocks.calcularCustoVacaDia.mockResolvedValue({ custoVacaDia: null, vacasEmLactacao: 0, totalConsumo: 0 });
});

describe("agregados por propriedade", () => {
  it("filtra produção, carência e grupos pelo sítio", async () => {
    await agregarProducao(7);

    expect(mocks.animalFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "ATIVO", propriedadeId: 7 },
    }));
    expect(mocks.eventoFindMany).not.toHaveBeenCalled();
  });

  it("filtra todas as fontes do custo de produção", async () => {
    await agregarCustoProducao(12, 7);

    expect(mocks.transacaoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ propriedadeId: 7 }),
    }));
    expect(mocks.calcularCustoVacaDia).toHaveBeenCalledWith(30, 7);
    expect(mocks.animalFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ propriedadeId: 7 }),
    }));
  });

  it("filtra financeiro e aplicações no custo sanitário", async () => {
    await agregarCustoSanidade(12, 7);

    expect(mocks.transacaoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ propriedadeId: 7, status: "CONFIRMADA" }),
    }));
    expect(mocks.eventoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ animal: { propriedadeId: 7 } }),
    }));
    expect(mocks.obterCustosMedios).toHaveBeenCalledWith(expect.anything(), [], 7);
  });

  it("custo sanitário exato segue a precedência: movimento de estoque > quantidade × custo médio > rateio", async () => {
    const { Prisma } = await import("@prisma/client");
    mocks.eventoFindMany.mockResolvedValue([
      // (a) movimento de estoque confirmado: valor já calculado na baixa (não é
      // só o preço unitário — 20mL e 10mL a R$0,62/mL, não R$0,62 cada aplicação).
      { produto: "Antibiótico", produtoId: 3, quantidadeUsada: new Prisma.Decimal(20), movimentoEstoqueId: 501, animal: { numero: "10", nome: null } },
      { produto: "Antibiótico", produtoId: 3, quantidadeUsada: new Prisma.Decimal(10), movimentoEstoqueId: 502, animal: { numero: "11", nome: null } },
      // (b) sem movimento (evento editado à mão) mas com produtoId + quantidadeUsada.
      { produto: "Vermífugo", produtoId: 4, quantidadeUsada: new Prisma.Decimal(5), movimentoEstoqueId: null, animal: { numero: "10", nome: null } },
      // (c) legado: só texto, sem produtoId nem quantidade → sem custo exato, cai no rateio
      // (o custo médio ainda é resolvido pelo nome, mas só para exibição/referência).
      { produto: "Vacina antiga", produtoId: null, quantidadeUsada: null, movimentoEstoqueId: null, animal: { numero: "10", nome: null } },
      { produto: "Sem cadastro", produtoId: null, quantidadeUsada: null, movimentoEstoqueId: null, animal: { numero: "10", nome: null } },
    ]);
    mocks.produtoFindMany.mockResolvedValue([{ id: 8, nome: "Vacina antiga" }]);
    mocks.movimentoFindMany.mockResolvedValue([
      { id: 501, valorTotal: new Prisma.Decimal("12.40") },
      { id: 502, valorTotal: new Prisma.Decimal("6.20") },
    ]);
    mocks.obterCustosMedios.mockResolvedValue(new Map([
      [3, new Prisma.Decimal("0.62")],
      [4, new Prisma.Decimal(6)],
      [8, new Prisma.Decimal("2.5")],
    ]));

    const r = await agregarCustoSanidade(12, 7);

    expect(mocks.obterCustosMedios).toHaveBeenCalledWith(expect.anything(), [3, 3, 4, 8], 7);
    expect(mocks.movimentoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: [501, 502] }, status: "CONFIRMADO" }),
    }));
    expect(r.produtos).toEqual(expect.arrayContaining([
      { produto: "Antibiótico", n: 2, custoMedio: 0.62, custoExato: 18.6 },
      { produto: "Vermífugo", n: 1, custoMedio: 6, custoExato: 30 },
      { produto: "Vacina antiga", n: 1, custoMedio: 2.5, custoExato: null },
      { produto: "Sem cadastro", n: 1, custoMedio: null, custoExato: null },
    ]));
    expect(r.custoExatoTotal).toBe(48.6);
    expect(r.produtosPrecificados).toBe(2);
    expect(r.topAnimais.find((a) => a.numero === "10")?.custoExato).toBe(42.4);
    expect(r.topAnimais.find((a) => a.numero === "11")?.custoExato).toBe(6.2);
  });

  it("monta insights da IA somente com animais e grupos do sítio", async () => {
    await listarInsightsRebanho(7);

    expect(mocks.animalFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "ATIVO", propriedadeId: 7 },
    }));
    expect(mocks.grupoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { propriedadeId: 7 },
    }));
  });
});
