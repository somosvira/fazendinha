import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  animalFindFirst: vi.fn(),
  animalFindMany: vi.fn(),
  eventoFindMany: vi.fn(),
  aplicacaoFindFirst: vi.fn(),
  protocoloFindFirst: vi.fn(),
  programacaoFindFirst: vi.fn(),
  reprodutorFindFirst: vi.fn(),
  centralFindFirst: vi.fn(),
  lactacaoFindMany: vi.fn(),
  controleFindMany: vi.fn(),
  movimentoFindMany: vi.fn(),
  getParametros: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    animal: { findFirst: mocks.animalFindFirst, findMany: mocks.animalFindMany },
    eventoReprodutivo: { findMany: mocks.eventoFindMany },
    aplicacaoProtocoloIATF: { findFirst: mocks.aplicacaoFindFirst, delete: vi.fn() },
    protocoloIATF: { findFirst: mocks.protocoloFindFirst },
    programacaoIATFLote: { findFirst: mocks.programacaoFindFirst },
    reprodutor: { findFirst: mocks.reprodutorFindFirst, findMany: vi.fn() },
    centralSemen: { findFirst: mocks.centralFindFirst },
    lactacao: { findMany: mocks.lactacaoFindMany },
    controleLeiteiro: { findMany: mocks.controleFindMany },
    movimentoEstoque: { findMany: mocks.movimentoFindMany },
  },
}));

vi.mock("./parametros.js", () => ({
  getNumero: vi.fn(),
  getParametros: mocks.getParametros,
}));

import { listarEventos, taxaConcepcaoRebanho } from "./eventos.js";
import { atualizarProtocolo, excluirAplicacao } from "./iatf.js";
import { detalheProgramacao } from "./iatf-lote.js";
import { atualizarReprodutor, excluirCentral } from "./reprodutores.js";
import { recomendarParaAnimal } from "./acasalamento.js";
import { montarRelatorioEmbrapa } from "./indicadores-embrapa.agg.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.animalFindMany.mockResolvedValue([]);
  mocks.eventoFindMany.mockResolvedValue([]);
  mocks.lactacaoFindMany.mockResolvedValue([]);
  mocks.controleFindMany.mockResolvedValue([]);
  mocks.movimentoFindMany.mockResolvedValue([]);
  mocks.getParametros.mockResolvedValue([]);
});

describe("escopo multi-propriedade da reprodução", () => {
  it("filtra o KPI de concepção pelo sítio do animal", async () => {
    await taxaConcepcaoRebanho(7);

    expect(mocks.eventoFindMany).toHaveBeenCalledWith({
      where: {
        tipo: { in: ["INSEMINACAO", "COBERTURA", "TRANSFERENCIA_EMBRIAO", "DIAGNOSTICO"] },
        animal: { propriedadeId: 7 },
      },
      select: { animalId: true, tipo: true, data: true, resultado: true },
    });
  });

  it("não expõe eventos de animal pertencente a outro sítio", async () => {
    mocks.animalFindFirst.mockResolvedValue(null);

    await expect(listarEventos(31, 7)).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO" }),
    );
    expect(mocks.animalFindFirst).toHaveBeenCalledWith({
      where: { id: 31, propriedadeId: 7 },
      select: { id: true },
    });
    expect(mocks.eventoFindMany).not.toHaveBeenCalled();
  });

  it("escopa todas as fontes do agregado Embrapa", async () => {
    await montarRelatorioEmbrapa(7);

    expect(mocks.animalFindMany).toHaveBeenCalledWith({ where: { propriedadeId: 7 }, include: { resumo: true } });
    expect(mocks.eventoFindMany).toHaveBeenCalledWith({ where: { animal: { propriedadeId: 7 } } });
    expect(mocks.lactacaoFindMany).toHaveBeenCalledWith({ where: { animal: { propriedadeId: 7 } } });
    expect(mocks.controleFindMany).toHaveBeenCalledWith({ where: { animal: { propriedadeId: 7 } } });
    expect(mocks.movimentoFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tipo: "SAIDA",
        produto: { tipo: "RACAO" },
        propriedadeId: 7,
      }),
    });
  });
});

describe("autorização por propriedade em operações por id", () => {
  it("recusa alterar protocolo IATF fora do sítio", async () => {
    mocks.protocoloFindFirst.mockResolvedValue(null);

    await expect(atualizarProtocolo(12, { nome: "D11" }, 7)).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO" }),
    );
    expect(mocks.protocoloFindFirst).toHaveBeenCalledWith({
      where: { id: 12, OR: [{ propriedadeId: 7 }, { propriedadeId: null }] },
      select: { id: true },
    });
  });

  it("recusa excluir aplicação IATF de animal de outro sítio", async () => {
    mocks.aplicacaoFindFirst.mockResolvedValue(null);

    await expect(excluirAplicacao(18, 7)).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO" }),
    );
    expect(mocks.aplicacaoFindFirst).toHaveBeenCalledWith({
      where: { id: 18, animal: { propriedadeId: 7 } },
      select: { id: true },
    });
  });

  it("recusa ler programação IATF de lote fora do sítio", async () => {
    mocks.programacaoFindFirst.mockResolvedValue(null);

    await expect(detalheProgramacao(22, 7)).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO" }),
    );
    expect(mocks.programacaoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 22, OR: [{ propriedadeId: 7 }, { propriedadeId: null }] },
      }),
    );
  });

  it("recusa alterar reprodutor e excluir central fora do sítio", async () => {
    mocks.reprodutorFindFirst.mockResolvedValue(null);
    mocks.centralFindFirst.mockResolvedValue(null);

    await expect(atualizarReprodutor(25, { nome: "Touro A" }, 7)).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO" }),
    );
    await expect(excluirCentral(26, 7)).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO" }),
    );
    expect(mocks.reprodutorFindFirst).toHaveBeenCalledWith({
      where: { id: 25, OR: [{ propriedadeId: 7 }, { propriedadeId: null }] },
      select: { id: true, propriedadeId: true },
    });
    expect(mocks.centralFindFirst).toHaveBeenCalledWith({
      where: { id: 26, OR: [{ propriedadeId: 7 }, { propriedadeId: null }] },
      select: { id: true },
    });
  });

  it("recusa recomendação de acasalamento para animal de outro sítio", async () => {
    mocks.animalFindFirst.mockResolvedValue(null);

    await expect(recomendarParaAnimal(31, 7)).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO" }),
    );
    expect(mocks.animalFindFirst).toHaveBeenCalledWith({
      where: { id: 31, propriedadeId: 7 },
      select: { id: true, paiNome: true },
    });
  });
});
