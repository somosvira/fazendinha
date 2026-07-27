import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execFindFirst: vi.fn(),
  aplicacaoFindUnique: vi.fn(),
  aplicacaoFindUniqueNaTx: vi.fn(),
  aplicacaoFindFirst: vi.fn(),
  aplicacaoDeleteForaTx: vi.fn(),
  aplicacaoDeleteNaTx: vi.fn(),
  execUpdate: vi.fn(),
  eventoFindFirst: vi.fn(),
  eventoFindMany: vi.fn(),
  eventoUpsert: vi.fn(),
  eventoDeleteMany: vi.fn(),
  estoqueFindFirst: vi.fn(),
  estoqueUpdateMany: vi.fn(),
  estoqueUpdate: vi.fn(),
  recomputarAnimal: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    execucaoEtapaIATF: { findFirst: mocks.execFindFirst, update: mocks.execUpdate },
    aplicacaoProtocoloIATF: {
      findUniqueOrThrow: mocks.aplicacaoFindUnique,
      findFirst: mocks.aplicacaoFindFirst,
      delete: mocks.aplicacaoDeleteForaTx,
    },
    $transaction: (fn: (tx: unknown) => unknown) => fn({
      execucaoEtapaIATF: { update: mocks.execUpdate },
      aplicacaoProtocoloIATF: {
        findUniqueOrThrow: mocks.aplicacaoFindUniqueNaTx,
        delete: mocks.aplicacaoDeleteNaTx,
      },
      eventoReprodutivo: {
        findFirst: mocks.eventoFindFirst,
        findMany: mocks.eventoFindMany,
        upsert: mocks.eventoUpsert,
        deleteMany: mocks.eventoDeleteMany,
      },
      estoqueSemen: {
        findFirst: mocks.estoqueFindFirst,
        updateMany: mocks.estoqueUpdateMany,
        update: mocks.estoqueUpdate,
      },
    }),
  },
}));

vi.mock("./eventos.js", () => ({ recomputarAnimal: mocks.recomputarAnimal }));

import { executarEtapaSchema } from "./iatf.schemas.js";
import { executarEtapa, excluirAplicacao } from "./iatf.js";

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
    propriedadeId: 7,
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
  mocks.aplicacaoFindUniqueNaTx.mockResolvedValue({
    propriedadeId: 7,
    execucoes: [{ id: 51 }, { id: 52 }],
  });
  mocks.aplicacaoFindFirst.mockResolvedValue({ id: 5 });
  mocks.eventoFindFirst.mockResolvedValue(null);
  mocks.eventoFindMany.mockResolvedValue([]);
  mocks.eventoUpsert.mockResolvedValue({ id: 90 });
  mocks.eventoDeleteMany.mockResolvedValue({ count: 1 });
  mocks.estoqueFindFirst.mockResolvedValue({ id: 18, dosesDisponiveis: 4 });
  mocks.estoqueUpdateMany.mockResolvedValue({ count: 1 });
  mocks.estoqueUpdate.mockResolvedValue({ id: 18, dosesDisponiveis: 5 });
});

describe("schema de execução IATF com lote de sêmen", () => {
  it("aceita e preserva estoqueSemenId positivo", () => {
    const resultado = executarEtapaSchema.safeParse({ status: "CONCLUIDA", estoqueSemenId: 18 });

    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data).toEqual(expect.objectContaining({ estoqueSemenId: 18 }));
  });
});

describe("excluirAplicacao — estorno de sêmen antes do cascade", () => {
  it("devolve uma dose por evento com baixa antes de excluir na mesma transação", async () => {
    mocks.eventoFindMany
      .mockResolvedValueOnce([{ estoqueSemenId: 18 }])
      .mockResolvedValueOnce([{
        id: 90,
        animalId: 7,
        tipo: "INSEMINACAO",
        data: new Date("2026-07-17T00:00:00Z"),
      }]);

    await excluirAplicacao(5, 7);

    expect(mocks.aplicacaoFindFirst).toHaveBeenCalledWith({
      where: { id: 5, animal: { propriedadeId: 7 } },
      select: { id: true },
    });
    expect(mocks.aplicacaoFindUniqueNaTx).toHaveBeenCalledWith({
      where: { id: 5 },
      select: {
        propriedadeId: true,
        execucoes: { select: { id: true } },
      },
    });
    expect(mocks.eventoFindMany).toHaveBeenNthCalledWith(1, {
      where: {
        origemExecucaoId: { in: [51, 52] },
        estoqueSemenId: { not: null },
        estoqueSemenDoseBaixada: true,
      },
      select: { estoqueSemenId: true },
      orderBy: { id: "asc" },
    });
    expect(mocks.eventoFindMany).toHaveBeenNthCalledWith(2, {
      where: { origemExecucaoId: { in: [51, 52] } },
      select: { id: true, animalId: true, tipo: true, data: true },
      orderBy: { id: "asc" },
    });
    expect(mocks.estoqueUpdateMany).toHaveBeenCalledWith({
      where: { id: 18, propriedadeId: 7 },
      data: { dosesDisponiveis: { increment: 1 } },
    });
    expect(mocks.eventoDeleteMany).toHaveBeenCalledWith({
      where: { origemExecucaoId: { in: [51, 52] } },
    });
    expect(mocks.recomputarAnimal).toHaveBeenCalledWith(
      expect.anything(),
      7,
      {
        tipo: "EXCLUSAO",
        evento: { id: 90, tipo: "INSEMINACAO", data: "2026-07-17" },
      },
    );
    expect(mocks.aplicacaoDeleteNaTx).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(mocks.aplicacaoDeleteForaTx).not.toHaveBeenCalled();
    expect(mocks.estoqueUpdateMany.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.eventoDeleteMany.mock.invocationCallOrder[0]);
    expect(mocks.eventoDeleteMany.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.recomputarAnimal.mock.invocationCallOrder[0]);
    expect(mocks.recomputarAnimal.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.aplicacaoDeleteNaTx.mock.invocationCallOrder[0]);
  });

  it("não devolve dose de evento cujo marcador de baixa é falso", async () => {
    mocks.eventoFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 90,
        animalId: 7,
        tipo: "INSEMINACAO",
        data: new Date("2026-07-17T00:00:00Z"),
      }]);

    await excluirAplicacao(5, 7);

    expect(mocks.eventoFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ estoqueSemenDoseBaixada: true }),
    }));
    expect(mocks.estoqueUpdateMany).not.toHaveBeenCalled();
    expect(mocks.eventoDeleteMany).toHaveBeenCalledWith({
      where: { origemExecucaoId: { in: [51, 52] } },
    });
    expect(mocks.recomputarAnimal).toHaveBeenCalledOnce();
    expect(mocks.aplicacaoDeleteNaTx).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  it("tolera lote ausente ou fora do sítio sem atualizar outro estoque", async () => {
    mocks.eventoFindMany
      .mockResolvedValueOnce([{ estoqueSemenId: 18 }])
      .mockResolvedValueOnce([{
        id: 90,
        animalId: 7,
        tipo: "INSEMINACAO",
        data: new Date("2026-07-17T00:00:00Z"),
      }]);
    mocks.estoqueUpdateMany.mockResolvedValue({ count: 0 });

    await expect(excluirAplicacao(5, 7)).resolves.toBeUndefined();

    expect(mocks.estoqueUpdateMany).toHaveBeenCalledWith({
      where: { id: 18, propriedadeId: 7 },
      data: { dosesDisponiveis: { increment: 1 } },
    });
    expect(mocks.aplicacaoDeleteNaTx).toHaveBeenCalledWith({ where: { id: 5 } });
  });
});

describe("executarEtapa — baixa de dose no evento terminal", () => {
  it("concluir a etapa terminal com lote decrementa uma dose e grava o vínculo com baixa", async () => {
    mocks.execFindFirst.mockResolvedValue(execucao(11));

    await executarEtapa(52, { status: "CONCLUIDA", dataExecucao: "2026-07-17", estoqueSemenId: 18 }, 7);

    expect(mocks.estoqueUpdateMany).toHaveBeenCalledWith({
      where: { id: 18, propriedadeId: 7, dosesDisponiveis: { gte: 1 } },
      data: { dosesDisponiveis: { decrement: 1 } },
    });
    expect(mocks.eventoUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { origemExecucaoId: 52 },
      create: expect.objectContaining({ estoqueSemenId: 18, estoqueSemenDoseBaixada: true }),
      update: expect.objectContaining({ estoqueSemenId: 18, estoqueSemenDoseBaixada: true }),
    }));
  });

  it("mantém o evento sem baixa e avisa quando outra transação consome a última dose", async () => {
    mocks.execFindFirst.mockResolvedValue(execucao(11));
    mocks.estoqueFindFirst.mockResolvedValue({ id: 18, dosesDisponiveis: 1 });
    mocks.estoqueUpdateMany.mockResolvedValue({ count: 0 });

    const resultado = await executarEtapa(52, { status: "CONCLUIDA", dataExecucao: "2026-07-17", estoqueSemenId: 18 }, 7);

    expect(mocks.eventoUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ estoqueSemenDoseBaixada: false }),
    }));
    expect(resultado).toEqual(expect.objectContaining({ aviso: expect.stringMatching(/estoque zerado/i) }));
  });

  it("não consome dose numa etapa terminal TETF", async () => {
    mocks.execFindFirst.mockResolvedValue(execucao(11, "TETF"));
    mocks.aplicacaoFindUnique.mockResolvedValue(aplicacao("TETF"));

    await executarEtapa(52, { status: "CONCLUIDA", dataExecucao: "2026-07-17", estoqueSemenId: 18 }, 7);

    expect(mocks.estoqueFindFirst).not.toHaveBeenCalled();
    expect(mocks.estoqueUpdateMany).not.toHaveBeenCalled();
    expect(mocks.eventoUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        tipo: "TRANSFERENCIA_EMBRIAO",
        estoqueSemenId: null,
        estoqueSemenDoseBaixada: false,
      }),
    }));
  });

  it("registra o vínculo sem baixa quando o estoque está zerado", async () => {
    mocks.execFindFirst.mockResolvedValue(execucao(11));
    mocks.estoqueFindFirst.mockResolvedValue({ id: 18, dosesDisponiveis: 0 });

    const resultado = await executarEtapa(52, { status: "CONCLUIDA", dataExecucao: "2026-07-17", estoqueSemenId: 18 }, 7);

    expect(mocks.estoqueUpdateMany).not.toHaveBeenCalled();
    expect(mocks.eventoUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ estoqueSemenDoseBaixada: false }),
    }));
    expect(resultado).toEqual(expect.objectContaining({ aviso: expect.stringMatching(/estoque zerado/i) }));
  });

  it("reconcluir a mesma etapa e lote não decrementa duas vezes", async () => {
    mocks.execFindFirst.mockResolvedValue(execucao(11));
    mocks.eventoFindFirst.mockResolvedValue({ id: 90, estoqueSemenId: 18, estoqueSemenDoseBaixada: true });

    await executarEtapa(52, { status: "CONCLUIDA", dataExecucao: "2026-07-18", estoqueSemenId: 18 }, 7);

    expect(mocks.estoqueUpdateMany).not.toHaveBeenCalled();
    expect(mocks.estoqueUpdate).not.toHaveBeenCalled();
    expect(mocks.eventoUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ estoqueSemenId: 18, estoqueSemenDoseBaixada: true }),
    }));
  });

  it("trocar de lote na reconclusão devolve a dose antiga e consome a nova", async () => {
    mocks.execFindFirst.mockResolvedValue(execucao(11));
    mocks.eventoFindFirst.mockResolvedValue({ id: 90, estoqueSemenId: 18, estoqueSemenDoseBaixada: true });

    await executarEtapa(52, { status: "CONCLUIDA", dataExecucao: "2026-07-18", estoqueSemenId: 22 }, 7);

    expect(mocks.estoqueUpdate).toHaveBeenCalledWith({
      where: { id: 18 },
      data: { dosesDisponiveis: { increment: 1 } },
    });
    expect(mocks.estoqueUpdateMany).toHaveBeenCalledWith({
      where: { id: 22, propriedadeId: 7, dosesDisponiveis: { gte: 1 } },
      data: { dosesDisponiveis: { decrement: 1 } },
    });
    expect(mocks.eventoUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ estoqueSemenId: 22, estoqueSemenDoseBaixada: true }),
    }));
  });

  it.each(["PENDENTE", "PULADA"] as const)("%s devolve a dose baixada e remove o evento", async (status) => {
    mocks.execFindFirst.mockResolvedValue(execucao(11));
    mocks.eventoFindFirst.mockResolvedValue({ id: 90, estoqueSemenId: 18, estoqueSemenDoseBaixada: true });

    await executarEtapa(52, { status }, 7);

    expect(mocks.estoqueUpdate).toHaveBeenCalledWith({
      where: { id: 18 },
      data: { dosesDisponiveis: { increment: 1 } },
    });
    expect(mocks.eventoUpsert).not.toHaveBeenCalled();
    expect(mocks.eventoDeleteMany).toHaveBeenCalledWith({ where: { origemExecucaoId: 52 } });
  });

  it("reabrir uma etapa cujo evento não teve baixa não devolve dose", async () => {
    mocks.execFindFirst.mockResolvedValue(execucao(11));
    mocks.eventoFindFirst.mockResolvedValue({ id: 90, estoqueSemenId: 18, estoqueSemenDoseBaixada: false });

    await executarEtapa(52, { status: "PENDENTE" }, 7);

    expect(mocks.estoqueUpdate).not.toHaveBeenCalled();
    expect(mocks.eventoDeleteMany).toHaveBeenCalledWith({ where: { origemExecucaoId: 52 } });
  });

  it("recusa lote de outro sítio antes de gravar o evento terminal", async () => {
    mocks.execFindFirst.mockResolvedValue(execucao(11));
    mocks.estoqueFindFirst.mockResolvedValue(null);

    await expect(
      executarEtapa(52, { status: "CONCLUIDA", dataExecucao: "2026-07-17", estoqueSemenId: 99 }, 7),
    ).rejects.toEqual(expect.objectContaining({ code: "NAO_ENCONTRADO" }));

    expect(mocks.eventoUpsert).not.toHaveBeenCalled();
    expect(mocks.estoqueUpdateMany).not.toHaveBeenCalled();
  });

  it("concluir sem lote informado não toca no estoque", async () => {
    mocks.execFindFirst.mockResolvedValue(execucao(11));

    await executarEtapa(52, { status: "CONCLUIDA", dataExecucao: "2026-07-17", produto: "Sêmen A" }, 7);

    expect(mocks.estoqueFindFirst).not.toHaveBeenCalled();
    expect(mocks.estoqueUpdateMany).not.toHaveBeenCalled();
    expect(mocks.eventoUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ reprodutor: "Sêmen A" }),
    }));
  });
});
