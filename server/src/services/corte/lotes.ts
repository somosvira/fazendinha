/* Serviço de Lote (gado de corte) — CRUD + baixa. Espelha plantio/talhoes.ts.
 *
 * A unidade é o LOTE (grupo), não a cabeça. Persistência via Prisma; o resumo
 * é um read-model recomputado por resumos.recompute.ts.
 */
import { prisma } from "../../db.js";
import { toLoteDTO } from "./lotes.mappers.js";
import type { Lote } from "./mock.js";
import type { CriarLoteInput, EditarLoteInput, BaixaLoteInput, ListFiltros } from "./lotes.schemas.js";

export class LoteError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "CODIGO_DUPLICADO" | "REF_INVALIDA", message: string) {
    super(message);
  }
}

const include = { resumo: true, piquete: true } as const;
const d = (s?: string | null) => (s ? new Date(s) : undefined);

export async function listarLotes(f: ListFiltros, propriedadeId?: number | null): Promise<Lote[]> {
  const where: any = {};
  if (f.estado !== "TODOS") where.estado = f.estado;
  if (f.categoria) where.categoria = f.categoria;
  if (propriedadeId != null) where.propriedadeId = propriedadeId; // escopo do sítio

  if (f.q)
    where.OR = [
      { codigo: { contains: f.q, mode: "insensitive" } },
      { nome: { contains: f.q, mode: "insensitive" } },
    ];
  const rows = await prisma.loteCorte.findMany({ where, include, orderBy: { codigo: "asc" } });
  return rows.map(toLoteDTO);
}

export async function obterLote(id: number): Promise<Lote | null> {
  const row = await prisma.loteCorte.findUnique({ where: { id }, include });
  return row ? toLoteDTO(row) : null;
}

async function assertPiquete(piqueteId?: number | null) {
  if (piqueteId && !(await prisma.piquete.findUnique({ where: { id: piqueteId } })))
    throw new LoteError("REF_INVALIDA", "piquete inexistente");
}

export async function criarLote(input: CriarLoteInput, propriedadeId?: number | null): Promise<Lote> {
  if (await prisma.loteCorte.findUnique({ where: { codigo: input.codigo } }))
    throw new LoteError("CODIGO_DUPLICADO", `código ${input.codigo} já existe`);
  await assertPiquete(input.piqueteId);
  const row = await prisma.loteCorte.create({
    data: {
      codigo: input.codigo,
      nome: input.nome,
      categoria: input.categoria,
      fase: input.fase,
      raca: input.raca,
      numCabecas: input.numCabecas,
      numCabecasEntrada: input.numCabecasEntrada,
      dataFormacao: new Date(input.dataFormacao),
      origem: input.origem ?? null,
      piqueteId: input.piqueteId ?? null,
      propriedadeId: propriedadeId ?? null, // sítio ativo (multi-propriedade)
      estado: input.estado,
      observacao: input.observacao ?? null,
      resumo: { create: {} },
    },
    include,
  });
  return toLoteDTO(row);
}

export async function editarLote(id: number, input: EditarLoteInput): Promise<Lote> {
  const existing = await prisma.loteCorte.findUnique({ where: { id } });
  if (!existing) throw new LoteError("NAO_ENCONTRADO", "lote não encontrado");
  if (input.codigo && input.codigo !== existing.codigo && (await prisma.loteCorte.findUnique({ where: { codigo: input.codigo } })))
    throw new LoteError("CODIGO_DUPLICADO", `código ${input.codigo} já existe`);
  await assertPiquete(input.piqueteId);
  const row = await prisma.loteCorte.update({
    where: { id },
    data: {
      codigo: input.codigo,
      nome: input.nome,
      categoria: input.categoria,
      fase: input.fase,
      raca: input.raca,
      numCabecas: input.numCabecas,
      numCabecasEntrada: input.numCabecasEntrada,
      dataFormacao: d(input.dataFormacao),
      origem: input.origem ?? undefined,
      piqueteId: input.piqueteId ?? undefined,
      estado: input.estado,
      observacao: input.observacao ?? undefined,
    },
    include,
  });
  return toLoteDTO(row);
}

/** Baixa o lote (VENDIDO/EXTINTO) — NÃO deleta a linha, só muda o estado. */
export async function darBaixa(id: number, input: BaixaLoteInput): Promise<Lote> {
  const existing = await prisma.loteCorte.findUnique({ where: { id } });
  if (!existing) throw new LoteError("NAO_ENCONTRADO", "lote não encontrado");
  const observacao = input.motivo
    ? [existing.observacao, `Baixa ${input.estado}: ${input.motivo}`].filter(Boolean).join(" · ")
    : existing.observacao;
  const row = await prisma.loteCorte.update({
    where: { id },
    data: { estado: input.estado, observacao },
    include,
  });
  return toLoteDTO(row);
}
