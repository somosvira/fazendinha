import { prisma } from "../../db.js";
import { toSafraDTO, toTarefaDTO, toApontamentoDTO } from "./planejamento.mappers.js";
import type {
  CriarSafraInput, EditarSafraInput,
  CriarTarefaInput, EditarTarefaInput,
  CriarApontamentoInput,
} from "./planejamento.schemas.js";

export class PlanejamentoError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "REF_INVALIDA" | "NOME_DUPLICADO", message: string) {
    super(message);
  }
}

// Safra precisa das tarefas + apontamentos incluídos para o resumo agregado.
const safraInclude = {
  centroCusto: { select: { nome: true } },
  tarefas: true,
  apontamentos: true,
} as const;

const tarefaInclude = {
  talhao: { select: { codigo: true } },
  lavoura: { select: { nome: true } },
} as const;

const apontamentoInclude = {
  talhao: { select: { codigo: true } },
} as const;

const d = (s?: string | null) => (s ? new Date(s) : undefined);

// ── Safras ────────────────────────────────────────────────────────────────
export async function listarSafras() {
  const rows = await prisma.safra.findMany({ include: safraInclude, orderBy: { dataInicio: "desc" } });
  return rows.map(toSafraDTO);
}

async function assertCentroCusto(centroCustoId?: number) {
  if (centroCustoId && !(await prisma.centroCusto.findUnique({ where: { id: centroCustoId } })))
    throw new PlanejamentoError("REF_INVALIDA", "centro de custo inexistente");
}

export async function criarSafra(input: CriarSafraInput) {
  if (await prisma.safra.findUnique({ where: { nome: input.nome } }))
    throw new PlanejamentoError("NOME_DUPLICADO", `safra ${input.nome} já existe`);
  await assertCentroCusto(input.centroCustoId);
  const row = await prisma.safra.create({
    data: {
      nome: input.nome,
      dataInicio: new Date(input.dataInicio),
      dataFim: new Date(input.dataFim),
      centroCustoId: input.centroCustoId,
    },
    include: safraInclude,
  });
  return toSafraDTO(row);
}

export async function editarSafra(id: number, input: EditarSafraInput) {
  const existing = await prisma.safra.findUnique({ where: { id } });
  if (!existing) throw new PlanejamentoError("NAO_ENCONTRADO", "safra não encontrada");
  if (input.nome && input.nome !== existing.nome && (await prisma.safra.findUnique({ where: { nome: input.nome } })))
    throw new PlanejamentoError("NOME_DUPLICADO", `safra ${input.nome} já existe`);
  await assertCentroCusto(input.centroCustoId);
  const row = await prisma.safra.update({
    where: { id },
    data: {
      nome: input.nome,
      dataInicio: d(input.dataInicio),
      dataFim: d(input.dataFim),
      centroCustoId: input.centroCustoId,
      fechada: input.fechada,
    },
    include: safraInclude,
  });
  return toSafraDTO(row);
}

// ── Tarefas ────────────────────────────────────────────────────────────────
export async function listarTarefas(safraId?: number) {
  const where = safraId ? { safraId } : {};
  const rows = await prisma.tarefaAgricola.findMany({ where, include: tarefaInclude, orderBy: [{ dataPrevista: "asc" }, { id: "asc" }] });
  return rows.map(toTarefaDTO);
}

async function assertTarefaRefs(input: { safraId?: number | null; talhaoId?: number | null; lavouraId?: number | null }) {
  if (input.safraId != null && !(await prisma.safra.findUnique({ where: { id: input.safraId } })))
    throw new PlanejamentoError("REF_INVALIDA", "safra inexistente");
  if (input.talhaoId && !(await prisma.talhao.findUnique({ where: { id: input.talhaoId } })))
    throw new PlanejamentoError("REF_INVALIDA", "talhão inexistente");
  if (input.lavouraId && !(await prisma.lavoura.findUnique({ where: { id: input.lavouraId } })))
    throw new PlanejamentoError("REF_INVALIDA", "lavoura inexistente");
}

export async function criarTarefa(input: CriarTarefaInput) {
  await assertTarefaRefs(input);
  const row = await prisma.tarefaAgricola.create({
    data: {
      safraId: input.safraId,
      talhaoId: input.talhaoId,
      lavouraId: input.lavouraId,
      tipo: input.tipo,
      descricao: input.descricao,
      responsavel: input.responsavel,
      produto: input.produto,
      unidade: input.unidade,
      qtdHaPrev: input.qtdHaPrev,
      qtdTotalPrev: input.qtdTotalPrev,
      dataPrevista: d(input.dataPrevista),
      custoPrev: input.custoPrev,
      // status não é nullable no banco (default PLANEJADA) — null vira undefined.
      status: input.status ?? undefined,
    },
    include: tarefaInclude,
  });
  return toTarefaDTO(row);
}

export async function editarTarefa(id: number, input: EditarTarefaInput) {
  if (!(await prisma.tarefaAgricola.findUnique({ where: { id } })))
    throw new PlanejamentoError("NAO_ENCONTRADO", "tarefa não encontrada");
  await assertTarefaRefs(input);
  const row = await prisma.tarefaAgricola.update({
    where: { id },
    data: {
      safraId: input.safraId,
      talhaoId: input.talhaoId,
      lavouraId: input.lavouraId,
      tipo: input.tipo,
      descricao: input.descricao,
      responsavel: input.responsavel,
      produto: input.produto,
      unidade: input.unidade,
      qtdHaPrev: input.qtdHaPrev,
      qtdTotalPrev: input.qtdTotalPrev,
      dataPrevista: d(input.dataPrevista),
      custoPrev: input.custoPrev,
      qtdHaReal: input.qtdHaReal,
      qtdTotalReal: input.qtdTotalReal,
      dataRealizada: d(input.dataRealizada),
      custoReal: input.custoReal,
      // status não é nullable no banco (default PLANEJADA) — null vira undefined.
      status: input.status ?? undefined,
      observacao: input.observacao,
    },
    include: tarefaInclude,
  });
  return toTarefaDTO(row);
}

export async function excluirTarefa(id: number) {
  if (!(await prisma.tarefaAgricola.findUnique({ where: { id } })))
    throw new PlanejamentoError("NAO_ENCONTRADO", "tarefa não encontrada");
  await prisma.tarefaAgricola.delete({ where: { id } });
}

// ── Apontamentos ─────────────────────────────────────────────────────────────
export async function listarApontamentos(safraId?: number) {
  const where = safraId ? { safraId } : {};
  const rows = await prisma.apontamentoMaquina.findMany({ where, include: apontamentoInclude, orderBy: [{ data: "desc" }, { id: "desc" }] });
  return rows.map(toApontamentoDTO);
}

async function assertApontamentoRefs(input: { safraId?: number | null; talhaoId?: number | null }) {
  if (input.safraId && !(await prisma.safra.findUnique({ where: { id: input.safraId } })))
    throw new PlanejamentoError("REF_INVALIDA", "safra inexistente");
  if (input.talhaoId && !(await prisma.talhao.findUnique({ where: { id: input.talhaoId } })))
    throw new PlanejamentoError("REF_INVALIDA", "talhão inexistente");
}

export async function criarApontamento(input: CriarApontamentoInput) {
  await assertApontamentoRefs(input);
  // Se valorTotal não vier mas valorHora vier, deriva valorTotal = horas * valorHora.
  const valorTotal =
    input.valorTotal != null ? input.valorTotal : input.valorHora != null ? input.horas * input.valorHora : undefined;
  const row = await prisma.apontamentoMaquina.create({
    data: {
      safraId: input.safraId,
      talhaoId: input.talhaoId,
      data: new Date(input.data),
      tipo: input.tipo,
      recurso: input.recurso,
      operador: input.operador,
      implemento: input.implemento,
      horas: input.horas,
      valorHora: input.valorHora,
      valorTotal,
      observacao: input.observacao,
    },
    include: apontamentoInclude,
  });
  return toApontamentoDTO(row);
}

export async function excluirApontamento(id: number) {
  if (!(await prisma.apontamentoMaquina.findUnique({ where: { id } })))
    throw new PlanejamentoError("NAO_ENCONTRADO", "apontamento não encontrado");
  await prisma.apontamentoMaquina.delete({ where: { id } });
}
