import { Prisma, type PrismaClient } from "@prisma/client";
import type { Genealogia } from "./parentesco.calc.js";
import type {
  CandidatoAcasalamento,
  ConfigRecomendacao,
  StatusCandidatoAcasalamento,
} from "./recomendar-acasalamento.calc.js";
import {
  criarMedidaAcasalamentoSchema,
  type TipoMedidaAcasalamento,
} from "./medidas-acasalamento.schemas.js";

export type DbAcasalamento = Pick<
  PrismaClient,
  | "$transaction"
  | "medidaAcasalamento"
  | "itemMedidaAcasalamento"
  | "indicadorGenetico"
  | "combinacaoMedidaAcasalamento"
  | "itemCombinacaoMedida"
>;

export interface CasoDouradoAcasalamento {
  ideagriId: number;
  nome: string;
  femea: Genealogia;
  candidatos: CandidatoAcasalamento[];
  config: ConfigRecomendacao;
  rankingEsperado: number[];
  statusEsperado: Record<string, StatusCandidatoAcasalamento>;
}

export interface DadosAcasalamentoLegado {
  medidasAcasalamento?: {
    ideagriId: number;
    nome: string;
    tipo: TipoMedidaAcasalamento;
    consanguinidadeMax: number | null;
    exigePedigree: boolean;
    ativo: boolean;
  }[];
  itensMedidaAcasalamento?: {
    medidaIdeagriId: number;
    indicadorSigla: string;
    peso: number;
    minimo: number | null;
    maximo: number | null;
  }[];
  combinacoesAcasalamento?: {
    ideagriId: number;
    nome: string;
    ativo: boolean;
  }[];
  itensCombinacaoAcasalamento?: {
    combinacaoIdeagriId: number;
    medidaIdeagriId: number;
    peso: number;
    obrigatoria: boolean;
    ordem: number;
  }[];
  casosDouradosAcasalamento?: CasoDouradoAcasalamento[];
}

export interface ResultadoImportAcasalamento {
  medidas: number;
  itensMedida: number;
  combinacoes: number;
  itensCombinacao: number;
  casosDourados: number;
}

const VAZIO: ResultadoImportAcasalamento = {
  medidas: 0,
  itensMedida: 0,
  combinacoes: 0,
  itensCombinacao: 0,
  casosDourados: 0,
};

type Tx = Parameters<Parameters<DbAcasalamento["$transaction"]>[0]>[0];

function agruparPor<T, K>(itens: readonly T[], chave: (item: T) => K): Map<K, T[]> {
  const grupos = new Map<K, T[]>();
  for (const item of itens) {
    const key = chave(item);
    const grupo = grupos.get(key);
    if (grupo) grupo.push(item);
    else grupos.set(key, [item]);
  }
  return grupos;
}

function rejeitarDuplicatas(
  valores: readonly string[],
  mensagem: (valor: string) => string,
): void {
  const vistos = new Set<string>();
  for (const valor of valores) {
    if (vistos.has(valor)) throw new Error(mensagem(valor));
    vistos.add(valor);
  }
}

function decimalOuNull(valor: number | null): Prisma.Decimal | null {
  return valor == null ? null : new Prisma.Decimal(valor);
}

export async function importarAcasalamentoLegado(
  db: DbAcasalamento,
  dados: DadosAcasalamentoLegado,
): Promise<ResultadoImportAcasalamento> {
  const temBloco =
    dados.medidasAcasalamento != null
    || dados.itensMedidaAcasalamento != null
    || dados.combinacoesAcasalamento != null
    || dados.itensCombinacaoAcasalamento != null
    || dados.casosDouradosAcasalamento != null;
  if (!temBloco) return { ...VAZIO };

  const medidas = dados.medidasAcasalamento ?? [];
  const itensMedida = dados.itensMedidaAcasalamento ?? [];
  const combinacoes = dados.combinacoesAcasalamento ?? [];
  const itensCombinacao = dados.itensCombinacaoAcasalamento ?? [];
  const casosDourados = dados.casosDouradosAcasalamento ?? [];

  return db.$transaction(async (tx: Tx) => {
    rejeitarDuplicatas(
      medidas.map(({ ideagriId }) => String(ideagriId)),
      (id) => `medida IDEAGRI ${id} duplicada no import de acasalamento`,
    );
    rejeitarDuplicatas(
      combinacoes.map(({ ideagriId }) => String(ideagriId)),
      (id) => `combinação IDEAGRI ${id} duplicada no import de acasalamento`,
    );

    const medidasOrigem = new Set(medidas.map(({ ideagriId }) => ideagriId));
    for (const item of itensMedida) {
      if (!medidasOrigem.has(item.medidaIdeagriId)) {
        throw new Error(`medida IDEAGRI ${item.medidaIdeagriId} não encontrada no import de acasalamento`);
      }
    }
    const combinacoesOrigem = new Set(combinacoes.map(({ ideagriId }) => ideagriId));
    for (const item of itensCombinacao) {
      if (!combinacoesOrigem.has(item.combinacaoIdeagriId)) {
        throw new Error(`combinação IDEAGRI ${item.combinacaoIdeagriId} não encontrada no import de acasalamento`);
      }
      if (!medidasOrigem.has(item.medidaIdeagriId)) {
        throw new Error(
          `medida IDEAGRI ${item.medidaIdeagriId} não encontrada para combinação IDEAGRI ${item.combinacaoIdeagriId}`,
        );
      }
    }

    const itensPorMedida = agruparPor(itensMedida, ({ medidaIdeagriId }) => medidaIdeagriId);
    const indicadorIdPorSigla = new Map<string, number>();
    const medidaIdPorIdeagri = new Map<number, number>();

    for (const medida of medidas) {
      const itens = itensPorMedida.get(medida.ideagriId) ?? [];
      rejeitarDuplicatas(
        itens.map(({ indicadorSigla }) => indicadorSigla),
        (sigla) => `indicador ${sigla} duplicado na medida IDEAGRI ${medida.ideagriId}`,
      );

      const itensResolvidos = [];
      for (const item of itens) {
        let indicadorId = indicadorIdPorSigla.get(item.indicadorSigla);
        if (indicadorId == null) {
          const indicador = await tx.indicadorGenetico.findUnique({
            where: { sigla: item.indicadorSigla },
            select: { id: true },
          });
          if (!indicador) {
            throw new Error(`indicador ${item.indicadorSigla} não encontrado no import de acasalamento`);
          }
          indicadorId = indicador.id;
          indicadorIdPorSigla.set(item.indicadorSigla, indicadorId);
        }
        itensResolvidos.push({
          indicadorId,
          peso: item.peso,
          minimo: item.minimo,
          maximo: item.maximo,
        });
      }

      if (medida.tipo !== "CONSANGUINIDADE" && medida.consanguinidadeMax != null) {
        throw new Error(
          `medida IDEAGRI ${medida.ideagriId} do tipo ${medida.tipo} não aceita limite de consanguinidade`,
        );
      }
      const validada = criarMedidaAcasalamentoSchema.parse({
        nome: medida.nome,
        tipo: medida.tipo,
        consanguinidadeMax: medida.consanguinidadeMax,
        exigePedigree: medida.exigePedigree,
        ativo: medida.ativo,
        itens: itensResolvidos,
      });
      const dadosMedida = {
        nome: validada.nome,
        tipo: validada.tipo,
        consanguinidadeMax: decimalOuNull(validada.consanguinidadeMax),
        exigePedigree: validada.exigePedigree,
        ativo: validada.ativo,
      };
      const row = await tx.medidaAcasalamento.upsert({
        where: { ideagriId: medida.ideagriId },
        create: { ideagriId: medida.ideagriId, ...dadosMedida },
        update: dadosMedida,
      });
      medidaIdPorIdeagri.set(medida.ideagriId, row.id);

      await tx.itemMedidaAcasalamento.deleteMany({ where: { medidaId: row.id } });
      if (itensResolvidos.length > 0) {
        await tx.itemMedidaAcasalamento.createMany({
          data: itensResolvidos.map((item) => ({
            medidaId: row.id,
            indicadorId: item.indicadorId,
            peso: new Prisma.Decimal(item.peso),
            minimo: decimalOuNull(item.minimo),
            maximo: decimalOuNull(item.maximo),
          })),
        });
      }
    }

    const itensPorCombinacao = agruparPor(
      itensCombinacao,
      ({ combinacaoIdeagriId }) => combinacaoIdeagriId,
    );
    for (const combinacao of combinacoes) {
      const itens = itensPorCombinacao.get(combinacao.ideagriId) ?? [];
      rejeitarDuplicatas(
        itens.map(({ medidaIdeagriId }) => String(medidaIdeagriId)),
        (id) => `medida IDEAGRI ${id} duplicada na combinação IDEAGRI ${combinacao.ideagriId}`,
      );
      const dadosCombinacao = { nome: combinacao.nome, ativo: combinacao.ativo };
      const row = await tx.combinacaoMedidaAcasalamento.upsert({
        where: { ideagriId: combinacao.ideagriId },
        create: { ideagriId: combinacao.ideagriId, ...dadosCombinacao },
        update: dadosCombinacao,
      });

      await tx.itemCombinacaoMedida.deleteMany({ where: { combinacaoId: row.id } });
      if (itens.length > 0) {
        await tx.itemCombinacaoMedida.createMany({
          data: itens.map((item) => ({
            combinacaoId: row.id,
            medidaId: medidaIdPorIdeagri.get(item.medidaIdeagriId)!,
            peso: new Prisma.Decimal(item.peso),
            obrigatoria: item.obrigatoria,
            ordem: item.ordem,
          })),
        });
      }
    }

    return {
      medidas: medidas.length,
      itensMedida: itensMedida.length,
      combinacoes: combinacoes.length,
      itensCombinacao: itensCombinacao.length,
      casosDourados: casosDourados.length,
    };
  });
}
