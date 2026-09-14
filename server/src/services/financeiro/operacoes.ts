import { Prisma, type DirecaoMovimentoConta, type TipoCompromisso, type TipoTransacaoFinanceira } from "@prisma/client";
import { prisma } from "../../db.js";
import { auditar, dinheiro, exigirContaAtiva, exigirParceiroAtivo, exigirPeriodoAberto, exigirPositivo, FinanceiroError } from "./regras.js";
import type { z } from "zod";
import type { liquidacaoSchema, operacaoSchema, transacaoAvulsaSchema, transferenciaSchema } from "./schemas.js";

type OperacaoInput = z.infer<typeof operacaoSchema> & { propriedadeId: number; usuarioId?: number | null };
type LiquidacaoInput = z.infer<typeof liquidacaoSchema> & { usuarioId?: number | null };
type TransferenciaInput = z.infer<typeof transferenciaSchema> & { propriedadeId: number; usuarioId?: number | null };
type TransacaoAvulsaInput = z.infer<typeof transacaoAvulsaSchema> & { propriedadeId: number; usuarioId?: number | null };

const incluiEstoque = new Set(["COMPRA_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "PRODUCAO"]);
const retiraEstoque = new Set(["VENDA", "DEVOLUCAO"]);
const documentoPublico = { id: true, tipo: true, nome: true, numero: true, mimeType: true, tamanhoBytes: true, createdAt: true } as const;

function tipoCompromisso(tipoOperacao: string): TipoCompromisso {
  return tipoOperacao === "VENDA" || tipoOperacao === "DEVOLUCAO" ? "RECEBER" : "PAGAR";
}

function tipoTransacao(tipoOperacao: string): TipoTransacaoFinanceira {
  if (tipoOperacao === "VENDA" || tipoOperacao === "DEVOLUCAO") return "RECEBIMENTO";
  if (tipoOperacao === "APORTE") return "APORTE";
  if (tipoOperacao === "RETIRADA") return "RETIRADA";
  return "PAGAMENTO";
}

function direcaoTransacao(tipo: TipoTransacaoFinanceira): DirecaoMovimentoConta {
  return tipo === "RECEBIMENTO" || tipo === "APORTE" ? "ENTRADA" : "SAIDA";
}

async function criarTransacaoComMovimento(
  tx: Prisma.TransactionClient,
  input: {
    tipo: TipoTransacaoFinanceira; data: Date; valor: Prisma.Decimal.Value; descricao?: string; operacaoId?: number;
    parceiroId?: number; propriedadeId: number; contaId: number; formaPagamento?: z.infer<typeof transacaoAvulsaSchema>["formaPagamento"];
    usuarioId?: number | null;
  },
) {
  const valor = exigirPositivo(input.valor);
  await exigirPeriodoAberto(tx, input.propriedadeId, input.data);
  await exigirContaAtiva(tx, input.contaId, input.propriedadeId);
  return tx.transacaoFinanceira.create({
    data: {
      tipo: input.tipo,
      data: input.data,
      valorTotal: valor,
      descricao: input.descricao,
      operacaoId: input.operacaoId,
      parceiroId: input.parceiroId,
      propriedadeId: input.propriedadeId,
      criadoPorId: input.usuarioId && input.usuarioId > 0 ? input.usuarioId : null,
      formaPagamento: input.formaPagamento,
      movimentos: { create: { contaId: input.contaId, direcao: direcaoTransacao(input.tipo), valor } },
    },
    include: { movimentos: true },
  });
}

async function criarOperacaoTx(tx: Prisma.TransactionClient, input: OperacaoInput) {
    await exigirPeriodoAberto(tx, input.propriedadeId, input.data);
    if (input.parceiroId) await exigirParceiroAtivo(tx, input.parceiroId, input.tipo);
    if (input.corrigeOperacaoId) {
      const original = await tx.operacao.findFirst({ where: { id: input.corrigeOperacaoId, propriedadeId: input.propriedadeId } });
      if (!original) throw new FinanceiroError("NAO_ENCONTRADO", "Operação original da correção não encontrada");
      if (original.status !== "CANCELADA") throw new FinanceiroError("CONFLITO", "Somente uma operação cancelada pode receber uma correção");
    }
    const produtosIds = input.itens.flatMap((item) => item.produtoId ? [item.produtoId] : []);
    const produtos = produtosIds.length
      ? await tx.produto.findMany({ where: { id: { in: produtosIds }, ativo: true } })
      : [];
    const produtosPorId = new Map(produtos.map((produto) => [produto.id, produto]));
    const temEfeitoEstoque = incluiEstoque.has(input.tipo) || retiraEstoque.has(input.tipo) || input.tipo === "AJUSTE_ESTOQUE";
    if (temEfeitoEstoque) {
      for (const item of input.itens.filter((item) => item.estocavel)) {
        if (!item.produtoId || !produtosPorId.has(item.produtoId)) {
          throw new FinanceiroError("VALIDACAO", `O item estocável “${item.descricao}” precisa apontar para um produto ativo`);
        }
      }
    }

    const classificar = async (categoriaId: number | null | undefined, classificacao?: "CUSTEIO" | "INVESTIMENTO" | null) => {
      const categoria = categoriaId ? await tx.categoria.findFirst({ where: { id: categoriaId, ativo: true } }) : null;
      if (categoriaId && !categoria) throw new FinanceiroError("VALIDACAO", "Selecione uma categoria ativa", "categoriaId");
      return { categoriaId: categoria?.id ?? null, categoriaNome: categoria?.nome ?? null, classificacao: classificacao === undefined ? categoria?.classificacao ?? null : classificacao };
    };
    const itens = await Promise.all(input.itens.map(async (item) => ({
      produtoId: item.produtoId,
      descricao: item.descricao,
      quantidade: new Prisma.Decimal(item.quantidade),
      unidade: item.unidade,
      valorUnitario: new Prisma.Decimal(item.valorUnitario),
      valorTotal: dinheiro(new Prisma.Decimal(item.quantidade).mul(item.valorUnitario)),
      estocavel: item.estocavel,
      ...await classificar(item.categoriaId === undefined ? produtosPorId.get(item.produtoId ?? 0)?.categoriaId : item.categoriaId, item.classificacao),
    })));
    const classificacaoOperacao = await classificar(itens.length ? null : input.categoriaId, input.classificacao);
    const totalItens = dinheiro(itens.reduce((soma, item) => soma.plus(item.valorTotal), new Prisma.Decimal(0)));
    const valorTotal = input.valorTotal === undefined ? totalItens : dinheiro(input.valorTotal);
    if (itens.length > 0 && input.valorTotal !== undefined && !totalItens.equals(valorTotal)) {
      throw new FinanceiroError("VALIDACAO", "O valor total informado deve corresponder à soma dos itens");
    }
    if (valorTotal.isNegative()) throw new FinanceiroError("VALIDACAO", "O valor total da operação não pode ser negativo");

    if (input.centroCustoId) {
      const centro = await tx.centroCusto.findFirst({ where: { id: input.centroCustoId, ativo: true } });
      if (!centro) throw new FinanceiroError("VALIDACAO", "Selecione um centro de custo ativo", "centroCustoId");
    }

    if (input.financeiro.condicao === "PARCIAL") {
      const futuro = input.financeiro.parcelas.reduce((soma, parcela) => soma.plus(parcela.valor), new Prisma.Decimal(0));
      if (!dinheiro(futuro.plus(input.financeiro.valorPago)).equals(valorTotal)) {
        throw new FinanceiroError("VALIDACAO", "O valor pago somado às parcelas deve ser igual ao total da operação");
      }
    }
    if (input.financeiro.condicao === "A_PRAZO") {
      const futuro = input.financeiro.parcelas.reduce((soma, parcela) => soma.plus(parcela.valor), new Prisma.Decimal(0));
      if (!dinheiro(futuro).equals(valorTotal)) throw new FinanceiroError("VALIDACAO", "A soma das parcelas deve ser igual ao total da operação");
    }

    const operacao = await tx.operacao.create({
      data: {
        tipo: input.tipo,
        status: "CONFIRMADA",
        data: input.data,
        descricao: input.descricao,
        valorTotal,
        propriedadeId: input.propriedadeId,
        parceiroId: input.parceiroId,
        ...classificacaoOperacao,
        centroCustoId: input.centroCustoId,
        corrigeOperacaoId: input.corrigeOperacaoId,
        criadoPorId: input.usuarioId && input.usuarioId > 0 ? input.usuarioId : null,
        itens: { create: itens },
      },
      include: { itens: true },
    });

    if (temEfeitoEstoque) {
      const tipoMovimento = retiraEstoque.has(input.tipo) ? "SAIDA" : input.tipo === "AJUSTE_ESTOQUE" ? "AJUSTE" : "ENTRADA";
      const origem = input.tipo === "COMPRA_ESTOQUE" ? "COMPRA" : input.tipo === "INVENTARIO_INICIAL" ? "INVENTARIO_INICIAL"
        : input.tipo === "BONIFICACAO" ? "BONIFICACAO" : input.tipo === "PRODUCAO" ? "PRODUCAO"
          : input.tipo === "DEVOLUCAO" ? "DEVOLUCAO" : "AJUSTE_INVENTARIO";
      for (const item of operacao.itens.filter((item) => item.estocavel && item.produtoId)) {
        await tx.movimentoEstoque.create({ data: {
          produtoId: item.produtoId!, tipo: tipoMovimento, origem, data: input.data, quantidade: item.quantidade,
          custoUnitario: item.valorUnitario, valorTotal: item.valorTotal, operacaoId: operacao.id, itemOperacaoId: item.id,
          propriedadeId: input.propriedadeId, criadoPorId: input.usuarioId && input.usuarioId > 0 ? input.usuarioId : null,
          observacao: input.descricao,
        } });
      }
    }

    const parcelas = input.financeiro.condicao === "A_PRAZO" || input.financeiro.condicao === "PARCIAL"
      ? input.financeiro.parcelas : [];
    for (const [indice, parcela] of parcelas.entries()) {
      await tx.compromissoFinanceiro.create({ data: {
        operacaoId: operacao.id, tipo: tipoCompromisso(input.tipo), valorOriginal: dinheiro(parcela.valor),
        dataVencimento: parcela.dataVencimento, numeroParcela: indice + 1, totalParcelas: parcelas.length,
        parceiroId: input.parceiroId,
      } });
    }

    if (input.financeiro.condicao === "A_VISTA" || input.financeiro.condicao === "PARCIAL") {
      const valor = input.financeiro.condicao === "A_VISTA" ? valorTotal : dinheiro(input.financeiro.valorPago);
      await criarTransacaoComMovimento(tx, {
        tipo: tipoTransacao(input.tipo), data: input.data, valor, descricao: input.descricao, operacaoId: operacao.id,
        parceiroId: input.parceiroId, propriedadeId: input.propriedadeId, contaId: input.financeiro.contaId,
        formaPagamento: input.financeiro.formaPagamento, usuarioId: input.usuarioId,
      });
    }

    await auditar(tx, { entidade: "Operacao", entidadeId: operacao.id, acao: "CONFIRMADA", usuarioId: input.usuarioId, depois: operacao });
    return tx.operacao.findUniqueOrThrow({
      where: { id: operacao.id },
      include: { itens: true, compromissos: true, transacoes: { include: { movimentos: true } }, movimentosEstoque: true, documentos: { select: documentoPublico }, parceiro: true },
    });
}

export function confirmarRascunhoOperacao(tx: Prisma.TransactionClient, input: OperacaoInput) {
  return criarOperacaoTx(tx, input);
}

export async function criarOperacao(input: OperacaoInput) {
  return prisma.$transaction((tx) => criarOperacaoTx(tx, input));
}

export async function liquidarCompromisso(compromissoId: number, input: LiquidacaoInput) {
  return prisma.$transaction(async (tx) => {
    const compromisso = await tx.compromissoFinanceiro.findUnique({
      where: { id: compromissoId }, include: { operacao: true, liquidacoes: { include: { transacao: true } } },
    });
    if (!compromisso) throw new FinanceiroError("NAO_ENCONTRADO", "Compromisso não encontrado");
    if (compromisso.status === "CANCELADO" || compromisso.status === "LIQUIDADO") throw new FinanceiroError("CONFLITO", "Este compromisso não aceita nova liquidação");
    const liquidado = compromisso.liquidacoes
      .filter((item) => item.transacao.status === "CONFIRMADA")
      .reduce((soma, item) => soma.plus(item.valor), new Prisma.Decimal(0));
    const restante = compromisso.valorOriginal.minus(liquidado);
    const valor = exigirPositivo(input.valor);
    if (valor.greaterThan(restante)) throw new FinanceiroError("VALIDACAO", `A liquidação excede o saldo restante de R$ ${restante.toFixed(2)}`);
    const tipo = compromisso.tipo === "PAGAR" ? "PAGAMENTO" : "RECEBIMENTO";
    const transacao = await criarTransacaoComMovimento(tx, {
      tipo, data: input.data, valor, descricao: input.descricao ?? `Liquidação do compromisso #${compromisso.id}`,
      operacaoId: compromisso.operacaoId, parceiroId: compromisso.parceiroId ?? undefined,
      propriedadeId: compromisso.operacao.propriedadeId, contaId: input.contaId,
      formaPagamento: input.formaPagamento, usuarioId: input.usuarioId,
    });
    await tx.liquidacao.create({ data: { compromissoId, transacaoId: transacao.id, valor } });
    const novoRestante = restante.minus(valor);
    await tx.compromissoFinanceiro.update({ where: { id: compromissoId }, data: { status: novoRestante.isZero() ? "LIQUIDADO" : "PARCIAL" } });
    await auditar(tx, { entidade: "CompromissoFinanceiro", entidadeId: compromissoId, acao: "LIQUIDADO", usuarioId: input.usuarioId, depois: { transacaoId: transacao.id, valor } });
    return transacao;
  });
}

export async function transferir(input: TransferenciaInput) {
  if (input.contaOrigemId === input.contaDestinoId) throw new FinanceiroError("VALIDACAO", "As contas de origem e destino devem ser diferentes");
  return prisma.$transaction(async (tx) => {
    await exigirPeriodoAberto(tx, input.propriedadeId, input.data);
    await exigirContaAtiva(tx, input.contaOrigemId, input.propriedadeId);
    await exigirContaAtiva(tx, input.contaDestinoId, input.propriedadeId);
    const valor = exigirPositivo(input.valor);
    const operacao = await tx.operacao.create({ data: {
      tipo: "TRANSFERENCIA_FINANCEIRA", status: "CONFIRMADA", data: input.data, valorTotal: valor,
      descricao: input.descricao ?? "Transferência entre contas", propriedadeId: input.propriedadeId,
      criadoPorId: input.usuarioId && input.usuarioId > 0 ? input.usuarioId : null,
    } });
    const transacao = await tx.transacaoFinanceira.create({ data: {
      tipo: "TRANSFERENCIA", data: input.data, valorTotal: valor, descricao: operacao.descricao,
      propriedadeId: input.propriedadeId, operacaoId: operacao.id,
      criadoPorId: input.usuarioId && input.usuarioId > 0 ? input.usuarioId : null,
      movimentos: { create: [
        { contaId: input.contaOrigemId, direcao: "SAIDA", valor },
        { contaId: input.contaDestinoId, direcao: "ENTRADA", valor },
      ] },
    }, include: { movimentos: true } });
    await auditar(tx, { entidade: "TransacaoFinanceira", entidadeId: transacao.id, acao: "TRANSFERENCIA_CONFIRMADA", usuarioId: input.usuarioId, depois: transacao });
    return transacao;
  });
}

export async function criarTransacaoAvulsa(input: TransacaoAvulsaInput) {
  return prisma.$transaction(async (tx) => {
    if (input.parceiroId) await exigirParceiroAtivo(tx, input.parceiroId);
    const transacao = await criarTransacaoComMovimento(tx, input);
    await auditar(tx, { entidade: "TransacaoFinanceira", entidadeId: transacao.id, acao: "CONFIRMADA", usuarioId: input.usuarioId, depois: transacao });
    return transacao;
  });
}

async function estornarTransacaoTx(tx: Prisma.TransactionClient, id: number, motivo: string, usuarioId?: number | null) {
    const original = await tx.transacaoFinanceira.findUnique({ where: { id }, include: { movimentos: true, liquidacoes: true, revertidaPor: true } });
    if (!original) throw new FinanceiroError("NAO_ENCONTRADO", "Transação não encontrada");
    if (original.status === "REVERTIDA" || original.revertidaPor) throw new FinanceiroError("JA_REVERTIDO", "A transação já foi estornada");
    await exigirPeriodoAberto(tx, original.propriedadeId, new Date());
    const estorno = await tx.transacaoFinanceira.create({ data: {
      tipo: "REVERSAO", data: new Date(), valorTotal: original.valorTotal, descricao: `Estorno #${id}: ${motivo}`,
      propriedadeId: original.propriedadeId, operacaoId: original.operacaoId, parceiroId: original.parceiroId,
      criadoPorId: usuarioId && usuarioId > 0 ? usuarioId : null, reversaoDeId: original.id,
      movimentos: { create: original.movimentos.map((movimento) => ({
        contaId: movimento.contaId, direcao: movimento.direcao === "ENTRADA" ? "SAIDA" : "ENTRADA", valor: movimento.valor,
      })) },
    }, include: { movimentos: true } });
    await tx.transacaoFinanceira.update({ where: { id }, data: { status: "REVERTIDA" } });
    for (const liquidacao of original.liquidacoes) await tx.liquidacao.delete({ where: { id: liquidacao.id } });
    const compromissoIds = [...new Set(original.liquidacoes.map((item) => item.compromissoId))];
    for (const compromissoId of compromissoIds) {
      const compromisso = await tx.compromissoFinanceiro.findUniqueOrThrow({ where: { id: compromissoId }, include: { liquidacoes: { include: { transacao: true } } } });
      const pago = compromisso.liquidacoes.filter((item) => item.transacao.status === "CONFIRMADA").reduce((soma, item) => soma.plus(item.valor), new Prisma.Decimal(0));
      await tx.compromissoFinanceiro.update({ where: { id: compromissoId }, data: { status: pago.isZero() ? "PENDENTE" : pago.lessThan(compromisso.valorOriginal) ? "PARCIAL" : "LIQUIDADO" } });
    }
    await auditar(tx, { entidade: "TransacaoFinanceira", entidadeId: id, acao: "ESTORNADA", motivo, usuarioId, antes: original, depois: estorno });
    return estorno;
}

export async function estornarTransacao(id: number, motivo: string, usuarioId?: number | null) {
  return prisma.$transaction((tx) => estornarTransacaoTx(tx, id, motivo, usuarioId));
}

export async function estornarOperacao(id: number, motivo: string, usuarioId?: number | null) {
  return prisma.$transaction(async (tx) => {
    const operacao = await tx.operacao.findUnique({
      where: { id },
      include: { transacoes: true, compromissos: { include: { liquidacoes: true } }, movimentosEstoque: { include: { revertidoPor: true } } },
    });
    if (!operacao) throw new FinanceiroError("NAO_ENCONTRADO", "Operação não encontrada");
    if (operacao.status === "CANCELADA") throw new FinanceiroError("JA_REVERTIDO", "A operação já foi cancelada");
    await exigirPeriodoAberto(tx, operacao.propriedadeId, new Date());

    for (const transacao of operacao.transacoes.filter((item) => item.status === "CONFIRMADA" && item.tipo !== "REVERSAO")) {
      await estornarTransacaoTx(tx, transacao.id, `Cancelamento da operação #${id}: ${motivo}`, usuarioId);
    }
    for (const movimento of operacao.movimentosEstoque.filter((item) => item.status === "CONFIRMADO" && !item.reversaoDeId && !item.revertidoPor)) {
      await tx.movimentoEstoque.create({ data: {
        produtoId: movimento.produtoId,
        tipo: movimento.tipo === "ENTRADA" ? "SAIDA" : movimento.tipo === "SAIDA" ? "ENTRADA" : "AJUSTE",
        origem: "AJUSTE_INVENTARIO", data: new Date(),
        quantidade: movimento.tipo === "AJUSTE" ? movimento.quantidade.negated() : movimento.quantidade,
        custoUnitario: movimento.custoUnitario, valorTotal: movimento.valorTotal,
        propriedadeId: movimento.propriedadeId, operacaoId: operacao.id,
        reversaoDeId: movimento.id, observacao: `Cancelamento da operação #${id}: ${motivo}`,
      } });
      await tx.movimentoEstoque.update({ where: { id: movimento.id }, data: { status: "REVERTIDO" } });
    }
    await tx.compromissoFinanceiro.updateMany({ where: { operacaoId: id, status: { not: "CANCELADO" } }, data: { status: "CANCELADO" } });
    const cancelada = await tx.operacao.update({ where: { id }, data: { status: "CANCELADA" } });
    await auditar(tx, { entidade: "Operacao", entidadeId: id, acao: "CANCELADA", motivo, usuarioId, antes: operacao, depois: cancelada });
    return cancelada;
  });
}

const includeOperacao = { parceiro: true, itens: true, compromissos: { include: { liquidacoes: { include: { transacao: true } } } }, transacoes: { include: { movimentos: true } }, movimentosEstoque: true, documentos: { select: documentoPublico }, corrigeOperacao: { select: { id: true, descricao: true } }, correcoes: { select: { id: true, descricao: true, status: true } } } as const;

export async function obterOperacao(id: number, propriedadeId?: number | null) {
  const operacao = await prisma.operacao.findFirst({ where: { id, ...(propriedadeId ? { propriedadeId } : {}) }, include: includeOperacao });
  if (!operacao) throw new FinanceiroError("NAO_ENCONTRADO", "Operação não encontrada");
  return operacao;
}

export async function listarOperacoes(propriedadeId?: number | null, inicio?: Date, fim?: Date) {
  return prisma.operacao.findMany({
    where: { ...(propriedadeId ? { propriedadeId } : {}), ...(inicio || fim ? { data: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lte: fim } : {}) } } : {}) },
    include: includeOperacao,
    orderBy: [{ data: "desc" }, { id: "desc" }],
  });
}

export async function listarCompromissos(propriedadeId?: number | null) {
  const compromissos = await prisma.compromissoFinanceiro.findMany({
    where: propriedadeId ? { operacao: { propriedadeId } } : {}, include: { parceiro: true, operacao: true, liquidacoes: { include: { transacao: true } } },
    orderBy: [{ dataVencimento: "asc" }, { id: "asc" }],
  });
  return compromissos.map((compromisso) => {
    const valorLiquidado = compromisso.liquidacoes.filter((item) => item.transacao.status === "CONFIRMADA").reduce((soma, item) => soma.plus(item.valor), new Prisma.Decimal(0));
    return { ...compromisso, valorLiquidado, saldoPendente: compromisso.valorOriginal.minus(valorLiquidado), vencido: compromisso.status !== "LIQUIDADO" && compromisso.status !== "CANCELADO" && compromisso.dataVencimento < new Date() };
  });
}
