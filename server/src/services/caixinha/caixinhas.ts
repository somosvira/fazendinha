// CRUD de Caixinha + razão de movimentos. Espelha cultivo/silos.ts (mesmo
// shape razão + saldo pré-computado). Fechamento mensal: criar/excluir
// movimento cuja data caia num mês fechado é rejeitado via assertMesAberto
// (services/fechamento.ts — mesma regra do Lancamento); a rota mapeia
// FechamentoMensalError → 409.

import { prisma } from "../../db.js";
import { assertMesAberto } from "../fechamento.js";
import { calcularSaldoCaixinha, recomputarSaldoCaixinha } from "./saldo.js";
import { Prisma } from "@prisma/client";
import type {
  CriarCaixinhaInput,
  EditarCaixinhaInput,
  CriarMovimentoCaixinhaInput,
  ListMovimentoCaixinhaFiltros,
} from "./schemas.js";

export class CaixinhaError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) {
    super(message);
  }
}

// ── Mappers (Decimal→number e Date→ISO só na borda do DTO) ───────────────
const iso = (d: Date | string): string =>
  typeof d === "string" ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);

function toCaixinhaDTO(c: any) {
  return {
    id: c.id,
    nome: c.nome,
    responsavel: c.responsavel ?? null,
    saldoAtual: Number(c.saldoAtual),
    ativo: !!c.ativo,
  };
}

function toMovimentoCaixinhaDTO(m: any) {
  return {
    id: m.id,
    caixinhaId: m.caixinhaId,
    data: iso(m.data),
    tipo: m.tipo as "ENTRADA" | "SAIDA",
    categoria: m.categoria ?? null, // só em SAIDA; ENTRADA vem null
    valor: Number(m.valor),
    descricao: m.descricao,
    observacao: m.observacao ?? null,
  };
}

// ── Caixinhas ────────────────────────────────────────────────────────────
export async function listarCaixinhas(propriedadeId?: number | null) {
  const rows = await prisma.caixinha.findMany({
    where: propriedadeId != null ? { propriedadeId } : undefined, // escopo do sítio
    orderBy: { nome: "asc" },
  });
  return rows.map(toCaixinhaDTO);
}

async function assertExiste(id: number) {
  const existing = await prisma.caixinha.findUnique({ where: { id } });
  if (!existing) throw new CaixinhaError("NAO_ENCONTRADO", "caixinha não encontrada");
  return existing;
}

export async function criarCaixinha(input: CriarCaixinhaInput, propriedadeId?: number | null) {
  const row = await prisma.caixinha.create({
    data: { nome: input.nome, responsavel: input.responsavel ?? undefined, propriedadeId: propriedadeId ?? null },
  });
  return toCaixinhaDTO(row);
}

export async function editarCaixinha(id: number, input: EditarCaixinhaInput) {
  await assertExiste(id);
  const row = await prisma.caixinha.update({
    where: { id },
    data: { nome: input.nome, responsavel: input.responsavel, ativo: input.ativo },
  });
  return toCaixinhaDTO(row);
}

// ── Movimentos (razão) ───────────────────────────────────────────────────

/** "YYYY-MM" → [primeiro dia do mês, primeiro dia do mês seguinte). Datas UTC. */
function janelaMes(mes: string): { inicio: Date; fim: Date } {
  const [ano, m] = mes.split("-").map(Number);
  return { inicio: new Date(Date.UTC(ano, m - 1, 1)), fim: new Date(Date.UTC(ano, m, 1)) };
}

export async function listarMovimentosCaixinha(caixinhaId: number, f: ListMovimentoCaixinhaFiltros) {
  await assertExiste(caixinhaId);
  const where: any = { caixinhaId };
  if (f.mes) {
    const { inicio, fim } = janelaMes(f.mes);
    where.data = { gte: inicio, lt: fim };
  }
  const rows = await prisma.movimentoCaixinha.findMany({
    where,
    orderBy: [{ data: "desc" }, { id: "desc" }],
  });
  return rows.map(toMovimentoCaixinhaDTO);
}

export async function criarMovimentoCaixinha(caixinhaId: number, input: CriarMovimentoCaixinhaInput) {
  const caixinha = await assertExiste(caixinhaId);
  const data = new Date(input.data);
  await assertMesAberto(data); // mês fechado → FechamentoMensalError (rota devolve 409)
  // Categoria só vale para SAIDA. ENTRADA (aporte) fica null; SAIDA sem categoria → OUTROS.
  const categoria = input.tipo === "SAIDA" ? input.categoria ?? "OUTROS" : null;
  const row = await prisma.movimentoCaixinha.create({
    data: {
      caixinhaId,
      data,
      tipo: input.tipo,
      categoria,
      valor: new Prisma.Decimal(input.valor.toFixed(2)),
      descricao: input.descricao,
      observacao: input.observacao ?? undefined,
    },
  });
  // Atualização incremental do saldo (razão + delta round2, nunca NaN).
  const delta = calcularSaldoCaixinha([{ tipo: input.tipo, valor: input.valor }]);
  const novoSaldo = Math.round((Number(caixinha.saldoAtual) + delta) * 100) / 100;
  await prisma.caixinha.update({
    where: { id: caixinhaId },
    data: { saldoAtual: new Prisma.Decimal(novoSaldo.toFixed(2)) },
  });
  return toMovimentoCaixinhaDTO(row);
}

export async function excluirMovimentoCaixinha(caixinhaId: number, movimentoId: number) {
  await assertExiste(caixinhaId);
  const mov = await prisma.movimentoCaixinha.findUnique({ where: { id: movimentoId } });
  if (!mov || mov.caixinhaId !== caixinhaId) {
    throw new CaixinhaError("NAO_ENCONTRADO", "movimento não encontrado");
  }
  await assertMesAberto(mov.data); // mês fechado → FechamentoMensalError (rota devolve 409)
  await prisma.movimentoCaixinha.delete({ where: { id: movimentoId } });
  await recomputarSaldoCaixinha(caixinhaId);
}
