import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db.js";
import { recomendarParaAnimais } from "./acasalamento.js";
import type { ConfigRecomendacao } from "./recomendar-acasalamento.calc.js";
import {
  type CriarPlanoAcasalamentoInput,
  type EscolherReprodutorPlanoInput,
} from "./planos-acasalamento.schemas.js";

export class PlanoAcasalamentoError extends Error {
  constructor(
    public code: "NAO_ENCONTRADO" | "CONFLITO",
    message: string,
  ) {
    super(message);
  }
}

export interface ResumoPlanoAcasalamentoDTO {
  id: number;
  nome: string;
  grupoId: number;
  grupoNome: string;
  combinacaoId: number;
  combinacaoNome: string;
  ultimaVersao: number | null;
  totalFemeas: number;
  totalEscolhas: number;
  createdAt: string;
  updatedAt: string;
}

export interface CandidatoSnapshotDTO {
  reprodutorId: number;
  nome: string;
  merito: number;
  parentesco: number;
  status: "ok" | "consanguineo" | "restrito" | "nao_verificavel";
  score: number;
  motivos: string[];
  indicadoresPontuados: number;
}

export interface LinhaPlanoAcasalamentoDTO {
  id: number;
  femeaId: number;
  femeaNumero: string;
  femeaNome: string | null;
  ranking: CandidatoSnapshotDTO[];
  reprodutorEscolhidoId: number | null;
  reprodutorEscolhidoNome: string | null;
  confirmadoNaoVerificavel: boolean;
}

export interface VersaoPlanoAcasalamentoDTO {
  id: number;
  versao: number;
  configSnapshot: ConfigRecomendacao;
  createdAt: string;
  linhas: LinhaPlanoAcasalamentoDTO[];
}

export interface PlanoAcasalamentoDTO extends ResumoPlanoAcasalamentoDTO {
  versoes: VersaoPlanoAcasalamentoDTO[];
}

const termoConfigSchema = z.object({
  indicadorId: z.number().int().positive(),
  peso: z.number(),
  direcao: z.enum(["maior_melhor", "menor_melhor"]),
  minimo: z.number().nullable(),
  maximo: z.number().nullable(),
  obrigatoria: z.boolean(),
});

const configSnapshotSchema = z.object({
  termos: z.array(termoConfigSchema),
  consanguinidadeMax: z.number().min(0).max(1),
  exigePedigree: z.boolean(),
});

const candidatoSnapshotSchema = z.object({
  reprodutorId: z.number().int().positive(),
  nome: z.string(),
  merito: z.number(),
  parentesco: z.number(),
  status: z.enum(["ok", "consanguineo", "restrito", "nao_verificavel"]),
  score: z.number(),
  motivos: z.array(z.string()),
  indicadoresPontuados: z.number().int().nonnegative(),
});

const rankingSnapshotSchema = z.array(candidatoSnapshotSchema);

const linhaInclude = {
  femea: { select: { numero: true, nome: true } },
  reprodutorEscolhido: { select: { nome: true } },
} satisfies Prisma.LinhaPlanoAcasalamentoInclude;

const planoInclude = {
  grupo: { select: { nome: true } },
  combinacao: { select: { nome: true } },
  versoes: {
    orderBy: { versao: "desc" },
    include: {
      linhas: {
        orderBy: [{ femea: { numero: "asc" } }, { id: "asc" }],
        include: linhaInclude,
      },
    },
  },
} satisfies Prisma.PlanoAcasalamentoInclude;

function registroNoEscopo(propriedadeId: number | null) {
  return propriedadeId != null ? { propriedadeId } : {};
}

function snapshotInvalido(): never {
  throw new PlanoAcasalamentoError(
    "CONFLITO",
    "snapshot de acasalamento inválido",
  );
}

function parseConfigSnapshot(valor: unknown): ConfigRecomendacao {
  const resultado = configSnapshotSchema.safeParse(valor);
  if (!resultado.success) return snapshotInvalido();
  return resultado.data;
}

function parseRankingSnapshot(valor: unknown): CandidatoSnapshotDTO[] {
  const resultado = rankingSnapshotSchema.safeParse(valor);
  if (!resultado.success) return snapshotInvalido();
  return resultado.data;
}

function mapearLinha(linha: {
  id: number;
  femeaId: number;
  femea: { numero: string; nome: string | null };
  rankingSnapshot: unknown;
  reprodutorEscolhidoId: number | null;
  reprodutorEscolhido: { nome: string } | null;
  confirmadoNaoVerificavel: boolean;
}): LinhaPlanoAcasalamentoDTO {
  return {
    id: linha.id,
    femeaId: linha.femeaId,
    femeaNumero: linha.femea.numero,
    femeaNome: linha.femea.nome,
    ranking: parseRankingSnapshot(linha.rankingSnapshot),
    reprodutorEscolhidoId: linha.reprodutorEscolhidoId,
    reprodutorEscolhidoNome: linha.reprodutorEscolhido?.nome ?? null,
    confirmadoNaoVerificavel: linha.confirmadoNaoVerificavel,
  };
}

function contagensUltimaVersao(versoes: Array<{
  versao: number;
  linhas: Array<{ reprodutorEscolhidoId: number | null }>;
}>) {
  const ultima = versoes[0];
  return {
    ultimaVersao: ultima?.versao ?? null,
    totalFemeas: ultima?.linhas.length ?? 0,
    totalEscolhas:
      ultima?.linhas.filter(({ reprodutorEscolhidoId }) =>
        reprodutorEscolhidoId != null).length ?? 0,
  };
}

function mapearResumo(plano: {
  id: number;
  nome: string;
  grupoId: number;
  grupo: { nome: string };
  combinacaoId: number;
  combinacao: { nome: string };
  createdAt: Date;
  updatedAt: Date;
  versoes: Array<{
    versao: number;
    linhas: Array<{ reprodutorEscolhidoId: number | null }>;
  }>;
}): ResumoPlanoAcasalamentoDTO {
  return {
    id: plano.id,
    nome: plano.nome,
    grupoId: plano.grupoId,
    grupoNome: plano.grupo.nome,
    combinacaoId: plano.combinacaoId,
    combinacaoNome: plano.combinacao.nome,
    ...contagensUltimaVersao(plano.versoes),
    createdAt: plano.createdAt.toISOString(),
    updatedAt: plano.updatedAt.toISOString(),
  };
}

function mapearPlano(plano: {
  id: number;
  nome: string;
  grupoId: number;
  grupo: { nome: string };
  combinacaoId: number;
  combinacao: { nome: string };
  createdAt: Date;
  updatedAt: Date;
  versoes: Array<{
    id: number;
    versao: number;
    configSnapshot: unknown;
    createdAt: Date;
    linhas: Array<Parameters<typeof mapearLinha>[0]>;
  }>;
}): PlanoAcasalamentoDTO {
  return {
    ...mapearResumo(plano),
    versoes: plano.versoes.map((versao) => ({
      id: versao.id,
      versao: versao.versao,
      configSnapshot: parseConfigSnapshot(versao.configSnapshot),
      createdAt: versao.createdAt.toISOString(),
      linhas: versao.linhas.map(mapearLinha),
    })),
  };
}

const femeasDoGrupoQuery = (grupoId: number, propriedadeId: number | null) => ({
  where: {
    grupoId,
    sexo: "F" as const,
    status: "ATIVO" as const,
    ...registroNoEscopo(propriedadeId),
  },
  select: { id: true, numero: true, nome: true },
  orderBy: [{ numero: "asc" as const }, { id: "asc" as const }],
});

async function carregarCalculoDoGrupo(
  grupoId: number,
  combinacaoId: number,
  propriedadeId: number | null,
) {
  const femeas = await prisma.animal.findMany(
    femeasDoGrupoQuery(grupoId, propriedadeId),
  );
  if (femeas.length === 0) {
    throw new PlanoAcasalamentoError("CONFLITO", "lote sem fêmeas ativas");
  }

  const recomendacao = await recomendarParaAnimais(
    femeas.map(({ id }) => id),
    propriedadeId,
    combinacaoId,
  );
  const linhas = femeas.map(({ id: femeaId }) => {
    const rankingSnapshot = recomendacao.resultados.get(femeaId);
    if (!rankingSnapshot) return snapshotInvalido();
    return { femeaId, rankingSnapshot };
  });
  return { configSnapshot: recomendacao.config, linhas };
}

function json(valor: unknown): Prisma.InputJsonValue {
  return valor as Prisma.InputJsonValue;
}

export async function listarPlanosAcasalamento(
  propriedadeId: number | null,
): Promise<ResumoPlanoAcasalamentoDTO[]> {
  const planos = await prisma.planoAcasalamento.findMany({
    where: registroNoEscopo(propriedadeId),
    include: {
      grupo: { select: { nome: true } },
      combinacao: { select: { nome: true } },
      versoes: {
        orderBy: { versao: "desc" },
        take: 1,
        select: {
          versao: true,
          linhas: { select: { reprodutorEscolhidoId: true } },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
  return planos.map(mapearResumo);
}

export async function obterPlanoAcasalamento(
  id: number,
  propriedadeId: number | null,
): Promise<PlanoAcasalamentoDTO> {
  const plano = await prisma.planoAcasalamento.findFirst({
    where: { id, ...registroNoEscopo(propriedadeId) },
    include: planoInclude,
  });
  if (!plano) {
    throw new PlanoAcasalamentoError("NAO_ENCONTRADO", "plano não encontrado");
  }
  return mapearPlano(plano);
}

export async function criarPlanoAcasalamento(
  input: CriarPlanoAcasalamentoInput,
  propriedadeId: number | null,
): Promise<PlanoAcasalamentoDTO> {
  const grupo = await prisma.grupo.findFirst({
    where: { id: input.grupoId, ...registroNoEscopo(propriedadeId) },
    select: { id: true, nome: true },
  });
  if (!grupo) {
    throw new PlanoAcasalamentoError("NAO_ENCONTRADO", "grupo não encontrado");
  }

  const combinacao = await prisma.combinacaoMedidaAcasalamento.findFirst({
    where: { id: input.combinacaoId, ativo: true },
    select: { id: true, nome: true },
  });
  if (!combinacao) {
    throw new PlanoAcasalamentoError(
      "NAO_ENCONTRADO",
      "combinação não encontrada",
    );
  }

  const calculo = await carregarCalculoDoGrupo(
    grupo.id,
    combinacao.id,
    propriedadeId,
  );
  const planoId = await prisma.$transaction(async (tx) => {
    const plano = await tx.planoAcasalamento.create({
      data: {
        nome: input.nome,
        grupoId: grupo.id,
        combinacaoId: combinacao.id,
        propriedadeId,
      },
      select: { id: true },
    });
    const versao = await tx.versaoPlanoAcasalamento.create({
      data: {
        planoId: plano.id,
        versao: 1,
        configSnapshot: json(calculo.configSnapshot),
      },
      select: { id: true },
    });
    await tx.linhaPlanoAcasalamento.createMany({
      data: calculo.linhas.map(({ femeaId, rankingSnapshot }) => ({
        versaoId: versao.id,
        femeaId,
        rankingSnapshot: json(rankingSnapshot),
      })),
    });
    return plano.id;
  });

  return obterPlanoAcasalamento(planoId, propriedadeId);
}

export async function recalcularPlanoAcasalamento(
  id: number,
  propriedadeId: number | null,
): Promise<PlanoAcasalamentoDTO> {
  const plano = await prisma.planoAcasalamento.findFirst({
    where: { id, ...registroNoEscopo(propriedadeId) },
    select: { id: true, grupoId: true, combinacaoId: true },
  });
  if (!plano) {
    throw new PlanoAcasalamentoError("NAO_ENCONTRADO", "plano não encontrado");
  }

  const calculo = await carregarCalculoDoGrupo(
    plano.grupoId,
    plano.combinacaoId,
    propriedadeId,
  );
  const ultima = await prisma.versaoPlanoAcasalamento.aggregate({
    where: { planoId: plano.id },
    _max: { versao: true },
  });
  const proximaVersao = (ultima._max.versao ?? 0) + 1;

  try {
    await prisma.$transaction(async (tx) => {
      const versao = await tx.versaoPlanoAcasalamento.create({
        data: {
          planoId: plano.id,
          versao: proximaVersao,
          configSnapshot: json(calculo.configSnapshot),
        },
        select: { id: true },
      });
      await tx.linhaPlanoAcasalamento.createMany({
        data: calculo.linhas.map(({ femeaId, rankingSnapshot }) => ({
          versaoId: versao.id,
          femeaId,
          rankingSnapshot: json(rankingSnapshot),
        })),
      });
      await tx.planoAcasalamento.update({
        where: { id: plano.id },
        data: { updatedAt: new Date() },
      });
    });
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2002"
    ) {
      throw new PlanoAcasalamentoError(
        "CONFLITO",
        "plano recalculado simultaneamente; tente novamente",
      );
    }
    throw erro;
  }

  return obterPlanoAcasalamento(plano.id, propriedadeId);
}

export async function escolherReprodutorPlano(
  linhaId: number,
  input: EscolherReprodutorPlanoInput,
  propriedadeId: number | null,
): Promise<{ linha: LinhaPlanoAcasalamentoDTO; aviso: string | null }> {
  const linha = await prisma.linhaPlanoAcasalamento.findFirst({
    where: {
      id: linhaId,
      ...(propriedadeId != null
        ? { versao: { plano: { propriedadeId } } }
        : {}),
    },
    include: {
      ...linhaInclude,
      versao: { select: { plano: { select: { id: true, propriedadeId: true } } } },
    },
  });
  if (!linha) {
    throw new PlanoAcasalamentoError(
      "NAO_ENCONTRADO",
      "linha do plano não encontrada",
    );
  }

  const ranking = parseRankingSnapshot(linha.rankingSnapshot);
  const candidato = ranking.find(
    ({ reprodutorId }) => reprodutorId === input.reprodutorId,
  );
  if (!candidato) {
    throw new PlanoAcasalamentoError(
      "NAO_ENCONTRADO",
      "reprodutor não encontrado no plano",
    );
  }
  if (candidato.status === "consanguineo" || candidato.status === "restrito") {
    throw new PlanoAcasalamentoError(
      "CONFLITO",
      "reprodutor eliminado pelas restrições do plano",
    );
  }
  if (
    candidato.status === "nao_verificavel" &&
    !input.confirmadoNaoVerificavel
  ) {
    throw new PlanoAcasalamentoError(
      "CONFLITO",
      "confirme o pedigree não verificável antes de escolher",
    );
  }

  const confirmadoNaoVerificavel = candidato.status === "nao_verificavel";
  const resultado = await prisma.$transaction(async (tx) => {
    const atualizada = await tx.linhaPlanoAcasalamento.update({
      where: { id: linha.id },
      data: {
        reprodutorEscolhidoId: candidato.reprodutorId,
        confirmadoNaoVerificavel,
      },
      include: linhaInclude,
    });
    const estoque = await tx.estoqueSemen.aggregate({
      where: { reprodutorId: candidato.reprodutorId, propriedadeId },
      _sum: { dosesDisponiveis: true },
    });
    return { atualizada, doses: estoque._sum.dosesDisponiveis ?? 0 };
  });

  return {
    linha: mapearLinha(resultado.atualizada),
    aviso:
      resultado.doses <= 0
        ? "reprodutor escolhido sem dose de sêmen disponível neste sítio"
        : null,
  };
}
