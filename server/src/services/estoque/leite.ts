import { Prisma } from "@prisma/client";
import { ValorizacaoError } from "./valorizacao.calc.js";
import { conferirMudancaNaturezaLeite, planejarBaixaLeite, selecionarOrigensLeite, type FinalidadeLeite, type SaldoOrigemLeite } from "./leite.calc.js";
import { auditar, exigirPeriodoAberto } from "../financeiro/regras.js";
import { travarValorizacaoTx, previaRetroatividadeTx } from "./valorizacao.js";
import { conferirCarenciaOrigensVendaTx } from "../pecuaria/leite/carencia-producao.js";
import { hojeFazendaDate } from "../pecuaria/rebanho/regras.js";

export const METODO_LEITE = "LEITE_FIFO_V1";
export type PlanoBaixaLeite = Omit<ReturnType<typeof planejarBaixaLeite>, "parcelas"> & {
  finalidade: FinalidadeLeite;
  parcelas: (ReturnType<typeof planejarBaixaLeite>["parcelas"][number] & { classificacaoId: string })[];
};
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const includeEntrada = {
  movimento: true,
  vinculosMedicoes: { where: { ativo: true }, include: { medicao: { include: { participante: { select: { animalId: true, brinco: true, nome: true } } } } } },
  sessao: { select: { ordem: true, nome: true } },
  classificacoes: { orderBy: { versao: "desc" as const }, take: 1 },
  apuracoes: { orderBy: { versao: "desc" as const }, take: 1, include: { apropriacoes: true } },
  alocacoes: { include: { movimento: true } },
} satisfies Prisma.EntradaProducaoLeiteInclude;

/** O saldo físico vem do mesmo movimento; alocações só identificam consumidores. */
export async function saldosOrigensLeiteTx(tx: Prisma.TransactionClient, produtoId: string, propriedadeId: number, data?: Date) {
  const entradas = await tx.entradaProducaoLeite.findMany({
    where: { status: "CONFIRMADA", movimento: { produtoId, propriedadeId, status: "CONFIRMADO", ...(data ? { data: { lte: data } } : {}) } },
    include: includeEntrada, orderBy: { movimento: { seq: "asc" } },
  });
  return entradas.map(entrada => {
    const apuracao = entrada.apuracoes[0];
    const consumos = entrada.alocacoes.filter(a => a.movimento.status === "CONFIRMADO" && !a.movimento.reversaoDeId && (!data || a.movimento.data <= data));
    const consumida = consumos.reduce((q, a) => q.plus(a.quantidade), D(0));
    const valores = consumos.map(a => apuracao?.apropriacoes.find(p => p.alocacaoId === a.id)?.valorTotal ?? a.valorTotal);
    const valor = apuracao && valores.every(v => v != null)
      ? apuracao.valorTotal.minus(valores.reduce<Prisma.Decimal>((s, v) => s.plus(v!), D(0))) : null;
    return { entrada, entradaId: entrada.id, data: entrada.movimento.data.toISOString().slice(0, 10), ordem: entrada.sessao.ordem,
      quantidade: entrada.movimento.quantidade.minus(consumida), valor,
      classificacaoId: entrada.classificacoes[0]?.id ?? null, natureza: entrada.classificacoes[0]?.natureza ?? "NAO_INFORMADA" };
  });
}

export async function planejarBaixaLeiteTx(tx: Prisma.TransactionClient, input: { produtoId: string; propriedadeId: number; data: Date; quantidade: Prisma.Decimal.Value; entradaIds?: string[]; finalidade: FinalidadeLeite }): Promise<PlanoBaixaLeite> {
  const bases = await saldosOrigensLeiteTx(tx, input.produtoId, input.propriedadeId, input.data);
  // Leite de outras origens não pode ser consumido como se tivesse lastro V5.
  const movimentos = await tx.movimentoEstoque.findMany({ where: { produtoId: input.produtoId, propriedadeId: input.propriedadeId,
    status: { in: ["CONFIRMADO", "REVERTIDO"] }, data: { lte: input.data } }, select: { tipo: true, quantidade: true } });
  const fisico = movimentos.reduce((s, m) => s.plus(m.tipo === "SAIDA" ? m.quantidade.negated() : m.quantidade), D(0));
  if (!fisico.eq(bases.reduce((s, b) => s.plus(b.quantidade), D(0))))
    throw new ValorizacaoError("SEM_LASTRO", "O saldo de leite diverge das ordenhas confirmadas; regularize as origens antes de retirar");
  if (input.entradaIds?.some(id => !bases.some(b => b.entradaId === id)))
    throw new ValorizacaoError("VALIDACAO", "Origem de leite não pertence a este produto, sítio ou data");
  const selecionadas = input.entradaIds ? bases.filter(b => input.entradaIds!.includes(b.entradaId)) : bases;
  const elegiveis = selecionarOrigensLeite(selecionadas, input.finalidade);
  const plano = planejarBaixaLeite({ quantidade: input.quantidade, bases: elegiveis satisfies SaldoOrigemLeite[] });
  if (input.finalidade === "VENDA") await conferirCarenciaOrigensVendaTx(tx, plano.parcelas.map(p => p.entradaId));
  return { ...plano, finalidade: input.finalidade, parcelas: plano.parcelas.map(p => {
    const classificacaoId = elegiveis.find(b => b.entradaId === p.entradaId)?.classificacaoId;
    if (!classificacaoId) throw new ValorizacaoError("CONFLITO", "A origem precisa de uma classificação inicial comprovada");
    return { ...p, classificacaoId };
  }) };
}

export async function registrarBaixaLeiteTx(tx: Prisma.TransactionClient, movimentoId: string, plano: PlanoBaixaLeite) {
  await tx.alocacaoLeiteEstoque.createMany({ data: plano.parcelas.map(p => ({ entradaId: p.entradaId, movimentoId,
    quantidade: p.quantidade, valorTotal: p.valorTotal, finalidade: plano.finalidade, classificacaoId: p.classificacaoId })) });
}

export async function obterClassificacaoEntradaLeiteTx(tx: Prisma.TransactionClient, entradaId: string) {
  return tx.classificacaoEntradaLeite.findFirst({ where: { entradaId }, orderBy: { versao: "desc" } });
}

export async function classificarEntradaLeiteTx(tx: Prisma.TransactionClient, input: {
  entradaId: string; natureza: "COMERCIAL" | "COLOSTRO" | "NAO_COMERCIAL"; motivo: string; versaoEsperada?: number;
}, contexto: { propriedadeId: number; usuarioId: number | null }) {
  const origem = await tx.entradaProducaoLeite.findFirst({ where: { id: input.entradaId, status: "CONFIRMADA", movimento: { propriedadeId: contexto.propriedadeId } }, include: { movimento: true } });
  if (!origem) throw new ValorizacaoError("VALIDACAO", "Entrada confirmada não encontrada neste sítio");
  await travarValorizacaoTx(tx, [origem.movimento.produtoId]);
  const atual = await obterClassificacaoEntradaLeiteTx(tx, input.entradaId);
  if (!atual) throw new ValorizacaoError("CONFLITO", "A origem não possui classificação inicial; regularize o cadastro");
  if (input.versaoEsperada != null && input.versaoEsperada !== atual.versao)
    throw new ValorizacaoError("CONFLITO", "A natureza da entrada mudou; atualize antes de declarar");
  if (!conferirMudancaNaturezaLeite(atual.natureza, input.natureza)) return atual;
  if (input.motivo.trim().length < 5) throw new ValorizacaoError("VALIDACAO", "Explique a declaração da natureza da entrada inteira");
  await exigirPeriodoAberto(tx, contexto.propriedadeId, new Date());
  const declaracao = await tx.classificacaoEntradaLeite.create({ data: { entradaId: input.entradaId, versao: atual.versao + 1,
    natureza: input.natureza, motivo: input.motivo.trim(), criadoPorId: contexto.usuarioId != null && contexto.usuarioId > 0 ? contexto.usuarioId : null } });
  await auditar(tx, { entidade: "ClassificacaoEntradaLeite", entidadeId: declaracao.id, acao: "DECLARADA", motivo: input.motivo, usuarioId: contexto.usuarioId, antes: atual, depois: declaracao });
  return declaracao;
}

/** Adaptador comum a destinos internos: o fato chamador e a saída usam o mesmo tx. */
export async function baixarLeiteTx(tx: Prisma.TransactionClient, input: {
  produtoId: string; propriedadeId: number; data: Date; quantidade: Prisma.Decimal.Value; entradaIds?: string[];
  origem: "NUTRICAO" | "PERDA"; observacao: string; usuarioId: number | null;
}) {
  if (input.data > hojeFazendaDate()) throw new ValorizacaoError("VALIDACAO", "Não confirme consumo futuro de leite");
  await travarValorizacaoTx(tx, [input.produtoId]);
  await exigirPeriodoAberto(tx, input.propriedadeId, input.data);
  const previa = await previaRetroatividadeTx(tx, input.produtoId, input.propriedadeId, input.data);
  if (!previa.permitido) throw new ValorizacaoError("CONFLITO", previa.motivo!);
  const plano = await planejarBaixaLeiteTx(tx, { ...input, finalidade: input.origem === "PERDA" ? "DESCARTE" : "CONSUMO" });
  const movimento = await tx.movimentoEstoque.create({ data: { produtoId: input.produtoId, propriedadeId: input.propriedadeId,
    tipo: "SAIDA", origem: input.origem, data: input.data, quantidade: plano.quantidade, metodoValorizacao: METODO_LEITE,
    valorTotal: plano.valorTotal, custoUnitario: plano.valorTotal?.div(plano.quantidade).toDecimalPlaces(4) ?? null,
    criadoPorId: input.usuarioId != null && input.usuarioId > 0 ? input.usuarioId : null, observacao: input.observacao } });
  await registrarBaixaLeiteTx(tx, movimento.id, plano);
  return movimento;
}

export async function estornarBaixaLeiteTx(tx: Prisma.TransactionClient, input: {
  movimentoId: string; propriedadeId: number; usuarioId: number | null; motivo: string; data?: Date;
}) {
  const referencia = await tx.movimentoEstoque.findFirst({ where: { id: input.movimentoId, propriedadeId: input.propriedadeId }, select: { produtoId: true } });
  if (!referencia) throw new ValorizacaoError("VALIDACAO", "Saída de leite não encontrada neste sítio");
  await travarValorizacaoTx(tx, [referencia.produtoId]);
  const original = await tx.movimentoEstoque.findUniqueOrThrow({ where: { id: input.movimentoId }, include: { revertidoPor: true } });
  if (original.metodoValorizacao !== METODO_LEITE || original.tipo !== "SAIDA" || original.operacaoId != null || original.reversaoDeId)
    throw new ValorizacaoError("VALIDACAO", "Use o fato de origem para regularizar esta retirada");
  if (original.status === "REVERTIDO" || original.revertidoPor) throw new ValorizacaoError("CONFLITO", "A saída de leite já foi estornada");
  if (await tx.retiradaOperacaoLeite.findUnique({ where: { movimentoId: original.id }, select: { id: true } }))
    throw new ValorizacaoError("CONFLITO", "Retirada comercial exige devolução física comprovada pelo fluxo de leite; correção de preço não devolve litros");
  const data = input.data ?? new Date();
  await exigirPeriodoAberto(tx, input.propriedadeId, original.data);
  await exigirPeriodoAberto(tx, input.propriedadeId, data);
  const inverso = await tx.movimentoEstoque.create({ data: { produtoId: original.produtoId, propriedadeId: input.propriedadeId,
    tipo: "ENTRADA", origem: original.origem, data, quantidade: original.quantidade, custoUnitario: original.custoUnitario,
    valorTotal: original.valorTotal, metodoValorizacao: METODO_LEITE, reversaoDeId: original.id,
    criadoPorId: input.usuarioId != null && input.usuarioId > 0 ? input.usuarioId : null, observacao: input.motivo } });
  await tx.movimentoEstoque.update({ where: { id: original.id }, data: { status: "REVERTIDO" } });
  await auditar(tx, { entidade: "MovimentoEstoque", entidadeId: original.id, acao: "ESTORNADO", motivo: input.motivo, usuarioId: input.usuarioId, antes: original, depois: inverso });
  return inverso;
}

/** Valor atualmente apurado, sem reescrever custo físico/snapshot confirmado. */
export async function valoresMovimentosLeiteTx(tx: Prisma.TransactionClient, ids: string[]) {
  const resultado = new Map<string, { valorTotal: Prisma.Decimal | null; custoUnitario: Prisma.Decimal | null }>();
  if (!ids.length) return resultado;
  const movimentos = await tx.movimentoEstoque.findMany({ where: { id: { in: ids }, metodoValorizacao: METODO_LEITE },
    include: { entradaProducaoLeite: { include: { apuracoes: { orderBy: { versao: "desc" }, take: 1 } } },
      alocacoesLeite: { include: { entrada: { include: { apuracoes: { orderBy: { versao: "desc" }, include: { apropriacoes: true } } } } } } } });
  const inversos = movimentos.filter(m => m.reversaoDeId);
  const valoresOriginais = inversos.length ? await valoresMovimentosLeiteTx(tx, inversos.map(m => m.reversaoDeId!)) : new Map<string, { valorTotal: Prisma.Decimal | null; custoUnitario: Prisma.Decimal | null }>();
  for (const m of movimentos) {
    if (m.reversaoDeId) { resultado.set(m.id, valoresOriginais.get(m.reversaoDeId) ?? { valorTotal: null, custoUnitario: null }); continue; }
    const parcelas = m.alocacoesLeite.map(a => a.entrada.apuracoes.flatMap(ap => ap.apropriacoes).find(p => p.alocacaoId === a.id)?.valorTotal ?? a.valorTotal);
    const valorTotal = m.entradaProducaoLeite ? m.entradaProducaoLeite.apuracoes[0]?.valorTotal ?? null
      : parcelas.length && parcelas.every(p => p != null) ? parcelas.reduce<Prisma.Decimal>((v, p) => v.plus(p!), D(0)) : null;
    resultado.set(m.id, { valorTotal, custoUnitario: valorTotal == null ? null : valorTotal.div(m.quantidade).toDecimalPlaces(4) });
  }
  return resultado;
}
