import { prisma } from "../../db.js";
import { toSiloDTO, toMovimentoSiloDTO } from "./mappers.js";
import { recomputarSaldoSilo } from "./silo.js";
import type { CriarSiloInput, EditarSiloInput, ListSiloFiltros, CriarMovimentoSiloInput } from "./schemas.js";

export class SiloError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "MOVIMENTO_INVALIDO", message: string) {
    super(message);
  }
}

export async function listarSilos(f: ListSiloFiltros, propriedadeId?: number | null) {
  const where: any = {};
  if (f.tipo) where.tipo = f.tipo;
  if (f.ativo !== undefined) where.ativo = f.ativo;
  if (propriedadeId != null) where.propriedadeId = propriedadeId; // escopo do sítio
  const rows = await prisma.silo.findMany({ where, orderBy: { nome: "asc" } });
  return rows.map(toSiloDTO);
}

export async function obterSilo(id: number) {
  const row = await prisma.silo.findUnique({ where: { id } });
  return row ? toSiloDTO(row) : null;
}

async function assertExiste(id: number) {
  const existing = await prisma.silo.findUnique({ where: { id } });
  if (!existing) throw new SiloError("NAO_ENCONTRADO", "silo não encontrado");
  return existing;
}

export async function criarSilo(input: CriarSiloInput, propriedadeId?: number | null) {
  const row = await prisma.silo.create({
    data: {
      propriedadeId: propriedadeId ?? null, // sítio ativo (multi-propriedade)
      nome: input.nome,
      tipo: input.tipo,
      capacidade: input.capacidade ?? undefined,
      unidade: input.unidade,
      ativo: input.ativo,
    },
  });
  return toSiloDTO(row);
}

export async function editarSilo(id: number, input: EditarSiloInput) {
  await assertExiste(id);
  const row = await prisma.silo.update({
    where: { id },
    data: { nome: input.nome, tipo: input.tipo, capacidade: input.capacidade, unidade: input.unidade, ativo: input.ativo },
  });
  return toSiloDTO(row);
}

export async function excluirSilo(id: number) {
  await assertExiste(id);
  await prisma.silo.delete({ where: { id } });
}

// ── Movimentos manuais (SAIDA: NUTRICAO/VENDA/AJUSTE; AJUSTE também serve p/
// correções de ENTRADA). ENTRADA/COLHEITA é criada automaticamente pela
// produção com destino=SILO — não passa por aqui.
export async function listarMovimentosSilo(siloId: number) {
  await assertExiste(siloId);
  const rows = await prisma.movimentoSilo.findMany({ where: { siloId }, orderBy: [{ data: "desc" }, { id: "desc" }] });
  return rows.map(toMovimentoSiloDTO);
}

export async function criarMovimentoSilo(siloId: number, input: CriarMovimentoSiloInput) {
  await assertExiste(siloId);
  if (input.tipo === "ENTRADA" && input.origem === "COLHEITA") {
    throw new SiloError("MOVIMENTO_INVALIDO", "movimento ENTRADA/COLHEITA é gerado automaticamente pela produção — não pode ser lançado manualmente");
  }
  const row = await prisma.movimentoSilo.create({
    data: {
      siloId,
      data: new Date(input.data),
      tipo: input.tipo,
      quantidade: input.quantidade,
      origem: input.origem,
      observacao: input.observacao ?? undefined,
    },
  });
  await recomputarSaldoSilo(siloId);
  return toMovimentoSiloDTO(row);
}

export async function excluirMovimentoSilo(siloId: number, movimentoId: number) {
  const mov = await prisma.movimentoSilo.findUnique({ where: { id: movimentoId } });
  if (!mov || mov.siloId !== siloId) throw new SiloError("NAO_ENCONTRADO", "movimento não encontrado");
  if (mov.origem === "COLHEITA") {
    throw new SiloError("MOVIMENTO_INVALIDO", "movimento gerado pela colheita — exclua/edite a produção de origem");
  }
  await prisma.movimentoSilo.delete({ where: { id: movimentoId } });
  await recomputarSaldoSilo(siloId);
}
