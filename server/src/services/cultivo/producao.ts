import { prisma } from "../../db.js";
import { toProducaoCultivoDTO } from "./mappers.js";
import { assertSafraAberta } from "./safras.js";
import { recomputarResumoSafra } from "./resumo.recompute.js";
import { recomputarSaldoSilo } from "./silo.js";
import type { CriarProducaoCultivoInput, EditarProducaoCultivoInput, ListProducaoCultivoFiltros } from "./schemas.js";

export class ProducaoCultivoError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "REF_INVALIDA" | "SAFRA_FECHADA", message: string) {
    super(message);
  }
}

const include = { area: { select: { codigo: true } }, silo: { select: { nome: true } } } as const;

export async function listarProducoesCultivo(f: ListProducaoCultivoFiltros) {
  const where: any = {};
  if (f.safraCultivoId !== undefined) where.safraCultivoId = f.safraCultivoId;
  if (f.areaCultivoId !== undefined) where.areaCultivoId = f.areaCultivoId;
  const rows = await prisma.producaoCultivo.findMany({ where, include, orderBy: [{ data: "desc" }, { id: "desc" }] });
  return rows.map(toProducaoCultivoDTO);
}

export async function obterProducaoCultivo(id: number) {
  const row = await prisma.producaoCultivo.findUnique({ where: { id }, include });
  return row ? toProducaoCultivoDTO(row) : null;
}

async function assertAreaValida(safraCultivoId: number, areaCultivoId?: number | null) {
  if (areaCultivoId == null) return;
  const area = await prisma.areaCultivo.findUnique({ where: { id: areaCultivoId } });
  if (!area || area.safraCultivoId !== safraCultivoId) {
    throw new ProducaoCultivoError("REF_INVALIDA", "área de cultivo inexistente ou de outra safra");
  }
}

async function assertSiloValido(siloId?: number | null) {
  if (siloId == null) return;
  if (!(await prisma.silo.findUnique({ where: { id: siloId } }))) {
    throw new ProducaoCultivoError("REF_INVALIDA", "silo inexistente");
  }
}

async function assertSafraAbertaOuErro(safraCultivoId: number) {
  try {
    await assertSafraAberta(safraCultivoId);
  } catch (e: any) {
    if (e?.code === "NAO_ENCONTRADO") throw new ProducaoCultivoError("REF_INVALIDA", "safra de cultivo inexistente");
    if (e?.code === "SAFRA_FECHADA") throw new ProducaoCultivoError("SAFRA_FECHADA", "safra fechada — produção não pode ser lançada/editada/excluída");
    throw e;
  }
}

// Cria o movimento de silo (ENTRADA/COLHEITA) e recomputa o saldo quando a
// produção tem destino=SILO + siloId (§5.2).
async function aplicarMovimentoSiloSeNecessario(producao: { id: number; siloId: number | null; destino: string | null; data: Date; quantidade: any }) {
  if (producao.destino !== "SILO" || producao.siloId == null) return;
  await prisma.movimentoSilo.create({
    data: {
      siloId: producao.siloId,
      data: producao.data,
      tipo: "ENTRADA",
      quantidade: producao.quantidade,
      origem: "COLHEITA",
      producaoCultivoId: producao.id,
    },
  });
  await recomputarSaldoSilo(producao.siloId);
}

// Remove movimentos de silo gerados por esta produção (edição/exclusão) e
// recomputa o saldo dos silos afetados.
async function removerMovimentosSiloDaProducao(producaoCultivoId: number) {
  const movs = await prisma.movimentoSilo.findMany({ where: { producaoCultivoId } });
  if (movs.length === 0) return;
  const siloIds = [...new Set(movs.map((m) => m.siloId))];
  await prisma.movimentoSilo.deleteMany({ where: { producaoCultivoId } });
  for (const siloId of siloIds) await recomputarSaldoSilo(siloId);
}

export async function criarProducaoCultivo(input: CriarProducaoCultivoInput) {
  await assertSafraAbertaOuErro(input.safraCultivoId);
  await assertAreaValida(input.safraCultivoId, input.areaCultivoId);
  await assertSiloValido(input.siloId);
  const row = await prisma.producaoCultivo.create({
    data: {
      safraCultivoId: input.safraCultivoId,
      areaCultivoId: input.areaCultivoId ?? undefined,
      data: new Date(input.data),
      tipo: input.tipo,
      quantidade: input.quantidade,
      unidade: input.unidade,
      destino: input.destino ?? undefined,
      siloId: input.siloId ?? undefined,
      observacao: input.observacao ?? undefined,
    },
    include,
  });
  await aplicarMovimentoSiloSeNecessario(row);
  await recomputarResumoSafra(row.safraCultivoId);
  return toProducaoCultivoDTO(await prisma.producaoCultivo.findUniqueOrThrow({ where: { id: row.id }, include }));
}

export async function editarProducaoCultivo(id: number, input: EditarProducaoCultivoInput) {
  const existing = await prisma.producaoCultivo.findUnique({ where: { id } });
  if (!existing) throw new ProducaoCultivoError("NAO_ENCONTRADO", "produção não encontrada");
  await assertSafraAbertaOuErro(existing.safraCultivoId);
  await assertAreaValida(existing.safraCultivoId, input.areaCultivoId);
  await assertSiloValido(input.siloId);

  // Movimento de silo depende do estado final (destino/siloId/quantidade/data) —
  // mais simples remover o antigo e recriar se ainda aplicável.
  await removerMovimentosSiloDaProducao(id);

  const row = await prisma.producaoCultivo.update({
    where: { id },
    data: {
      areaCultivoId: input.areaCultivoId,
      data: input.data ? new Date(input.data) : undefined,
      tipo: input.tipo,
      quantidade: input.quantidade,
      unidade: input.unidade,
      destino: input.destino,
      siloId: input.siloId,
      observacao: input.observacao,
    },
    include,
  });
  await aplicarMovimentoSiloSeNecessario(row);
  await recomputarResumoSafra(row.safraCultivoId);
  return toProducaoCultivoDTO(await prisma.producaoCultivo.findUniqueOrThrow({ where: { id: row.id }, include }));
}

export async function excluirProducaoCultivo(id: number) {
  const existing = await prisma.producaoCultivo.findUnique({ where: { id } });
  if (!existing) throw new ProducaoCultivoError("NAO_ENCONTRADO", "produção não encontrada");
  await assertSafraAbertaOuErro(existing.safraCultivoId);
  await removerMovimentosSiloDaProducao(id);
  await prisma.producaoCultivo.delete({ where: { id } });
  await recomputarResumoSafra(existing.safraCultivoId);
}
