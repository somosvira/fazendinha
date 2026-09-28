import { Prisma, type TipoOperacaoFinanceira, type TipoTransacaoFinanceira } from "@prisma/client";
import { prisma } from "../../db.js";
import { auditar, exigirContaAtiva, exigirParceiroAtivo, exigirPeriodoAberto, exigirPositivo, FinanceiroError } from "./regras.js";
import { comoErroFinanceiro, simularParcelas as simularParcelasCalc } from "./parcelas.calc.js";
import { direcaoTransacao, preverEfeitosOperacao, temParcelas, type ContextoOperacao } from "@rionovo/shared";
import { obterBasesCusto, produtosComEstoque } from "../estoque/estoque.js";
import type { BaseCusto } from "../estoque/estoque.calc.js";
import { rotuloUnidade } from "../estoque/unidades.js";
import type { z } from "zod";
import type { liquidacaoSchema, operacaoSchema, simulacaoParcelasSchema, transacaoAvulsaSchema, transferenciaSchema } from "./schemas.js";

type OperacaoInput = z.infer<typeof operacaoSchema> & { propriedadeId: number; usuarioId?: number | null };
type LiquidacaoInput = z.infer<typeof liquidacaoSchema> & { usuarioId?: number | null };
type TransferenciaInput = z.infer<typeof transferenciaSchema> & { propriedadeId: number; usuarioId?: number | null };
type TransacaoAvulsaInput = z.infer<typeof transacaoAvulsaSchema> & { propriedadeId: number; usuarioId?: number | null };
type ContextoEstorno = { propriedadeId: number; usuarioId?: number | null };
type SimulacaoParcelasInput = z.infer<typeof simulacaoParcelasSchema>;

// Prefixo padronizado da descrição do estorno gerado por um cancelamento de
// operação — usado tanto para criar a descrição quanto (no client) para
// detectar que uma reversão no extrato veio de um cancelamento e linkar de volta.
export const PREFIXO_CANCELAMENTO_OPERACAO = "Cancelamento da operação #";

const documentoPublico = { id: true, tipo: true, nome: true, numero: true, mimeType: true, tamanhoBytes: true, createdAt: true } as const;

async function criarTransacaoComMovimento(
  tx: Prisma.TransactionClient,
  input: {
    id?: string; tipo: TipoTransacaoFinanceira; data: Date; valor: Prisma.Decimal.Value; descricao?: string; operacaoId?: string;
    parceiroId?: string; propriedadeId: number; contaId: string; formaPagamento?: z.infer<typeof transacaoAvulsaSchema>["formaPagamento"];
    usuarioId?: number | null;
  },
) {
  const valor = exigirPositivo(input.valor);
  await exigirPeriodoAberto(tx, input.propriedadeId, input.data);
  await exigirContaAtiva(tx, input.contaId, input.propriedadeId);
  return tx.transacaoFinanceira.create({
    data: {
      id: input.id,
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

const includeOperacaoCriada = {
  itens: true, compromissos: true, transacoes: { include: { movimentos: true } }, movimentosEstoque: true,
  documentos: { select: documentoPublico }, parceiro: true,
} satisfies Prisma.OperacaoInclude;

/** Reenvio com um id que outra requisição acabou de gravar: devolve o registro já criado. */
async function comIdDoCliente<T>(id: string | undefined, criar: () => Promise<T>, existente: () => Promise<T | null>): Promise<T> {
  try {
    return await criar();
  } catch (erro) {
    if (!id) throw erro;
    const registro = await existente();
    if (registro) return registro;
    throw erro;
  }
}

async function operacaoExistente(db: Prisma.TransactionClient, id: string | undefined, propriedadeId: number, tipo: TipoOperacaoFinanceira) {
  if (!id) return false;
  const operacao = await db.operacao.findUnique({ where: { id }, select: { propriedadeId: true, tipo: true } });
  if (!operacao) return false;
  if (operacao.propriedadeId !== propriedadeId || operacao.tipo !== tipo) {
    throw new FinanceiroError("CONFLITO", "Este identificador já pertence a outra operação");
  }
  return true;
}

async function operacaoCriadaExistente(db: Prisma.TransactionClient, input: OperacaoInput) {
  if (!await operacaoExistente(db, input.id, input.propriedadeId, input.tipo)) return null;
  return db.operacao.findUniqueOrThrow({ where: { id: input.id }, include: includeOperacaoCriada });
}

/** O que a previsão dos efeitos precisa ler do banco: só registros ativos. */
async function carregarContextoOperacao(tx: Prisma.TransactionClient, input: OperacaoInput): Promise<ContextoOperacao> {
  const produtosIds = [...new Set(input.itens.flatMap((item) => item.produtoId ? [item.produtoId] : []))];
  const produtos = produtosIds.length
    ? await tx.produto.findMany({ where: { id: { in: produtosIds }, ativo: true }, include: { centrosCusto: { select: { centroCustoId: true } } } })
    : [];
  const retira = input.tipo === "VENDA" || input.tipo === "DEVOLUCAO";
  const comEstoque = retira ? [...await produtosComEstoque(tx, produtosIds, input.propriedadeId)] : [];
  const basesCusto = comEstoque.length ? await obterBasesCusto(tx, comEstoque, input.propriedadeId) : new Map<string, BaseCusto>();
  const idsCentros = [input.centroCustoId, ...input.itens.map((item) => item.centroCustoId), ...produtos.flatMap((produto) => produto.centrosCusto.map((c) => c.centroCustoId))];
  const idsCategorias = [input.categoriaId, ...input.itens.map((item) => item.categoriaId), ...produtos.map((produto) => produto.categoriaId)];
  const unicos = (ids: (string | null | undefined)[]) => [...new Set(ids.flatMap((id) => id ? [id] : []))];
  const [centrosCusto, categorias] = await Promise.all([
    unicos(idsCentros).length ? tx.centroCusto.findMany({ where: { id: { in: unicos(idsCentros) }, ativo: true }, select: { id: true, nome: true } }) : [],
    unicos(idsCategorias).length ? tx.categoria.findMany({ where: { id: { in: unicos(idsCategorias) }, ativo: true }, select: { id: true, nome: true, classificacao: true } }) : [],
  ]);
  return {
    produtos: produtos.map((produto) => ({ id: produto.id, categoriaId: produto.categoriaId, centrosCustoIds: produto.centrosCusto.map((c) => c.centroCustoId) })),
    categorias,
    centrosCusto,
    produtosComEstoque: comEstoque,
    basesCusto: [...basesCusto].map(([produtoId, base]) => ({ produtoId, quantidade: base.quantidade.toString(), valor: base.valor.toString() })),
  };
}

async function criarOperacaoTx(tx: Prisma.TransactionClient, input: OperacaoInput) {
    const existente = await operacaoCriadaExistente(tx, input);
    if (existente) return existente;
    const parcelasInformadas = temParcelas(input.financeiro) ? input.financeiro.parcelas : [];
    const idsParcelas = parcelasInformadas.flatMap((parcela) => parcela.id ? [parcela.id] : []);
    if (idsParcelas.length && await tx.compromissoFinanceiro.count({ where: { id: { in: idsParcelas } } })) {
      throw new FinanceiroError("CONFLITO", "Este identificador de parcela já pertence a outro compromisso");
    }
    await exigirPeriodoAberto(tx, input.propriedadeId, input.data);
    if (input.parceiroId) await exigirParceiroAtivo(tx, input.parceiroId, input.tipo);
    if (input.corrigeOperacaoId) {
      const original = await tx.operacao.findFirst({ where: { id: input.corrigeOperacaoId, propriedadeId: input.propriedadeId } });
      if (!original) throw new FinanceiroError("NAO_ENCONTRADO", "Operação original da correção não encontrada");
      if (original.status !== "CANCELADA") throw new FinanceiroError("CONFLITO", "Somente uma operação cancelada pode receber uma correção");
    }
    const contexto = await carregarContextoOperacao(tx, input);
    const efeitos = comoErroFinanceiro(() => preverEfeitosOperacao(input, contexto));
    const criadoPorId = input.usuarioId && input.usuarioId > 0 ? input.usuarioId : null;

    const operacao = await tx.operacao.create({
      data: {
        id: input.id,
        tipo: input.tipo,
        status: "CONFIRMADA",
        data: input.data,
        descricao: input.descricao,
        valorTotal: new Prisma.Decimal(efeitos.valorTotal),
        propriedadeId: input.propriedadeId,
        parceiroId: input.parceiroId,
        categoriaId: efeitos.categoriaId,
        categoriaNome: efeitos.categoriaNome,
        classificacao: efeitos.classificacao,
        centroCustoId: input.centroCustoId,
        corrigeOperacaoId: input.corrigeOperacaoId,
        criadoPorId,
        itens: { create: efeitos.itens.map((item) => ({
          ordem: item.ordem,
          produtoId: item.produtoId,
          centroCustoId: item.centroCustoId,
          centroCustoNome: item.centroCustoNome,
          descricao: item.descricao,
          quantidade: new Prisma.Decimal(item.quantidade),
          unidade: item.unidade,
          valorUnitario: new Prisma.Decimal(item.valorUnitario),
          valorTotal: new Prisma.Decimal(item.valorTotal),
          estocavel: item.estocavel,
          categoriaId: item.categoriaId,
          categoriaNome: item.categoriaNome,
          classificacao: item.classificacao,
        })) },
      },
      include: { itens: true },
    });

    const itemPorOrdem = new Map(operacao.itens.map((item) => [item.ordem, item.id]));
    for (const movimento of efeitos.movimentosEstoque) {
      await tx.movimentoEstoque.create({ data: {
        produtoId: movimento.produtoId, tipo: movimento.tipo, origem: movimento.origem, data: input.data,
        quantidade: new Prisma.Decimal(movimento.quantidade),
        custoUnitario: new Prisma.Decimal(movimento.custoUnitario), valorTotal: new Prisma.Decimal(movimento.valorTotal),
        operacaoId: operacao.id, itemOperacaoId: itemPorOrdem.get(movimento.ordemItem),
        centroCustoId: movimento.centroCustoId,
        propriedadeId: input.propriedadeId, criadoPorId,
        observacao: input.descricao,
      } });
    }

    for (const compromisso of efeitos.compromissos) {
      await tx.compromissoFinanceiro.create({ data: {
        id: compromisso.id, operacaoId: operacao.id, tipo: compromisso.tipo, valorOriginal: new Prisma.Decimal(compromisso.valorOriginal),
        dataVencimento: compromisso.dataVencimento, numeroParcela: compromisso.numeroParcela, totalParcelas: compromisso.totalParcelas,
        parceiroId: input.parceiroId,
      } });
    }

    if (efeitos.transacao) {
      await criarTransacaoComMovimento(tx, {
        tipo: efeitos.transacao.tipo, data: input.data, valor: efeitos.transacao.valor, descricao: input.descricao, operacaoId: operacao.id,
        parceiroId: input.parceiroId, propriedadeId: input.propriedadeId, contaId: efeitos.transacao.contaId,
        formaPagamento: efeitos.transacao.formaPagamento, usuarioId: input.usuarioId,
      });
    }

    await auditar(tx, { entidade: "Operacao", entidadeId: operacao.id, acao: "CONFIRMADA", usuarioId: input.usuarioId, depois: operacao });
    return tx.operacao.findUniqueOrThrow({ where: { id: operacao.id }, include: includeOperacaoCriada });
}

export function simularParcelas(input: SimulacaoParcelasInput) {
  return simularParcelasCalc(input);
}

export function confirmarRascunhoOperacao(tx: Prisma.TransactionClient, input: OperacaoInput) {
  return criarOperacaoTx(tx, input);
}

export async function criarOperacao(input: OperacaoInput) {
  return comIdDoCliente(input.id,
    () => prisma.$transaction((tx) => criarOperacaoTx(tx, input)),
    () => operacaoCriadaExistente(prisma, input));
}

async function bloquearOperacao(tx: Prisma.TransactionClient, id: string, propriedadeId?: number) {
  // Serializa liquidações e estornos sem bloquear as referências por chave estrangeira.
  const linhas = propriedadeId == null
    ? await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Operacao" WHERE "id" = ${id} FOR NO KEY UPDATE`
    : await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Operacao" WHERE "id" = ${id} AND "propriedadeId" = ${propriedadeId} FOR NO KEY UPDATE`;
  return linhas.length > 0;
}

async function compromissoParaLiquidar(tx: Prisma.TransactionClient, id: string, valor: Prisma.Decimal) {
  const compromisso = await tx.compromissoFinanceiro.findUnique({
    where: { id }, include: { operacao: true, liquidacoes: { include: { transacao: true } } },
  });
  if (!compromisso) throw new FinanceiroError("NAO_ENCONTRADO", "Compromisso não encontrado");
  if (compromisso.operacao.status === "CANCELADA" || compromisso.status === "CANCELADO" || compromisso.status === "LIQUIDADO") {
    throw new FinanceiroError("CONFLITO", "Este compromisso não aceita nova liquidação");
  }
  const liquidado = compromisso.liquidacoes.filter((item) => item.transacao.status === "CONFIRMADA")
    .reduce((soma, item) => soma.plus(item.valor), new Prisma.Decimal(0));
  const restante = compromisso.valorOriginal.minus(liquidado);
  if (valor.greaterThan(restante)) throw new FinanceiroError("VALIDACAO", `A liquidação excede o saldo restante de R$ ${restante.toFixed(2)}`);
  return { compromisso, restante };
}

async function liquidacaoExistente(db: Prisma.TransactionClient, compromissoId: string, transacaoId: string | undefined) {
  if (!transacaoId) return null;
  const transacao = await db.transacaoFinanceira.findUnique({
    where: { id: transacaoId }, include: { movimentos: true, liquidacoes: { select: { compromissoId: true } } },
  });
  if (!transacao) return null;
  const { liquidacoes, ...resto } = transacao;
  if (!liquidacoes.some((liquidacao) => liquidacao.compromissoId === compromissoId)) {
    throw new FinanceiroError("CONFLITO", "Este identificador já pertence a outra transação");
  }
  return resto;
}

export async function liquidarCompromisso(compromissoId: string, input: LiquidacaoInput) {
  return comIdDoCliente(input.transacaoId, () => prisma.$transaction(async (tx) => {
    const existente = await liquidacaoExistente(tx, compromissoId, input.transacaoId);
    if (existente) return existente;
    const valor = exigirPositivo(input.valor);
    const { compromisso } = await compromissoParaLiquidar(tx, compromissoId, valor);
    const tipo = compromisso.tipo === "PAGAR" ? "PAGAMENTO" : "RECEBIMENTO";
    const transacao = await criarTransacaoComMovimento(tx, {
      id: input.transacaoId, tipo, data: input.data, valor, descricao: input.descricao ?? `Liquidação do compromisso #${compromisso.seq}`,
      operacaoId: compromisso.operacaoId, parceiroId: compromisso.parceiroId ?? undefined,
      propriedadeId: compromisso.operacao.propriedadeId, contaId: input.contaId,
      formaPagamento: input.formaPagamento, usuarioId: input.usuarioId,
    });
    await bloquearOperacao(tx, compromisso.operacaoId);
    // Releitura após o bloqueio: uma liquidação concorrente pode ter consumido o saldo.
    // A transação e seus movimentos ainda não estão confirmados; uma falha reverte tudo.
    const { restante } = await compromissoParaLiquidar(tx, compromissoId, valor);
    await tx.liquidacao.create({ data: { compromissoId, transacaoId: transacao.id, valor } });
    const novoRestante = restante.minus(valor);
    await tx.compromissoFinanceiro.update({ where: { id: compromissoId }, data: { status: novoRestante.isZero() ? "LIQUIDADO" : "PARCIAL" } });
    await auditar(tx, { entidade: "CompromissoFinanceiro", entidadeId: compromissoId, acao: "LIQUIDADO", usuarioId: input.usuarioId, depois: { transacaoId: transacao.id, valor } });
    return transacao;
  }), () => liquidacaoExistente(prisma, compromissoId, input.transacaoId));
}

async function transferenciaExistente(db: Prisma.TransactionClient, input: TransferenciaInput) {
  if (!await operacaoExistente(db, input.id, input.propriedadeId, "TRANSFERENCIA_FINANCEIRA")) return null;
  return db.transacaoFinanceira.findFirstOrThrow({ where: { operacaoId: input.id, tipo: "TRANSFERENCIA" }, include: { movimentos: true }, orderBy: { seq: "asc" } });
}

export async function transferir(input: TransferenciaInput) {
  if (input.contaOrigemId === input.contaDestinoId) throw new FinanceiroError("VALIDACAO", "As contas de origem e destino devem ser diferentes");
  return comIdDoCliente(input.id, () => prisma.$transaction(async (tx) => {
    const existente = await transferenciaExistente(tx, input);
    if (existente) return existente;
    await exigirPeriodoAberto(tx, input.propriedadeId, input.data);
    await exigirContaAtiva(tx, input.contaOrigemId, input.propriedadeId);
    await exigirContaAtiva(tx, input.contaDestinoId, input.propriedadeId);
    const valor = exigirPositivo(input.valor);
    const operacao = await tx.operacao.create({ data: {
      id: input.id, tipo: "TRANSFERENCIA_FINANCEIRA", status: "CONFIRMADA", data: input.data, valorTotal: valor,
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
  }), () => transferenciaExistente(prisma, input));
}

export async function criarTransacaoAvulsa(input: TransacaoAvulsaInput) {
  return prisma.$transaction(async (tx) => {
    if (input.parceiroId) await exigirParceiroAtivo(tx, input.parceiroId);
    const transacao = await criarTransacaoComMovimento(tx, input);
    await auditar(tx, { entidade: "TransacaoFinanceira", entidadeId: transacao.id, acao: "CONFIRMADA", usuarioId: input.usuarioId, depois: transacao });
    return transacao;
  });
}

async function estornarTransacaoTx(tx: Prisma.TransactionClient, id: string, motivo: string, contexto: ContextoEstorno) {
    const referencia = await tx.transacaoFinanceira.findFirst({ where: { id, propriedadeId: contexto.propriedadeId }, select: { operacaoId: true } });
    if (!referencia) throw new FinanceiroError("NAO_ENCONTRADO", "Transação não encontrada");
    if (referencia.operacaoId != null) await bloquearOperacao(tx, referencia.operacaoId, contexto.propriedadeId);
    else await tx.$queryRaw`SELECT "id" FROM "TransacaoFinanceira" WHERE "id" = ${id} AND "propriedadeId" = ${contexto.propriedadeId} FOR NO KEY UPDATE`;
    const original = await tx.transacaoFinanceira.findFirst({ where: { id, propriedadeId: contexto.propriedadeId }, include: { movimentos: true, liquidacoes: true, revertidaPor: true } });
    if (!original) throw new FinanceiroError("NAO_ENCONTRADO", "Transação não encontrada");
    if (original.status === "REVERTIDA" || original.revertidaPor) throw new FinanceiroError("JA_REVERTIDO", "A transação já foi estornada");
    await exigirPeriodoAberto(tx, original.propriedadeId, new Date());
    const estorno = await tx.transacaoFinanceira.create({ data: {
      tipo: "REVERSAO", data: new Date(), valorTotal: original.valorTotal, descricao: `Estorno #${original.seq}: ${motivo}`,
      propriedadeId: original.propriedadeId, operacaoId: original.operacaoId, parceiroId: original.parceiroId,
      criadoPorId: contexto.usuarioId && contexto.usuarioId > 0 ? contexto.usuarioId : null, reversaoDeId: original.id,
      movimentos: { create: original.movimentos.map((movimento) => ({
        contaId: movimento.contaId, direcao: movimento.direcao === "ENTRADA" ? "SAIDA" : "ENTRADA", valor: movimento.valor,
      })) },
    }, include: { movimentos: true } });
    await tx.transacaoFinanceira.update({ where: { id }, data: { status: "REVERTIDA" } });
    const compromissoIds = [...new Set(original.liquidacoes.map((item) => item.compromissoId))];
    for (const compromissoId of compromissoIds) {
      const compromisso = await tx.compromissoFinanceiro.findUniqueOrThrow({ where: { id: compromissoId }, include: { liquidacoes: { include: { transacao: true } } } });
      const pago = compromisso.liquidacoes.filter((item) => item.transacao.status === "CONFIRMADA").reduce((soma, item) => soma.plus(item.valor), new Prisma.Decimal(0));
      if (compromisso.status !== "CANCELADO") {
        await tx.compromissoFinanceiro.update({ where: { id: compromissoId }, data: { status: pago.isZero() ? "PENDENTE" : pago.lessThan(compromisso.valorOriginal) ? "PARCIAL" : "LIQUIDADO" } });
      }
    }
    await auditar(tx, { entidade: "TransacaoFinanceira", entidadeId: id, acao: "ESTORNADA", motivo, usuarioId: contexto.usuarioId, antes: original, depois: estorno });
    return estorno;
}

export async function estornarTransacao(id: string, motivo: string, contexto: ContextoEstorno) {
  return prisma.$transaction((tx) => estornarTransacaoTx(tx, id, motivo, contexto));
}

export async function estornarOperacao(id: string, motivo: string, contexto: ContextoEstorno) {
  return prisma.$transaction(async (tx) => {
    if (!await bloquearOperacao(tx, id, contexto.propriedadeId)) throw new FinanceiroError("NAO_ENCONTRADO", "Operação não encontrada");
    const operacao = await tx.operacao.findFirst({
      where: { id, propriedadeId: contexto.propriedadeId },
      include: { transacoes: true, compromissos: { include: { liquidacoes: true } }, movimentosEstoque: { include: { revertidoPor: true } } },
    });
    if (!operacao) throw new FinanceiroError("NAO_ENCONTRADO", "Operação não encontrada");
    if (operacao.status === "CANCELADA") throw new FinanceiroError("JA_REVERTIDO", "A operação já foi cancelada");
    await exigirPeriodoAberto(tx, operacao.propriedadeId, new Date());

    for (const transacao of operacao.transacoes.filter((item) => item.status === "CONFIRMADA" && item.tipo !== "REVERSAO")) {
      await estornarTransacaoTx(tx, transacao.id, `${PREFIXO_CANCELAMENTO_OPERACAO}${operacao.numero}: ${motivo}`, contexto);
    }
    for (const movimento of operacao.movimentosEstoque.filter((item) => item.status === "CONFIRMADO" && !item.reversaoDeId && !item.revertidoPor)) {
      await tx.movimentoEstoque.create({ data: {
        produtoId: movimento.produtoId,
        tipo: movimento.tipo === "ENTRADA" ? "SAIDA" : movimento.tipo === "SAIDA" ? "ENTRADA" : "AJUSTE",
        origem: "AJUSTE_INVENTARIO", data: new Date(),
        quantidade: movimento.tipo === "AJUSTE" ? movimento.quantidade.negated() : movimento.quantidade,
        custoUnitario: movimento.custoUnitario, valorTotal: movimento.tipo === "AJUSTE" ? movimento.valorTotal.negated() : movimento.valorTotal,
        propriedadeId: movimento.propriedadeId, operacaoId: operacao.id, centroCustoId: movimento.centroCustoId,
        reversaoDeId: movimento.id, observacao: `${PREFIXO_CANCELAMENTO_OPERACAO}${operacao.numero}: ${motivo}`,
      } });
      await tx.movimentoEstoque.update({ where: { id: movimento.id }, data: { status: "REVERTIDO" } });
    }
    await tx.compromissoFinanceiro.updateMany({ where: { operacaoId: id, status: { not: "CANCELADO" } }, data: { status: "CANCELADO" } });
    const cancelada = await tx.operacao.update({ where: { id }, data: { status: "CANCELADA" } });
    await auditar(tx, { entidade: "Operacao", entidadeId: id, acao: "CANCELADA", motivo, usuarioId: contexto.usuarioId, antes: operacao, depois: cancelada });
    return cancelada;
  });
}

const includeOperacao = Prisma.validator<Prisma.OperacaoInclude>()({
  parceiro: true,
  centroCusto: { select: { id: true, nome: true } },
  itens: { orderBy: { ordem: "asc" } },
  compromissos: {
    include: {
      liquidacoes: {
        include: {
          transacao: {
            include: {
              movimentos: { include: { conta: { select: { id: true, nome: true } } } },
              reversaoDe: { select: { id: true, tipo: true, status: true, data: true, descricao: true } },
              revertidaPor: { select: { id: true, tipo: true, status: true, data: true, descricao: true } },
            },
          },
        },
        orderBy: [{ transacao: { data: "asc" } }, { transacao: { seq: "asc" } }],
      },
    },
  },
  transacoes: {
    include: {
      movimentos: { include: { conta: { select: { id: true, nome: true } } } },
      reversaoDe: { select: { id: true, tipo: true, status: true, data: true, descricao: true } },
      revertidaPor: { select: { id: true, tipo: true, status: true, data: true, descricao: true } },
    },
    orderBy: [{ data: "asc" }, { seq: "asc" }],
  },
  movimentosEstoque: { include: { revertidoPor: { select: { id: true } }, produto: { select: { id: true, nome: true, unidade: true } } } },
  documentos: { select: documentoPublico },
  corrigeOperacao: { select: { id: true, numero: true, descricao: true } },
  correcoes: { select: { id: true, numero: true, descricao: true, status: true } },
});

function valoresCompromisso<T extends { status: string; valorOriginal: Prisma.Decimal; liquidacoes: { valor: Prisma.Decimal; transacao: { status: string } }[] }>(compromisso: T) {
  const valorLiquidado = compromisso.liquidacoes
    .filter((item) => item.transacao.status === "CONFIRMADA")
    .reduce((soma, item) => soma.plus(item.valor), new Prisma.Decimal(0));
  const saldoPendente = compromisso.valorOriginal.minus(valorLiquidado);
  return { ...compromisso, valorLiquidado, saldoPendente, saldoExigivel: compromisso.status === "CANCELADO" ? new Prisma.Decimal(0) : saldoPendente };
}

function resumoCancelamento(operacao: Prisma.OperacaoGetPayload<{ include: typeof includeOperacao }>) {
  const compromissos = operacao.compromissos
    .filter((compromisso) => compromisso.status !== "CANCELADO")
    .map(valoresCompromisso)
    .map((compromisso) => ({ id: compromisso.id, numeroParcela: compromisso.numeroParcela, status: compromisso.status, valorOriginal: compromisso.valorOriginal, valorLiquidado: compromisso.valorLiquidado, saldoExigivel: compromisso.saldoExigivel }));
  const transacoes = operacao.transacoes
    .filter((transacao) => transacao.tipo !== "REVERSAO" && transacao.status === "CONFIRMADA" && !transacao.revertidaPor)
    .map((transacao) => ({
      id: transacao.id, tipo: transacao.tipo, data: transacao.data, valorTotal: transacao.valorTotal,
      movimentos: transacao.movimentos.map((movimento) => ({ id: movimento.id, contaId: movimento.contaId, conta: movimento.conta, valor: movimento.valor, direcaoInversa: movimento.direcao === "ENTRADA" ? "SAIDA" : "ENTRADA" })),
    }));
  const estoque = operacao.movimentosEstoque
    .filter((movimento) => movimento.status === "CONFIRMADO" && !movimento.reversaoDeId && !movimento.revertidoPor)
    .map((movimento) => ({ id: movimento.id, produtoId: movimento.produtoId, produtoNome: movimento.produto.nome, quantidade: movimento.quantidade, unidade: rotuloUnidade(movimento.produto.unidade), tipo: movimento.tipo }));
  const impactosPorConta = new Map<string, { conta: { id: string; nome: string }; entrada: Prisma.Decimal; saida: Prisma.Decimal }>();
  for (const transacao of transacoes) for (const movimento of transacao.movimentos) {
    const atual = impactosPorConta.get(movimento.contaId) ?? { conta: movimento.conta, entrada: new Prisma.Decimal(0), saida: new Prisma.Decimal(0) };
    if (movimento.direcaoInversa === "ENTRADA") atual.entrada = atual.entrada.plus(movimento.valor); else atual.saida = atual.saida.plus(movimento.valor);
    impactosPorConta.set(movimento.contaId, atual);
  }
  return {
    compromissos,
    transacoes,
    estoque,
    impactosPorConta: [...impactosPorConta.values()],
    documentosPreservados: operacao.documentos.length,
  };
}

export async function obterOperacao(id: string, propriedadeId?: number | null) {
  const operacao = await prisma.operacao.findFirst({ where: { id, ...(propriedadeId ? { propriedadeId } : {}) }, include: includeOperacao });
  if (!operacao) throw new FinanceiroError("NAO_ENCONTRADO", "Operação não encontrada");
  return { ...operacao, compromissos: operacao.compromissos.map(valoresCompromisso), resumoCancelamento: resumoCancelamento(operacao) };
}

export async function listarOperacoes(propriedadeId?: number | null, inicio?: Date, fim?: Date) {
  return prisma.operacao.findMany({
    where: { ...(propriedadeId ? { propriedadeId } : {}), ...(inicio || fim ? { data: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lte: fim } : {}) } } : {}) },
    include: includeOperacao,
    orderBy: [{ data: "desc" }, { numero: "desc" }],
  });
}

export async function listarCompromissos(propriedadeId?: number | null, periodo?: { inicio: Date; fim: Date }) {
  const compromissos = await prisma.compromissoFinanceiro.findMany({
    where: { ...(propriedadeId ? { operacao: { propriedadeId } } : {}), ...(periodo ? { dataVencimento: { gte: periodo.inicio, lte: periodo.fim } } : {}) }, include: { parceiro: true, operacao: true, liquidacoes: { include: { transacao: true } } },
    orderBy: [{ dataVencimento: "asc" }, { seq: "asc" }],
  });
  return compromissos.map((compromisso) => ({
    ...valoresCompromisso(compromisso),
    vencido: compromisso.status !== "LIQUIDADO" && compromisso.status !== "CANCELADO" && compromisso.dataVencimento < new Date(),
  }));
}
