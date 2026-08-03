import { Prisma, type StatusFolhaCampo } from "@prisma/client";
import { prisma } from "../../db.js";
import { mapearRespostasParaEvento, validarCamposDoTemplate } from "./formularios.campos.js";
import { registrarEventoNaTransacao } from "./eventos.js";
import {
  configFormularioSchema,
  type AtualizarLinhasFolhaInput,
  type ConfigFormulario,
  type CriarFolhaCampoInput,
} from "./formularios.schemas.js";
import { gerarRelatorio, type LinhaRelatorioDTO, type ResultadoRelatorioDTO } from "./relatorios.js";
import type { IdTemplateRelatorio } from "./relatorios.catalogo.js";

export class FormularioFolhaError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "CONFLITO", message: string) {
    super(message);
  }
}

interface SnapshotLinha {
  numero: string;
  nome: string | null;
  categoria: string;
  grupo: string | null;
  setor: string | null;
  data: string | null;
  valores: Record<string, string | number | null>;
}

export interface LinhaFolhaCampoDTO {
  id: number;
  ordem: number;
  animalId: number;
  eventoOrigemId: number | null;
  snapshot: SnapshotLinha;
  status: "PENDENTE" | "PREENCHIDA" | "NAO_REALIZADO" | "REGISTRADA";
  respostas: Record<string, unknown> | null;
  motivoNaoRealizado: string | null;
  eventoGeradoId: number | null;
}

export interface FolhaCampoDTO {
  id: number;
  nome: string;
  templateId: IdTemplateRelatorio;
  status: "RASCUNHO" | "EM_CAMPO" | "AGUARDANDO_LANCAMENTO" | "CONCLUIDA" | "CANCELADA";
  filtros: Record<string, unknown>;
  config: ConfigFormulario;
  modeloId: number | null;
  totalLinhas: number;
  linhasProntas: number;
  propriedadeId: number | null;
  geradoEm: string;
  concluidoEm: string | null;
  linhas: LinhaFolhaCampoDTO[];
}

const includeLinhas = { linhas: { orderBy: { ordem: "asc" as const } } };

function escopo(propriedadeId: number | null) {
  return propriedadeId != null ? { propriedadeId } : {};
}

function parseObjeto(valor: unknown, erro: string): Record<string, unknown> {
  if (valor == null || typeof valor !== "object" || Array.isArray(valor)) throw new Error(erro);
  return valor as Record<string, unknown>;
}

function mapearFolha(row: any): FolhaCampoDTO {
  const config = configFormularioSchema.safeParse(row.configSnapshot);
  if (!config.success) throw new Error("configuração da folha inválida");
  return {
    id: row.id,
    nome: row.nome,
    templateId: row.templateId as IdTemplateRelatorio,
    status: row.status,
    filtros: parseObjeto(row.filtrosSnapshot, "filtros da folha inválidos"),
    config: config.data,
    modeloId: row.modeloId,
    totalLinhas: row.totalLinhas,
    linhasProntas: row.linhasProntas,
    propriedadeId: row.propriedadeId,
    geradoEm: row.geradoEm.toISOString(),
    concluidoEm: row.concluidoEm?.toISOString() ?? null,
    linhas: (row.linhas ?? []).map((linha: any) => ({
      id: linha.id,
      ordem: linha.ordem,
      animalId: linha.animalId,
      eventoOrigemId: linha.eventoOrigemId,
      snapshot: parseObjeto(linha.snapshot, "snapshot de linha inválido") as unknown as SnapshotLinha,
      status: linha.status,
      respostas: linha.respostas ? parseObjeto(linha.respostas, "respostas de linha inválidas") : null,
      motivoNaoRealizado: linha.motivoNaoRealizado,
      eventoGeradoId: linha.eventoGeradoId,
    })),
  };
}

function snapshot(linha: LinhaRelatorioDTO, relatorio: ResultadoRelatorioDTO): SnapshotLinha {
  return {
    numero: linha.numero,
    nome: linha.nome,
    categoria: linha.categoria,
    grupo: linha.grupo,
    setor: linha.setor,
    data: linha.data,
    valores: Object.fromEntries(relatorio.colunas.map((coluna, indice) => [coluna.chave, linha.celulas[indice] ?? null])),
  };
}

async function exigirFolha(id: number, propriedadeId: number | null, include = false): Promise<any> {
  const folha = await prisma.folhaCampo.findFirst({
    where: { id, ...escopo(propriedadeId) },
    ...(include ? { include: includeLinhas } : {}),
  });
  if (!folha) throw new FormularioFolhaError("NAO_ENCONTRADO", "folha de campo não encontrada");
  return folha;
}

export async function criarFolhaCampo(input: CriarFolhaCampoInput, propriedadeId: number | null): Promise<FolhaCampoDTO> {
  try {
    validarCamposDoTemplate(input.filtros.templateId, input.config.camposPapel);
  } catch (error) {
    throw new FormularioFolhaError("CONFLITO", error instanceof Error ? error.message : "configuração de formulário inválida");
  }
  if (input.modeloId != null) {
    const modelo = await prisma.modeloFormularioCampo.findFirst({ where: { id: input.modeloId, ...escopo(propriedadeId) } });
    if (!modelo) throw new FormularioFolhaError("NAO_ENCONTRADO", "modelo de formulário não encontrado");
  }
  const relatorio = await gerarRelatorio(input.filtros, propriedadeId);
  if (relatorio.truncado) throw new FormularioFolhaError("CONFLITO", "refine os filtros antes de criar a folha; o relatório está truncado");
  if (relatorio.linhas.length === 0) throw new FormularioFolhaError("CONFLITO", "o relatório não possui linhas para criar a folha");

  const criada = await prisma.folhaCampo.create({
    data: {
      nome: input.nome,
      templateId: input.filtros.templateId,
      filtrosSnapshot: input.filtros as Prisma.InputJsonValue,
      configSnapshot: input.config as Prisma.InputJsonValue,
      modeloId: input.modeloId ?? null,
      totalLinhas: relatorio.linhas.length,
      propriedadeId,
      linhas: {
        create: relatorio.linhas.map((linha, ordem) => ({
          ordem,
          animalId: linha.animalId,
          eventoOrigemId: linha.eventoId,
          snapshot: snapshot(linha, relatorio) as unknown as Prisma.InputJsonValue,
        })),
      },
    },
  });
  return obterFolhaCampo(criada.id, propriedadeId);
}

export async function listarFolhasCampo(propriedadeId: number | null, status?: StatusFolhaCampo): Promise<FolhaCampoDTO[]> {
  const rows = await prisma.folhaCampo.findMany({
    where: { ...escopo(propriedadeId), ...(status ? { status } : {}) },
    include: includeLinhas,
    orderBy: [{ geradoEm: "desc" }, { id: "desc" }],
  });
  return rows.map(mapearFolha);
}

export async function obterFolhaCampo(id: number, propriedadeId: number | null): Promise<FolhaCampoDTO> {
  return mapearFolha(await exigirFolha(id, propriedadeId, true));
}

export async function salvarLinhasFolha(id: number, input: AtualizarLinhasFolhaInput, propriedadeId: number | null): Promise<FolhaCampoDTO> {
  const folha = await exigirFolha(id, propriedadeId);
  if (folha.status === "CONCLUIDA" || folha.status === "CANCELADA") {
    throw new FormularioFolhaError("CONFLITO", "folha concluída ou cancelada não pode ser alterada");
  }
  const ids = input.linhas.map((linha) => linha.id);
  const existentes = await prisma.linhaFolhaCampo.findMany({ where: { folhaId: id, id: { in: ids } }, select: { id: true } });
  if (existentes.length !== new Set(ids).size) throw new FormularioFolhaError("NAO_ENCONTRADO", "uma ou mais linhas não pertencem à folha");

  await prisma.$transaction(async (tx) => {
    for (const linha of input.linhas) {
      await tx.linhaFolhaCampo.update({
        where: { id: linha.id },
        data: linha.status === "PREENCHIDA"
          ? { status: linha.status, respostas: linha.respostas as Prisma.InputJsonValue, motivoNaoRealizado: null }
          : linha.status === "NAO_REALIZADO"
            ? { status: linha.status, respostas: Prisma.DbNull, motivoNaoRealizado: linha.motivoNaoRealizado }
            : { status: linha.status, respostas: linha.respostas ? linha.respostas as Prisma.InputJsonValue : Prisma.DbNull, motivoNaoRealizado: null },
      });
    }
    const todas = await tx.linhaFolhaCampo.findMany({ where: { folhaId: id }, select: { status: true } });
    const prontas = todas.filter((linha) => linha.status !== "PENDENTE").length;
    await tx.folhaCampo.update({
      where: { id },
      data: { linhasProntas: prontas, status: prontas > 0 ? "AGUARDANDO_LANCAMENTO" : "EM_CAMPO" },
    });
  });
  return obterFolhaCampo(id, propriedadeId);
}

export async function concluirFolhaCampo(id: number, propriedadeId: number | null): Promise<FolhaCampoDTO> {
  const atual = await exigirFolha(id, propriedadeId, true);
  if (atual.status === "CONCLUIDA") return mapearFolha(atual);
  if (atual.status === "CANCELADA") throw new FormularioFolhaError("CONFLITO", "folha cancelada não pode ser concluída");
  const folha = mapearFolha(atual);
  validarRespostasDaFolha(folha);

  await prisma.$transaction(async (tx) => {
    for (const linha of folha.linhas) {
      if (linha.status !== "PREENCHIDA" || linha.eventoGeradoId != null) continue;
      const payload = mapearRespostasParaEvento(folha.templateId, linha.respostas ?? {});
      const evento = await registrarEventoNaTransacao(tx, linha.animalId, payload, propriedadeId);
      await tx.linhaFolhaCampo.update({
        where: { id: linha.id },
        data: { status: "REGISTRADA", eventoGeradoId: Number(evento.id) },
      });
    }
    await tx.folhaCampo.update({
      where: { id },
      data: { status: "CONCLUIDA", concluidoEm: new Date(), linhasProntas: folha.totalLinhas },
    });
  }, { timeout: 120_000 });
  return obterFolhaCampo(id, propriedadeId);
}

export async function cancelarFolhaCampo(id: number, propriedadeId: number | null): Promise<FolhaCampoDTO> {
  const folha = await exigirFolha(id, propriedadeId);
  if (folha.status === "CONCLUIDA") throw new FormularioFolhaError("CONFLITO", "folha concluída não pode ser cancelada");
  await prisma.folhaCampo.update({ where: { id }, data: { status: "CANCELADA" } });
  return obterFolhaCampo(id, propriedadeId);
}

export function validarRespostasDaFolha(folha: Pick<FolhaCampoDTO, "templateId" | "linhas">): void {
  for (const linha of folha.linhas) {
    if (linha.status === "PENDENTE") throw new FormularioFolhaError("CONFLITO", "resolva todas as linhas pendentes antes de concluir");
    if (linha.status === "PREENCHIDA") mapearRespostasParaEvento(folha.templateId, linha.respostas ?? {});
  }
}
