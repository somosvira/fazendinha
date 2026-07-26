import { prisma } from "../../db.js";
import { resumoProgramacao, type ResumoProgramacao } from "./iatf-lote.calc.js";
import type { EtapaAgendada } from "./iatf.calc.js";
import {
  agregarStatusLote,
  planejarExecucaoColetiva,
  type AplicacaoLoteExec,
  type ResumoLoteExec,
} from "./iatf-lote-exec.calc.js";
import type { CriarProgramacaoInput, ExecutarEtapaLoteInput } from "./iatf-lote.schemas.js";
import {
  atualizarExecucaoNaTransacao,
  materializarExecucoes,
  type AplicacaoRow,
  type ExecRow,
} from "./iatf.js";

export class IatfLoteError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "PROTOCOLO_INATIVO" | "SEM_ANIMAIS", message: string) { super(message); }
}

const iso = (x: Date) => new Date(x).toISOString().slice(0, 10);
// @db.Date gravado a partir de uma Date UTC-meia-noite para não escorregar de dia por fuso.
const dataDb = (isoDia: string) => new Date(`${isoDia}T00:00:00Z`);
// `hoje` civil UTC — a leitura de progresso é determinística sobre a data corrente.
const hojeUTC = () => new Date().toISOString().slice(0, 10);

export interface ProgramacaoIatfLoteDTO {
  id: number;
  protocoloId: number;
  protocoloNome: string;
  grupoId: number | null;
  grupoNome: string | null;
  nome: string | null;
  dataInicio: string;
  observacao: string | null;
  totalAnimais: number;
  // Leitura de progresso do lote (agenda derivada + próxima etapa + concluídas).
  agenda: EtapaAgendada[];
  totalEtapas: number;
  etapasConcluidas: number;
  proxima: EtapaAgendada | null;
  concluido: boolean;
}

export interface AnimalProgramacaoDTO { aplicacaoId: number; animalId: number; numero: string; nome: string | null }
export interface ProgramacaoDetalheDTO extends ProgramacaoIatfLoteDTO {
  animais: AnimalProgramacaoDTO[];
  resumoExec: ResumoLoteExec;
}

type EtapaRow = { dia: number; acao: string; hormonio: string | null; ordem: number };
type ProgRow = {
  id: number; protocoloId: number; grupoId: number | null; nome: string | null;
  dataInicio: Date; observacao: string | null;
  protocolo: { nome: string; etapas: EtapaRow[] };
  grupo: { nome: string } | null;
  _count: { aplicacoes: number };
};

type ExecResumoRow = {
  id: number;
  dia: number;
  ordem: number;
  status: "PENDENTE" | "CONCLUIDA" | "PULADA";
  dataPlanejada: Date;
};
type AplicacaoResumoRow = { id: number; animalId: number; execucoes: ExecResumoRow[] };
type ProgDetalheRow = Omit<ProgRow, "_count"> & {
  aplicacoes: (AplicacaoResumoRow & {
    animal: { id: number; numero: string; nome: string | null };
  })[];
};

function aplicacaoExecDTO(a: AplicacaoResumoRow): AplicacaoLoteExec {
  return {
    aplicacaoId: a.id,
    animalId: a.animalId,
    execucoes: a.execucoes.map((e) => ({
      id: e.id,
      dia: e.dia,
      ordem: e.ordem,
      status: e.status,
      dataPlanejada: iso(e.dataPlanejada),
    })),
  };
}

function programacaoDTO(p: ProgRow, hoje: string): ProgramacaoIatfLoteDTO {
  const dataInicio = iso(p.dataInicio);
  // Lote exibe progresso com base nas datas planejadas (agenda simples). O status real
  // de cada etapa é preenchido e consultado na aplicação individual.
  const r: ResumoProgramacao = resumoProgramacao({ etapas: p.protocolo.etapas, dataInicio, hoje });
  return {
    id: p.id,
    protocoloId: p.protocoloId,
    protocoloNome: p.protocolo.nome,
    grupoId: p.grupoId,
    grupoNome: p.grupo?.nome ?? null,
    nome: p.nome,
    dataInicio,
    observacao: p.observacao,
    totalAnimais: p._count.aplicacoes,
    agenda: r.agenda,
    totalEtapas: r.totalEtapas,
    etapasConcluidas: r.etapasConcluidas,
    proxima: r.proxima,
    concluido: r.concluido,
  };
}

function includeProgramacao(propriedadeId: number | null) {
  return {
    protocolo: { select: { nome: true, etapas: { select: { dia: true, acao: true, hormonio: true, ordem: true } } } },
    grupo: { select: { nome: true } },
    _count: {
      select: {
        aplicacoes: propriedadeId != null
          ? { where: { animal: { propriedadeId } } }
          : true,
      },
    },
  } as const;
}

function registroNoEscopo(propriedadeId: number | null) {
  return propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {};
}

export async function listarProgramacoes(propriedadeId: number | null): Promise<ProgramacaoIatfLoteDTO[]> {
  const rows = await prisma.programacaoIATFLote.findMany({
    where: registroNoEscopo(propriedadeId),
    include: includeProgramacao(propriedadeId),
    orderBy: { dataInicio: "desc" },
  });
  const hoje = hojeUTC();
  return rows.map((p) => programacaoDTO(p as ProgRow, hoje));
}

export async function detalheProgramacao(id: number, propriedadeId: number | null = null): Promise<ProgramacaoDetalheDTO> {
  const p = await prisma.programacaoIATFLote.findFirst({
    where: { id, ...registroNoEscopo(propriedadeId) },
    include: {
      ...includeProgramacao(propriedadeId),
      aplicacoes: {
        where: propriedadeId != null ? { animal: { propriedadeId } } : {},
        select: {
          id: true,
          animalId: true,
          animal: { select: { id: true, numero: true, nome: true } },
          execucoes: { select: { id: true, dia: true, ordem: true, status: true, dataPlanejada: true } },
        },
        orderBy: { animal: { numero: "asc" } },
      },
    },
  });
  if (!p) throw new IatfLoteError("NAO_ENCONTRADO", "programação não encontrada");
  const detalhe = p as unknown as ProgDetalheRow;
  const hoje = hojeUTC();
  const base = programacaoDTO({ ...detalhe, _count: { aplicacoes: detalhe.aplicacoes.length } }, hoje);
  const animais = detalhe.aplicacoes.map((a) => ({
    aplicacaoId: a.id,
    animalId: a.animal.id,
    numero: a.animal.numero,
    nome: a.animal.nome,
  }));
  const resumoExec = agregarStatusLote(detalhe.aplicacoes.map(aplicacaoExecDTO), hoje);
  return { ...base, animais, resumoExec };
}

export async function criarProgramacao(input: CriarProgramacaoInput, propriedadeId: number | null): Promise<ProgramacaoDetalheDTO> {
  const protocolo = await prisma.protocoloIATF.findFirst({
    where: { id: input.protocoloId, ...registroNoEscopo(propriedadeId) },
  });
  if (!protocolo) throw new IatfLoteError("NAO_ENCONTRADO", "protocolo não encontrado");
  if (!protocolo.ativo) throw new IatfLoteError("PROTOCOLO_INATIVO", "protocolo inativo não pode ser aplicado");
  if (input.grupoId != null) {
    const grupo = await prisma.grupo.findFirst({
      where: {
        id: input.grupoId,
        ...(propriedadeId != null ? { propriedadeId } : {}),
      },
      select: { id: true },
    });
    if (!grupo) throw new IatfLoteError("NAO_ENCONTRADO", "grupo não encontrado");
  }

  // Só animais que realmente existem entram no lote (ignora ids fantasma silenciosamente
  // filtrando; se sobrar zero, é erro do chamador).
  const ids = [...new Set(input.animalIds)];
  const existentes = await prisma.animal.findMany({
    where: {
      id: { in: ids },
      ...(propriedadeId != null ? { propriedadeId } : {}),
    },
    select: { id: true },
  });
  const validos = existentes.map((a) => a.id);
  if (validos.length === 0) throw new IatfLoteError("SEM_ANIMAIS", "nenhum animal válido para a programação");

  const dataInicioIso = input.dataInicio;
  const dataInicio = dataDb(dataInicioIso);
  // Etapas do catálogo → snapshot de execução para cada animal do lote.
  const protocoloFull = await prisma.protocoloIATF.findUniqueOrThrow({
    where: { id: input.protocoloId },
    include: { etapas: true },
  });
  const execTemplate = materializarExecucoes(protocoloFull.etapas, dataInicioIso);

  const criada = await prisma.$transaction(async (tx) => {
    const prog = await tx.programacaoIATFLote.create({
      data: {
        protocoloId: input.protocoloId,
        grupoId: input.grupoId ?? null,
        nome: input.nome ?? null,
        dataInicio,
        observacao: input.observacao ?? null,
        propriedadeId,
      },
    });
    // Fan-out: uma aplicação + execuções materializadas por animal.
    for (const animalId of validos) {
      await tx.aplicacaoProtocoloIATF.create({
        data: {
          animalId,
          protocoloId: input.protocoloId,
          dataInicio,
          programacaoId: prog.id,
          propriedadeId,
          execucoes: { create: execTemplate },
        },
      });
    }
    return prog.id;
  });
  return detalheProgramacao(criada, propriedadeId);
}

async function aplicacoesDaProgramacao(
  programacaoId: number,
  propriedadeId: number | null,
) {
  return prisma.aplicacaoProtocoloIATF.findMany({
    where: {
      programacaoId,
      ...(propriedadeId != null ? { animal: { propriedadeId } } : {}),
    },
    include: {
      protocolo: { include: { etapas: true } },
      execucoes: true,
    },
    orderBy: { animalId: "asc" },
  });
}

/** Marca a mesma etapa para os animais do lote, preservando as exceções individuais. */
export async function executarEtapaLote(
  programacaoId: number,
  input: ExecutarEtapaLoteInput,
  propriedadeId: number | null,
): Promise<{ aplicados: number; ignorados: number; resumo: ResumoLoteExec }> {
  const programacao = await prisma.programacaoIATFLote.findFirst({
    where: { id: programacaoId, ...registroNoEscopo(propriedadeId) },
    select: { id: true },
  });
  if (!programacao) throw new IatfLoteError("NAO_ENCONTRADO", "programação não encontrada");

  const rows = await aplicacoesDaProgramacao(programacaoId, propriedadeId);
  const aplicacoes = rows.map((a) => aplicacaoExecDTO(a));
  const plano = planejarExecucaoColetiva(
    aplicacoes,
    { dia: input.dia, ordem: input.ordem },
    input.status,
    input.excecoesAnimalIds ?? [],
  );
  if (!plano.length) {
    return {
      aplicados: 0,
      ignorados: aplicacoes.length,
      resumo: agregarStatusLote(aplicacoes, hojeUTC()),
    };
  }

  const porId = new Map(rows.map((a) => [a.id, a]));
  const hoje = hojeUTC();
  await prisma.$transaction(async (tx) => {
    for (const item of plano) {
      const aplicacao = porId.get(item.aplicacaoId);
      const execucao = aplicacao?.execucoes.find((e) => e.id === item.execucaoId);
      if (!aplicacao || !execucao) continue;
      await atualizarExecucaoNaTransacao(
        tx,
        { ...execucao, aplicacaoId: aplicacao.id, aplicacao } as unknown as ExecRow & { aplicacaoId: number; aplicacao: AplicacaoRow },
        input,
        hoje,
      );
    }
  });

  const atualizadas = (await aplicacoesDaProgramacao(programacaoId, propriedadeId)).map((a) => aplicacaoExecDTO(a));
  return {
    aplicados: plano.length,
    ignorados: aplicacoes.length - plano.length,
    resumo: agregarStatusLote(atualizadas, hoje),
  };
}

export async function excluirProgramacao(id: number, propriedadeId: number | null = null): Promise<void> {
  const existente = await prisma.programacaoIATFLote.findFirst({
    where: { id, ...registroNoEscopo(propriedadeId) },
    select: { id: true },
  });
  if (!existente) throw new IatfLoteError("NAO_ENCONTRADO", "programação não encontrada");
  // As aplicações-filhas caem por cascade (onDelete: Cascade em programacaoId).
  await prisma.programacaoIATFLote.delete({ where: { id } });
}
