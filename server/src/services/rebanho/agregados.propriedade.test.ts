import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  animalFindMany: vi.fn(),
  grupoFindMany: vi.fn(),
  producaoFindMany: vi.fn(),
  eventoFindMany: vi.fn(),
  transacaoFindMany: vi.fn(),
  produtoFindMany: vi.fn(),
  categoriaFindMany: vi.fn(),
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

  it("custo sanitário exato usa o custo médio do sítio, cruzando por produtoId e, no legado, pelo nome", async () => {
    const { Prisma } = await import("@prisma/client");
    mocks.eventoFindMany.mockResolvedValue([
      { produto: "Vermífugo", produtoId: 3, animal: { numero: "10", nome: null } },
      { produto: "Vermífugo", produtoId: 3, animal: { numero: "11", nome: null } },
      { produto: "Vacina antiga", produtoId: null, animal: { numero: "10", nome: null } },
      { produto: "Sem cadastro", produtoId: null, animal: { numero: "10", nome: null } },
    ]);
    mocks.produtoFindMany.mockResolvedValue([{ id: 8, nome: "Vacina antiga" }]);
    mocks.obterCustosMedios.mockResolvedValue(new Map([[3, new Prisma.Decimal(6)], [8, new Prisma.Decimal("2.5")]]));

    const r = await agregarCustoSanidade(12, 7);

    expect(mocks.obterCustosMedios).toHaveBeenCalledWith(expect.anything(), [3, 3, 8], 7);
    expect(r.produtos).toEqual(expect.arrayContaining([
      { produto: "Vermífugo", n: 2, custoMedio: 6, custoExato: 12 },
      { produto: "Vacina antiga", n: 1, custoMedio: 2.5, custoExato: 2.5 },
      { produto: "Sem cadastro", n: 1, custoMedio: null, custoExato: null },
    ]));
    expect(r.custoExatoTotal).toBe(14.5);
    expect(r.produtosPrecificados).toBe(2);
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
