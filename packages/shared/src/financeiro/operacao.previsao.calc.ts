import { arredondarDinheiro, dividirDecimais, somarDecimais, type ValorDecimal } from "../lib/decimal.js";
import { ErroValidacaoFinanceira } from "./erros.js";
import { totalItensFinanceiros, valorItemFinanceiro } from "./parcelas.calc.js";
import type { FormaPagamento, OperacaoValidada } from "../schemas/financeiro.schemas.js";

type Classificacao = "CUSTEIO" | "INVESTIMENTO";
type TipoOperacao = OperacaoValidada["tipo"];
export type TipoMovimentoEstoque = "ENTRADA" | "SAIDA" | "AJUSTE";
export type OrigemMovimentoEstoque = "COMPRA" | "INVENTARIO_INICIAL" | "BONIFICACAO" | "PRODUCAO" | "DEVOLUCAO" | "AJUSTE_INVENTARIO";
export type TipoTransacaoOperacao = "PAGAMENTO" | "RECEBIMENTO" | "APORTE" | "RETIRADA";

/** Cadastros que a operação referencia. Cada lista traz só os registros ativos. */
export interface ContextoOperacao {
  produtos: readonly { id: string; categoriaId: string | null; centrosCustoIds: readonly string[] }[];
  categorias: readonly { id: string; nome: string; classificacao: Classificacao | null }[];
  centrosCusto: readonly { id: string; nome: string }[];
  /** Venda/devolução: produtos que já tiveram entrada no sítio. */
  produtosComEstoque?: readonly string[];
  /** Venda/devolução: base do custo médio (Σ quantidade, Σ valor) das entradas valorizadas no sítio. */
  basesCusto?: readonly { produtoId: string; quantidade: ValorDecimal; valor: ValorDecimal }[];
}

export interface ItemPrevisto {
  ordem: number;
  produtoId?: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  estocavel: boolean;
  categoriaId: string | null;
  categoriaNome: string | null;
  classificacao: Classificacao | null;
  /** Centro gravado no item; null = herda o da operação. */
  centroCustoId: string | null;
  centroCustoNome: string | null;
  centroCustoEfetivoId: string | null;
}

export interface MovimentoEstoquePrevisto {
  ordemItem: number;
  produtoId: string;
  tipo: TipoMovimentoEstoque;
  origem: OrigemMovimentoEstoque;
  quantidade: number;
  custoUnitario: number;
  valorTotal: number;
  centroCustoId: string | null;
}

export interface CompromissoPrevisto {
  id?: string;
  tipo: "PAGAR" | "RECEBER";
  valorOriginal: number;
  dataVencimento: Date;
  numeroParcela: number;
  totalParcelas: number;
}

export interface TransacaoPrevista {
  tipo: TipoTransacaoOperacao;
  direcao: "ENTRADA" | "SAIDA";
  valor: number;
  contaId: string;
  formaPagamento?: FormaPagamento;
}

export interface EfeitosOperacao {
  valorTotal: number;
  categoriaId: string | null;
  categoriaNome: string | null;
  classificacao: Classificacao | null;
  centroCustoId: string | null;
  itens: ItemPrevisto[];
  movimentosEstoque: MovimentoEstoquePrevisto[];
  compromissos: CompromissoPrevisto[];
  transacao: TransacaoPrevista | null;
}

const incluiEstoque = new Set<TipoOperacao>(["COMPRA_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "PRODUCAO"]);
const retiraEstoque = new Set<TipoOperacao>(["VENDA", "DEVOLUCAO"]);

function tipoCompromissoDaOperacao(tipo: TipoOperacao): "PAGAR" | "RECEBER" {
  return tipo === "VENDA" || tipo === "DEVOLUCAO" ? "RECEBER" : "PAGAR";
}

function tipoTransacaoDaOperacao(tipo: TipoOperacao): TipoTransacaoOperacao {
  if (tipo === "VENDA" || tipo === "DEVOLUCAO") return "RECEBIMENTO";
  if (tipo === "APORTE") return "APORTE";
  if (tipo === "RETIRADA") return "RETIRADA";
  return "PAGAMENTO";
}

function direcaoTransacao(tipo: TipoTransacaoOperacao): "ENTRADA" | "SAIDA" {
  return tipo === "RECEBIMENTO" || tipo === "APORTE" ? "ENTRADA" : "SAIDA";
}

function movimentoDaOperacao(tipo: TipoOperacao): { tipo: TipoMovimentoEstoque; origem: OrigemMovimentoEstoque } | null {
  if (!incluiEstoque.has(tipo) && !retiraEstoque.has(tipo) && tipo !== "AJUSTE_ESTOQUE") return null;
  return {
    tipo: retiraEstoque.has(tipo) ? "SAIDA" : tipo === "AJUSTE_ESTOQUE" ? "AJUSTE" : "ENTRADA",
    origem: tipo === "COMPRA_ESTOQUE" ? "COMPRA" : tipo === "INVENTARIO_INICIAL" ? "INVENTARIO_INICIAL"
      : tipo === "BONIFICACAO" ? "BONIFICACAO" : tipo === "PRODUCAO" ? "PRODUCAO"
        : tipo === "DEVOLUCAO" ? "DEVOLUCAO" : "AJUSTE_INVENTARIO",
  };
}

/** Saída pelo custo médio: quantidade × valor da base ÷ quantidade da base; sem base, custo 0. */
export function valorSaidaPelaBase(quantidade: ValorDecimal, base?: { quantidade: ValorDecimal; valor: ValorDecimal }) {
  if (!base || !(Number(base.quantidade) > 0)) return { custoUnitario: 0, valorTotal: 0 };
  const valorTotal = dividirDecimais(quantidade, base.quantidade, 2, base.valor);
  return { custoUnitario: Number(quantidade) === 0 ? 0 : dividirDecimais(valorTotal, quantidade, 4), valorTotal };
}

/**
 * Efeitos que a confirmação de uma operação grava, sem acesso a banco. Lança
 * ErroValidacaoFinanceira com as mesmas mensagens e campos do servidor.
 * Não cobre o que depende do estado no momento da gravação: período fechado,
 * parceiro e conta ativos, correção de operação cancelada e ids já usados.
 */
export function preverEfeitosOperacao(input: OperacaoValidada, contexto: ContextoOperacao): EfeitosOperacao {
  const produtos = new Map(contexto.produtos.map((produto) => [produto.id, produto]));
  const categorias = new Map(contexto.categorias.map((categoria) => [categoria.id, categoria]));
  const centros = new Map(contexto.centrosCusto.map((centro) => [centro.id, centro.nome]));

  // Produto com exatamente um centro o transmite ao item; com vários (ou
  // nenhum) o item fica sem centro próprio e herda o da operação.
  const centrosItens = input.itens.map((item) => {
    if (item.centroCustoId !== undefined) return item.centroCustoId;
    const produto = produtos.get(item.produtoId ?? "");
    return produto && produto.centrosCustoIds.length === 1 ? produto.centrosCustoIds[0] : null;
  });

  // Quem decide se o item mexe no estoque é o tipo da operação. Venda e
  // devolução só retiram produto que já teve entrada no sítio; sem isso o item
  // vira não estocável e segue a regra de centro efetivo.
  const movimento = movimentoDaOperacao(input.tipo);
  const comEstoqueNoSitio = retiraEstoque.has(input.tipo) ? new Set(contexto.produtosComEstoque ?? []) : null;
  const estocavelItens = input.itens.map((item) => {
    if (!movimento) return false;
    if (comEstoqueNoSitio && item.produtoId != null) return comEstoqueNoSitio.has(item.produtoId);
    return item.estocavel || item.produtoId != null;
  });

  if (input.centroCustoId && !centros.has(input.centroCustoId)) throw new ErroValidacaoFinanceira("Selecione um centro de custo ativo", "centroCustoId");
  centrosItens.forEach((id, indice) => {
    if (id && !centros.has(id)) throw new ErroValidacaoFinanceira("Selecione um centro de custo ativo", `itens.${indice}.centroCustoId`);
    // Estocável pode ficar sem centro (o consumo futuro decide).
    if (!estocavelItens[indice] && !(id ?? input.centroCustoId)) {
      throw new ErroValidacaoFinanceira("Informe o centro de custo deste item ou um centro padrão para a operação", `itens.${indice}.centroCustoId`);
    }
  });
  input.itens.forEach((item, indice) => {
    if (estocavelItens[indice] && (!item.produtoId || !produtos.has(item.produtoId))) {
      throw new ErroValidacaoFinanceira(`O item “${item.descricao}” movimenta estoque e precisa apontar para um produto ativo`);
    }
  });

  const classificar = (categoriaId: string | null | undefined, classificacao?: Classificacao | null) => {
    const categoria = categoriaId ? categorias.get(categoriaId) : undefined;
    if (categoriaId && !categoria) throw new ErroValidacaoFinanceira("Selecione uma categoria ativa", "categoriaId");
    return {
      categoriaId: categoria?.id ?? null,
      categoriaNome: categoria?.nome ?? null,
      classificacao: classificacao === undefined ? categoria?.classificacao ?? null : classificacao,
    };
  };

  const itens: ItemPrevisto[] = input.itens.map((item, indice) => {
    const centroCustoId = centrosItens[indice];
    const valorTotal = valorItemFinanceiro(item);
    return {
      ordem: indice + 1,
      produtoId: item.produtoId,
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidade: item.unidade,
      // Com valor total informado, o unitário é só derivado (4 casas da coluna).
      valorUnitario: item.valorTotal === undefined ? item.valorUnitario ?? 0 : dividirDecimais(valorTotal, item.quantidade, 4),
      valorTotal,
      estocavel: estocavelItens[indice],
      ...classificar(item.categoriaId === undefined ? produtos.get(item.produtoId ?? "")?.categoriaId : item.categoriaId, item.classificacao),
      centroCustoId,
      centroCustoNome: centroCustoId ? centros.get(centroCustoId) ?? null : null,
      centroCustoEfetivoId: centroCustoId ?? input.centroCustoId ?? null,
    };
  });
  const classificacaoOperacao = classificar(itens.length ? null : input.categoriaId, input.classificacao);

  const totalItens = totalItensFinanceiros(itens);
  const valorTotal = input.valorTotal === undefined ? totalItens : arredondarDinheiro(input.valorTotal);
  if (itens.length > 0 && input.valorTotal !== undefined && totalItens !== valorTotal) {
    throw new ErroValidacaoFinanceira("O valor total informado deve corresponder à soma dos itens");
  }
  if (valorTotal < 0) throw new ErroValidacaoFinanceira("O valor total da operação não pode ser negativo");

  const financeiro = input.financeiro;
  if (financeiro.condicao === "PARCIAL"
    && somarDecimais([...financeiro.parcelas.map((parcela) => parcela.valor), financeiro.valorPago], 2) !== valorTotal) {
    throw new ErroValidacaoFinanceira("O valor pago somado às parcelas deve ser igual ao total da operação");
  }
  if (financeiro.condicao === "A_PRAZO" && somarDecimais(financeiro.parcelas.map((parcela) => parcela.valor), 2) !== valorTotal) {
    throw new ErroValidacaoFinanceira("A soma das parcelas deve ser igual ao total da operação");
  }

  const bases = new Map((contexto.basesCusto ?? []).map((base) => [base.produtoId, base]));
  const movimentosEstoque: MovimentoEstoquePrevisto[] = movimento
    ? itens.filter((item) => item.estocavel && item.produtoId).map((item) => ({
      ordemItem: item.ordem,
      produtoId: item.produtoId!,
      tipo: movimento.tipo,
      origem: movimento.origem,
      quantidade: item.quantidade,
      // Saída baixa pelo custo médio do sítio, nunca pelo preço de venda.
      ...(movimento.tipo === "SAIDA"
        ? valorSaidaPelaBase(item.quantidade, bases.get(item.produtoId!))
        : { custoUnitario: item.valorUnitario, valorTotal: item.valorTotal }),
      centroCustoId: item.centroCustoEfetivoId,
    }))
    : [];

  const parcelas = financeiro.condicao === "A_PRAZO" || financeiro.condicao === "PARCIAL" ? financeiro.parcelas : [];
  const compromissos: CompromissoPrevisto[] = parcelas.map((parcela, indice) => ({
    ...(parcela.id ? { id: parcela.id } : {}),
    tipo: tipoCompromissoDaOperacao(input.tipo),
    valorOriginal: arredondarDinheiro(parcela.valor),
    dataVencimento: parcela.dataVencimento,
    numeroParcela: indice + 1,
    totalParcelas: parcelas.length,
  }));

  let transacao: TransacaoPrevista | null = null;
  if (financeiro.condicao === "A_VISTA" || financeiro.condicao === "PARCIAL") {
    const valor = financeiro.condicao === "A_VISTA" ? valorTotal : arredondarDinheiro(financeiro.valorPago);
    if (valor <= 0) throw new ErroValidacaoFinanceira("valor deve ser maior que zero");
    const tipo = tipoTransacaoDaOperacao(input.tipo);
    transacao = {
      tipo, direcao: direcaoTransacao(tipo), valor, contaId: financeiro.contaId,
      ...(financeiro.formaPagamento ? { formaPagamento: financeiro.formaPagamento } : {}),
    };
  }

  return {
    valorTotal,
    ...classificacaoOperacao,
    centroCustoId: input.centroCustoId ?? null,
    itens,
    movimentosEstoque,
    compromissos,
    transacao,
  };
}
