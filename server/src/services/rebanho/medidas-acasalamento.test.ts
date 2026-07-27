import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  atualizarCombinacaoMedidaSchema,
  atualizarMedidaAcasalamentoSchema,
  criarCombinacaoMedidaSchema,
  criarMedidaAcasalamentoSchema,
} from "./medidas-acasalamento.schemas.js";

const mocks = vi.hoisted(() => ({
  medidaFindMany: vi.fn(),
  medidaFindUnique: vi.fn(),
  medidaUpdate: vi.fn(),
  medidaDelete: vi.fn(),
  combinacaoFindMany: vi.fn(),
  combinacaoFindUnique: vi.fn(),
  combinacaoUpdate: vi.fn(),
  combinacaoDelete: vi.fn(),
  itemCombinacaoCount: vi.fn(),
  planoCount: vi.fn(),
  transaction: vi.fn(),
  txIndicadorFindMany: vi.fn(),
  txMedidaFindMany: vi.fn(),
  txMedidaCreate: vi.fn(),
  txMedidaUpdate: vi.fn(),
  txItemMedidaDeleteMany: vi.fn(),
  txItemMedidaCreateMany: vi.fn(),
  txCombinacaoCreate: vi.fn(),
  txCombinacaoUpdate: vi.fn(),
  txItemCombinacaoDeleteMany: vi.fn(),
  txItemCombinacaoCreateMany: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    medidaAcasalamento: {
      findMany: mocks.medidaFindMany,
      findUnique: mocks.medidaFindUnique,
      update: mocks.medidaUpdate,
      delete: mocks.medidaDelete,
    },
    combinacaoMedidaAcasalamento: {
      findMany: mocks.combinacaoFindMany,
      findUnique: mocks.combinacaoFindUnique,
      update: mocks.combinacaoUpdate,
      delete: mocks.combinacaoDelete,
    },
    itemCombinacaoMedida: { count: mocks.itemCombinacaoCount },
    planoAcasalamento: { count: mocks.planoCount },
    $transaction: mocks.transaction,
  },
}));

import {
  MedidaAcasalamentoError,
  atualizarCombinacaoMedida,
  atualizarMedidaAcasalamento,
  criarCombinacaoMedida,
  criarMedidaAcasalamento,
  excluirCombinacaoMedida,
  excluirMedidaAcasalamento,
  listarCombinacoesMedida,
  listarMedidasAcasalamento,
} from "./medidas-acasalamento.js";

const medidaRow = {
  id: 10,
  nome: "Mérito leiteiro",
  tipo: "MERITO",
  consanguinidadeMax: null,
  exigePedigree: false,
  ativo: true,
  itens: [{
    id: 31,
    indicadorId: 7,
    peso: new Prisma.Decimal("1.2500"),
    minimo: new Prisma.Decimal("2.500"),
    maximo: null,
    indicador: { sigla: "PTA" },
  }],
};

const combinacaoRow = {
  id: 20,
  nome: "Leite equilibrado",
  ativo: true,
  itens: [{
    id: 42,
    medidaId: 10,
    peso: new Prisma.Decimal("2.5000"),
    obrigatoria: true,
    ordem: 3,
    medida: { nome: "Mérito leiteiro", tipo: "MERITO" },
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.medidaFindMany.mockResolvedValue([medidaRow]);
  mocks.medidaFindUnique.mockResolvedValue(medidaRow);
  mocks.combinacaoFindMany.mockResolvedValue([combinacaoRow]);
  mocks.combinacaoFindUnique.mockResolvedValue(combinacaoRow);
  mocks.itemCombinacaoCount.mockResolvedValue(0);
  mocks.planoCount.mockResolvedValue(0);
  mocks.txIndicadorFindMany.mockResolvedValue([{ id: 7 }]);
  mocks.txMedidaFindMany.mockResolvedValue([{ id: 10 }]);
  mocks.txMedidaCreate.mockResolvedValue({ id: 10 });
  mocks.txCombinacaoCreate.mockResolvedValue({ id: 20 });
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    indicadorGenetico: { findMany: mocks.txIndicadorFindMany },
    medidaAcasalamento: {
      findMany: mocks.txMedidaFindMany,
      create: mocks.txMedidaCreate,
      update: mocks.txMedidaUpdate,
    },
    itemMedidaAcasalamento: {
      deleteMany: mocks.txItemMedidaDeleteMany,
      createMany: mocks.txItemMedidaCreateMany,
    },
    combinacaoMedidaAcasalamento: {
      create: mocks.txCombinacaoCreate,
      update: mocks.txCombinacaoUpdate,
    },
    itemCombinacaoMedida: {
      deleteMany: mocks.txItemCombinacaoDeleteMany,
      createMany: mocks.txItemCombinacaoCreateMany,
    },
  }));
});

describe("schemas de medidas", () => {
  it("aceita as cinco configurações válidas", () => {
    const validas = [
      { nome: "Mérito", tipo: "MERITO", itens: [{ indicadorId: 1 }] },
      { nome: "Restrição", tipo: "RESTRICAO_INDICADOR", itens: [{ indicadorId: 1, minimo: 10 }] },
      { nome: "Consanguinidade", tipo: "CONSANGUINIDADE", consanguinidadeMax: 0.125 },
      { nome: "Pedigree", tipo: "PEDIGREE", exigePedigree: true },
      { nome: "Sêmen", tipo: "SEMEN" },
    ];

    for (const input of validas) expect(criarMedidaAcasalamentoSchema.safeParse(input).success).toBe(true);
  });

  it("rejeita tipo, limiar e itens incoerentes", () => {
    const invalidas = [
      { nome: "Inválida", tipo: "OUTRO" },
      { nome: "Mérito", tipo: "MERITO", itens: [] },
      { nome: "Restrição", tipo: "RESTRICAO_INDICADOR", itens: [] },
      { nome: "Consanguinidade", tipo: "CONSANGUINIDADE" },
      { nome: "Consanguinidade", tipo: "CONSANGUINIDADE", consanguinidadeMax: 1.1 },
      { nome: "Consanguinidade", tipo: "CONSANGUINIDADE", consanguinidadeMax: 0.1, itens: [{ indicadorId: 1 }] },
      { nome: "Pedigree", tipo: "PEDIGREE" },
      { nome: "Pedigree", tipo: "PEDIGREE", exigePedigree: true, itens: [{ indicadorId: 1 }] },
      { nome: "Sêmen", tipo: "SEMEN", itens: [{ indicadorId: 1 }] },
    ];

    for (const input of invalidas) expect(criarMedidaAcasalamentoSchema.safeParse(input).success).toBe(false);
  });

  it("rejeita mínimo maior que máximo e indicador duplicado", () => {
    expect(criarMedidaAcasalamentoSchema.safeParse({
      nome: "Faixa",
      tipo: "RESTRICAO_INDICADOR",
      itens: [{ indicadorId: 1, minimo: 10, maximo: 5 }],
    }).success).toBe(false);
    expect(criarMedidaAcasalamentoSchema.safeParse({
      nome: "Duplicada",
      tipo: "MERITO",
      itens: [{ indicadorId: 1 }, { indicadorId: 1 }],
    }).success).toBe(false);
  });

  it("valida PATCH somente no shape fornecido", () => {
    expect(atualizarMedidaAcasalamentoSchema.safeParse({ nome: "Novo nome" }).success).toBe(true);
    expect(atualizarMedidaAcasalamentoSchema.safeParse({
      itens: [{ indicadorId: 1 }, { indicadorId: 1 }],
    }).success).toBe(false);
  });
});

describe("schemas de combinações", () => {
  it("exige item e rejeita medida duplicada também no PATCH", () => {
    expect(criarCombinacaoMedidaSchema.safeParse({ nome: "Vazia", itens: [] }).success).toBe(false);
    const duplicada = { itens: [{ medidaId: 1 }, { medidaId: 1 }] };
    expect(criarCombinacaoMedidaSchema.safeParse({ nome: "Duplicada", ...duplicada }).success).toBe(false);
    expect(atualizarCombinacaoMedidaSchema.safeParse(duplicada).success).toBe(false);
  });
});

describe("criarMedidaAcasalamento", () => {
  it("valida indicadores ativos e substitui itens dentro da transação", async () => {
    const input = criarMedidaAcasalamentoSchema.parse({
      nome: "Mérito leiteiro",
      tipo: "MERITO",
      itens: [{ indicadorId: 7, peso: 1.25, minimo: 2.5 }],
    });

    await expect(criarMedidaAcasalamento(input)).resolves.toMatchObject({ id: 10, nome: "Mérito leiteiro" });

    expect(mocks.txIndicadorFindMany).toHaveBeenCalledWith({
      where: { id: { in: [7] }, ativo: true },
      select: { id: true },
    });
    expect(mocks.txMedidaCreate).toHaveBeenCalledWith({
      data: {
        nome: "Mérito leiteiro",
        tipo: "MERITO",
        consanguinidadeMax: null,
        exigePedigree: false,
        ativo: true,
      },
      select: { id: true },
    });
    expect(mocks.txItemMedidaDeleteMany).toHaveBeenCalledWith({ where: { medidaId: 10 } });
    expect(mocks.txItemMedidaCreateMany).toHaveBeenCalledWith({
      data: [{ medidaId: 10, indicadorId: 7, peso: 1.25, minimo: 2.5, maximo: null }],
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("atualizarMedidaAcasalamento", () => {
  it("valida o estado final e preserva todos os campos omitidos", async () => {
    await atualizarMedidaAcasalamento(10, { nome: "Mérito revisado" });

    expect(mocks.txMedidaUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        nome: "Mérito revisado",
        tipo: "MERITO",
        consanguinidadeMax: null,
        exigePedigree: false,
        ativo: true,
      },
    });
    expect(mocks.txItemMedidaDeleteMany).toHaveBeenCalledWith({ where: { medidaId: 10 } });
    expect(mocks.txItemMedidaCreateMany).toHaveBeenCalledWith({
      data: [{ medidaId: 10, indicadorId: 7, peso: 1.25, minimo: 2.5, maximo: null }],
    });
  });

  it("rejeita configuração final inválida", async () => {
    await expect(atualizarMedidaAcasalamento(10, { tipo: "PEDIGREE" })).rejects.toThrow(
      "medida de pedigree precisa exigir pedigree",
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("conflitos e exclusão de medida", () => {
  it("mapeia P2002 para conflito com nome já cadastrado", async () => {
    mocks.txMedidaCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "6.0.0" },
    ));
    const input = criarMedidaAcasalamentoSchema.parse({
      nome: "Duplicada",
      tipo: "SEMEN",
    });

    await expect(criarMedidaAcasalamento(input)).rejects.toEqual(
      expect.objectContaining<Partial<MedidaAcasalamentoError>>({
        code: "CONFLITO",
        message: "nome já cadastrado",
      }),
    );
  });

  it("inativa medida em uso e deleta medida sem uso", async () => {
    mocks.itemCombinacaoCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await excluirMedidaAcasalamento(10);
    expect(mocks.medidaUpdate).toHaveBeenCalledWith({ where: { id: 10 }, data: { ativo: false } });
    expect(mocks.medidaDelete).not.toHaveBeenCalled();

    await excluirMedidaAcasalamento(10);
    expect(mocks.medidaDelete).toHaveBeenCalledWith({ where: { id: 10 } });
  });
});

describe("criarCombinacaoMedida", () => {
  it("valida medidas ativas e grava os itens sem filtro de propriedade", async () => {
    const input = criarCombinacaoMedidaSchema.parse({
      nome: "Leite equilibrado",
      itens: [{ medidaId: 10, peso: 2.5, obrigatoria: true, ordem: 3 }],
    });

    await criarCombinacaoMedida(input);

    expect(mocks.txMedidaFindMany).toHaveBeenCalledWith({
      where: { id: { in: [10] }, ativo: true },
      select: { id: true },
    });
    expect(mocks.txCombinacaoCreate).toHaveBeenCalledWith({
      data: { nome: "Leite equilibrado", ativo: true },
      select: { id: true },
    });
    expect(mocks.txItemCombinacaoDeleteMany).toHaveBeenCalledWith({ where: { combinacaoId: 20 } });
    expect(mocks.txItemCombinacaoCreateMany).toHaveBeenCalledWith({
      data: [{ combinacaoId: 20, medidaId: 10, peso: 2.5, obrigatoria: true, ordem: 3 }],
    });
  });
});

describe("atualizarCombinacaoMedida", () => {
  it("substitui os itens dentro da transação", async () => {
    await atualizarCombinacaoMedida(20, {
      itens: [{ medidaId: 10, peso: 4, obrigatoria: false, ordem: 1 }],
    });

    expect(mocks.txCombinacaoUpdate).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { nome: "Leite equilibrado", ativo: true },
    });
    expect(mocks.txItemCombinacaoDeleteMany).toHaveBeenCalledWith({ where: { combinacaoId: 20 } });
    expect(mocks.txItemCombinacaoCreateMany).toHaveBeenCalledWith({
      data: [{ combinacaoId: 20, medidaId: 10, peso: 4, obrigatoria: false, ordem: 1 }],
    });
  });
});

describe("excluirCombinacaoMedida", () => {
  it("inativa combinação com plano e deleta combinação sem plano", async () => {
    mocks.planoCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await excluirCombinacaoMedida(20);
    expect(mocks.combinacaoUpdate).toHaveBeenCalledWith({ where: { id: 20 }, data: { ativo: false } });
    expect(mocks.combinacaoDelete).not.toHaveBeenCalled();

    await excluirCombinacaoMedida(20);
    expect(mocks.combinacaoDelete).toHaveBeenCalledWith({ where: { id: 20 } });
  });
});

describe("referências ausentes", () => {
  it("retorna NAO_ENCONTRADO para indicador e medida referenciada ausentes", async () => {
    mocks.txIndicadorFindMany.mockResolvedValue([]);
    const medida = criarMedidaAcasalamentoSchema.parse({
      nome: "Mérito",
      tipo: "MERITO",
      itens: [{ indicadorId: 7 }],
    });
    await expect(criarMedidaAcasalamento(medida)).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO", message: "indicador não encontrado" }),
    );

    mocks.txMedidaFindMany.mockResolvedValue([]);
    const combinacao = criarCombinacaoMedidaSchema.parse({
      nome: "Combinação",
      itens: [{ medidaId: 10 }],
    });
    await expect(criarCombinacaoMedida(combinacao)).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO", message: "medida não encontrada" }),
    );
  });

  it("retorna NAO_ENCONTRADO para ids de medida e combinação ausentes", async () => {
    mocks.medidaFindUnique.mockResolvedValueOnce(null);
    await expect(atualizarMedidaAcasalamento(999, { nome: "Ausente" })).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO", message: "medida não encontrada" }),
    );

    mocks.combinacaoFindUnique.mockResolvedValueOnce(null);
    await expect(atualizarCombinacaoMedida(999, { nome: "Ausente" })).rejects.toEqual(
      expect.objectContaining({ code: "NAO_ENCONTRADO", message: "combinação não encontrada" }),
    );
  });
});

describe("listagens e DTOs", () => {
  it("converte Decimal e ordena itens por id/ordem nas queries compartilhadas", async () => {
    await expect(listarMedidasAcasalamento()).resolves.toEqual([{
      id: 10,
      nome: "Mérito leiteiro",
      tipo: "MERITO",
      consanguinidadeMax: null,
      exigePedigree: false,
      ativo: true,
      itens: [{ indicadorId: 7, indicadorSigla: "PTA", peso: 1.25, minimo: 2.5, maximo: null }],
    }]);
    expect(mocks.medidaFindMany).toHaveBeenCalledWith({
      where: { ativo: true },
      include: {
        itens: {
          include: { indicador: { select: { sigla: true } } },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { nome: "asc" },
    });

    await expect(listarCombinacoesMedida(true)).resolves.toEqual([{
      id: 20,
      nome: "Leite equilibrado",
      ativo: true,
      itens: [{
        medidaId: 10,
        medidaNome: "Mérito leiteiro",
        medidaTipo: "MERITO",
        peso: 2.5,
        obrigatoria: true,
        ordem: 3,
      }],
    }]);
    expect(mocks.combinacaoFindMany).toHaveBeenCalledWith({
      where: {},
      include: {
        itens: {
          include: { medida: { select: { nome: true, tipo: true } } },
          orderBy: [{ ordem: "asc" }, { id: "asc" }],
        },
      },
      orderBy: { nome: "asc" },
    });
  });
});
