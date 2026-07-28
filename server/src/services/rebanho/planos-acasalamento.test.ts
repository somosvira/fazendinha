import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  criarPlanoAcasalamentoSchema,
  escolherReprodutorPlanoSchema,
} from "./planos-acasalamento.schemas.js";

const mocks = vi.hoisted(() => ({
  grupoFindFirst: vi.fn(),
  combinacaoFindFirst: vi.fn(),
  animalFindMany: vi.fn(),
  planoFindMany: vi.fn(),
  planoFindFirst: vi.fn(),
  versaoAggregate: vi.fn(),
  linhaFindFirst: vi.fn(),
  estoqueAggregate: vi.fn(),
  estoqueUpdate: vi.fn(),
  transaction: vi.fn(),
  txPlanoCreate: vi.fn(),
  txPlanoUpdate: vi.fn(),
  txVersaoCreate: vi.fn(),
  txVersaoUpdate: vi.fn(),
  txVersaoDeleteMany: vi.fn(),
  txLinhaCreateMany: vi.fn(),
  txLinhaUpdate: vi.fn(),
  recomendarParaAnimais: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    grupo: { findFirst: mocks.grupoFindFirst },
    combinacaoMedidaAcasalamento: { findFirst: mocks.combinacaoFindFirst },
    animal: { findMany: mocks.animalFindMany },
    planoAcasalamento: {
      findMany: mocks.planoFindMany,
      findFirst: mocks.planoFindFirst,
    },
    versaoPlanoAcasalamento: { aggregate: mocks.versaoAggregate },
    linhaPlanoAcasalamento: { findFirst: mocks.linhaFindFirst },
    estoqueSemen: {
      aggregate: mocks.estoqueAggregate,
      update: mocks.estoqueUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("./acasalamento.js", () => ({
  AcasalamentoError: class AcasalamentoError extends Error {
    constructor(public code: "NAO_ENCONTRADO", message: string) {
      super(message);
    }
  },
  recomendarParaAnimais: mocks.recomendarParaAnimais,
}));

import {
  PlanoAcasalamentoError,
  criarPlanoAcasalamento,
  escolherReprodutorPlano,
  listarPlanosAcasalamento,
  obterPlanoAcasalamento,
  recalcularPlanoAcasalamento,
} from "./planos-acasalamento.js";

const dataCriacao = new Date("2026-07-27T12:00:00.000Z");
const dataAtualizacao = new Date("2026-07-27T13:00:00.000Z");

const configSnapshot = {
  termos: [{
    indicadorId: 7,
    peso: 1.5,
    direcao: "maior_melhor" as const,
    minimo: null,
    maximo: null,
    obrigatoria: false,
  }],
  consanguinidadeMax: 0.125,
  exigePedigree: false,
};

const rankingSnapshot = [
  {
    reprodutorId: 10,
    nome: "Touro Seguro",
    merito: 0.8,
    parentesco: 0,
    status: "ok" as const,
    score: 0.8,
    motivos: ["mérito genético calculado com 1 indicador"],
    indicadoresPontuados: 1,
  },
  {
    reprodutorId: 20,
    nome: "Touro Incerto",
    merito: 0.6,
    parentesco: 0,
    status: "nao_verificavel" as const,
    score: 0.6,
    motivos: ["pedigree insuficiente para verificar consanguinidade"],
    indicadoresPontuados: 1,
  },
  {
    reprodutorId: 30,
    nome: "Touro Consanguíneo",
    merito: 1,
    parentesco: 0.5,
    status: "consanguineo" as const,
    score: 0,
    motivos: ["parentesco 50% acima do limite de 12.5%"],
    indicadoresPontuados: 1,
  },
  {
    reprodutorId: 40,
    nome: "Touro Restrito",
    merito: 0.9,
    parentesco: 0,
    status: "restrito" as const,
    score: 0,
    motivos: ["indicador 7 abaixo do mínimo 10"],
    indicadoresPontuados: 1,
  },
];

function versaoRow(versao = 1) {
  return {
    id: 200 + versao,
    versao,
    configSnapshot,
    createdAt: dataCriacao,
    linhas: [
      {
        id: 301,
        femeaId: 11,
        femea: { numero: "0011", nome: "Aurora" },
        rankingSnapshot,
        reprodutorEscolhidoId: 10,
        reprodutorEscolhido: { nome: "Touro Seguro" },
        confirmadoNaoVerificavel: false,
      },
      {
        id: 302,
        femeaId: 12,
        femea: { numero: "0012", nome: null },
        rankingSnapshot,
        reprodutorEscolhidoId: null,
        reprodutorEscolhido: null,
        confirmadoNaoVerificavel: false,
      },
    ],
  };
}

function planoRow() {
  return {
    id: 100,
    nome: "Novilhas 2026",
    grupoId: 8,
    grupo: { nome: "Novilhas" },
    combinacaoId: 9,
    combinacao: { nome: "Leite equilibrado" },
    propriedadeId: 3,
    createdAt: dataCriacao,
    updatedAt: dataAtualizacao,
    versoes: [versaoRow()],
  };
}

function linhaRow() {
  return {
    id: 301,
    femeaId: 11,
    femea: { numero: "0011", nome: "Aurora" },
    rankingSnapshot,
    reprodutorEscolhidoId: null,
    reprodutorEscolhido: null,
    confirmadoNaoVerificavel: false,
    versao: {
      plano: { id: 100, propriedadeId: 3 },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.grupoFindFirst.mockResolvedValue({ id: 8, nome: "Novilhas" });
  mocks.combinacaoFindFirst.mockResolvedValue({ id: 9, nome: "Leite equilibrado" });
  mocks.animalFindMany.mockResolvedValue([
    { id: 11, numero: "0011", nome: "Aurora" },
    { id: 12, numero: "0012", nome: null },
  ]);
  mocks.planoFindMany.mockResolvedValue([planoRow()]);
  mocks.planoFindFirst.mockResolvedValue(planoRow());
  mocks.versaoAggregate.mockResolvedValue({ _max: { versao: 1 } });
  mocks.linhaFindFirst.mockResolvedValue(linhaRow());
  mocks.estoqueAggregate.mockResolvedValue({ _sum: { dosesDisponiveis: 5 } });
  mocks.txPlanoCreate.mockResolvedValue({ id: 100 });
  mocks.txVersaoCreate.mockResolvedValue({ id: 201 });
  mocks.txLinhaUpdate.mockImplementation(async ({ data }: { data: {
    reprodutorEscolhidoId: number;
    confirmadoNaoVerificavel: boolean;
  } }) => ({
    ...linhaRow(),
    reprodutorEscolhidoId: data.reprodutorEscolhidoId,
    reprodutorEscolhido: {
      nome: rankingSnapshot.find(({ reprodutorId }) =>
        reprodutorId === data.reprodutorEscolhidoId)?.nome ?? "",
    },
    confirmadoNaoVerificavel: data.confirmadoNaoVerificavel,
  }));
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    planoAcasalamento: {
      create: mocks.txPlanoCreate,
      update: mocks.txPlanoUpdate,
    },
    versaoPlanoAcasalamento: {
      create: mocks.txVersaoCreate,
      update: mocks.txVersaoUpdate,
      deleteMany: mocks.txVersaoDeleteMany,
    },
    linhaPlanoAcasalamento: {
      createMany: mocks.txLinhaCreateMany,
      update: mocks.txLinhaUpdate,
    },
    estoqueSemen: {
      aggregate: mocks.estoqueAggregate,
      update: mocks.estoqueUpdate,
    },
  }));
  mocks.recomendarParaAnimais.mockResolvedValue({
    config: configSnapshot,
    resultados: new Map([
      [11, rankingSnapshot],
      [12, rankingSnapshot],
    ]),
  });
});

describe("schemas de planos de acasalamento", () => {
  it("normaliza payloads válidos e rejeita campos inválidos", () => {
    expect(criarPlanoAcasalamentoSchema.parse({
      nome: "  Novilhas 2026  ",
      grupoId: 8,
      combinacaoId: 9,
    })).toEqual({ nome: "Novilhas 2026", grupoId: 8, combinacaoId: 9 });
    expect(criarPlanoAcasalamentoSchema.safeParse({
      nome: "",
      grupoId: 0,
      combinacaoId: 1.5,
    }).success).toBe(false);

    expect(escolherReprodutorPlanoSchema.parse({ reprodutorId: 10 })).toEqual({
      reprodutorId: 10,
      confirmadoNaoVerificavel: false,
    });
    expect(escolherReprodutorPlanoSchema.safeParse({
      reprodutorId: -1,
      confirmadoNaoVerificavel: "sim",
    }).success).toBe(false);
  });
});

describe("criarPlanoAcasalamento", () => {
  const input = { nome: "Novilhas 2026", grupoId: 8, combinacaoId: 9 };

  it("recusa grupo fora do sítio, combinação inativa e lote sem fêmeas", async () => {
    mocks.grupoFindFirst.mockResolvedValueOnce(null);
    await expect(criarPlanoAcasalamento(input, 3)).rejects.toMatchObject({
      code: "NAO_ENCONTRADO",
      message: "grupo não encontrado",
    });
    expect(mocks.grupoFindFirst).toHaveBeenLastCalledWith({
      where: { id: 8, propriedadeId: 3 },
      select: { id: true, nome: true },
    });

    mocks.combinacaoFindFirst.mockResolvedValueOnce(null);
    await expect(criarPlanoAcasalamento(input, 3)).rejects.toMatchObject({
      code: "NAO_ENCONTRADO",
      message: "combinação não encontrada",
    });
    expect(mocks.combinacaoFindFirst).toHaveBeenLastCalledWith({
      where: { id: 9, ativo: true },
      select: { id: true, nome: true },
    });

    mocks.animalFindMany.mockResolvedValueOnce([]);
    await expect(criarPlanoAcasalamento(input, 3)).rejects.toEqual(
      new PlanoAcasalamentoError("CONFLITO", "lote sem fêmeas ativas"),
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("persiste plano, versão 1 e uma linha por fêmea na mesma transação", async () => {
    await expect(criarPlanoAcasalamento(input, 3)).resolves.toMatchObject({
      id: 100,
      ultimaVersao: 1,
      totalFemeas: 2,
      totalEscolhas: 1,
      versoes: [{ versao: 1, configSnapshot, linhas: [{ femeaId: 11 }, { femeaId: 12 }] }],
    });

    expect(mocks.animalFindMany).toHaveBeenCalledWith({
      where: {
        grupoId: 8,
        sexo: "F",
        status: "ATIVO",
        propriedadeId: 3,
      },
      select: { id: true, numero: true, nome: true },
      orderBy: [{ numero: "asc" }, { id: "asc" }],
    });
    expect(mocks.recomendarParaAnimais).toHaveBeenCalledWith([11, 12], 3, 9);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.txPlanoCreate).toHaveBeenCalledWith({
      data: {
        nome: "Novilhas 2026",
        grupoId: 8,
        combinacaoId: 9,
        propriedadeId: 3,
      },
      select: { id: true },
    });
    expect(mocks.txVersaoCreate).toHaveBeenCalledWith({
      data: { planoId: 100, versao: 1, configSnapshot },
      select: { id: true },
    });
    expect(mocks.txLinhaCreateMany).toHaveBeenCalledWith({
      data: [
        { versaoId: 201, femeaId: 11, rankingSnapshot },
        { versaoId: 201, femeaId: 12, rankingSnapshot },
      ],
    });
  });
});

describe("recalcularPlanoAcasalamento", () => {
  it("cria N+1 com as fêmeas e configuração atuais sem alterar versões anteriores", async () => {
    mocks.planoFindFirst
      .mockResolvedValueOnce({ id: 100, grupoId: 8, combinacaoId: 9 })
      .mockResolvedValueOnce({ ...planoRow(), versoes: [versaoRow(2), versaoRow(1)] });

    await expect(recalcularPlanoAcasalamento(100, 3)).resolves.toMatchObject({
      id: 100,
      ultimaVersao: 2,
    });

    expect(mocks.planoFindFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 100, propriedadeId: 3 },
      select: { id: true, grupoId: true, combinacaoId: true },
    });
    expect(mocks.versaoAggregate).toHaveBeenCalledWith({
      where: { planoId: 100 },
      _max: { versao: true },
    });
    expect(mocks.txVersaoCreate).toHaveBeenCalledWith({
      data: { planoId: 100, versao: 2, configSnapshot },
      select: { id: true },
    });
    expect(mocks.txVersaoUpdate).not.toHaveBeenCalled();
    expect(mocks.txVersaoDeleteMany).not.toHaveBeenCalled();
  });

  it("mapeia combinação inativada depois da criação para erro de domínio", async () => {
    const { AcasalamentoError } = await import("./acasalamento.js");
    mocks.planoFindFirst.mockResolvedValueOnce({
      id: 100,
      grupoId: 8,
      combinacaoId: 9,
    });
    mocks.recomendarParaAnimais.mockRejectedValueOnce(
      new AcasalamentoError("NAO_ENCONTRADO", "combinação não encontrada"),
    );

    await expect(recalcularPlanoAcasalamento(100, 3)).rejects.toEqual(
      new PlanoAcasalamentoError(
        "NAO_ENCONTRADO",
        "combinação do plano indisponível",
      ),
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("mapeia P2002 de versão concorrente para conflito operacional", async () => {
    mocks.planoFindFirst.mockResolvedValueOnce({ id: 100, grupoId: 8, combinacaoId: 9 });
    mocks.txVersaoCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "6.0.0" },
    ));

    await expect(recalcularPlanoAcasalamento(100, 3)).rejects.toEqual(
      new PlanoAcasalamentoError(
        "CONFLITO",
        "plano recalculado simultaneamente; tente novamente",
      ),
    );
  });
});

describe("listarPlanosAcasalamento e obterPlanoAcasalamento", () => {
  it("filtra planos estritamente pelo sítio e conta somente a última versão", async () => {
    await expect(listarPlanosAcasalamento(3)).resolves.toEqual([{
      id: 100,
      nome: "Novilhas 2026",
      grupoId: 8,
      grupoNome: "Novilhas",
      combinacaoId: 9,
      combinacaoNome: "Leite equilibrado",
      ultimaVersao: 1,
      totalFemeas: 2,
      totalEscolhas: 1,
      createdAt: dataCriacao.toISOString(),
      updatedAt: dataAtualizacao.toISOString(),
    }]);
    expect(mocks.planoFindMany).toHaveBeenCalledWith({
      where: { propriedadeId: 3 },
      include: expect.objectContaining({
        grupo: { select: { nome: true } },
        combinacao: { select: { nome: true } },
      }),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
  });

  it("obtém apenas plano do sítio e mapeia versões descendentes com datas ISO", async () => {
    mocks.planoFindFirst.mockResolvedValue({
      ...planoRow(),
      versoes: [versaoRow(2), versaoRow(1)],
    });

    await expect(obterPlanoAcasalamento(100, 3)).resolves.toMatchObject({
      id: 100,
      ultimaVersao: 2,
      versoes: [
        { versao: 2, createdAt: dataCriacao.toISOString() },
        { versao: 1, createdAt: dataCriacao.toISOString() },
      ],
    });
    expect(mocks.planoFindFirst).toHaveBeenCalledWith({
      where: { id: 100, propriedadeId: 3 },
      include: expect.objectContaining({
        grupo: { select: { nome: true } },
        combinacao: { select: { nome: true } },
      }),
    });
  });

  it("não aplica filtro apenas quando o escopo consolidado é explícito", async () => {
    await listarPlanosAcasalamento(null);
    await obterPlanoAcasalamento(100, null);

    expect(mocks.planoFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(mocks.planoFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 100 },
    }));
  });

  it("falha fechado quando config ou ranking do snapshot está corrompido", async () => {
    mocks.planoFindFirst.mockResolvedValueOnce({
      ...planoRow(),
      versoes: [{ ...versaoRow(), configSnapshot: { termos: "corrompidos" } }],
    });
    await expect(obterPlanoAcasalamento(100, 3)).rejects.toEqual(
      new PlanoAcasalamentoError("CONFLITO", "snapshot de acasalamento inválido"),
    );

    mocks.planoFindFirst.mockResolvedValueOnce({
      ...planoRow(),
      versoes: [{
        ...versaoRow(),
        linhas: [{ ...versaoRow().linhas[0], rankingSnapshot: [{ reprodutorId: "10" }] }],
      }],
    });
    await expect(obterPlanoAcasalamento(100, 3)).rejects.toEqual(
      new PlanoAcasalamentoError("CONFLITO", "snapshot de acasalamento inválido"),
    );
  });
});

describe("escolherReprodutorPlano", () => {
  it("bloqueia candidato ausente e candidatos eliminados pelo snapshot", async () => {
    await expect(escolherReprodutorPlano(
      301,
      { reprodutorId: 999, confirmadoNaoVerificavel: false },
      3,
    )).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });

    for (const reprodutorId of [30, 40]) {
      await expect(escolherReprodutorPlano(
        301,
        { reprodutorId, confirmadoNaoVerificavel: false },
        3,
      )).rejects.toEqual(new PlanoAcasalamentoError(
        "CONFLITO",
        "reprodutor eliminado pelas restrições do plano",
      ));
    }
    expect(mocks.txLinhaUpdate).not.toHaveBeenCalled();
  });

  it("exige confirmação explícita para pedigree não verificável", async () => {
    await expect(escolherReprodutorPlano(
      301,
      { reprodutorId: 20, confirmadoNaoVerificavel: false },
      3,
    )).rejects.toEqual(new PlanoAcasalamentoError(
      "CONFLITO",
      "confirme o pedigree não verificável antes de escolher",
    ));
  });

  it("persiste escolha ok ignorando confirmação indevida e não retorna aviso com dose", async () => {
    await expect(escolherReprodutorPlano(
      301,
      { reprodutorId: 10, confirmadoNaoVerificavel: true },
      3,
    )).resolves.toMatchObject({
      linha: {
        reprodutorEscolhidoId: 10,
        reprodutorEscolhidoNome: "Touro Seguro",
        confirmadoNaoVerificavel: false,
      },
      aviso: null,
    });

    expect(mocks.txLinhaUpdate).toHaveBeenCalledWith({
      where: { id: 301 },
      data: {
        reprodutorEscolhidoId: 10,
        confirmadoNaoVerificavel: false,
      },
      include: expect.any(Object),
    });
    expect(mocks.estoqueAggregate).toHaveBeenCalledWith({
      where: { reprodutorId: 10, propriedadeId: 3 },
      _sum: { dosesDisponiveis: true },
    });
    expect(mocks.estoqueUpdate).not.toHaveBeenCalled();
  });

  it("persiste confirmação não verificável e estoque zero/ausente gera somente aviso", async () => {
    mocks.estoqueAggregate.mockResolvedValue({ _sum: { dosesDisponiveis: null } });

    await expect(escolherReprodutorPlano(
      301,
      { reprodutorId: 20, confirmadoNaoVerificavel: true },
      3,
    )).resolves.toMatchObject({
      linha: { confirmadoNaoVerificavel: true },
      aviso: "reprodutor escolhido sem dose de sêmen disponível neste sítio",
    });

    expect(mocks.txLinhaUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        reprodutorEscolhidoId: 20,
        confirmadoNaoVerificavel: true,
      },
    }));
    expect(mocks.estoqueUpdate).not.toHaveBeenCalled();
  });

  it("soma todo o estoque do reprodutor no escopo consolidado", async () => {
    await expect(escolherReprodutorPlano(
      301,
      { reprodutorId: 10, confirmadoNaoVerificavel: false },
      null,
    )).resolves.toMatchObject({ aviso: null });

    expect(mocks.estoqueAggregate).toHaveBeenCalledWith({
      where: { reprodutorId: 10 },
      _sum: { dosesDisponiveis: true },
    });
  });

  it("trata linha de outro sítio como não encontrada", async () => {
    mocks.linhaFindFirst.mockResolvedValue(null);

    await expect(escolherReprodutorPlano(
      301,
      { reprodutorId: 10, confirmadoNaoVerificavel: false },
      4,
    )).rejects.toEqual(new PlanoAcasalamentoError(
      "NAO_ENCONTRADO",
      "linha do plano não encontrada",
    ));
    expect(mocks.linhaFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 301,
        versao: { plano: { propriedadeId: 4 } },
      },
    }));
  });
});
