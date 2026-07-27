import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  animalFindMany: vi.fn(),
  grupoFindMany: vi.fn(),
  producaoFindMany: vi.fn(),
  eventoFindMany: vi.fn(),
  lancamentoFindMany: vi.fn(),
  produtoFindMany: vi.fn(),
  obterConfig: vi.fn(),
  calcularCustoVacaDia: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    animal: { findMany: mocks.animalFindMany },
    grupo: { findMany: mocks.grupoFindMany },
    producaoLote: { findMany: mocks.producaoFindMany },
    eventoSanitario: { findMany: mocks.eventoFindMany },
    lancamento: { findMany: mocks.lancamentoFindMany },
    produto: { findMany: mocks.produtoFindMany },
  },
}));
vi.mock("./config.js", () => ({ obterConfig: mocks.obterConfig }));
vi.mock("./estoque.js", () => ({ calcularCustoVacaDia: mocks.calcularCustoVacaDia }));
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
  mocks.lancamentoFindMany.mockResolvedValue([]);
  mocks.produtoFindMany.mockResolvedValue([]);
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

    expect(mocks.lancamentoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ propriedadeId: 7 }),
    }));
    expect(mocks.calcularCustoVacaDia).toHaveBeenCalledWith(30, 7);
    expect(mocks.animalFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ propriedadeId: 7 }),
    }));
  });

  it("filtra financeiro e aplicações no custo sanitário", async () => {
    await agregarCustoSanidade(12, 7);

    expect(mocks.lancamentoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ propriedadeId: 7, estornado: false }),
    }));
    expect(mocks.eventoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ animal: { propriedadeId: 7 } }),
    }));
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
