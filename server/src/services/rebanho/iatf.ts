import { prisma } from "../../db.js";
import type { Prisma } from "@prisma/client";
import { recomputarAnimal } from "./eventos.js";
import { planejarBaixaDose, planejarDevolucaoDose } from "./semen-baixa.calc.js";
import {
  agendarEtapas, ordenarEtapas, etapasComStatus, progressoExecucao,
  type EtapaComStatus, type ExecucaoEtapa,
} from "./iatf.calc.js";
import type {
  CriarProtocoloInput, AtualizarProtocoloInput, AplicarProtocoloInput, EtapaInput, ExecutarEtapaInput,
} from "./iatf.schemas.js";

export class IatfError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "PROTOCOLO_INATIVO" | "CONFLITO", message: string) { super(message); }
}

const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);
// @db.Date gravado a partir de uma Date UTC-meia-noite para não escorregar de dia por fuso.
const dataDb = (isoDia: string) => new Date(`${isoDia}T00:00:00Z`);

export interface EtapaDTO { dia: number; acao: string; hormonio: string | null; ordem: number }
export interface ProtocoloDTO {
  id: number;
  nome: string;
  descricao: string | null;
  hormonioBase: string | null;
  finalidade: "IATF" | "TETF";
  ativo: boolean;
  etapas: EtapaDTO[];
}
export interface AplicacaoDTO {
  id: number;
  animalId: number;
  protocoloId: number;
  protocoloNome: string;
  dataInicio: string;
  observacao: string | null;
  usoCidr: boolean;
  estimulo: string | null;
  perdaImplante: boolean;
  etapas: EtapaComStatus[];
  progresso: {
    total: number;
    resolvidas: number;
    concluidas: number;
    puladas: number;
    pendentes: number;
    proxima: EtapaComStatus | null;
    concluido: boolean;
  };
}

type EtapaRow = { dia: number; acao: string; hormonio: string | null; ordem: number };
type ProtocoloRow = { id: number; nome: string; descricao: string | null; hormonioBase: string | null; finalidade: "IATF" | "TETF"; ativo: boolean; etapas: EtapaRow[] };

function protocoloDTO(p: ProtocoloRow): ProtocoloDTO {
  return {
    id: p.id, nome: p.nome, descricao: p.descricao, hormonioBase: p.hormonioBase,
    finalidade: p.finalidade, ativo: p.ativo,
    etapas: ordenarEtapas(p.etapas).map((e) => ({ dia: e.dia, acao: e.acao, hormonio: e.hormonio, ordem: e.ordem })),
  };
}

// Normaliza as etapas do input: quando `ordem` não vem, usa o índice como desempate.
function etapasCreate(etapas: EtapaInput[]) {
  return etapas.map((e, i) => ({ dia: e.dia, acao: e.acao, hormonio: e.hormonio ?? null, ordem: e.ordem ?? i }));
}

// Catálogos legados com propriedadeId null são compartilhados; registros de sítio
// só podem ser lidos ou alterados no próprio escopo.
function catalogoNoEscopo(propriedadeId: number | null) {
  return propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {};
}

function animalNoEscopo(animalId: number, propriedadeId: number | null) {
  return { id: animalId, ...(propriedadeId != null ? { propriedadeId } : {}) };
}

// ── Catálogo de protocolos ───────────────────────────────────────────────────

export async function listarProtocolos(propriedadeId: number | null, incluirInativos = false): Promise<ProtocoloDTO[]> {
  const rows = await prisma.protocoloIATF.findMany({
    where: {
      ...(incluirInativos ? {} : { ativo: true }),
      // Escopo: protocolos do sítio + os compartilhados (propriedadeId null).
      ...catalogoNoEscopo(propriedadeId),
    },
    include: { etapas: true },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
  return rows.map(protocoloDTO);
}

export async function criarProtocolo(input: CriarProtocoloInput, propriedadeId: number | null): Promise<ProtocoloDTO> {
  const p = await prisma.protocoloIATF.create({
    data: {
      nome: input.nome,
      descricao: input.descricao ?? null,
      hormonioBase: input.hormonioBase ?? null,
      finalidade: input.finalidade ?? "IATF",
      ativo: input.ativo ?? true,
      propriedadeId,
      etapas: { create: etapasCreate(input.etapas) },
    },
    include: { etapas: true },
  });
  return protocoloDTO(p);
}

export async function atualizarProtocolo(
  id: number,
  input: AtualizarProtocoloInput,
  propriedadeId: number | null = null,
): Promise<ProtocoloDTO> {
  const existente = await prisma.protocoloIATF.findFirst({
    where: { id, ...catalogoNoEscopo(propriedadeId) },
    select: { id: true },
  });
  if (!existente) throw new IatfError("NAO_ENCONTRADO", "protocolo não encontrado");
  const p = await prisma.$transaction(async (tx) => {
    await tx.protocoloIATF.update({
      where: { id },
      data: {
        ...(input.nome !== undefined ? { nome: input.nome } : {}),
        ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
        ...(input.hormonioBase !== undefined ? { hormonioBase: input.hormonioBase } : {}),
        ...(input.finalidade !== undefined ? { finalidade: input.finalidade } : {}),
        ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
      },
    });
    // Etapas são substituídas por completo quando vêm no payload (o front sempre
    // manda a lista inteira do editor). Delete-then-create dentro da transação.
    if (input.etapas !== undefined) {
      await tx.etapaProtocoloIATF.deleteMany({ where: { protocoloId: id } });
      await tx.etapaProtocoloIATF.createMany({ data: etapasCreate(input.etapas).map((e) => ({ ...e, protocoloId: id })) });
    }
    return tx.protocoloIATF.findUniqueOrThrow({ where: { id }, include: { etapas: true } });
  });
  return protocoloDTO(p);
}

export async function excluirProtocolo(id: number, propriedadeId: number | null = null): Promise<void> {
  const existente = await prisma.protocoloIATF.findFirst({
    where: { id, ...catalogoNoEscopo(propriedadeId) },
    select: { id: true },
  });
  if (!existente) throw new IatfError("NAO_ENCONTRADO", "protocolo não encontrado");
  const emUso = await prisma.aplicacaoProtocoloIATF.count({ where: { protocoloId: id } });
  if (emUso > 0) {
    // Preserva a história: protocolo já aplicado só é inativado, não apagado.
    await prisma.protocoloIATF.update({ where: { id }, data: { ativo: false } });
    return;
  }
  await prisma.protocoloIATF.delete({ where: { id } });
}

// ── Aplicação a um animal ────────────────────────────────────────────────────

export type ExecRow = {
  id: number; dia: number; acao: string; hormonio: string | null; ordem: number;
  dataPlanejada: Date; status: "PENDENTE" | "CONCLUIDA" | "PULADA";
  dataExecucao: Date | null; produto: string | null; dose: string | null; observacao: string | null;
};
export type AplicacaoRow = {
  id: number; animalId: number; protocoloId: number; dataInicio: Date; observacao: string | null;
  usoCidr: boolean; estimulo: string | null; perdaImplante: boolean; propriedadeId: number | null;
  protocolo: ProtocoloRow;
  execucoes: ExecRow[];
};

const INCLUDE_APLICACAO = {
  protocolo: { include: { etapas: true } },
  execucoes: true,
} as const;

function toExecucao(e: ExecRow): ExecucaoEtapa {
  return {
    id: e.id, dia: e.dia, acao: e.acao, hormonio: e.hormonio, ordem: e.ordem,
    dataPlanejada: iso(e.dataPlanejada)!, status: e.status, dataExecucao: iso(e.dataExecucao),
    produto: e.produto, dose: e.dose, observacao: e.observacao,
  };
}

function aplicacaoDTO(a: AplicacaoRow, hoje = new Date().toISOString().slice(0, 10)): AplicacaoDTO {
  const dataInicio = iso(a.dataInicio)!;
  // Prefer materializadas; se vazias (legado), deriva da agenda do catálogo.
  const etapasTpl = a.protocolo.etapas;
  const execs = a.execucoes.map(toExecucao);
  const etapas = etapasComStatus(etapasTpl, dataInicio, execs, hoje);
  return {
    id: a.id, animalId: a.animalId, protocoloId: a.protocoloId, protocoloNome: a.protocolo.nome,
    dataInicio, observacao: a.observacao,
    usoCidr: a.usoCidr, estimulo: a.estimulo, perdaImplante: a.perdaImplante,
    etapas, progresso: progressoExecucao(etapas),
  };
}

/** Snapshot das etapas do catálogo → linhas de execução PENDENTE na data planejada. */
export function materializarExecucoes(
  etapas: { dia: number; acao: string; hormonio: string | null; ordem: number }[],
  dataInicio: string,
) {
  return agendarEtapas(etapas, dataInicio).map((e) => ({
    dia: e.dia, acao: e.acao, hormonio: e.hormonio, ordem: e.ordem,
    dataPlanejada: dataDb(e.data), status: "PENDENTE" as const,
  }));
}

export async function aplicarProtocolo(animalId: number, input: AplicarProtocoloInput, propriedadeId: number | null): Promise<AplicacaoDTO> {
  const animal = await prisma.animal.findFirst({
    where: animalNoEscopo(animalId, propriedadeId),
    select: { id: true },
  });
  if (!animal) throw new IatfError("NAO_ENCONTRADO", "animal não encontrado");
  const protocolo = await prisma.protocoloIATF.findFirst({
    where: { id: input.protocoloId, ...catalogoNoEscopo(propriedadeId) },
    include: { etapas: true },
  });
  if (!protocolo) throw new IatfError("NAO_ENCONTRADO", "protocolo não encontrado");
  if (!protocolo.ativo) throw new IatfError("PROTOCOLO_INATIVO", "protocolo inativo não pode ser aplicado");

  const execs = materializarExecucoes(protocolo.etapas, input.dataInicio);
  const a = await prisma.aplicacaoProtocoloIATF.create({
    data: {
      animalId, protocoloId: input.protocoloId,
      dataInicio: dataDb(input.dataInicio),
      observacao: input.observacao ?? null,
      usoCidr: input.usoCidr ?? false,
      estimulo: input.estimulo ?? null,
      perdaImplante: input.perdaImplante ?? false,
      propriedadeId,
      execucoes: { create: execs },
    },
    include: INCLUDE_APLICACAO,
  });
  return aplicacaoDTO(a as unknown as AplicacaoRow);
}

export async function listarAplicacoes(animalId: number, propriedadeId: number | null = null): Promise<AplicacaoDTO[]> {
  const animal = await prisma.animal.findFirst({
    where: animalNoEscopo(animalId, propriedadeId),
    select: { id: true },
  });
  if (!animal) throw new IatfError("NAO_ENCONTRADO", "animal não encontrado");
  const rows = await prisma.aplicacaoProtocoloIATF.findMany({
    where: { animalId },
    include: INCLUDE_APLICACAO,
    orderBy: { dataInicio: "desc" },
  });
  const hoje = new Date().toISOString().slice(0, 10);
  return rows.map((r) => aplicacaoDTO(r as unknown as AplicacaoRow, hoje));
}

export async function excluirAplicacao(id: number, propriedadeId: number | null = null): Promise<void> {
  const existente = await prisma.aplicacaoProtocoloIATF.findFirst({
    where: {
      id,
      ...(propriedadeId != null ? { animal: { propriedadeId } } : {}),
    },
    select: { id: true },
  });
  if (!existente) throw new IatfError("NAO_ENCONTRADO", "aplicação não encontrada");
  await prisma.aplicacaoProtocoloIATF.delete({ where: { id } }); // cascade execuções
}

/** Atualiza a execução e mantém o evento terminal IA/TE idempotente na mesma transação. */
export async function atualizarExecucaoNaTransacao(
  tx: Prisma.TransactionClient,
  ex: ExecRow & { aplicacaoId: number; aplicacao: AplicacaoRow },
  input: ExecutarEtapaInput,
  hoje: string,
): Promise<{ eventoTerminalAtualizado: boolean; aviso?: string }> {
  const dataExecucao = input.status === "PENDENTE"
    ? null
    : dataDb(input.dataExecucao ?? hoje);
  await tx.execucaoEtapaIATF.update({
    where: { id: ex.id },
    data: {
      status: input.status,
      dataExecucao,
      ...(input.produto !== undefined ? { produto: input.produto } : {}),
      ...(input.dose !== undefined ? { dose: input.dose } : {}),
      ...(input.observacao !== undefined ? { observacao: input.observacao } : {}),
    },
  });

  const diaTerminal = Math.max(...ex.aplicacao.protocolo.etapas.map((etapa) => etapa.dia));
  if (ex.dia !== diaTerminal) return { eventoTerminalAtualizado: false };

  const propriedadeId = ex.aplicacao.propriedadeId;
  // Estoque decidido a partir do evento terminal já vinculado (idempotência do upsert por
  // origemExecucaoId): só consumimos quando a etapa passa a CONCLUIDA e ainda não há baixa
  // para o mesmo lote; trocar de lote devolve a dose antiga e consome a nova; reabrir/pular
  // devolve a dose uma vez e desvincula o evento. Reconcluir o mesmo lote não decrementa de novo.
  // O fallback existe apenas para testes/consumidores legados com uma superfície Prisma mínima.
  const eventoTerminal = typeof tx.eventoReprodutivo.findFirst === "function"
    ? await tx.eventoReprodutivo.findFirst({
      where: { origemExecucaoId: ex.id },
      select: { estoqueSemenId: true, estoqueSemenDoseBaixada: true },
    })
    : null;

  // Escopo: leitura/decremento condicionados ao sítio da aplicação (cobre individual e lote).
  const escopoPropriedade = propriedadeId != null ? { propriedadeId } : {};
  let aviso: string | null = null;

  async function devolverDose(loteId: number): Promise<void> {
    const estoque = await tx.estoqueSemen.findFirst({
      where: { id: loteId, ...escopoPropriedade },
      select: { id: true, dosesDisponiveis: true },
    });
    if (!estoque) return; // lote removido/fora de escopo: nada a devolver
    const plano = planejarDevolucaoDose({ doseBaixada: true, dosesDisponiveis: estoque.dosesDisponiveis });
    if (plano.devolver) {
      await tx.estoqueSemen.update({ where: { id: loteId }, data: { dosesDisponiveis: { increment: 1 } } });
    }
  }

  if (input.status !== "CONCLUIDA") {
    // Reabrir/pular: devolve a dose que este evento consumiu (uma vez) antes de removê-lo.
    if (eventoTerminal?.estoqueSemenId != null && eventoTerminal.estoqueSemenDoseBaixada) {
      await devolverDose(eventoTerminal.estoqueSemenId);
    }
    await tx.eventoReprodutivo.deleteMany({ where: { origemExecucaoId: ex.id } });
  } else {
    const tipo = ex.aplicacao.protocolo.finalidade === "TETF"
      ? "TRANSFERENCIA_EMBRIAO"
      : "INSEMINACAO";
    const produto = input.produto === undefined ? ex.produto : input.produto;
    const data = dataExecucao ?? ex.dataPlanejada;
    const loteAnterior = eventoTerminal?.estoqueSemenId ?? null;
    const doseAnteriorBaixada = eventoTerminal?.estoqueSemenDoseBaixada ?? false;
    // A execução terminal individual pode informar estoqueSemenId. O schema do lote não
    // expõe esse campo: em lote, não há seleção/consumo de lote novo — só preservação e
    // reconciliação idempotente de eventual vínculo terminal já existente. TETF sempre ignora lote.
    const loteInput = tipo === "INSEMINACAO"
      ? (input.estoqueSemenId === undefined ? loteAnterior : input.estoqueSemenId)
      : null;

    // O lote persistido no evento é a fonte da verdade da baixa; só decrementa quando muda
    // de lote (ou é o primeiro consumo). Reconcluir o mesmo lote preserva a baixa existente.
    let estoqueSemenDoseBaixada = loteInput != null && loteInput === loteAnterior && doseAnteriorBaixada;
    if (loteInput != null && !(loteInput === loteAnterior && doseAnteriorBaixada)) {
      const estoque = await tx.estoqueSemen.findFirst({
        where: { id: loteInput, ...escopoPropriedade },
        select: { id: true, dosesDisponiveis: true },
      });
      if (!estoque) throw new IatfError("NAO_ENCONTRADO", "lote de sêmen não encontrado");
      // Trocou de lote e o anterior tinha baixa: devolve a dose antiga antes de consumir a nova.
      if (loteAnterior != null && loteAnterior !== loteInput && doseAnteriorBaixada) {
        await devolverDose(loteAnterior);
      }
      const plano = planejarBaixaDose({ estoqueSemenId: loteInput, dosesDisponiveis: estoque.dosesDisponiveis });
      aviso = plano.aviso;
      if (plano.consumir) {
        const baixa = await tx.estoqueSemen.updateMany({
          where: { id: loteInput, ...escopoPropriedade, dosesDisponiveis: { gte: 1 } },
          data: { dosesDisponiveis: { decrement: 1 } },
        });
        estoqueSemenDoseBaixada = baixa.count === 1;
        if (!estoqueSemenDoseBaixada) {
          aviso = planejarBaixaDose({ estoqueSemenId: loteInput, dosesDisponiveis: 0 }).aviso;
        }
      }
    }

    await tx.eventoReprodutivo.upsert({
      where: { origemExecucaoId: ex.id },
      create: {
        animalId: ex.aplicacao.animalId,
        tipo,
        data,
        protocolo: ex.aplicacao.protocolo.nome,
        reprodutor: produto ?? (tipo === "INSEMINACAO" ? "IATF" : null),
        origemExecucaoId: ex.id,
        estoqueSemenId: loteInput,
        estoqueSemenDoseBaixada,
      },
      update: {
        data,
        protocolo: ex.aplicacao.protocolo.nome,
        ...(produto !== undefined ? { reprodutor: produto } : {}),
        estoqueSemenId: loteInput,
        estoqueSemenDoseBaixada,
      },
    });
  }
  await recomputarAnimal(tx, ex.aplicacao.animalId, {
    tipo: input.status === "CONCLUIDA" ? "CRIACAO" : "EXCLUSAO",
    evento: {
      tipo: ex.aplicacao.protocolo.finalidade === "TETF" ? "TRANSFERENCIA_EMBRIAO" : "INSEMINACAO",
      data: iso(dataExecucao ?? ex.dataPlanejada)!,
    },
  });
  return aviso
    ? { eventoTerminalAtualizado: true, aviso }
    : { eventoTerminalAtualizado: true };
}

/** Marca uma etapa materializada como CONCLUIDA / PULADA / PENDENTE. */
export async function executarEtapa(
  execucaoId: number,
  input: ExecutarEtapaInput,
  propriedadeId: number | null = null,
): Promise<AplicacaoDTO & { aviso?: string }> {
  const ex = await prisma.execucaoEtapaIATF.findFirst({
    where: {
      id: execucaoId,
      ...(propriedadeId != null ? { aplicacao: { animal: { propriedadeId } } } : {}),
    },
    include: { aplicacao: { include: INCLUDE_APLICACAO } },
  });
  if (!ex) throw new IatfError("NAO_ENCONTRADO", "execução de etapa não encontrada");

  const resultado = await prisma.$transaction((tx) => atualizarExecucaoNaTransacao(
    tx,
    ex as unknown as ExecRow & { aplicacaoId: number; aplicacao: AplicacaoRow },
    input,
    new Date().toISOString().slice(0, 10),
  ));

  const a = await prisma.aplicacaoProtocoloIATF.findUniqueOrThrow({
    where: { id: ex.aplicacaoId },
    include: INCLUDE_APLICACAO,
  });
  const dto = aplicacaoDTO(a as unknown as AplicacaoRow);
  return resultado.aviso ? { ...dto, aviso: resultado.aviso } : dto;
}
