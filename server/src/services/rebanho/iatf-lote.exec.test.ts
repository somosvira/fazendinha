import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  programacaoFindFirst: vi.fn(),
  programacaoFindUniqueNaTx: vi.fn(),
  programacaoFindMany: vi.fn(),
  programacaoDeleteForaTx: vi.fn(),
  programacaoDeleteNaTx: vi.fn(),
  aplicacaoFindMany: vi.fn(),
  eventoFindMany: vi.fn(),
  eventoDeleteMany: vi.fn(),
  estoqueUpdateMany: vi.fn(),
  atualizarExecucao: vi.fn(),
  recomputarAnimal: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    programacaoIATFLote: {
      findFirst: mocks.programacaoFindFirst,
      findMany: mocks.programacaoFindMany,
      delete: mocks.programacaoDeleteForaTx,
    },
    aplicacaoProtocoloIATF: { findMany: mocks.aplicacaoFindMany },
    $transaction: (fn: (tx: unknown) => unknown) => fn({
      programacaoIATFLote: {
        findUniqueOrThrow: mocks.programacaoFindUniqueNaTx,
        delete: mocks.programacaoDeleteNaTx,
      },
      aplicacaoProtocoloIATF: { findMany: mocks.aplicacaoFindMany },
      eventoReprodutivo: {
        findMany: mocks.eventoFindMany,
        deleteMany: mocks.eventoDeleteMany,
      },
      estoqueSemen: { updateMany: mocks.estoqueUpdateMany },
    }),
  },
}));

vi.mock("./eventos.js", () => ({ recomputarAnimal: mocks.recomputarAnimal }));

vi.mock("./iatf.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./iatf.js")>();
  return {
    ...original,
    materializarExecucoes: vi.fn(() => []),
    atualizarExecucaoNaTransacao: mocks.atualizarExecucao,
  };
});

import { executarEtapaLote, excluirProgramacao, listarProgramacoes } from "./iatf-lote.js";

const exec = (id: number, status: "PENDENTE" | "CONCLUIDA" = "PENDENTE") => ({
  id,
  dia: 7,
  ordem: 0,
  acao: "Retirada do implante",
  hormonio: "PGF2α",
  dataPlanejada: new Date("2026-07-13T00:00:00Z"),
  status,
  dataExecucao: status === "CONCLUIDA" ? new Date("2026-07-13T00:00:00Z") : null,
  produto: null,
  dose: null,
  observacao: null,
});

const app = (id: number, animalId: number, status: "PENDENTE" | "CONCLUIDA" = "PENDENTE") => ({
  id,
  animalId,
  protocoloId: 3,
  dataInicio: new Date("2026-07-06T00:00:00Z"),
  observacao: null,
  usoCidr: false,
  estimulo: null,
  perdaImplante: false,
  protocolo: {
    id: 3,
    nome: "P11",
    descricao: null,
    hormonioBase: null,
    finalidade: "IATF",
    ativo: true,
    etapas: [{ dia: 7, ordem: 0, acao: "Retirada do implante", hormonio: "PGF2α" }],
  },
  execucoes: [exec(id * 10 + 1, status)],
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.programacaoFindFirst.mockResolvedValue({ id: 3 });
  mocks.programacaoFindUniqueNaTx.mockResolvedValue({ propriedadeId: 7 });
  mocks.eventoFindMany.mockResolvedValue([]);
  mocks.eventoDeleteMany.mockResolvedValue({ count: 0 });
  mocks.estoqueUpdateMany.mockResolvedValue({ count: 1 });
  mocks.atualizarExecucao.mockResolvedValue(false);
});

describe("listarProgramacoes", () => {
  it("usa status real: etapa vencida e pendente continua pendente", async () => {
    mocks.programacaoFindMany.mockResolvedValue([{
      id: 3,
      protocoloId: 3,
      grupoId: null,
      nome: "Lote teste",
      dataInicio: new Date("2026-07-06T00:00:00Z"),
      observacao: null,
      protocolo: { nome: "P11", etapas: [{ dia: 7, ordem: 0, acao: "Retirada", hormonio: null }] },
      grupo: null,
      aplicacoes: [{ id: 1, animalId: 101, execucoes: [exec(11)] }],
      _count: { aplicacoes: 1 },
    }]);

    const [r] = await listarProgramacoes(null);

    expect(r.resumoExec).toMatchObject({
      totalAnimais: 1,
      porEtapa: [{ dia: 7, ordem: 0, pendentes: 1 }],
      concluido: false,
    });
    expect(r.etapasConcluidas).toBe(0);
    expect(r.concluido).toBe(false);
  });
});

describe("excluirProgramacao — estorno de sêmen antes do cascade", () => {
  it("devolve todas as doses dos filhos, somando dois eventos do mesmo lote", async () => {
    mocks.aplicacaoFindMany.mockResolvedValue([
      { execucoes: [{ id: 11 }] },
      { execucoes: [{ id: 21 }] },
      { execucoes: [{ id: 31 }] },
    ]);
    mocks.eventoFindMany
      .mockResolvedValueOnce([
        { estoqueSemenId: 18 },
        { estoqueSemenId: 18 },
        { estoqueSemenId: 22 },
      ])
      .mockResolvedValueOnce([
        { id: 91, animalId: 101, tipo: "INSEMINACAO", data: new Date("2026-07-17T00:00:00Z") },
        { id: 92, animalId: 102, tipo: "INSEMINACAO", data: new Date("2026-07-17T00:00:00Z") },
        { id: 93, animalId: 103, tipo: "INSEMINACAO", data: new Date("2026-07-17T00:00:00Z") },
      ]);

    await excluirProgramacao(3, 7);

    expect(mocks.programacaoFindFirst).toHaveBeenCalledWith({
      where: { id: 3, OR: [{ propriedadeId: 7 }, { propriedadeId: null }] },
      select: { id: true },
    });
    expect(mocks.programacaoFindUniqueNaTx).toHaveBeenCalledWith({
      where: { id: 3 },
      select: { propriedadeId: true },
    });
    expect(mocks.aplicacaoFindMany).toHaveBeenCalledWith({
      where: { programacaoId: 3 },
      select: { execucoes: { select: { id: true } } },
    });
    expect(mocks.eventoFindMany).toHaveBeenNthCalledWith(1, {
      where: {
        origemExecucaoId: { in: [11, 21, 31] },
        estoqueSemenId: { not: null },
        estoqueSemenDoseBaixada: true,
      },
      select: { estoqueSemenId: true },
      orderBy: { id: "asc" },
    });
    expect(mocks.eventoFindMany).toHaveBeenNthCalledWith(2, {
      where: { origemExecucaoId: { in: [11, 21, 31] } },
      select: { id: true, animalId: true, tipo: true, data: true },
      orderBy: { id: "asc" },
    });
    expect(mocks.estoqueUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 18, propriedadeId: 7 },
      data: { dosesDisponiveis: { increment: 2 } },
    });
    expect(mocks.estoqueUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 22, propriedadeId: 7 },
      data: { dosesDisponiveis: { increment: 1 } },
    });
    expect(mocks.eventoDeleteMany).toHaveBeenCalledWith({
      where: { origemExecucaoId: { in: [11, 21, 31] } },
    });
    expect(mocks.recomputarAnimal).toHaveBeenCalledTimes(3);
    expect(mocks.recomputarAnimal).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      101,
      { tipo: "EXCLUSAO", evento: { id: 91, tipo: "INSEMINACAO", data: "2026-07-17" } },
    );
    expect(mocks.recomputarAnimal).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      103,
      { tipo: "EXCLUSAO", evento: { id: 93, tipo: "INSEMINACAO", data: "2026-07-17" } },
    );
    expect(mocks.programacaoDeleteNaTx).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(mocks.programacaoDeleteForaTx).not.toHaveBeenCalled();
    expect(mocks.estoqueUpdateMany.mock.invocationCallOrder[1])
      .toBeLessThan(mocks.eventoDeleteMany.mock.invocationCallOrder[0]);
    expect(mocks.eventoDeleteMany.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.recomputarAnimal.mock.invocationCallOrder[0]);
    expect(mocks.recomputarAnimal.mock.invocationCallOrder[2])
      .toBeLessThan(mocks.programacaoDeleteNaTx.mock.invocationCallOrder[0]);
  });
});

describe("executarEtapaLote", () => {
  it("atualiza a etapa de todos menos os animais em exceção e reagrega do banco", async () => {
    mocks.aplicacaoFindMany
      .mockResolvedValueOnce([app(1, 101), app(2, 102)])
      .mockResolvedValueOnce([app(1, 101, "CONCLUIDA"), app(2, 102)]);

    const r = await executarEtapaLote(3, {
      dia: 7,
      ordem: 0,
      status: "CONCLUIDA",
      dataExecucao: "2026-07-13",
      excecoesAnimalIds: [102],
      produto: "PGF2α",
      dose: "2 ml",
    }, null);

    expect(mocks.atualizarExecucao).toHaveBeenCalledOnce();
    expect(mocks.atualizarExecucao.mock.calls[0][1]).toMatchObject({ id: 11, aplicacao: { animalId: 101 } });
    expect(mocks.atualizarExecucao.mock.calls[0][2]).toMatchObject({ status: "CONCLUIDA", produto: "PGF2α", dose: "2 ml" });
    expect(r).toMatchObject({
      aplicados: 1,
      ignorados: 1,
      resumo: {
        totalAnimais: 2,
        porEtapa: [{ dia: 7, ordem: 0, concluidas: 1, pendentes: 1 }],
        concluido: false,
      },
    });
    expect(mocks.aplicacaoFindMany).toHaveBeenCalledTimes(2);
  });

  it("recusa programação fora do sítio antes de buscar aplicações", async () => {
    mocks.programacaoFindFirst.mockResolvedValue(null);

    await expect(executarEtapaLote(3, { dia: 7, ordem: 0, status: "PULADA" }, 7))
      .rejects.toEqual(expect.objectContaining({ code: "NAO_ENCONTRADO" }));

    expect(mocks.programacaoFindFirst).toHaveBeenCalledWith({
      where: { id: 3, OR: [{ propriedadeId: 7 }, { propriedadeId: null }] },
      select: { id: true },
    });
    expect(mocks.aplicacaoFindMany).not.toHaveBeenCalled();
  });

  it("retorna zero aplicado quando nenhuma execução casa dia+ordem", async () => {
    mocks.aplicacaoFindMany.mockResolvedValueOnce([app(1, 101)]);

    const r = await executarEtapaLote(3, { dia: 9, ordem: 0, status: "PULADA" }, null);

    expect(r.aplicados).toBe(0);
    expect(r.ignorados).toBe(1);
    expect(mocks.atualizarExecucao).not.toHaveBeenCalled();
    expect(mocks.aplicacaoFindMany).toHaveBeenCalledOnce();
  });
});
