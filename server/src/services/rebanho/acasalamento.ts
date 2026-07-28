import { prisma } from "../../db.js";
import {
  configDaCombinacao,
  configDefault,
  type MedidaResolvida,
} from "./config-acasalamento.calc.js";
import {
  genealogiaDaFemea,
  genealogiaDoTouro,
  type AnimalGenealogia,
} from "./genealogia-acasalamento.calc.js";
import type { DirecaoIndicadorAcasalamento } from "./merito-acasalamento.calc.js";
import {
  recomendarAcasalamento,
  type CandidatoAcasalamento,
  type CandidatoRecomendado,
  type ConfigRecomendacao,
  type StatusCandidatoAcasalamento,
} from "./recomendar-acasalamento.calc.js";

export class AcasalamentoError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) {
    super(message);
  }
}

export interface ItemRecomendacaoAcasalamentoDTO {
  id: number;
  nome: string;
  score: number;
  consanguineo: boolean;
  motivo: string;
  status: StatusCandidatoAcasalamento;
  parentesco: number;
  merito: number;
  motivos: string[];
  indicadoresPontuados: number;
}

export interface RecomendacaoAcasalamentoDTO {
  animalId: number;
  paiNome: string | null;
  combinacaoId: number | null;
  recomendacoes: ItemRecomendacaoAcasalamentoDTO[];
}

function direcaoIndicador(
  valor: string,
): DirecaoIndicadorAcasalamento | null {
  return valor === "maior_melhor" || valor === "menor_melhor" ? valor : null;
}

async function resolverConfiguracao(
  combinacaoId: number | null | undefined,
  indicadores: { id: number; direcao: string; ranking: boolean }[],
) {
  if (combinacaoId == null) {
    const ranking = indicadores
      .filter(({ ranking }) => ranking)
      .map(({ id, direcao }) => {
        const resolvida = direcaoIndicador(direcao);
        if (!resolvida) {
          throw new Error(`indicador ${id} sem direção configurada`);
        }
        return { indicadorId: id, direcao: resolvida };
      });
    return configDefault(ranking);
  }

  const combinacao = await prisma.combinacaoMedidaAcasalamento.findFirst({
    where: { id: combinacaoId, ativo: true },
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
  if (!combinacao) {
    throw new AcasalamentoError("NAO_ENCONTRADO", "combinação não encontrada");
  }

  const direcoes = new Map<number, DirecaoIndicadorAcasalamento>();
  for (const indicador of indicadores) {
    const direcao = direcaoIndicador(indicador.direcao);
    if (direcao) direcoes.set(indicador.id, direcao);
  }

  const medidas: MedidaResolvida[] = combinacao.itens.map((item) => ({
    tipo: item.medida.tipo as MedidaResolvida["tipo"],
    peso: Number(item.peso),
    obrigatoria: item.obrigatoria,
    consanguinidadeMax:
      item.medida.consanguinidadeMax == null
        ? null
        : Number(item.medida.consanguinidadeMax),
    exigePedigree: item.medida.exigePedigree,
    itens: item.medida.itens.map((medidaItem) => ({
      indicadorId: medidaItem.indicadorId,
      peso: Number(medidaItem.peso),
      minimo: medidaItem.minimo == null ? null : Number(medidaItem.minimo),
      maximo: medidaItem.maximo == null ? null : Number(medidaItem.maximo),
    })),
  }));
  return configDaCombinacao(medidas, direcoes);
}

const animalGenealogiaSelect = {
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
} as const;

async function carregarContextoRecomendacao(
  propriedadeId: number | null,
  combinacaoId: number | null | undefined,
): Promise<{ config: ConfigRecomendacao; candidatos: CandidatoAcasalamento[] }> {
  const [reprodutores, indicadores] = await Promise.all([
    prisma.reprodutor.findMany({
      where: {
        ativo: true,
        ...(propriedadeId != null
          ? { OR: [{ propriedadeId }, { propriedadeId: null }] }
          : {}),
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
    }),
    prisma.indicadorGenetico.findMany({
      where: { ativo: true },
      select: { id: true, direcao: true, ranking: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const config = await resolverConfiguracao(combinacaoId, indicadores);
  const candidatos: CandidatoAcasalamento[] = reprodutores.map((reprodutor) => ({
    id: reprodutor.id,
    nome: reprodutor.nome,
    genealogia: genealogiaDoTouro(
      reprodutor.pedigree,
      reprodutor.nome,
      reprodutor.codigo,
    ),
    valores: reprodutor.valoresIndicador.map(({ indicadorId, valor }) => ({
      indicadorId,
      valor: Number(valor),
    })),
  }));

  return { config, candidatos };
}

function recomendarComContexto(
  femea: AnimalGenealogia,
  config: ConfigRecomendacao,
  candidatos: CandidatoAcasalamento[],
): CandidatoRecomendado[] {
  return recomendarAcasalamento(genealogiaDaFemea(femea), candidatos, config);
}

export async function recomendarParaAnimais(
  animalIds: readonly number[],
  propriedadeId: number | null,
  combinacaoId: number,
): Promise<{
  config: ConfigRecomendacao;
  resultados: Map<number, CandidatoRecomendado[]>;
}> {
  const [femeas, contexto] = await Promise.all([
    prisma.animal.findMany({
      where: {
        id: { in: [...animalIds] },
        ...(propriedadeId != null ? { propriedadeId } : {}),
      },
      select: animalGenealogiaSelect,
    }),
    carregarContextoRecomendacao(propriedadeId, combinacaoId),
  ]);
  const femeasPorId = new Map(femeas.map((femea) => [femea.id, femea]));
  const resultados = new Map<number, CandidatoRecomendado[]>();

  for (const animalId of animalIds) {
    const femea = femeasPorId.get(animalId);
    if (femea) {
      resultados.set(
        animalId,
        recomendarComContexto(femea, contexto.config, contexto.candidatos),
      );
    }
  }

  return { config: contexto.config, resultados };
}

// Recomenda touros por indicadores genéticos e parentesco, sem reservar nem baixar doses.
export async function recomendarParaAnimal(
  animalId: number,
  propriedadeId: number | null,
  combinacaoId?: number | null,
): Promise<RecomendacaoAcasalamentoDTO> {
  const vaca = await prisma.animal.findFirst({
    where: {
      id: animalId,
      ...(propriedadeId != null ? { propriedadeId } : {}),
    },
    select: animalGenealogiaSelect,
  });
  if (!vaca) {
    throw new AcasalamentoError("NAO_ENCONTRADO", "animal não encontrado");
  }
  const contexto = await carregarContextoRecomendacao(
    propriedadeId,
    combinacaoId,
  );

  const recomendacoes = recomendarComContexto(
    vaca,
    contexto.config,
    contexto.candidatos,
  ).map((recomendacao): ItemRecomendacaoAcasalamentoDTO => ({
    id: recomendacao.reprodutorId,
    nome: recomendacao.nome,
    score: recomendacao.score,
    consanguineo: recomendacao.status === "consanguineo",
    motivo: recomendacao.motivos[0] ?? "",
    status: recomendacao.status,
    parentesco: recomendacao.parentesco,
    merito: recomendacao.merito,
    motivos: recomendacao.motivos,
    indicadoresPontuados: recomendacao.indicadoresPontuados,
  }));

  return {
    animalId,
    paiNome: vaca.paiNome,
    combinacaoId: combinacaoId ?? null,
    recomendacoes,
  };
}
