import { Prisma, type DirecaoMovimentoConta, type TipoCompromisso, type TipoOperacaoFinanceira, type TipoTransacaoFinanceira } from "@prisma/client";
import { prisma } from "../../db.js";
import { auditar, dinheiro, exigirContaAtiva, exigirParceiroAtivo, exigirPeriodoAberto, exigirPositivo, FinanceiroError } from "./regras.js";
import { gerarParcelasFinanceiras, totalItensFinanceiros } from "./parcelas.calc.js";
import { obterBasesCusto, produtosComEstoque } from "../estoque/estoque.js";
import { valorSaidaDaBase } from "../estoque/estoque.calc.js";
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

/** Uma consulta para todos os centros usados na operação (cabeçalho + itens).
 * Devolve id → nome só dos ativos; quem chamou decide o campo do erro. */
async function resolverCentros(tx: Prisma.TransactionClient, ids: string[]) {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return new Map<string, string>();
  const centros = await tx.centroCusto.findMany({ where: { id: { in: unicos }, ativo: true }, select: { id: true, nome: true } });
  return new Map(centros.map((centro) => [centro.id, centro.nome]));
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

async function criarOperacaoTx(tx: Prisma.TransactionClient, input: OperacaoInput) {
    const existente = await operacaoCriadaExistente(tx, input);
    if (existente) return existente;
    const parcelasInformadas = input.financeiro.condicao === "A_PRAZO" || input.financeiro.condicao === "PARCIAL" ? input.financeiro.parcelas : [];
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
    const produtosIds = input.itens.flatMap((item) => item.produtoId ? [item.produtoId] : []);
    const produtos = produtosIds.length
      ? await tx.produto.findMany({ where: { id: { in: produtosIds }, ativo: true }, include: { centrosCusto: { select: { centroCustoId: true } } } })
      : [];
    const produtosPorId = new Map(produtos.map((produto) => [produto.id, produto]));
    // Produto com exatamente um centro cadastrado o transmite ao item; com vários
    // (ou nenhum) o item fica sem centro próprio e herda o da operação.
    const centroUnicoDoProduto = (produto: (typeof produtos)[number] | undefined) =>
      produto && produto.centrosCusto.length === 1 ? produto.centrosCusto[0].centroCustoId : null;
    const centrosItens = input.itens.map((item) => item.centroCustoId === undefined ? centroUnicoDoProduto(produtosPorId.get(item.produtoId ?? "")) : item.centroCustoId);
    // Quem decide se o item entra/sai do estoque é o TIPO da operação, não o
    // produto: nos tipos que põem no estoque (compra para estoque, inventário,
    // bonificação, produção) e no ajuste, todo item com produto (ou marcado
    // estocável pelo cliente) é estocável; nos demais tipos nenhum é. O snapshot
    // ItemOperacao.estocavel grava essa decisão.
    // Venda/devolução só retiram do estoque produto que já teve entrada no sítio
    // (mesma regra das baixas automáticas): vender leite, bezerro ou café que
    // nunca foi estocado não gera SAIDA a custo 0 nem saldo negativo — o item
    // vira não estocável e segue a regra de centro de custo efetivo.
    const temEfeitoEstoque = incluiEstoque.has(input.tipo) || retiraEstoque.has(input.tipo) || input.tipo === "AJUSTE_ESTOQUE";
    const retira = retiraEstoque.has(input.tipo);
    const comEstoqueNoSitio = retira ? await produtosComEstoque(tx, produtosIds, input.propriedadeId) : null;
    const estocavelItens = input.itens.map((item) => {
      if (!temEfeitoEstoque) return false;
      if (comEstoqueNoSitio && item.produtoId != null) return comEstoqueNoSitio.has(item.produtoId);
      return item.estocavel || item.produtoId != null;
    });
    const centros = await resolverCentros(tx, [input.centroCustoId ?? null, ...centrosItens].flatMap((id) => id ? [id] : []));
    if (input.centroCustoId && !centros.has(input.centroCustoId)) throw new FinanceiroError("VALIDACAO", "Selecione um centro de custo ativo", "centroCustoId");
    centrosItens.forEach((id, indice) => {
      if (id && !centros.has(id)) throw new FinanceiroError("VALIDACAO", "Selecione um centro de custo ativo", `itens.${indice}.centroCustoId`);
      // Item não estocável sem centro efetivo (próprio ou da operação) não tem
      // onde parar nos relatórios; estocável pode ficar sem centro (o consumo
      // futuro decide).
      if (!estocavelItens[indice] && !(id ?? input.centroCustoId)) {
        throw new FinanceiroError("VALIDACAO", "Informe o centro de custo deste item ou um centro padrão para a operação", `itens.${indice}.centroCustoId`);
      }
    });
    input.itens.forEach((item, indice) => {
      if (estocavelItens[indice] && (!item.produtoId || !produtosPorId.has(item.produtoId))) {
        throw new FinanceiroError("VALIDACAO", `O item “${item.descricao}” movimenta estoque e precisa apontar para um produto ativo`);
      }
    });

    const classificar = async (categoriaId: string | null | undefined, classificacao?: "CUSTEIO" | "INVESTIMENTO" | null) => {
      const categoria = categoriaId ? await tx.categoria.findFirst({ where: { id: categoriaId, ativo: true } }) : null;
      if (categoriaId && !categoria) throw new FinanceiroError("VALIDACAO", "Selecione uma categoria ativa", "categoriaId");
      return { categoriaId: categoria?.id ?? null, categoriaNome: categoria?.nome ?? null, classificacao: classificacao === undefined ? categoria?.classificacao ?? null : classificacao };
    };
    const itens = await Promise.all(input.itens.map(async (item, indice) => ({
      ordem: indice + 1,
      produtoId: item.produtoId,
      centroCustoId: centrosItens[indice],
      centroCustoNome: centrosItens[indice] ? centros.get(centrosItens[indice]!) ?? null : null,
      descricao: item.descricao,
      quantidade: new Prisma.Decimal(item.quantidade),
      unidade: item.unidade,
      // Quando o item vem por valor total, `valorTotal` é o campo autoritativo
      // (é ele que soma para o total da operação, nunca a reconstrução
      // quantidade × unitário). `valorUnitario` aqui é só um derivado para
      // exibição/relatório e é arredondado explicitamente às 4 casas da
      // coluna — sem isso, quocientes não exatos (ex.: 100 ÷ 3) dependeriam
      // do arredondamento implícito do driver do Postgres ao gravar.
      valorUnitario: item.valorTotal === undefined
        ? new Prisma.Decimal(item.valorUnitario ?? 0)
        : dinheiro(item.valorTotal).div(item.quantidade).toDecimalPlaces(4),
      valorTotal: item.valorTotal === undefined
        ? dinheiro(new Prisma.Decimal(item.quantidade).mul(item.valorUnitario ?? 0))
        : dinheiro(item.valorTotal),
      estocavel: estocavelItens[indice],
      ...await classificar(item.categoriaId === undefined ? produtosPorId.get(item.produtoId ?? "")?.categoriaId : item.categoriaId, item.classificacao),
    })));
    const classificacaoOperacao = await classificar(itens.length ? null : input.categoriaId, input.classificacao);
    const totalItens = totalItensFinanceiros(itens);
    const valorTotal = input.valorTotal === undefined ? totalItens : dinheiro(input.valorTotal);
    if (itens.length > 0 && input.valorTotal !== undefined && !totalItens.equals(valorTotal)) {
      throw new FinanceiroError("VALIDACAO", "O valor total informado deve corresponder à soma dos itens");
    }
    if (valorTotal.isNegative()) throw new FinanceiroError("VALIDACAO", "O valor total da operação não pode ser negativo");

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
        id: input.id,
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
      const itensEstoque = operacao.itens.filter((item) => item.estocavel && item.produtoId);
      // SAIDA (venda/devolução) baixa pelo custo médio do sítio, nunca pelo
      // preço de venda; ENTRADA/AJUSTE valorizam pelo próprio item.
      const custosSaida = tipoMovimento === "SAIDA"
        ? await obterBasesCusto(tx, itensEstoque.map((item) => item.produtoId!), input.propriedadeId)
        : null;
      for (const item of itensEstoque) {
        const valores = custosSaida
          ? valorSaidaDaBase(item.quantidade, custosSaida.get(item.produtoId!))
          : { custoUnitario: item.valorUnitario, valorTotal: item.valorTotal };
        await tx.movimentoEstoque.create({ data: {
          produtoId: item.produtoId!, tipo: tipoMovimento, origem, data: input.data, quantidade: item.quantidade,
          ...valores, operacaoId: operacao.id, itemOperacaoId: item.id,
          centroCustoId: item.centroCustoId ?? input.centroCustoId ?? null,
          propriedadeId: input.propriedadeId, criadoPorId: input.usuarioId && input.usuarioId > 0 ? input.usuarioId : null,
          observacao: input.descricao,
        } });
      }
    }

    const parcelas = input.financeiro.condicao === "A_PRAZO" || input.financeiro.condicao === "PARCIAL"
      ? input.financeiro.parcelas : [];
    for (const [indice, parcela] of parcelas.entries()) {
      await tx.compromissoFinanceiro.create({ data: {
        id: parcela.id, operacaoId: operacao.id, tipo: tipoCompromisso(input.tipo), valorOriginal: dinheiro(parcela.valor),
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
    return tx.operacao.findUniqueOrThrow({ where: { id: operacao.id }, include: includeOperacaoCriada });
}

export function simularParcelas(input: SimulacaoParcelasInput) {
  const totalOperacao = input.itens.length
    ? totalItensFinanceiros(input.itens)
    : dinheiro(input.valorTotal ?? 0);
  const valorPagoAgora = dinheiro(input.valorPagoAgora ?? 0);
  const saldoAPrazo = dinheiro(totalOperacao.minus(valorPagoAgora));
  // `isPositive()` do decimal.js considera zero positivo (sinal +1) — usar
  // lessThanOrEqualTo(0) para realmente exigir saldo > 0 aqui.
  if (saldoAPrazo.lessThanOrEqualTo(0)) throw new FinanceiroError("VALIDACAO", "O saldo a prazo deve ser maior que zero", "valorPagoAgora");
  return {
    totalOperacao,
    valorPagoAgora,
    saldoAPrazo,
    parcelas: gerarParcelasFinanceiras(saldoAPrazo, input.quantidadeParcelas, input.frequencia, input.primeiroVencimento),
  };
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
