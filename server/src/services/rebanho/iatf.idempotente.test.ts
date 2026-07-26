import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execFindFirst: vi.fn(),
  execUpdate: vi.fn(),
  aplicacaoFindUnique: vi.fn(),
  eventoUpsert: vi.fn(),
  eventoDeleteMany: vi.fn(),
  recomputarAnimal: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    execucaoEtapaIATF: { findFirst: mocks.execFindFirst, update: mocks.execUpdate },
    aplicacaoProtocoloIATF: { findUniqueOrThrow: mocks.aplicacaoFindUnique },
    $transaction: (fn: (tx: unknown) => unknown) => fn({
      execucaoEtapaIATF: { update: mocks.execUpdate },
      eventoReprodutivo: { upsert: mocks.eventoUpsert, deleteMany: mocks.eventoDeleteMany },
    }),
  },
}));

vi.mock("./eventos.js", () => ({ recomputarAnimal: mocks.recomputarAnimal }));

import { executarEtapa } from "./iatf.js";

function aplicacao(finalidade: "IATF" | "TETF" = "IATF") {
  return {
    id: 5,
    animalId: 7,
    protocoloId: 3,
    dataInicio: new Date("2026-07-06T00:00:00Z"),
    observacao: null,
    usoCidr: false,
    estimulo: null,
    perdaImplante: false,
    protocolo: {
      id: 3,
      nome: finalidade === "IATF" ? "P11" : "TETF receptoras",
      descricao: null,
      hormonioBase: null,
      finalidade,
      ativo: true,
      etapas: [
        { dia: 0, acao: "Implante", hormonio: "P4", ordem: 0 },
        { dia: 11, acao: finalidade, hormonio: null, ordem: 0 },
      ],
    },
    execucoes: [
      { id: 51, dia: 0, ordem: 0, acao: "Implante", hormonio: "P4", dataPlanejada: new Date("2026-07-06T00:00:00Z"), status: "CONCLUIDA", dataExecucao: new Date("2026-07-06T00:00:00Z"), produto: null, dose: null, observacao: null },
      { id: 52, dia: 11, ordem: 0, acao: finalidade, hormonio: null, dataPlanejada: new Date("2026-07-17T00:00:00Z"), status: "PENDENTE", dataExecucao: null, produto: null, dose: null, observacao: null },
    ],
  };
}

function execucao(dia: number, finalidade: "IATF" | "TETF" = "IATF") {
  const app = aplicacao(finalidade);
  return { ...app.execucoes.find((e) => e.dia === dia)!, aplicacaoId: app.id, aplicacao: app };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.aplicacaoFindUnique.mockResolvedValue(aplicacao());
  mocks.eventoUpsert.mockResolvedValue({ id: 90 });
  mocks.eventoDeleteMany.mockResolvedValue({ count: 1 });
});

describe("executarEtapa — evento terminal idempotente", () => {
  it("concluir etapa terminal IATF faz upsert por origemExecucaoId", async () => {
    mocks.execFindFirst.mockResolvedValue(execucao(11));
    await executarEtapa(52, { status: "CONCLUIDA", dataExecucao: "2026-07-17", produto: "Sêmen A" }, null);
    expect(mocks.eventoUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { origemExecucaoId: 52 },
      create: expect.objectContaining({ animalId: 7, tipo: "INSEMINACAO", origemExecucaoId: 52, reprodutor: "Sêmen A" }),
    }));
    expect(mocks.recomputarAnimal).toHaveBeenCalledOnce();
  });

  it("concluir etapa terminal TETF cria transferência de embrião", async () => {
    mocks.execFindFirst.mockResolvedValue(execucao(11, "TETF"));
    mocks.aplicacaoFindUnique.mockResolvedValue(aplicacao("TETF"));
    await executarEtapa(52, { status: "CONCLUIDA", dataExecucao: "2026-07-17" }, null);
    expect(mocks.eventoUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ tipo: "TRANSFERENCIA_EMBRIAO" }),
    }));
  });

  it.each(["PENDENTE", "PULADA"] as const)("%s remove o evento terminal vinculado", async (status) => {
    mocks.execFindFirst.mockResolvedValue(execucao(11));
    await executarEtapa(52, { status }, null);
    expect(mocks.eventoDeleteMany).toHaveBeenCalledWith({ where: { origemExecucaoId: 52 } });
    expect(mocks.eventoUpsert).not.toHaveBeenCalled();
    expect(mocks.recomputarAnimal).toHaveBeenCalledOnce();
  });

  it("etapa não terminal não cria nem remove evento reprodutivo", async () => {
    mocks.execFindFirst.mockResolvedValue(execucao(0));
    await executarEtapa(51, { status: "CONCLUIDA", dataExecucao: "2026-07-06" }, null);
    expect(mocks.eventoUpsert).not.toHaveBeenCalled();
    expect(mocks.eventoDeleteMany).not.toHaveBeenCalled();
    expect(mocks.recomputarAnimal).not.toHaveBeenCalled();
  });
});
