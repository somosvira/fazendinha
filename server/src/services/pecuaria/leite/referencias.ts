import type { FornecimentoNutricionalLeite } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { exigirPeriodoAberto } from "../../financeiro/regras.js";
import { auditar, RebanhoError } from "../rebanho/regras.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { transacaoPecuaria } from "../transacao.js";
import { valorGerencialLeite } from "./nutricao.calc.js";

function limitesReferencia(data: Date, anterior: boolean) {
  const inicio = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() - Number(anterior), 1));
  return { inicio, fim: new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth()+1, 0)) };
}
export async function candidatosReferenciaTx(tx: Prisma.TransactionClient, f: Pick<FornecimentoNutricionalLeite,"data"|"propriedadeId">, anterior: boolean) {
  const mes = limitesReferencia(f.data, anterior);
  const fechamentos = await tx.fechamentoOperacaoLeite.findMany({ where: { comercial: { propriedadeId: f.propriedadeId, inicio: { gte: mes.inicio }, fim: { lte: mes.fim } }, operacao: { status: "CONFIRMADA" } },
    include: { comercial: { include: { parceiro: { select: { nome: true } }, fechamentos: { orderBy: { versao: "desc" }, take: 1, select: { id: true } } } } }, orderBy: [{ criadoEm: "desc" }, { id: "asc" }] });
  return fechamentos.filter(r => r.comercial.fechamentos[0]?.id === r.id);
}
async function gravarReferenciaTx(tx: Prisma.TransactionClient, f: FornecimentoNutricionalLeite, fechamento: Awaited<ReturnType<typeof candidatosReferenciaTx>>[number], provisoria: boolean, motivo: string, usuarioId: number | null) {
  await exigirPeriodoAberto(tx, f.propriedadeId, f.data);
  const anterior = await tx.referenciaGerencialLeite.findFirst({ where: { fornecimentoId: f.id }, orderBy: { versao: "desc" } });
  if (anterior?.fechamentoId === fechamento.id) return anterior;
  if (await tx.referenciaGerencialLeite.findFirst({ where: { fornecimentoId: f.id, fechamentoId: fechamento.id } })) throw new RebanhoError("CONFLITO", "Esta referência já integra o histórico; selecione o fechamento vigente");
  if (anterior && !anterior.provisoria && provisoria) throw new RebanhoError("CONFLITO", "Uma referência do período não pode voltar ao preço provisório do mês anterior");
  const depois = await tx.referenciaGerencialLeite.create({ data: { fornecimentoId: f.id, fechamentoId: fechamento.id, versao: (anterior?.versao ?? 0)+1,
    periodoInicio: fechamento.comercial.inicio, periodoFim: fechamento.comercial.fim, parceiroId: fechamento.comercial.parceiroId,
    precoUnitario: fechamento.precoUnitario, valorTotal: valorGerencialLeite(f.quantidadeLitros, fechamento.precoUnitario), provisoria, motivo, criadoPorId: usuarioId } });
  await auditar(tx, { entidade: "ReferenciaGerencialLeite", entidadeId: depois.id, propriedadeId: f.propriedadeId, usuarioId,
    acao: anterior ? "REVISAO_REFERENCIA" : "REFERENCIA_INICIAL", antes: anterior, depois });
  return depois;
}
/** A leitura nunca grava. Na confirmação física, uma única fonte anterior comprovada pode originar snapshot provisório. */
export async function aplicarReferenciaProvisoriaTx(tx: Prisma.TransactionClient, f: FornecimentoNutricionalLeite, usuarioId: number | null) {
  usuarioId = usuarioId != null && usuarioId > 0 ? usuarioId : null;
  const candidatos = await candidatosReferenciaTx(tx, f, true);
  if (candidatos.length === 1) await gravarReferenciaTx(tx, f, candidatos[0], true, "Referência provisória do mês anterior na confirmação da dieta", usuarioId);
}
export async function listarReferenciasDisponiveis(fornecimentoId: string, propriedadeId: number) {
  return prisma.$transaction(async tx => {
    const f = await tx.fornecimentoNutricionalLeite.findFirst({ where: { id: fornecimentoId, propriedadeId } });
    if (!f) throw new RebanhoError("NAO_ENCONTRADO", "Fornecimento não encontrado neste sítio");
    const anteriores = await candidatosReferenciaTx(tx, f, true), atuais = await candidatosReferenciaTx(tx, f, false);
    return { itens: [...atuais.map(r => ({ r, provisoria: false })), ...anteriores.map(r => ({ r, provisoria: true }))].map(({r, provisoria}) => ({ fechamentoId: r.id, versao: r.versao,
      comprador: r.comercial.parceiro.nome, periodoInicio: r.comercial.inicio.toISOString().slice(0,10), periodoFim: r.comercial.fim.toISOString().slice(0,10), precoUnitario: r.precoUnitario.toFixed(4), provisoria })) };
  });
}
export async function revisarReferenciaLeite(fornecimentoId: string, input: { chave: string; propriedadeId: number; fechamentoId: string; versaoEsperada: number; motivo: string }, usuarioId: number | null) {
  usuarioId = usuarioId != null && usuarioId > 0 ? usuarioId : null;
  return transacaoPecuaria(async tx => operacaoIdempotenteTx(tx, { ...input, fornecimentoId }, usuarioId, "REFERENCIA_GERENCIAL_LEITE", async () => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-fornecimento-leite:${fornecimentoId}`}))`;
    const f = await tx.fornecimentoNutricionalLeite.findFirst({ where: { id: fornecimentoId, propriedadeId: input.propriedadeId } });
    if (!f) throw new RebanhoError("NAO_ENCONTRADO", "Fornecimento não encontrado neste sítio");
    if (f.status !== "CONFIRMADO") throw new RebanhoError("CONFLITO", "Fornecimento estornado não pode receber referência");
    const atual = await tx.referenciaGerencialLeite.findFirst({ where: { fornecimentoId }, orderBy: { versao: "desc" } });
    if ((atual?.versao ?? 0) !== input.versaoEsperada) throw new RebanhoError("CONFLITO", "A referência mudou; confira a versão atual");
    await exigirPeriodoAberto(tx, f.propriedadeId, f.data);
    await exigirPeriodoAberto(tx, f.propriedadeId, new Date());
    const atuais = await candidatosReferenciaTx(tx, f, false), anteriores = await candidatosReferenciaTx(tx, f, true);
    const escolhido = [...atuais, ...anteriores].find(r => r.id === input.fechamentoId);
    if (!escolhido) throw new RebanhoError("VALIDACAO", "Escolha um fechamento vigente deste sítio, do mês do consumo ou do mês anterior");
    const provisoria = !atuais.some(r => r.id === escolhido.id);
    const r = await gravarReferenciaTx(tx, f, escolhido, provisoria, input.motivo, usuarioId);
    return { id: r.id, versao: r.versao, fechamentoId: r.fechamentoId, precoUnitario: r.precoUnitario.toFixed(4), valorTotal: r.valorTotal.toFixed(2), provisoria: r.provisoria };
  }));
}
