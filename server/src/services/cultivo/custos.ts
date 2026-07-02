import { prisma } from "../../db.js";
import { toLancamentoCustoDTO } from "./mappers.js";
import { assertSafraAberta } from "./safras.js";
import { recomputarResumoSafra } from "./resumo.recompute.js";
import type { CriarLancamentoCustoInput, EditarLancamentoCustoInput, ListLancamentoCustoFiltros } from "./schemas.js";

export class LancamentoCustoError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "REF_INVALIDA" | "SAFRA_FECHADA", message: string) {
    super(message);
  }
}

const include = { area: { select: { codigo: true } } } as const;

export async function listarLancamentosCusto(f: ListLancamentoCustoFiltros) {
  const where: any = {};
  if (f.safraCultivoId !== undefined) where.safraCultivoId = f.safraCultivoId;
  if (f.areaCultivoId !== undefined) where.areaCultivoId = f.areaCultivoId;
  if (f.classe && f.classe !== "tudo") where.classe = f.classe.toUpperCase();
  const rows = await prisma.lancamentoCusto.findMany({ where, include, orderBy: [{ data: "desc" }, { id: "desc" }] });
  return rows.map(toLancamentoCustoDTO);
}

export async function obterLancamentoCusto(id: number) {
  const row = await prisma.lancamentoCusto.findUnique({ where: { id }, include });
  return row ? toLancamentoCustoDTO(row) : null;
}

async function assertAreaValida(safraCultivoId: number, areaCultivoId?: number | null) {
  if (areaCultivoId == null) return;
  const area = await prisma.areaCultivo.findUnique({ where: { id: areaCultivoId } });
  if (!area || area.safraCultivoId !== safraCultivoId) {
    throw new LancamentoCustoError("REF_INVALIDA", "área de cultivo inexistente ou de outra safra");
  }
}

async function assertSafraAbertaOuErro(safraCultivoId: number) {
  try {
    await assertSafraAberta(safraCultivoId);
  } catch (e: any) {
    if (e?.code === "NAO_ENCONTRADO") throw new LancamentoCustoError("REF_INVALIDA", "safra de cultivo inexistente");
    if (e?.code === "SAFRA_FECHADA") throw new LancamentoCustoError("SAFRA_FECHADA", "safra fechada — custo não pode ser lançado/editado/excluído");
    throw e;
  }
}

export async function criarLancamentoCusto(input: CriarLancamentoCustoInput) {
  await assertSafraAbertaOuErro(input.safraCultivoId);
  await assertAreaValida(input.safraCultivoId, input.areaCultivoId);
  const row = await prisma.lancamentoCusto.create({
    data: {
      safraCultivoId: input.safraCultivoId,
      areaCultivoId: input.areaCultivoId ?? undefined,
      tipo: input.tipo,
      classe: input.classe,
      data: new Date(input.data),
      descricao: input.descricao,
      valor: input.valor,
      qtd: input.qtd ?? undefined,
      unidade: input.unidade ?? undefined,
      horasMaquina: input.horasMaquina ?? undefined,
      numMaquinas: input.numMaquinas ?? undefined,
      numCaminhoes: input.numCaminhoes ?? undefined,
      observacao: input.observacao ?? undefined,
    },
    include,
  });
  await recomputarResumoSafra(row.safraCultivoId);
  return toLancamentoCustoDTO(row);
}

export async function editarLancamentoCusto(id: number, input: EditarLancamentoCustoInput) {
  const existing = await prisma.lancamentoCusto.findUnique({ where: { id } });
  if (!existing) throw new LancamentoCustoError("NAO_ENCONTRADO", "lançamento de custo não encontrado");
  await assertSafraAbertaOuErro(existing.safraCultivoId);
  await assertAreaValida(existing.safraCultivoId, input.areaCultivoId);
  const row = await prisma.lancamentoCusto.update({
    where: { id },
    data: {
      areaCultivoId: input.areaCultivoId,
      tipo: input.tipo,
      classe: input.classe,
      data: input.data ? new Date(input.data) : undefined,
      descricao: input.descricao,
      valor: input.valor,
      qtd: input.qtd,
      unidade: input.unidade,
      horasMaquina: input.horasMaquina,
      numMaquinas: input.numMaquinas,
      numCaminhoes: input.numCaminhoes,
      observacao: input.observacao,
    },
    include,
  });
  await recomputarResumoSafra(row.safraCultivoId);
  return toLancamentoCustoDTO(row);
}

export async function excluirLancamentoCusto(id: number) {
  const existing = await prisma.lancamentoCusto.findUnique({ where: { id } });
  if (!existing) throw new LancamentoCustoError("NAO_ENCONTRADO", "lançamento de custo não encontrado");
  await assertSafraAbertaOuErro(existing.safraCultivoId);
  await prisma.lancamentoCusto.delete({ where: { id } });
  await recomputarResumoSafra(existing.safraCultivoId);
}
