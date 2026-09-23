import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { toTimeline, type EventoTimelineDTO } from "./eventos-sanidade.mappers.js";
import type { CriarEventoSanitarioInput } from "./eventos-sanidade.schemas.js";
import { recomputarResumoSanidade, type EvtSan } from "./sanidade.recompute.js";
import { recomputarQuartos } from "./quarto.recompute.js";
import { planejarBaixaSanidade } from "./sanidade-estoque.calc.js";
import { propriedadePrincipalId } from "../propriedade.js";
import { resolverCentroSaida } from "../estoque/centro.calc.js";
import { estornarMovimentoTx, obterCustoMedio } from "../estoque/estoque.js";

export class EventoSanError extends Error { constructor(public code: "NAO_ENCONTRADO" | "CONFLITO" | "MES_FECHADO", message: string) { super(message); } }
const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);

async function assertPeriodoAberto(tx: Prisma.TransactionClient, propriedadeId: number, data: Date) {
  const periodo = await tx.periodoFinanceiro.findUnique({ where: { propriedadeId_ano_mes: { propriedadeId, ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 } } });
  if (periodo?.status === "FECHADO") throw new EventoSanError("MES_FECHADO", "período financeiro fechado");
}

export async function recomputarSanidade(animalId: number): Promise<void> {
  const exs = await prisma.eventoSanitario.findMany({ where: { animalId } });
  const evs: EvtSan[] = exs.map((e) => ({ tipo: e.tipo, data: iso(e.data)!, ccs: e.ccs }));
  const r = recomputarResumoSanidade(evs);
  // Saúde por quarto: agrega cronicidade/perdidos dos ExameQuarto (fato próprio) → ResumoAnimal.
  const eqs = await prisma.exameQuarto.findMany({ where: { animalId } });
  const q = recomputarQuartos(
    eqs.map((e) => ({ quarto: e.quarto, data: iso(e.data)!, scoreCmt: e.scoreCmt, ccs: e.ccs, clinica: e.clinica, perdido: e.perdido })),
    iso(new Date())!,
  );
  const dados = { ccs: r.ccs, ccsTendencia: r.ccsTendencia, quartosCronicos: q.quartosCronicos, quartosPerdidos: q.quartosPerdidos };
  await prisma.resumoAnimal.upsert({
    where: { animalId },
    create: { animalId, ...dados },
    update: dados,
  });
}
export async function listarSanidade(animalId: number): Promise<EventoTimelineDTO[]> {
  return (await prisma.eventoSanitario.findMany({ where: { animalId }, orderBy: { data: "desc" } })).map(toTimeline);
}
// Plano de baixa valorizado pelo custo médio ponderado do produto no sítio.
async function planejarComCustoMedio(tx: Prisma.TransactionClient, tipo: string, produtoId: number | null, quantidadeUsada: number | null, propriedadeId: number) {
  const custoUnitario = produtoId != null ? await obterCustoMedio(tx, produtoId, propriedadeId) : null;
  return planejarBaixaSanidade({ tipo, produtoId, quantidadeUsada, custoUnitario });
}

export async function registrarSanidade(animalId: number, input: CriarEventoSanitarioInput, propriedadeId: number | null = null): Promise<EventoTimelineDTO> {
  const animal = await prisma.animal.findFirst({ where: { id: animalId, ...(propriedadeId != null ? { propriedadeId } : {}) }, select: { id: true, propriedadeId: true, grupo: { select: { centroCustoId: true } } } });
  if (!animal) throw new EventoSanError("NAO_ENCONTRADO", "animal não encontrado");
  const produtoId = (input as any).produtoId ?? null;
  const quantidadeUsada = (input as any).quantidadeUsada ?? null;

  // Baixa automática de estoque quando a APLICACAO/VACINA consome um produto vinculado.
  // O produto precisa existir; custo unitário = custo médio do sítio (0 se sem base).
  const produto = produtoId != null ? await prisma.produto.findUnique({ where: { id: produtoId }, select: { id: true, centrosCusto: { select: { centroCustoId: true } } } }) : null;
  if (produtoId != null && !produto) throw new EventoSanError("NAO_ENCONTRADO", "produto do estoque não encontrado");
  const consome = planejarBaixaSanidade({ tipo: input.tipo, produtoId, quantidadeUsada, custoUnitario: null }) != null;
  const centroCustoId = produto ? resolverCentroSaida({ produtoCentroIds: produto.centrosCusto.map((cc) => cc.centroCustoId), contextoCentroId: animal.grupo?.centroCustoId }) : null;
  const propriedadeMovimentoId = animal.propriedadeId ?? (await propriedadePrincipalId());
  const data = new Date(input.data);

  // Campos escalares do evento (exclui os auxiliares que não são colunas diretas).
  const { produtoId: _pid, quantidadeUsada: _q, dtFim, ...resto } = input as any;

  const e = await prisma.$transaction(async (tx) => {
    if (consome) await assertPeriodoAberto(tx, propriedadeMovimentoId, data);
    const plano = consome ? await planejarComCustoMedio(tx, input.tipo, produtoId, quantidadeUsada, propriedadeMovimentoId) : null;
    // SAIDA de consumo NÃO gera Lancamento (a compra ENTRADA já lançou no financeiro).
    const mov = plano
      ? await tx.movimentoEstoque.create({
          data: {
            produtoId: plano.produtoId, tipo: "SAIDA", origem: "SANIDADE", data,
            quantidade: plano.quantidade, custoUnitario: plano.custoUnitario, valorTotal: plano.valorTotal,
            propriedadeId: propriedadeMovimentoId, centroCustoId, observacao: `Consumo em ${input.tipo.toLowerCase()} (animal ${animalId})`,
          },
        })
      : null;
    return tx.eventoSanitario.create({
      data: {
        animalId, ...resto, data,
        dtFim: dtFim ? new Date(dtFim) : undefined,
        produtoId, quantidadeUsada: quantidadeUsada != null ? new Prisma.Decimal(quantidadeUsada) : undefined,
        movimentoEstoqueId: mov?.id ?? undefined,
      },
    });
  });
  await recomputarSanidade(animalId);
  return toTimeline(e);
}
export async function editarSanidade(eventoId: number, input: CriarEventoSanitarioInput, propriedadeId: number | null = null): Promise<EventoTimelineDTO> {
  const existente = await prisma.eventoSanitario.findFirst({
    where: { id: eventoId, ...(propriedadeId != null ? { animal: { propriedadeId } } : {}) },
    include: { animal: { select: { propriedadeId: true, grupo: { select: { centroCustoId: true } } } } },
  });
  if (!existente) throw new EventoSanError("NAO_ENCONTRADO", "evento não encontrado");
  if (existente.tipo !== input.tipo) throw new EventoSanError("CONFLITO", "o tipo do evento não pode ser alterado");

  const produtoId = (input as any).produtoId ?? null;
  const quantidadeUsada = (input as any).quantidadeUsada ?? null;
  const produto = produtoId != null ? await prisma.produto.findUnique({ where: { id: produtoId }, select: { id: true, centrosCusto: { select: { centroCustoId: true } } } }) : null;
  if (produtoId != null && !produto) throw new EventoSanError("NAO_ENCONTRADO", "produto do estoque não encontrado");
  const consome = planejarBaixaSanidade({ tipo: input.tipo, produtoId, quantidadeUsada, custoUnitario: null }) != null;
  const centroCustoId = produto ? resolverCentroSaida({ produtoCentroIds: produto.centrosCusto.map((cc) => cc.centroCustoId), contextoCentroId: existente.animal.grupo?.centroCustoId }) : null;
  const propriedadeMovimentoId = existente.animal.propriedadeId ?? (await propriedadePrincipalId());
  const data = new Date(input.data);
  const afetaEstoque = consome || existente.movimentoEstoqueId != null;
  const { produtoId: _pid, quantidadeUsada: _q, dtFim, ...resto } = input as any;
  const observacaoEstorno = `Estorno: evento sanitário #${eventoId} editado`;

  const atualizado = await prisma.$transaction(async (tx) => {
    if (afetaEstoque) {
      await assertPeriodoAberto(tx, propriedadeMovimentoId, data);
      if (existente.data.getTime() !== data.getTime()) await assertPeriodoAberto(tx, propriedadeMovimentoId, existente.data);
    }
    let movimentoEstoqueId = existente.movimentoEstoqueId;
    const anterior = movimentoEstoqueId != null
      ? await tx.movimentoEstoque.findUnique({ where: { id: movimentoEstoqueId }, select: { id: true, produtoId: true, quantidade: true, data: true, centroCustoId: true } })
      : null;
    // Movimento confirmado não é editado nem apagado: se algo relevante ao
    // estoque mudou, estorna o antigo e cria um novo valorizado pelo custo
    // médio atual (contrato do financeiro, mesmo padrão do plantio).
    const mudouBaixa = consome && (
      anterior == null
      || anterior.produtoId !== produtoId
      || !anterior.quantidade.equals(quantidadeUsada)
      || anterior.data.getTime() !== data.getTime()
      || (anterior.centroCustoId ?? null) !== (centroCustoId ?? null)
    );
    if (consome && mudouBaixa) {
      if (anterior) await estornarMovimentoTx(tx, anterior.id, { observacao: observacaoEstorno });
      const plano = (await planejarComCustoMedio(tx, input.tipo, produtoId, quantidadeUsada, propriedadeMovimentoId))!;
      movimentoEstoqueId = (await tx.movimentoEstoque.create({ data: {
        produtoId: plano.produtoId, tipo: "SAIDA", origem: "SANIDADE", data,
        quantidade: plano.quantidade, custoUnitario: plano.custoUnitario, valorTotal: plano.valorTotal,
        propriedadeId: propriedadeMovimentoId, centroCustoId,
        observacao: `Consumo em ${input.tipo.toLowerCase()} (animal ${existente.animalId})`,
      } })).id;
    } else if (!consome && movimentoEstoqueId != null) {
      // Edição removeu o produto/quantidade: estorna a baixa gerada antes.
      await estornarMovimentoTx(tx, movimentoEstoqueId, { observacao: observacaoEstorno });
      movimentoEstoqueId = null;
    }
    return tx.eventoSanitario.update({
      where: { id: eventoId },
      data: { ...resto, data, dtFim: dtFim ? new Date(dtFim) : null, produtoId,
        quantidadeUsada: quantidadeUsada != null ? new Prisma.Decimal(quantidadeUsada) : null,
        movimentoEstoqueId },
    });
  });
  await recomputarSanidade(existente.animalId);
  return toTimeline(atualizado);
}

export async function excluirSanidade(eventoId: number, propriedadeId: number | null = null): Promise<void> {
  const e = await prisma.eventoSanitario.findFirst({ where: { id: eventoId, ...(propriedadeId != null ? { animal: { propriedadeId } } : {}) }, include: { animal: { select: { propriedadeId: true } } } });
  if (!e) throw new EventoSanError("NAO_ENCONTRADO", "evento não encontrado");
  const propriedadeMovimentoId = e.animal.propriedadeId ?? (await propriedadePrincipalId());
  await prisma.$transaction(async (tx) => {
    if (e.movimentoEstoqueId != null) {
      await assertPeriodoAberto(tx, propriedadeMovimentoId, e.data);
      // A baixa confirmada não é apagada: estorna (inverso + REVERTIDO) e o
      // evento sai; o par original/inverso fica no razão de estoque.
      await estornarMovimentoTx(tx, e.movimentoEstoqueId, { observacao: `Estorno: evento sanitário #${eventoId} excluído` });
    }
    await tx.eventoSanitario.delete({ where: { id: eventoId } });
  });
  await recomputarSanidade(e.animalId);
}
