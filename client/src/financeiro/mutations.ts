import { useMemo, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import {
  ajusteContagemSchema, arredondarDinheiro, dinheiro, somar, ErroValidacaoFinanceira, liquidacaoSchema, operacaoSchema, preverEfeitosOperacao,
  transferenciaSchema, type ContextoOperacao, type EfeitosOperacao, type OperacaoValidada,
} from "@rionovo/shared";
import { inscrever, obterFila } from "../lib/offline/fila";
import {
  insertItemSortedInCacheList, invalidar, porPrefixo, updateItemInCacheList, useOfflineMutation, validado, erroDeValidacao, type ResultadoZod,
} from "../lib/offline/useOfflineMutation";
import type { SaldoDTO } from "../estoque/api";
import {
  type AjusteEstoqueInput, type AjusteEstoqueResultado, type Compromisso, type ConfiguracoesFinanceiras, type Conta, type DashboardFinanceiro,
  type MovimentoConta, type MovimentoGeral, type Operacao, type ParceiroBase, type RascunhoOperacao, obterRascunhoOperacao,
} from "./novo-api";
import { estoqueKeys, financeiroKeys } from "./queries";
import { estadoRascunhoAtivo, prepararPublicacaoRascunho } from "./rascunhoAtivo";
import { lerRascunhoLocal, limparRascunhoLocal } from "./rascunhoLocal";
import { rotuloUnidade } from "../lib/unidades";
import { dia, dataIso, hojeIso } from "../lib/data";

type Callbacks<T> = { onSuccess?: (resposta: T) => void; onError?: (erro: unknown) => void };

const CHAVE_CRIAR = "financeiro-criar-operacao";
const CHAVE_AJUSTE = "financeiro-ajuste-estoque";
const CHAVE_LIQUIDAR = "financeiro-liquidar-compromisso";
const CHAVE_TRANSFERIR = "financeiro-transferir";
const CHAVE_DESCARTAR = "financeiro-descartar-rascunho";

// ── Valores e datas ──────────────────────────────────────────────────────────

/** Limites de período guardados na queryKey (posições 2 e 3: início e fim; null ou "" = sem limite). */
function noPeriodo(queryKey: QueryKey, data: string) {
  const [, , inicio, fim] = queryKey as readonly unknown[];
  const d = dia(data);
  return (typeof inicio !== "string" || !inicio || d >= inicio) && (typeof fim !== "string" || !fim || d <= fim);
}

type DeltaConta = { contaId: string; delta: number };

function aplicarDeltasContas<T extends { id: string; saldoAtual: string }>(contas: T[], deltas: DeltaConta[]): T[] {
  return contas.map((conta) => {
    const delta = deltas.filter((item) => item.contaId === conta.id).reduce((soma, item) => soma + item.delta, 0);
    return delta ? { ...conta, saldoAtual: somar(conta.saldoAtual, delta) } : conta;
  });
}

function entradasSaldo(qc: QueryClient, deltas: DeltaConta[]) {
  if (!deltas.length) return [];
  return [
    ...porPrefixo<ConfiguracoesFinanceiras>(qc, financeiroKeys.configuracoes(), (config) => ({ ...config, contas: aplicarDeltasContas(config.contas, deltas) })),
    ...porPrefixo<DashboardFinanceiro>(qc, financeiroKeys.dashboardTodos(), (dashboard) => {
      const noGeral = deltas.filter((item) => dashboard.contas.some((conta) => conta.id === item.contaId && conta.ativo && conta.incluirNoSaldoGeral));
      return {
        ...dashboard,
        contas: aplicarDeltasContas(dashboard.contas, deltas),
        saldoGeral: somar(dashboard.saldoGeral, noGeral.reduce((soma, item) => soma + item.delta, 0)),
      };
    }),
  ];
}

function entradasExtrato(qc: QueryClient, movimentos: MovimentoGeral[]) {
  return [
    ...movimentos.flatMap((movimento) => porPrefixo<MovimentoConta[]>(qc, financeiroKeys.extrato(movimento.contaId), (lista) =>
      insertItemSortedInCacheList<MovimentoConta>(lista, movimento, (item) => dia(item.transacao.data), "desc"))),
    ...porPrefixo<MovimentoGeral[]>(qc, financeiroKeys.extratoGeral(), (lista) =>
      movimentos.reduce((atual, movimento) => insertItemSortedInCacheList(atual, movimento, (item) => dia(item.transacao.data), "desc"), lista)),
  ];
}

function entradasOperacaoNova(qc: QueryClient, operacao: Operacao) {
  return [
    ...porPrefixo<Operacao[]>(qc, financeiroKeys.operacoesTodos(), (lista, queryKey) =>
      noPeriodo(queryKey, operacao.data) ? insertItemSortedInCacheList(lista, operacao, (item) => dia(item.data), "desc") : lista),
    { queryKey: financeiroKeys.operacao(operacao.id), aplicar: () => operacao },
    invalidar(financeiroKeys.operacoesTodos()),
  ];
}

function entradasEstoque(qc: QueryClient, ajustar: (saldo: SaldoDTO) => SaldoDTO | null) {
  return [
    ...porPrefixo<SaldoDTO[]>(qc, estoqueKeys.saldosTodos(), (lista) => lista.map((saldo) => ajustar(saldo) ?? saldo)),
    invalidar(["estoque"]),
  ];
}

function comSaldoEstoque(saldo: SaldoDTO, quantidade: number): SaldoDTO {
  const arredondado = Math.round(quantidade * 1000) / 1000;
  return {
    ...saldo,
    saldo: arredondado,
    valor: arredondarDinheiro(arredondado * (saldo.custoMedio ?? 0)),
    abaixoMinimo: saldo.minimoEstoque != null && arredondado < saldo.minimoEstoque,
  };
}

function lerConfig(qc: QueryClient) {
  return qc.getQueryData<ConfiguracoesFinanceiras>(financeiroKeys.configuracoes());
}

function contaDoCache(qc: QueryClient, contaId: string): Pick<Conta, "id" | "nome" | "instituicao"> {
  const conta = lerConfig(qc)?.contas.find((item) => item.id === contaId);
  return { id: contaId, nome: conta?.nome ?? "", instituicao: conta?.instituicao ?? null };
}

function parceiroDoCache(qc: QueryClient, parceiroId: string | null | undefined): ParceiroBase | null {
  const parceiro = parceiroId ? lerConfig(qc)?.parceiros.find((item) => item.id === parceiroId) : undefined;
  return parceiro ? { id: parceiro.id, nome: parceiro.nome, documento: parceiro.documento, tipo: parceiro.tipo, telefone: parceiro.telefone, email: parceiro.email, ativo: parceiro.ativo } : null;
}

// ── Criar operação ───────────────────────────────────────────────────────────

type ParcelaCorpo = { id?: string; valor: unknown; dataVencimento: unknown };
export type CriarOperacaoInput = {
  id?: string;
  tipo: string;
  data: string;
  descricao: string;
  financeiro: { condicao: string; contaId?: string; parcelas?: ParcelaCorpo[]; [campo: string]: unknown };
  [campo: string]: unknown;
};
type OperacaoPreparada = { corpo: CriarOperacaoInput & { id: string }; otimista: Operacao; efeitos: EfeitosOperacao | null };

const RETIRA_ESTOQUE = new Set(["VENDA", "DEVOLUCAO"]);

function contextoOperacao(qc: QueryClient, input: OperacaoValidada): ContextoOperacao | null {
  const config = lerConfig(qc);
  if (!config) return null;
  const centrosAtivos = config.centrosCusto.filter((centro) => centro.ativo);
  const idsCentrosAtivos = new Set(centrosAtivos.map((centro) => centro.id));
  const saldos = qc.getQueryData<SaldoDTO[]>(estoqueKeys.saldos());
  const produtosDosItens = input.itens.flatMap((item) => item.produtoId ? [item.produtoId] : []);
  return {
    produtos: config.produtos.filter((produto) => produto.ativo !== false).map((produto) => ({
      id: produto.id,
      categoriaId: produto.categoriaId ?? produto.categoria?.id ?? null,
      centrosCustoIds: (produto.centroCustoIds ?? produto.centrosCusto?.map((centro) => centro.id) ?? []).filter((id) => idsCentrosAtivos.has(id)),
    })),
    categorias: config.categorias.filter((categoria) => categoria.ativo).map(({ id, nome, classificacao }) => ({ id, nome, classificacao })),
    centrosCusto: centrosAtivos.map(({ id, nome }) => ({ id, nome })),
    // Sem os saldos em cache, venda/devolução supõem que o produto tem estoque; o servidor decide no envio.
    ...(RETIRA_ESTOQUE.has(input.tipo) ? {
      produtosComEstoque: saldos ? saldos.map((saldo) => saldo.produtoId) : produtosDosItens,
      basesCusto: (saldos ?? []).filter((saldo) => saldo.custoMedio != null).map((saldo) => ({ produtoId: saldo.produtoId, quantidade: 1, valor: saldo.custoMedio! })),
    } : {}),
  };
}

function comIds(input: CriarOperacaoInput): CriarOperacaoInput & { id: string } {
  const parcelas = input.financeiro.parcelas;
  return {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    financeiro: parcelas ? { ...input.financeiro, parcelas: parcelas.map((parcela) => ({ ...parcela, id: parcela.id ?? crypto.randomUUID() })) } : input.financeiro,
  };
}

function montarOperacaoOtimista(qc: QueryClient, id: string, input: OperacaoValidada, efeitos: EfeitosOperacao | null): Operacao {
  const config = lerConfig(qc);
  const parceiro = parceiroDoCache(qc, input.parceiroId);
  const data = dataIso(input.data);
  const centro = input.centroCustoId ? config?.centrosCusto.find((item) => item.id === input.centroCustoId) : undefined;
  const referencia = { id, numero: null, tipo: input.tipo, descricao: input.descricao };
  const agora = new Date();
  const transacao = efeitos?.transacao;
  return {
    id, numero: null, tipo: input.tipo, status: "CONFIRMADA", data, descricao: input.descricao,
    valorTotal: dinheiro(efeitos?.valorTotal ?? input.valorTotal ?? 0),
    parceiro, parceiroId: input.parceiroId ?? null,
    categoriaId: efeitos?.categoriaId ?? input.categoriaId ?? null, categoriaNome: efeitos?.categoriaNome ?? null, classificacao: efeitos?.classificacao ?? null,
    centroCustoId: input.centroCustoId ?? null, centroCusto: centro ? { id: centro.id, nome: centro.nome } : null,
    corrigeOperacaoId: input.corrigeOperacaoId ?? null, corrigeOperacao: null, correcoes: [],
    itens: (efeitos?.itens ?? []).map((item) => ({
      id: crypto.randomUUID(), ordem: item.ordem, descricao: item.descricao, quantidade: String(item.quantidade), unidade: item.unidade,
      valorUnitario: String(item.valorUnitario), valorTotal: dinheiro(item.valorTotal), estocavel: item.estocavel, produtoId: item.produtoId ?? null,
      categoriaId: item.categoriaId, categoriaNome: item.categoriaNome, classificacao: item.classificacao,
      centroCustoId: item.centroCustoId, centroCustoNome: item.centroCustoNome,
    })),
    compromissos: (efeitos?.compromissos ?? []).map((compromisso) => ({
      id: compromisso.id ?? crypto.randomUUID(), seq: null, tipo: compromisso.tipo, status: "PENDENTE",
      valorOriginal: dinheiro(compromisso.valorOriginal), valorLiquidado: "0.00",
      saldoPendente: dinheiro(compromisso.valorOriginal), saldoExigivel: dinheiro(compromisso.valorOriginal),
      dataVencimento: compromisso.dataVencimento.toISOString(), numeroParcela: compromisso.numeroParcela, totalParcelas: compromisso.totalParcelas,
      vencido: compromisso.dataVencimento < agora, parceiro, operacao: referencia, liquidacoes: [],
    })),
    transacoes: transacao ? [{
      id: crypto.randomUUID(), seq: null, tipo: transacao.tipo, status: "CONFIRMADA", data, valorTotal: dinheiro(transacao.valor),
      formaPagamento: transacao.formaPagamento ?? null, operacaoId: id,
      movimentos: [{ id: crypto.randomUUID(), seq: null, contaId: transacao.contaId, direcao: transacao.direcao, valor: dinheiro(transacao.valor), conta: contaDoCache(qc, transacao.contaId) }],
    }] : [],
    movimentosEstoque: (efeitos?.movimentosEstoque ?? []).map((movimento) => ({
      id: crypto.randomUUID(), seq: null, tipo: movimento.tipo, status: "CONFIRMADO", quantidade: String(movimento.quantidade), valorTotal: dinheiro(movimento.valorTotal), produtoId: movimento.produtoId,
    })),
    documentos: [],
  };
}

function movimentosDaOperacao(qc: QueryClient, operacao: Operacao): MovimentoGeral[] {
  return operacao.transacoes.flatMap((transacao) => transacao.movimentos.map((movimento) => ({
    id: movimento.id, seq: null, contaId: movimento.contaId, direcao: movimento.direcao, valor: movimento.valor,
    conta: contaDoCache(qc, movimento.contaId),
    transacao: {
      id: transacao.id, seq: null, tipo: transacao.tipo, status: transacao.status, data: transacao.data, descricao: operacao.descricao,
      formaPagamento: transacao.formaPagamento, parceiro: operacao.parceiro,
      operacao: { id: operacao.id, numero: null, descricao: operacao.descricao, tipo: operacao.tipo },
    },
  })));
}

const deltasDosMovimentos = (movimentos: MovimentoGeral[]): DeltaConta[] =>
  movimentos.map((movimento) => ({ contaId: movimento.contaId, delta: movimento.direcao === "ENTRADA" ? Number(movimento.valor) : -Number(movimento.valor) }));

function prepararOperacao(qc: QueryClient, input: CriarOperacaoInput): OperacaoPreparada {
  const corpo = comIds(input);
  const validada = validado(operacaoSchema.safeParse(corpo) as ResultadoZod<OperacaoValidada>);
  const contexto = contextoOperacao(qc, validada);
  let efeitos: EfeitosOperacao | null = null;
  if (contexto) {
    try { efeitos = preverEfeitosOperacao(validada, contexto); }
    catch (erro) {
      if (erro instanceof ErroValidacaoFinanceira) throw erroDeValidacao(erro.message, erro.campo);
      throw erro;
    }
  }
  return { corpo, otimista: montarOperacaoOtimista(qc, corpo.id, validada, efeitos), efeitos };
}

export function useCriarOperacao() {
  const qc = useQueryClient();
  const base = useOfflineMutation<OperacaoPreparada, Operacao>({
    mutationKey: CHAVE_CRIAR,
    path: () => "/financeiro/operacoes",
    method: "POST",
    body: (preparada) => preparada.corpo,
    criarOtimista: (preparada) => preparada.otimista,
    queryKeys: (preparada) => {
      const operacao = preparada.otimista;
      const movimentos = movimentosDaOperacao(qc, operacao);
      const estoque = new Map<string, number>();
      for (const movimento of preparada.efeitos?.movimentosEstoque ?? []) {
        const sinal = movimento.tipo === "SAIDA" ? -1 : 1;
        estoque.set(movimento.produtoId, (estoque.get(movimento.produtoId) ?? 0) + sinal * movimento.quantidade);
      }
      return [
        ...entradasOperacaoNova(qc, operacao),
        ...(operacao.compromissos.length ? porPrefixo<Compromisso[]>(qc, financeiroKeys.compromissosTodos(), (lista, queryKey) =>
          operacao.compromissos.filter((compromisso) => noPeriodo(queryKey, compromisso.dataVencimento))
            .reduce((atual, compromisso) => insertItemSortedInCacheList(atual, compromisso, (item) => dia(item.dataVencimento), "asc"), lista)) : []),
        invalidar(financeiroKeys.compromissosTodos()),
        ...entradasExtrato(qc, movimentos),
        ...entradasSaldo(qc, deltasDosMovimentos(movimentos)),
        invalidar(financeiroKeys.dashboardTodos()),
        invalidar(financeiroKeys.configuracoes()),
        ...(estoque.size ? entradasEstoque(qc, (saldo) => estoque.has(saldo.produtoId) ? comSaldoEstoque(saldo, saldo.saldo + estoque.get(saldo.produtoId)!) : null) : []),
      ];
    },
  });

  function mutate(input: CriarOperacaoInput, opts?: Callbacks<Operacao>) {
    const preparada = prepararOperacao(qc, input);
    base.mutate(preparada, {
      onSuccess: opts?.onSuccess,
      onError: (erro) => { qc.removeQueries({ queryKey: financeiroKeys.operacao(preparada.corpo.id), exact: true }); opts?.onError?.(erro); },
    });
    return preparada.corpo.id;
  }

  return {
    mutate,
    /** Lança ApiError (422) com `campo` quando o corpo não passaria no servidor. */
    validar: (input: CriarOperacaoInput) => prepararOperacao(qc, input).corpo,
    pendentes: base.pendentes as unknown as (CriarOperacaoInput & { id: string })[],
  };
}

// ── Ajuste de estoque ────────────────────────────────────────────────────────

type AjustePreparado = { corpo: AjusteEstoqueInput & { id: string }; otimista: Operacao };

function prepararAjuste(qc: QueryClient, input: AjusteEstoqueInput): AjustePreparado {
  const corpo = { ...input, id: input.id ?? crypto.randomUUID() };
  validado(ajusteContagemSchema.safeParse(corpo) as ResultadoZod<unknown>);
  const saldo = qc.getQueryData<SaldoDTO[]>(estoqueKeys.saldos())?.find((item) => item.produtoId === input.produtoId);
  const produto = lerConfig(qc)?.produtos.find((item) => item.id === input.produtoId);
  const diferenca = Math.round((input.quantidadeContada - input.saldoEsperado) * 1000) / 1000;
  const custo = saldo?.custoMedio ?? 0;
  const valor = dinheiro(Math.abs(diferenca) * custo);
  const nome = saldo?.nome ?? produto?.nome ?? "produto";
  const otimista: Operacao = {
    id: corpo.id, numero: null, tipo: "AJUSTE_ESTOQUE", status: "CONFIRMADA", data: hojeIso(), descricao: input.observacao.trim(), valorTotal: valor,
    parceiro: null, centroCustoId: input.centroCustoId ?? null, corrigeOperacao: null, correcoes: [],
    itens: [{ id: crypto.randomUUID(), ordem: 1, descricao: `Ajuste: ${nome}`, quantidade: String(Math.abs(diferenca)), unidade: saldo ? rotuloUnidade(saldo.unidade) : produto ? rotuloUnidade(produto.unidade) : "un", valorUnitario: String(custo), valorTotal: valor, estocavel: true, produtoId: input.produtoId }],
    compromissos: [], transacoes: [], documentos: [],
    movimentosEstoque: [{ id: crypto.randomUUID(), seq: null, tipo: "AJUSTE", status: "CONFIRMADO", quantidade: String(diferenca), valorTotal: valor, produtoId: input.produtoId }],
  };
  return { corpo, otimista };
}

export function useAjusteEstoque() {
  const qc = useQueryClient();
  const base = useOfflineMutation<AjustePreparado, Operacao, AjusteEstoqueResultado>({
    mutationKey: CHAVE_AJUSTE,
    path: () => "/estoque/ajustes",
    method: "POST",
    body: (preparado) => preparado.corpo,
    criarOtimista: (preparado) => preparado.otimista,
    queryKeys: (preparado) => [
      ...entradasEstoque(qc, (saldo) => saldo.produtoId === preparado.corpo.produtoId ? comSaldoEstoque(saldo, preparado.corpo.quantidadeContada) : null),
      ...entradasOperacaoNova(qc, preparado.otimista),
    ],
  });

  function mutate(input: AjusteEstoqueInput, opts?: Callbacks<AjusteEstoqueResultado>) {
    const preparado = prepararAjuste(qc, input);
    base.mutate(preparado, {
      onSuccess: opts?.onSuccess,
      onError: (erro) => { qc.removeQueries({ queryKey: financeiroKeys.operacao(preparado.corpo.id), exact: true }); opts?.onError?.(erro); },
    });
    return preparado.corpo.id;
  }

  return { mutate, validar: (input: AjusteEstoqueInput) => prepararAjuste(qc, input).corpo, pendentes: base.pendentes as unknown as (AjusteEstoqueInput & { id: string })[] };
}

// ── Liquidar compromisso ─────────────────────────────────────────────────────

export type LiquidarCompromissoInput = {
  compromissoId: string;
  /** Só orienta o otimista: PAGAR tira da conta, RECEBER põe. */
  tipo: "PAGAR" | "RECEBER";
  operacaoId?: string;
  transacaoId?: string;
  contaId: string;
  valor: number;
  data: string;
  formaPagamento?: string;
  descricao?: string;
};
type CorpoLiquidacao = { transacaoId: string; contaId: string; valor: number; data: string; formaPagamento?: string; descricao?: string };
type LiquidacaoPreparada = { compromissoId: string; tipo: "PAGAR" | "RECEBER"; operacaoId?: string; corpo: CorpoLiquidacao };

function prepararLiquidacao(input: LiquidarCompromissoInput): LiquidacaoPreparada {
  const corpo: CorpoLiquidacao = {
    transacaoId: input.transacaoId ?? crypto.randomUUID(), contaId: input.contaId, valor: input.valor, data: input.data,
    ...(input.formaPagamento ? { formaPagamento: input.formaPagamento } : {}),
    ...(input.descricao ? { descricao: input.descricao } : {}),
  };
  validado(liquidacaoSchema.safeParse(corpo) as ResultadoZod<unknown>);
  return { compromissoId: input.compromissoId, tipo: input.tipo, operacaoId: input.operacaoId, corpo };
}

function liquidar(compromisso: Compromisso, valor: number): Compromisso {
  // A listagem de operações traz compromissos sem os valores liquidados; ali não há saldo a corrigir.
  if (compromisso.valorLiquidado == null) return compromisso;
  const valorLiquidado = arredondarDinheiro(Number(compromisso.valorLiquidado) + valor);
  const saldoPendente = Math.max(0, arredondarDinheiro(Number(compromisso.valorOriginal) - valorLiquidado));
  return {
    ...compromisso,
    valorLiquidado: dinheiro(valorLiquidado),
    saldoPendente: dinheiro(saldoPendente),
    ...(compromisso.saldoExigivel !== undefined ? { saldoExigivel: dinheiro(saldoPendente) } : {}),
    status: saldoPendente === 0 ? "LIQUIDADO" : "PARCIAL",
    vencido: saldoPendente === 0 ? false : compromisso.vencido,
  };
}

export function useLiquidarCompromisso() {
  const qc = useQueryClient();
  const base = useOfflineMutation<LiquidacaoPreparada, MovimentoGeral>({
    mutationKey: CHAVE_LIQUIDAR,
    path: (preparada) => `/financeiro/compromissos/${preparada.compromissoId}/liquidacoes`,
    method: "POST",
    body: (preparada) => preparada.corpo,
    queryKeys: (preparada) => {
      const { corpo, compromissoId } = preparada;
      const atualizar = (lista: Compromisso[]): Compromisso[] => {
        const existente = lista.find((item) => item.id === compromissoId);
        return existente ? updateItemInCacheList(lista, liquidar(existente, corpo.valor), (item) => item.id === compromissoId) : lista;
      };
      const compromisso = qc.getQueriesData<Compromisso[]>({ queryKey: financeiroKeys.compromissosTodos() })
        .flatMap(([, lista]) => lista ?? []).find((item) => item.id === compromissoId);
      const operacaoId = preparada.operacaoId ?? compromisso?.operacao.id;
      const direcao = preparada.tipo === "RECEBER" ? "ENTRADA" as const : "SAIDA" as const;
      const movimento: MovimentoGeral = {
        id: crypto.randomUUID(), seq: null, contaId: corpo.contaId, direcao, valor: dinheiro(corpo.valor), conta: contaDoCache(qc, corpo.contaId),
        transacao: {
          id: corpo.transacaoId, seq: null, tipo: preparada.tipo === "RECEBER" ? "RECEBIMENTO" : "PAGAMENTO", status: "CONFIRMADA", data: dataIso(corpo.data),
          descricao: corpo.descricao ?? (compromisso ? `Liquidação do compromisso${compromisso.seq != null ? ` #${compromisso.seq}` : ""}` : "Liquidação de compromisso"),
          formaPagamento: corpo.formaPagamento ?? null, parceiro: compromisso?.parceiro ?? null,
          operacao: compromisso ? { id: compromisso.operacao.id, numero: compromisso.operacao.numero, descricao: compromisso.operacao.descricao, tipo: compromisso.operacao.tipo } : null,
        },
      };
      return [
        ...porPrefixo<Compromisso[]>(qc, financeiroKeys.compromissosTodos(), atualizar),
        invalidar(financeiroKeys.compromissosTodos()),
        ...porPrefixo<DashboardFinanceiro>(qc, financeiroKeys.dashboardTodos(), (dashboard) => ({ ...dashboard, proximosCompromissos: atualizar(dashboard.proximosCompromissos) })),
        ...(operacaoId ? porPrefixo<Operacao>(qc, financeiroKeys.operacao(operacaoId), (operacao) => ({ ...operacao, compromissos: atualizar(operacao.compromissos) })) : []),
        ...porPrefixo<Operacao[]>(qc, financeiroKeys.operacoesTodos(), (lista) => lista.map((operacao) => operacao.id === operacaoId ? { ...operacao, compromissos: atualizar(operacao.compromissos) } : operacao)),
        invalidar(["financeiro", "operacao"]),
        invalidar(financeiroKeys.operacoesTodos()),
        ...entradasExtrato(qc, [movimento]),
        ...entradasSaldo(qc, deltasDosMovimentos([movimento])),
        invalidar(financeiroKeys.dashboardTodos()),
        invalidar(financeiroKeys.configuracoes()),
      ];
    },
  });

  function mutate(input: LiquidarCompromissoInput, opts?: Callbacks<unknown>) {
    const preparada = prepararLiquidacao(input);
    base.mutate(preparada, opts);
    return preparada.corpo.transacaoId;
  }

  return { mutate, validar: (input: LiquidarCompromissoInput) => prepararLiquidacao(input).corpo, pendentes: base.pendentes as unknown as CorpoLiquidacao[] };
}

// ── Transferência entre contas ───────────────────────────────────────────────

export type TransferirInput = { id?: string; contaOrigemId: string; contaDestinoId: string; valor: number; data: string; descricao?: string };
type TransferenciaPreparada = { corpo: TransferirInput & { id: string }; otimista: Operacao };

function prepararTransferencia(qc: QueryClient, input: TransferirInput): TransferenciaPreparada {
  const corpo = { ...input, id: input.id ?? crypto.randomUUID() };
  validado(transferenciaSchema.safeParse(corpo) as ResultadoZod<unknown>);
  if (corpo.contaOrigemId === corpo.contaDestinoId) throw erroDeValidacao("Escolha contas de origem e destino diferentes", "contaDestinoId");
  const valor = dinheiro(corpo.valor);
  const data = dataIso(corpo.data);
  const descricao = corpo.descricao ?? "Transferência entre contas";
  const otimista: Operacao = {
    id: corpo.id, numero: null, tipo: "TRANSFERENCIA_FINANCEIRA", status: "CONFIRMADA", data, descricao, valorTotal: valor,
    parceiro: null, corrigeOperacao: null, correcoes: [], itens: [], compromissos: [], movimentosEstoque: [], documentos: [],
    transacoes: [{
      id: crypto.randomUUID(), seq: null, tipo: "TRANSFERENCIA", status: "CONFIRMADA", data, valorTotal: valor, formaPagamento: null, operacaoId: corpo.id,
      movimentos: [
        { id: crypto.randomUUID(), seq: null, contaId: corpo.contaOrigemId, direcao: "SAIDA", valor, conta: contaDoCache(qc, corpo.contaOrigemId) },
        { id: crypto.randomUUID(), seq: null, contaId: corpo.contaDestinoId, direcao: "ENTRADA", valor, conta: contaDoCache(qc, corpo.contaDestinoId) },
      ],
    }],
  };
  return { corpo, otimista };
}

export function useTransferir() {
  const qc = useQueryClient();
  const base = useOfflineMutation<TransferenciaPreparada, Operacao>({
    mutationKey: CHAVE_TRANSFERIR,
    path: () => "/financeiro/transferencias",
    method: "POST",
    body: (preparada) => preparada.corpo,
    criarOtimista: (preparada) => preparada.otimista,
    queryKeys: (preparada) => {
      const movimentos = movimentosDaOperacao(qc, preparada.otimista);
      return [
        ...entradasOperacaoNova(qc, preparada.otimista),
        ...entradasExtrato(qc, movimentos),
        ...entradasSaldo(qc, deltasDosMovimentos(movimentos)),
        invalidar(financeiroKeys.dashboardTodos()),
        invalidar(financeiroKeys.configuracoes()),
      ];
    },
  });

  function mutate(input: TransferirInput, opts?: Callbacks<unknown>) {
    const preparada = prepararTransferencia(qc, input);
    base.mutate(preparada, {
      onSuccess: opts?.onSuccess,
      onError: (erro) => { qc.removeQueries({ queryKey: financeiroKeys.operacao(preparada.corpo.id), exact: true }); opts?.onError?.(erro); },
    });
    return preparada.corpo.id;
  }

  return { mutate, validar: (input: TransferirInput) => prepararTransferencia(qc, input).corpo, pendentes: base.pendentes as unknown as (TransferirInput & { id: string })[] };
}

// ── Descartar rascunho ───────────────────────────────────────────────────────

export function useDescartarRascunho() {
  const base = useOfflineMutation<void, undefined, null>({
    mutationKey: CHAVE_DESCARTAR,
    path: () => "/financeiro/operacoes/rascunho",
    method: "DELETE",
    queryKeys: () => [{ queryKey: financeiroKeys.rascunho(), aplicar: (): RascunhoOperacao | null => null }],
  });

  function mutate(_input?: void, opts?: Callbacks<null>) {
    prepararPublicacaoRascunho("escrita")(null);
    void limparRascunhoLocal();
    base.mutate(undefined, opts);
  }

  return { mutate, pendentes: base.pendentes };
}

// ── Saldo estimado ───────────────────────────────────────────────────────────

/** Contas cujo saldo em tela inclui escritas ainda não sincronizadas. */
export function useContasComSaldoEstimado(): ReadonlySet<string> {
  const fila = useSyncExternalStore(inscrever, obterFila, obterFila);
  return useMemo(() => {
    const contas = new Set<string>();
    for (const item of fila) {
      const corpo = item.body as Record<string, any> | undefined;
      if (!corpo) continue;
      if (item.mutationKey === CHAVE_LIQUIDAR) contas.add(corpo.contaId);
      if (item.mutationKey === CHAVE_TRANSFERIR) { contas.add(corpo.contaOrigemId); contas.add(corpo.contaDestinoId); }
      if (item.mutationKey === CHAVE_CRIAR && corpo.financeiro?.contaId) contas.add(corpo.financeiro.contaId);
    }
    return contas;
  }, [fila]);
}

/** Online pergunta ao servidor; sem conexão, vale o que o aparelho sabe (cache ou edição local). */
export async function existeRascunhoOperacao(qc: QueryClient, online: boolean): Promise<boolean> {
  if (online) return !!(await obterRascunhoOperacao());
  return !!(estadoRascunhoAtivo().rascunho ?? qc.getQueryData<RascunhoOperacao | null>(financeiroKeys.rascunho())) || !!(await lerRascunhoLocal());
}
