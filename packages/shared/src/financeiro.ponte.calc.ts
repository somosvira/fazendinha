import type { z } from "zod";
import type { formaPagamentoSchema, OperacaoInput } from "./financeiro.schemas.js";

type FormaPagamento = z.infer<typeof formaPagamentoSchema>;

// Metade PURA de criarOperacaoTx (server/src/services/financeiro/operacoes.ts)
// — o que decide quais efeitos colaterais uma Operação gera, sem tocar em
// banco. O server chama isto em vez de reimplementar a regra inline; o
// client chama a mesma função para montar o item otimista da fila offline
// (ver docs/design/offline/PLANO_FINANCEIRO.md). Dinheiro em `number`, não
// `Prisma.Decimal` — esse tipo não pode ir para o bundle do client; o
// servidor continua sendo a fonte real assim que a escrita sincroniza.
//
// O que fica de fora de propósito (depende de estado do banco no momento
// real da escrita, não é previsível aqui): produto/conta ainda ativos,
// período ainda aberto, operação de correção ainda existir e estar
// cancelada. Isso é responsabilidade do server no momento real do insert.

const incluiEstoque = new Set(["COMPRA_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "PRODUCAO"]);
const retiraEstoque = new Set(["VENDA", "DEVOLUCAO"]);

export function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function tipoCompromisso(tipoOperacao: string): "PAGAR" | "RECEBER" {
  return tipoOperacao === "VENDA" || tipoOperacao === "DEVOLUCAO" ? "RECEBER" : "PAGAR";
}

function tipoTransacao(tipoOperacao: string): "PAGAMENTO" | "RECEBIMENTO" | "APORTE" | "RETIRADA" {
  if (tipoOperacao === "VENDA" || tipoOperacao === "DEVOLUCAO") return "RECEBIMENTO";
  if (tipoOperacao === "APORTE") return "APORTE";
  if (tipoOperacao === "RETIRADA") return "RETIRADA";
  return "PAGAMENTO";
}

function direcaoTransacao(tipo: "PAGAMENTO" | "RECEBIMENTO" | "APORTE" | "RETIRADA"): "ENTRADA" | "SAIDA" {
  return tipo === "RECEBIMENTO" || tipo === "APORTE" ? "ENTRADA" : "SAIDA";
}

export class EfeitosOperacaoError extends Error {}

export interface ItemPrevisto {
  produtoId?: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  estocavel: boolean;
}

type OrigemMovimentoEstoque = "COMPRA" | "INVENTARIO_INICIAL" | "BONIFICACAO" | "PRODUCAO" | "DEVOLUCAO" | "AJUSTE_INVENTARIO";

export interface MovimentoEstoquePrevisto {
  produtoId: number;
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  origem: OrigemMovimentoEstoque;
  quantidade: number;
  custoUnitario: number;
  valorTotal: number;
}

export interface CompromissoPrevisto {
  tipo: "PAGAR" | "RECEBER";
  valorOriginal: number;
  dataVencimento: Date;
  numeroParcela: number;
  totalParcelas: number;
}

export interface TransacaoPrevista {
  tipo: "PAGAMENTO" | "RECEBIMENTO" | "APORTE" | "RETIRADA";
  direcao: "ENTRADA" | "SAIDA";
  valorTotal: number;
  contaId: number;
  formaPagamento?: FormaPagamento;
}

export interface EfeitosOperacaoPrevistos {
  itens: ItemPrevisto[];
  valorTotal: number;
  temEfeitoEstoque: boolean;
  // tipo/origem do movimento de estoque são os mesmos para toda a operação
  // (não variam por item) — expostos à parte para o server reusar no laço
  // real (que precisa do id verdadeiro do ItemOperacao, só existe pós-insert)
  // sem duplicar este mapeamento.
  tipoMovimentoEstoque: "ENTRADA" | "SAIDA" | "AJUSTE" | null;
  origemMovimentoEstoque: OrigemMovimentoEstoque | null;
  movimentosEstoque: MovimentoEstoquePrevisto[];
  compromissos: CompromissoPrevisto[];
  transacao: TransacaoPrevista | null;
}

export function preverEfeitosOperacao(input: OperacaoInput): EfeitosOperacaoPrevistos {
  const itens: ItemPrevisto[] = input.itens.map((item) => ({
    produtoId: item.produtoId,
    descricao: item.descricao,
    quantidade: item.quantidade,
    unidade: item.unidade,
    valorUnitario: item.valorUnitario,
    valorTotal: arredondar(item.quantidade * item.valorUnitario),
    estocavel: item.estocavel,
  }));
  const totalItens = arredondar(itens.reduce((soma, item) => soma + item.valorTotal, 0));
  const valorTotal = input.valorTotal === undefined ? totalItens : arredondar(input.valorTotal);
  if (itens.length > 0 && input.valorTotal !== undefined && Math.abs(totalItens - valorTotal) > 0.005) {
    throw new EfeitosOperacaoError("O valor total informado deve corresponder à soma dos itens");
  }
  if (valorTotal < 0) throw new EfeitosOperacaoError("O valor total da operação não pode ser negativo");

  if (input.financeiro.condicao === "PARCIAL") {
    const futuro = arredondar(input.financeiro.parcelas.reduce((soma, parcela) => soma + parcela.valor, 0));
    if (Math.abs(arredondar(futuro + input.financeiro.valorPago) - valorTotal) > 0.005) {
      throw new EfeitosOperacaoError("O valor pago somado às parcelas deve ser igual ao total da operação");
    }
  }
  if (input.financeiro.condicao === "A_PRAZO") {
    const futuro = arredondar(input.financeiro.parcelas.reduce((soma, parcela) => soma + parcela.valor, 0));
    if (Math.abs(futuro - valorTotal) > 0.005) {
      throw new EfeitosOperacaoError("A soma das parcelas deve ser igual ao total da operação");
    }
  }

  const temEfeitoEstoque = incluiEstoque.has(input.tipo) || retiraEstoque.has(input.tipo) || input.tipo === "AJUSTE_ESTOQUE";
  const movimentosEstoque: MovimentoEstoquePrevisto[] = [];
  let tipoMovimentoEstoque: EfeitosOperacaoPrevistos["tipoMovimentoEstoque"] = null;
  let origemMovimentoEstoque: EfeitosOperacaoPrevistos["origemMovimentoEstoque"] = null;
  if (temEfeitoEstoque) {
    tipoMovimentoEstoque = retiraEstoque.has(input.tipo) ? "SAIDA" : input.tipo === "AJUSTE_ESTOQUE" ? "AJUSTE" : "ENTRADA";
    origemMovimentoEstoque = input.tipo === "COMPRA_ESTOQUE" ? "COMPRA" : input.tipo === "INVENTARIO_INICIAL" ? "INVENTARIO_INICIAL"
      : input.tipo === "BONIFICACAO" ? "BONIFICACAO" : input.tipo === "PRODUCAO" ? "PRODUCAO"
        : input.tipo === "DEVOLUCAO" ? "DEVOLUCAO" : "AJUSTE_INVENTARIO";
    for (const item of itens.filter((item) => item.estocavel && item.produtoId)) {
      movimentosEstoque.push({
        produtoId: item.produtoId!, tipo: tipoMovimentoEstoque, origem: origemMovimentoEstoque,
        quantidade: item.quantidade, custoUnitario: item.valorUnitario, valorTotal: item.valorTotal,
      });
    }
  }

  const parcelas = input.financeiro.condicao === "A_PRAZO" || input.financeiro.condicao === "PARCIAL"
    ? input.financeiro.parcelas : [];
  const compromissos: CompromissoPrevisto[] = parcelas.map((parcela, indice) => ({
    tipo: tipoCompromisso(input.tipo), valorOriginal: arredondar(parcela.valor),
    dataVencimento: parcela.dataVencimento, numeroParcela: indice + 1, totalParcelas: parcelas.length,
  }));

  let transacao: TransacaoPrevista | null = null;
  if (input.financeiro.condicao === "A_VISTA" || input.financeiro.condicao === "PARCIAL") {
    const valor = input.financeiro.condicao === "A_VISTA" ? valorTotal : arredondar(input.financeiro.valorPago);
    const tipo = tipoTransacao(input.tipo);
    transacao = { tipo, direcao: direcaoTransacao(tipo), valorTotal: valor, contaId: input.financeiro.contaId, formaPagamento: input.financeiro.formaPagamento };
  }

  return { itens, valorTotal, temEfeitoEstoque, tipoMovimentoEstoque, origemMovimentoEstoque, movimentosEstoque, compromissos, transacao };
}
