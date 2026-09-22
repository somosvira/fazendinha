import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { toTimeline, type EventoTimelineDTO } from "./eventos-sanidade.mappers.js";
import type { CriarEventoSanitarioInput } from "./eventos-sanidade.schemas.js";
import { recomputarResumoSanidade, type EvtSan } from "./sanidade.recompute.js";
import { recomputarQuartos } from "./quarto.recompute.js";
import { planejarBaixaSanidade } from "./sanidade-estoque.calc.js";
import { propriedadePrincipalId } from "../propriedade.js";
import { resolverCentroSaida } from "../estoque/centro.calc.js";

export class EventoSanError extends Error { constructor(public code: "NAO_ENCONTRADO" | "CONFLITO" | "MES_FECHADO", message: string) { super(message); } }
const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);

async function assertPeriodoAberto(propriedadeId: number, data: Date) {
  const periodo = await prisma.periodoFinanceiro.findUnique({ where: { propriedadeId_ano_mes: { propriedadeId, ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 } } });
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
export async function registrarSanidade(animalId: number, input: CriarEventoSanitarioInput, propriedadeId: number | null = null): Promise<EventoTimelineDTO> {
  const animal = await prisma.animal.findFirst({ where: { id: animalId, ...(propriedadeId != null ? { propriedadeId } : {}) }, select: { id: true, propriedadeId: true, grupo: { select: { centroCustoId: true } } } });
  if (!animal) throw new EventoSanError("NAO_ENCONTRADO", "animal não encontrado");
  const produtoId = (input as any).produtoId ?? null;
  const quantidadeUsada = (input as any).quantidadeUsada ?? null;

  // Baixa automática de estoque quando a APLICACAO/VACINA consome um produto vinculado.
  // O produto precisa existir; custo unitário vem do cadastro (0 se desconhecido).
  const produto = produtoId != null ? await prisma.produto.findUnique({ where: { id: produtoId }, select: { id: true, custoUnitario: true, centrosCusto: { select: { centroCustoId: true } } } }) : null;
  if (produtoId != null && !produto) throw new EventoSanError("NAO_ENCONTRADO", "produto do estoque não encontrado");
  const plano = planejarBaixaSanidade({ tipo: input.tipo, produtoId, quantidadeUsada, custoUnitario: produto?.custoUnitario != null ? Number(produto.custoUnitario) : null });
  const centroCustoId = produto ? resolverCentroSaida({ produtoCentroIds: produto.centrosCusto.map((cc) => cc.centroCustoId), contextoCentroId: animal.grupo?.centroCustoId }) : null;
  const propriedadeMovimentoId = animal.propriedadeId ?? (await propriedadePrincipalId());
  const data = new Date(input.data);
  if (plano) await assertPeriodoAberto(propriedadeMovimentoId, data);

  // Campos escalares do evento (exclui os auxiliares que não são colunas diretas).
  const { produtoId: _pid, quantidadeUsada: _q, dtFim, ...resto } = input as any;

  const e = await prisma.$transaction(async (tx) => {
    // SAIDA de consumo NÃO gera Lancamento (a compra ENTRADA já lançou no financeiro).
    const mov = plano
      ? await tx.movimentoEstoque.create({
          data: {
            produtoId: plano.produtoId, tipo: "SAIDA", origem: "SANIDADE", data,
            quantidade: new Prisma.Decimal(plano.quantidade),
            custoUnitario: new Prisma.Decimal(plano.custoUnitario),
            valorTotal: new Prisma.Decimal(plano.valorTotal),
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
  const produto = produtoId != null ? await prisma.produto.findUnique({ where: { id: produtoId }, select: { id: true, custoUnitario: true, centrosCusto: { select: { centroCustoId: true } } } }) : null;
  if (produtoId != null && !produto) throw new EventoSanError("NAO_ENCONTRADO", "produto do estoque não encontrado");
  const plano = planejarBaixaSanidade({ tipo: input.tipo, produtoId, quantidadeUsada, custoUnitario: produto?.custoUnitario != null ? Number(produto.custoUnitario) : null });
  const centroCustoId = produto ? resolverCentroSaida({ produtoCentroIds: produto.centrosCusto.map((cc) => cc.centroCustoId), contextoCentroId: existente.animal.grupo?.centroCustoId }) : null;
  const propriedadeMovimentoId = existente.animal.propriedadeId ?? (await propriedadePrincipalId());
  const data = new Date(input.data);
  const afetaEstoque = plano != null || existente.movimentoEstoqueId != null;
  if (afetaEstoque) {
    await assertPeriodoAberto(propriedadeMovimentoId, data);
    if (existente.data.getTime() !== data.getTime()) await assertPeriodoAberto(propriedadeMovimentoId, existente.data);
  }
  const { produtoId: _pid, quantidadeUsada: _q, dtFim, ...resto } = input as any;

  const atualizado = await prisma.$transaction(async (tx) => {
    let movimentoEstoqueId = existente.movimentoEstoqueId;
    const dadosMovimento = plano ? {
      produtoId: plano.produtoId, tipo: "SAIDA" as const, origem: "SANIDADE" as const, data,
      quantidade: new Prisma.Decimal(plano.quantidade), custoUnitario: new Prisma.Decimal(plano.custoUnitario),
      valorTotal: new Prisma.Decimal(plano.valorTotal), propriedadeId: propriedadeMovimentoId, centroCustoId,
      observacao: `Consumo em ${input.tipo.toLowerCase()} (animal ${existente.animalId})`,
    } : null;
    if (movimentoEstoqueId != null && dadosMovimento) {
      await tx.movimentoEstoque.update({ where: { id: movimentoEstoqueId }, data: dadosMovimento });
    } else if (movimentoEstoqueId == null && dadosMovimento) {
      movimentoEstoqueId = (await tx.movimentoEstoque.create({ data: dadosMovimento })).id;
    } else if (movimentoEstoqueId != null) {
      await tx.eventoSanitario.update({ where: { id: eventoId }, data: { movimentoEstoqueId: null } });
      await tx.movimentoEstoque.delete({ where: { id: movimentoEstoqueId } });
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
  if (e.movimentoEstoqueId != null) await assertPeriodoAberto(propriedadeMovimentoId, e.data);
  await prisma.$transaction(async (tx) => {
    await tx.eventoSanitario.delete({ where: { id: eventoId } });
    if (e.movimentoEstoqueId != null) await tx.movimentoEstoque.delete({ where: { id: e.movimentoEstoqueId } });
  });
  await recomputarSanidade(e.animalId);
}
