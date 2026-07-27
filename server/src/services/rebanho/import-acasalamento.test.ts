import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { importarAcasalamentoLegado } from "./import-acasalamento.js";

let txMock: ReturnType<typeof novoTx>;

function novoTx() {
  return {
    medidaAcasalamento: {
      upsert: vi.fn(async ({ where }: any) => ({ id: 100 + where.ideagriId })),
    },
    itemMedidaAcasalamento: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    indicadorGenetico: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.sigla === "PTAL" ? { id: 42 } : null),
    },
    combinacaoMedidaAcasalamento: {
      upsert: vi.fn(async ({ where }: any) => ({ id: 200 + where.ideagriId })),
    },
    itemCombinacaoMedida: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

function dbMock() {
  return {
    $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  } as any;
}

const medidaMerito = {
  ideagriId: 10,
  nome: "Mérito leiteiro",
  tipo: "MERITO" as const,
  consanguinidadeMax: null,
  exigePedigree: false,
  ativo: true,
};

const itemMedida = {
  medidaIdeagriId: 10,
  indicadorSigla: "PTAL",
  peso: 2,
  minimo: 100,
  maximo: 900,
};

const combinacao = { ideagriId: 20, nome: "Índice leite", ativo: true };
const itemCombinacao = {
  combinacaoIdeagriId: 20,
  medidaIdeagriId: 10,
  peso: 1.5,
  obrigatoria: true,
  ordem: 0,
};

const casoDourado = {
  ideagriId: 30,
  nome: "Caso Atlas",
  femea: { ancestrais: [{ chave: "pai-a", grau: 0.5 }], profundidade: 1, paiConhecido: true },
  candidatos: [],
  config: { termos: [], consanguinidadeMax: 0.125, exigePedigree: false },
  rankingEsperado: [],
  statusEsperado: {},
};

describe("importarAcasalamentoLegado", () => {
  it("sem blocos de acasalamento é no-op e não abre transação", async () => {
    txMock = novoTx();
    const db = dbMock();

    await expect(importarAcasalamentoLegado(db, {})).resolves.toEqual({
      medidas: 0,
      itensMedida: 0,
      combinacoes: 0,
      itensCombinacao: 0,
      casosDourados: 0,
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("usa uma única transação e upserta pais pela identidade IDEAGRI", async () => {
    txMock = novoTx();
    const db = dbMock();

    const resultado = await importarAcasalamentoLegado(db, {
      medidasAcasalamento: [medidaMerito],
      itensMedidaAcasalamento: [itemMedida],
      combinacoesAcasalamento: [combinacao],
      itensCombinacaoAcasalamento: [itemCombinacao],
      casosDouradosAcasalamento: [casoDourado],
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.medidaAcasalamento.upsert).toHaveBeenCalledWith({
      where: { ideagriId: 10 },
      create: {
        ideagriId: 10,
        nome: "Mérito leiteiro",
        tipo: "MERITO",
        consanguinidadeMax: null,
        exigePedigree: false,
        ativo: true,
      },
      update: {
        nome: "Mérito leiteiro",
        tipo: "MERITO",
        consanguinidadeMax: null,
        exigePedigree: false,
        ativo: true,
      },
    });
    expect(txMock.combinacaoMedidaAcasalamento.upsert).toHaveBeenCalledWith({
      where: { ideagriId: 20 },
      create: { ideagriId: 20, nome: "Índice leite", ativo: true },
      update: { nome: "Índice leite", ativo: true },
    });
    expect(resultado).toEqual({
      medidas: 1,
      itensMedida: 1,
      combinacoes: 1,
      itensCombinacao: 1,
      casosDourados: 1,
    });
  });

  it("substitui os itens de cada medida, inclusive por fotografia vazia", async () => {
    txMock = novoTx();
    const db = dbMock();

    await importarAcasalamentoLegado(db, {
      medidasAcasalamento: [
        medidaMerito,
        {
          ideagriId: 11,
          nome: "Limite de parentesco",
          tipo: "CONSANGUINIDADE",
          consanguinidadeMax: 0.125,
          exigePedigree: false,
          ativo: true,
        },
      ],
      itensMedidaAcasalamento: [itemMedida],
    });

    expect(txMock.itemMedidaAcasalamento.deleteMany.mock.calls.map(([args]) => args)).toEqual([
      { where: { medidaId: 110 } },
      { where: { medidaId: 111 } },
    ]);
    expect(txMock.indicadorGenetico.findUnique).toHaveBeenCalledWith({
      where: { sigla: "PTAL" },
      select: { id: true },
    });
    const criacao = txMock.itemMedidaAcasalamento.createMany.mock.calls[0][0];
    expect(criacao.data[0]).toEqual({
      medidaId: 110,
      indicadorId: 42,
      peso: expect.any(Prisma.Decimal),
      minimo: expect.any(Prisma.Decimal),
      maximo: expect.any(Prisma.Decimal),
    });
    expect(txMock.itemMedidaAcasalamento.createMany).toHaveBeenCalledTimes(1);
  });

  it("substitui os itens de cada combinação resolvendo a medida importada", async () => {
    txMock = novoTx();
    const db = dbMock();

    await importarAcasalamentoLegado(db, {
      medidasAcasalamento: [medidaMerito],
      itensMedidaAcasalamento: [itemMedida],
      combinacoesAcasalamento: [
        combinacao,
        { ideagriId: 21, nome: "Índice vazio", ativo: false },
      ],
      itensCombinacaoAcasalamento: [itemCombinacao],
    });

    expect(txMock.itemCombinacaoMedida.deleteMany.mock.calls.map(([args]) => args)).toEqual([
      { where: { combinacaoId: 220 } },
      { where: { combinacaoId: 221 } },
    ]);
    const criacao = txMock.itemCombinacaoMedida.createMany.mock.calls[0][0];
    expect(criacao.data[0]).toEqual({
      combinacaoId: 220,
      medidaId: 110,
      peso: expect.any(Prisma.Decimal),
      obrigatoria: true,
      ordem: 0,
    });
    expect(txMock.itemCombinacaoMedida.createMany).toHaveBeenCalledTimes(1);
  });

  it("executado duas vezes converge pelos mesmos upserts e substituições", async () => {
    txMock = novoTx();
    const db = dbMock();
    const dados = {
      medidasAcasalamento: [medidaMerito],
      itensMedidaAcasalamento: [itemMedida],
      combinacoesAcasalamento: [combinacao],
      itensCombinacaoAcasalamento: [itemCombinacao],
    };

    const primeira = await importarAcasalamentoLegado(db, dados);
    const segunda = await importarAcasalamentoLegado(db, dados);

    expect(segunda).toEqual(primeira);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(txMock.medidaAcasalamento.upsert.mock.calls.map(([args]) => args.where)).toEqual([
      { ideagriId: 10 }, { ideagriId: 10 },
    ]);
    expect(txMock.combinacaoMedidaAcasalamento.upsert.mock.calls.map(([args]) => args.where)).toEqual([
      { ideagriId: 20 }, { ideagriId: 20 },
    ]);
    expect(txMock.itemMedidaAcasalamento.deleteMany).toHaveBeenCalledTimes(2);
    expect(txMock.itemCombinacaoMedida.deleteMany).toHaveBeenCalledTimes(2);
  });

  it("aborta quando indicador por sigla não existe", async () => {
    txMock = novoTx();
    txMock.indicadorGenetico.findUnique.mockResolvedValue(null);
    const db = dbMock();

    await expect(importarAcasalamentoLegado(db, {
      medidasAcasalamento: [medidaMerito],
      itensMedidaAcasalamento: [itemMedida],
    })).rejects.toThrow("indicador PTAL não encontrado no import de acasalamento");
    expect(txMock.itemMedidaAcasalamento.createMany).not.toHaveBeenCalled();
  });

  it("aborta quando item de medida referencia medida ausente", async () => {
    txMock = novoTx();
    const db = dbMock();

    await expect(importarAcasalamentoLegado(db, {
      itensMedidaAcasalamento: [itemMedida],
    })).rejects.toThrow("medida IDEAGRI 10 não encontrada no import de acasalamento");
  });

  it("aborta quando item de combinação referencia combinação ou medida ausente", async () => {
    txMock = novoTx();
    const db = dbMock();

    await expect(importarAcasalamentoLegado(db, {
      medidasAcasalamento: [medidaMerito],
      itensCombinacaoAcasalamento: [itemCombinacao],
    })).rejects.toThrow("combinação IDEAGRI 20 não encontrada no import de acasalamento");

    await expect(importarAcasalamentoLegado(db, {
      combinacoesAcasalamento: [combinacao],
      itensCombinacaoAcasalamento: [itemCombinacao],
    })).rejects.toThrow("medida IDEAGRI 10 não encontrada para combinação IDEAGRI 20");
  });

  it("valida coerência das medidas pelo schema e aborta duplicatas", async () => {
    txMock = novoTx();
    const db = dbMock();

    await expect(importarAcasalamentoLegado(db, {
      medidasAcasalamento: [{ ...medidaMerito, consanguinidadeMax: 0.2 }],
      itensMedidaAcasalamento: [itemMedida],
    })).rejects.toThrow();
    expect(txMock.medidaAcasalamento.upsert).not.toHaveBeenCalled();

    await expect(importarAcasalamentoLegado(db, {
      medidasAcasalamento: [medidaMerito],
      itensMedidaAcasalamento: [itemMedida, itemMedida],
    })).rejects.toThrow("indicador PTAL duplicado na medida IDEAGRI 10");
  });

  it("casos dourados apenas contam e não acionam nenhum delegate de persistência", async () => {
    txMock = novoTx();
    const db = dbMock();

    await expect(importarAcasalamentoLegado(db, {
      casosDouradosAcasalamento: [casoDourado],
    })).resolves.toEqual({
      medidas: 0,
      itensMedida: 0,
      combinacoes: 0,
      itensCombinacao: 0,
      casosDourados: 1,
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.medidaAcasalamento.upsert).not.toHaveBeenCalled();
    expect(txMock.combinacaoMedidaAcasalamento.upsert).not.toHaveBeenCalled();
    expect(txMock.itemMedidaAcasalamento.createMany).not.toHaveBeenCalled();
    expect(txMock.itemCombinacaoMedida.createMany).not.toHaveBeenCalled();
  });
});
