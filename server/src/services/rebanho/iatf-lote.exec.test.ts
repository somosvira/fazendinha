import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  programacaoFindFirst: vi.fn(),
  programacaoFindMany: vi.fn(),
  aplicacaoFindMany: vi.fn(),
  atualizarExecucao: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    programacaoIATFLote: { findFirst: mocks.programacaoFindFirst, findMany: mocks.programacaoFindMany },
    aplicacaoProtocoloIATF: { findMany: mocks.aplicacaoFindMany },
    $transaction: (fn: (tx: unknown) => unknown) => fn({}),
  },
}));

vi.mock("./iatf.js", () => ({
  materializarExecucoes: vi.fn(() => []),
  atualizarExecucaoNaTransacao: mocks.atualizarExecucao,
}));

import { executarEtapaLote, listarProgramacoes } from "./iatf-lote.js";

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
