import { prisma } from "../../db.js";
import { agruparLotes, statusValidade, type StatusValidade, type ResumoLotes } from "./lote.calc.js";

export class LoteError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) { super(message); }
}

const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);
const dataDb = (isoDia: string) => new Date(`${isoDia}T00:00:00Z`);
const hojeUTC = () => new Date().toISOString().slice(0, 10);
const num = (v: unknown): number | null => (v == null ? null : Number(v));

export interface LocalDTO { id: number; nome: string; ativo: boolean; totalLotes: number }
export interface LoteDTO {
  id: number; produtoId: number; produtoNome: string;
  codigo: string; validade: string | null; localId: number | null; localNome: string | null;
  quantidade: number | null; status: StatusValidade;
}
export interface LotesResp { lotes: LoteDTO[]; resumo: ResumoLotes }

export interface CriarLocalInput { nome: string; ativo?: boolean }
export interface CriarLoteInput { produtoId: number; codigo: string; validade?: string | null; localId?: number | null; quantidade?: number | null }

// ── Locais de armazenamento ───────────────────────────────────────────────────

export async function listarLocais(propriedadeId: number | null): Promise<LocalDTO[]> {
  const rows = await prisma.localArmazenamento.findMany({
    where: propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {},
    include: { _count: { select: { lotes: true } } },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });
  return rows.map((l) => ({ id: l.id, nome: l.nome, ativo: l.ativo, totalLotes: l._count.lotes }));
}

export async function criarLocal(input: CriarLocalInput, propriedadeId: number | null): Promise<LocalDTO> {
  const l = await prisma.localArmazenamento.create({ data: { nome: input.nome, ativo: input.ativo ?? true, propriedadeId } });
  return { id: l.id, nome: l.nome, ativo: l.ativo, totalLotes: 0 };
}

export async function excluirLocal(id: number): Promise<void> {
  if (!(await prisma.localArmazenamento.findUnique({ where: { id } }))) throw new LoteError("NAO_ENCONTRADO", "local não encontrado");
  const emUso = await prisma.loteProduto.count({ where: { localId: id } });
  if (emUso > 0) { await prisma.localArmazenamento.update({ where: { id }, data: { ativo: false } }); return; }
  await prisma.localArmazenamento.delete({ where: { id } });
}

// ── Lotes de produto ──────────────────────────────────────────────────────────

export async function listarLotes(propriedadeId: number | null): Promise<LotesResp> {
  const hoje = hojeUTC();
  const rows = await prisma.loteProduto.findMany({
    where: propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {},
    include: { produto: { select: { nome: true } }, local: { select: { nome: true } } },
    orderBy: [{ validade: "asc" }],
  });
  const lotes: LoteDTO[] = rows.map((l) => {
    const validade = iso(l.validade);
    return {
      id: l.id, produtoId: l.produtoId, produtoNome: l.produto.nome,
      codigo: l.codigo, validade, localId: l.localId, localNome: l.local?.nome ?? null,
      quantidade: num(l.quantidade), status: statusValidade(validade, hoje),
    };
  });
  return { lotes, resumo: agruparLotes(lotes.map((l) => ({ validade: l.validade })), hoje) };
}

export async function criarLote(input: CriarLoteInput, propriedadeId: number | null): Promise<LoteDTO> {
  if (!(await prisma.produto.findUnique({ where: { id: input.produtoId } }))) throw new LoteError("NAO_ENCONTRADO", "produto não encontrado");
  const l = await prisma.loteProduto.create({
    data: {
      produtoId: input.produtoId, codigo: input.codigo,
      validade: input.validade ? dataDb(input.validade) : null,
      localId: input.localId ?? null, quantidade: input.quantidade ?? null, propriedadeId,
    },
    include: { produto: { select: { nome: true } }, local: { select: { nome: true } } },
  });
  const validade = iso(l.validade);
  return { id: l.id, produtoId: l.produtoId, produtoNome: l.produto.nome, codigo: l.codigo, validade, localId: l.localId, localNome: l.local?.nome ?? null, quantidade: num(l.quantidade), status: statusValidade(validade, hojeUTC()) };
}

export async function excluirLote(id: number): Promise<void> {
  if (!(await prisma.loteProduto.findUnique({ where: { id } }))) throw new LoteError("NAO_ENCONTRADO", "lote não encontrado");
  await prisma.loteProduto.delete({ where: { id } });
}
