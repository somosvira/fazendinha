import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  animalFindFirst: vi.fn(),
  animalFindMany: vi.fn(),
  reprodutorFindMany: vi.fn(),
  indicadorFindMany: vi.fn(),
  combinacaoFindFirst: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    animal: {
      findFirst: mocks.animalFindFirst,
      findMany: mocks.animalFindMany,
    },
    reprodutor: { findMany: mocks.reprodutorFindMany },
    indicadorGenetico: { findMany: mocks.indicadorFindMany },
    combinacaoMedidaAcasalamento: { findFirst: mocks.combinacaoFindFirst },
  },
}));

import {
  AcasalamentoError,
  recomendarParaAnimal,
  recomendarParaAnimais,
} from "./acasalamento.js";

const pedigreeCompleto = {
  paiNome: "Pai do touro",
  paiCodigo: "PT-01",
  maeNome: "Mãe do touro",
  maeCodigo: "MT-01",
  avoMaternoNome: null,
  avoMaternoCodigo: null,
  avoPaternoNome: null,
  avoPaternoCodigo: null,
};

const vaca = {
  id: 7,
  paiNome: "Pai legado",
  pai: {
    nome: "Touro pai",
    numero: "PAI-001",
    paiNome: null,
    mae: null,
  },
  mae: null,
};

const reprodutores = [
  {
    id: 10,
    nome: "Touro não aparentado",
    codigo: "TA-010",
    valoresIndicador: [
      { indicadorId: 1, valor: new Prisma.Decimal(80) },
      { indicadorId: 2, valor: new Prisma.Decimal(20) },
    ],
    pedigree: pedigreeCompleto,
  },
  {
    id: 20,
    nome: "Touro pai",
    codigo: "PAI-001",
    valoresIndicador: [
      { indicadorId: 1, valor: new Prisma.Decimal(120) },
      { indicadorId: 2, valor: new Prisma.Decimal(10) },
    ],
    pedigree: pedigreeCompleto,
  },
];

const indicadores = [
  { id: 1, direcao: "maior_melhor", ranking: true },
  { id: 2, direcao: "menor_melhor", ranking: true },
  { id: 3, direcao: "maior_melhor", ranking: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.animalFindFirst.mockResolvedValue(vaca);
  mocks.animalFindMany.mockResolvedValue([
    vaca,
    {
      id: 8,
      paiNome: null,
      pai: null,
      mae: null,
    },
  ]);
  mocks.reprodutorFindMany.mockResolvedValue(reprodutores);
  mocks.indicadorFindMany.mockResolvedValue(indicadores);
  mocks.combinacaoFindFirst.mockResolvedValue(null);
});

describe("recomendarParaAnimal", () => {
  it("monta genealogias e indicadores no default e devolve DTO estritamente superset", async () => {
    const resultado = await recomendarParaAnimal(7, 3);

    expect(mocks.animalFindFirst).toHaveBeenCalledWith({
      where: { id: 7, propriedadeId: 3 },
      select: {
        id: true,
        paiNome: true,
        pai: {
          select: {
            nome: true,
            numero: true,
            paiNome: true,
            mae: { select: { nome: true, numero: true } },
          },
        },
        mae: {
          select: {
            nome: true,
            numero: true,
            paiNome: true,
            mae: { select: { nome: true, numero: true } },
          },
        },
      },
    });
    expect(mocks.reprodutorFindMany).toHaveBeenCalledWith({
      where: {
        ativo: true,
        OR: [{ propriedadeId: 3 }, { propriedadeId: null }],
      },
      select: {
        id: true,
        nome: true,
        codigo: true,
        valoresIndicador: {
          select: { indicadorId: true, valor: true },
        },
        pedigree: {
          select: {
            paiNome: true,
            paiCodigo: true,
            maeNome: true,
            maeCodigo: true,
            avoMaternoNome: true,
            avoMaternoCodigo: true,
            avoPaternoNome: true,
            avoPaternoCodigo: true,
          },
        },
      },
    });
    expect(mocks.indicadorFindMany).toHaveBeenCalledWith({
      where: { ativo: true },
      select: { id: true, direcao: true, ranking: true },
      orderBy: { id: "asc" },
    });
    expect(mocks.combinacaoFindFirst).not.toHaveBeenCalled();

    expect(resultado).toEqual({
      animalId: 7,
      paiNome: "Pai legado",
      combinacaoId: null,
      recomendacoes: [
        {
          id: 10,
          nome: "Touro não aparentado",
          score: 0,
          consanguineo: false,
          motivo: "mérito genético calculado com 2 indicadores",
          status: "ok",
          parentesco: 0,
          merito: 0,
          motivos: ["mérito genético calculado com 2 indicadores"],
          indicadoresPontuados: 2,
        },
        {
          id: 20,
          nome: "Touro pai",
          score: 0,
          consanguineo: true,
          motivo: "parentesco 50% acima do limite de 12.5%",
          status: "consanguineo",
          parentesco: 0.5,
          merito: 1,
          motivos: ["parentesco 50% acima do limite de 12.5%"],
          indicadoresPontuados: 2,
        },
      ],
    });
  });

  it("resolve combinação ativa e usa seus itens mesmo sem ranking default", async () => {
    mocks.indicadorFindMany.mockResolvedValue([
      { id: 1, direcao: "maior_melhor", ranking: false },
      { id: 2, direcao: "menor_melhor", ranking: false },
    ]);
    mocks.combinacaoFindFirst.mockResolvedValue({
      id: 44,
      itens: [{
        peso: new Prisma.Decimal(2),
        obrigatoria: true,
        ordem: 1,
        medida: {
          tipo: "MERITO",
          consanguinidadeMax: null,
          exigePedigree: false,
          itens: [{
            indicadorId: 1,
            peso: new Prisma.Decimal("1.5"),
            minimo: null,
            maximo: null,
          }],
        },
      }],
    });

    const resultado = await recomendarParaAnimal(7, 3, 44);

    expect(mocks.combinacaoFindFirst).toHaveBeenCalledWith({
      where: { id: 44, ativo: true },
      select: {
        id: true,
        itens: {
          orderBy: [{ ordem: "asc" }, { id: "asc" }],
          select: {
            peso: true,
            obrigatoria: true,
            ordem: true,
            medida: {
              select: {
                tipo: true,
                consanguinidadeMax: true,
                exigePedigree: true,
                itens: {
                  orderBy: { id: "asc" },
                  select: {
                    indicadorId: true,
                    peso: true,
                    minimo: true,
                    maximo: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    expect(resultado.combinacaoId).toBe(44);
    expect(resultado.recomendacoes.find(({ id }) => id === 20)).toMatchObject({
      merito: 1,
      indicadoresPontuados: 1,
    });
  });

  it("rejeita combinação ausente ou inativa como não encontrada", async () => {
    mocks.combinacaoFindFirst.mockResolvedValue(null);

    await expect(recomendarParaAnimal(7, 3, 999)).rejects.toMatchObject({
      code: "NAO_ENCONTRADO",
      message: "combinação não encontrada",
    });
  });

  it("trata animal de outro escopo como não encontrado", async () => {
    mocks.animalFindFirst.mockResolvedValue(null);

    await expect(recomendarParaAnimal(7, 3)).rejects.toEqual(
      new AcasalamentoError("NAO_ENCONTRADO", "animal não encontrado"),
    );
    expect(mocks.reprodutorFindMany).not.toHaveBeenCalled();
  });

  it("não restringe fatos quando o escopo de leitura é global", async () => {
    await recomendarParaAnimal(7, null);

    expect(mocks.animalFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
    }));
    expect(mocks.reprodutorFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ativo: true },
    }));
  });
});

describe("recomendarParaAnimais", () => {
  it("carrega fêmeas e contexto uma única vez e mantém resultado por animal", async () => {
    mocks.combinacaoFindFirst.mockResolvedValue({
      id: 44,
      itens: [{
        peso: new Prisma.Decimal(1),
        obrigatoria: false,
        ordem: 1,
        medida: {
          tipo: "CONSANGUINIDADE",
          consanguinidadeMax: new Prisma.Decimal("0.125"),
          exigePedigree: false,
          itens: [],
        },
      }],
    });

    const resultado = await recomendarParaAnimais([7, 8], 3, 44);

    expect(mocks.animalFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.animalFindMany).toHaveBeenCalledWith({
      where: { id: { in: [7, 8] }, propriedadeId: 3 },
      select: {
        id: true,
        paiNome: true,
        pai: {
          select: {
            nome: true,
            numero: true,
            paiNome: true,
            mae: { select: { nome: true, numero: true } },
          },
        },
        mae: {
          select: {
            nome: true,
            numero: true,
            paiNome: true,
            mae: { select: { nome: true, numero: true } },
          },
        },
      },
    });
    expect(mocks.reprodutorFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.indicadorFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.combinacaoFindFirst).toHaveBeenCalledTimes(1);
    expect(resultado.config).toMatchObject({ consanguinidadeMax: 0.125 });
    expect([...resultado.resultados.keys()]).toEqual([7, 8]);
    expect(resultado.resultados.get(7)).toHaveLength(2);
    expect(resultado.resultados.get(8)).toHaveLength(2);
  });
});
