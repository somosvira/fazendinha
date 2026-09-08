import { useQuery } from "@tanstack/react-query";
import { arredondar, preverEfeitosOperacao, type OperacaoInput as OperacaoSchemaInput } from "@rionovo/shared";
import { comPropriedade } from "../propriedadeScope";
import { req } from "../lib/offline/req";
import { criarIdOtimista, criarIdTemporario, prependItemToCacheList, useOfflineMutation } from "../lib/offline/useOfflineMutation";

export type Conta = { id: number; nome: string; tipo: "BANCO" | "CAIXA" | "APLICACAO" | "DINHEIRO"; instituicao: string | null; identificacao: string | null; saldoAbertura: string; dataSaldoAbertura: string; saldoAtual: string; incluirNoSaldoGeral: boolean; ativo: boolean };
export type Parceiro = { id: number; nome: string; documento: string | null; tipo: string; telefone: string | null; email: string | null; ativo: boolean };
export type Categoria = { id: number; nome: string };
export type GrupoCategoria = { id: number; nome: string; categorias: Categoria[] };
export type CentroCusto = { id: number; nome: string; ehInvestimento: boolean };
export type Produto = { id: number; nome: string; unidade: string; estocavel: boolean; custoUnitario: string | null };
export type ConfiguracoesFinanceiras = { contas: Conta[]; parceiros: Parceiro[]; gruposCategorias: GrupoCategoria[]; centrosCusto: CentroCusto[]; produtos: Produto[] };
// id: number | string — string só quando ainda não sincronizou (id temporário
// ou "otimista:", ver lib/offline/useOfflineMutation.ts). idPendenteDeSync(id)
// diz quando uma ação que depende de id real deve ficar indisponível.
export type Compromisso = { id: number | string; tipo: "PAGAR" | "RECEBER"; status: string; valorOriginal: string; valorLiquidado: string; saldoPendente: string; dataVencimento: string; vencido: boolean; parceiro: Parceiro | null; operacao: { id: number | string; tipo: string; descricao: string | null } };
export type ItemOperacao = { id: number; descricao: string; quantidade: string; unidade: string; valorUnitario: string; valorTotal: string; estocavel: boolean; produtoId: number | null };
export type MovimentoEstoqueOperacao = { id: number; tipo: string; status: string; quantidade: string; valorTotal: string; produtoId: number };
export type TransacaoOperacao = { id: number; tipo: string; status: string; data?: string; valorTotal: string; formaPagamento?: string | null; movimentos?: { id: number; contaId: number; direcao: "ENTRADA" | "SAIDA"; valor: string }[] };
export type DocumentoFinanceiro = { id: number; tipo: string; nome: string; numero: string | null; mimeType: string | null; tamanhoBytes: number | null };
export type RascunhoOperacao = { id: number; dados: { formulario?: Record<string, unknown>; operacao?: Record<string, unknown> }; versao: number; updatedAt: string; documentos: DocumentoFinanceiro[] };
export type Operacao = { id: number | string; tipo: string; status: string; data: string; descricao: string | null; valorTotal: string; parceiro: Parceiro | null; parceiroId?: number | null; categoriaId?: number | null; centroCustoId?: number | null; corrigeOperacaoId?: number | null; corrigeOperacao?: { id: number; descricao: string | null } | null; correcoes?: { id: number; descricao: string | null; status: string }[]; itens: ItemOperacao[]; compromissos: Compromisso[]; transacoes: TransacaoOperacao[]; movimentosEstoque: MovimentoEstoqueOperacao[]; documentos: DocumentoFinanceiro[] };
export type MovimentoConta = { id: number; contaId?: number; direcao: "ENTRADA" | "SAIDA"; valor: string; transacao: { id: number; tipo: string; status: string; data: string; descricao: string | null; formaPagamento: string | null; parceiro: Parceiro | null; operacao: { id: number; descricao: string | null; tipo: string } | null } };
export type DashboardFinanceiro = { periodo: { inicio: string; fim: string }; saldoGeral: string; contas: Conta[]; realizado: { entradas: string; saidas: string; resultado: string }; compromissos: { aPagar: string; aReceber: string }; despesasPorCategoria: { categoria: string; valor: string }[] };

export const obterDashboardFinanceiro = (inicio?: string, fim?: string) => req<DashboardFinanceiro>(`/financeiro/dashboard${inicio && fim ? `?inicio=${inicio}&fim=${fim}` : ""}`);
export const obterConfiguracoesFinanceiras = () => req<ConfiguracoesFinanceiras>("/financeiro/configuracoes");
export const listarOperacoes = (filtros?: { inicio?: string; fim?: string }) => {
  const query = new URLSearchParams(Object.entries(filtros ?? {}).filter(([, valor]) => !!valor) as [string, string][]).toString();
  return req<Operacao[]>(`/financeiro/operacoes${query ? `?${query}` : ""}`);
};
export const obterOperacao = (id: number) => req<Operacao>(`/financeiro/operacoes/${id}`);
export const listarCompromissos = () => req<Compromisso[]>("/financeiro/compromissos");
export const obterExtratoConta = (id: number) => req<MovimentoConta[]>(`/financeiro/contas/${id}/extrato`);

// Query key factory do módulo (convenção offline — ver docs/design/offline/README.md).
export const financeiroKeys = {
  dashboardTodos: () => ["financeiro", "dashboard"] as const,
  dashboard: (inicio?: string, fim?: string) => ["financeiro", "dashboard", inicio ?? null, fim ?? null] as const,
  configuracoes: () => ["financeiro", "configuracoes"] as const,
  operacoesTodos: () => ["financeiro", "operacoes"] as const,
  operacoes: (filtros?: { inicio?: string; fim?: string }) => ["financeiro", "operacoes", filtros?.inicio ?? null, filtros?.fim ?? null] as const,
  operacao: (id: number) => ["financeiro", "operacao", id] as const,
  compromissos: () => ["financeiro", "compromissos"] as const,
  extrato: (contaId: number) => ["financeiro", "extrato", contaId] as const,
  rascunho: () => ["financeiro", "rascunho"] as const,
};

export function useDashboardFinanceiro(inicio?: string, fim?: string) {
  return useQuery({ queryKey: financeiroKeys.dashboard(inicio, fim), queryFn: () => obterDashboardFinanceiro(inicio, fim) });
}
export function useConfiguracoesFinanceiras() {
  return useQuery({ queryKey: financeiroKeys.configuracoes(), queryFn: () => obterConfiguracoesFinanceiras() });
}
export function useOperacoesFinanceiras(filtros?: { inicio?: string; fim?: string }) {
  return useQuery({ queryKey: financeiroKeys.operacoes(filtros), queryFn: () => listarOperacoes(filtros) });
}
export function useOperacaoFinanceira(id: number) {
  return useQuery({ queryKey: financeiroKeys.operacao(id), queryFn: () => obterOperacao(id) });
}
export function useCompromissosFinanceiros() {
  return useQuery({ queryKey: financeiroKeys.compromissos(), queryFn: () => listarCompromissos() });
}
export function useExtratoConta(contaId: number | null) {
  return useQuery({ queryKey: financeiroKeys.extrato(contaId ?? 0), queryFn: () => obterExtratoConta(contaId!), enabled: contaId != null });
}
export function useRascunhoOperacao() {
  return useQuery({ queryKey: financeiroKeys.rascunho(), queryFn: () => obterRascunhoOperacao() });
}
export const criarOperacao = (input: unknown) => req<Operacao>("/financeiro/operacoes", { method: "POST", body: JSON.stringify(input) });
export const obterRascunhoOperacao = () => req<RascunhoOperacao | null>("/financeiro/operacoes/rascunho");
export const salvarRascunhoOperacao = (dados: unknown, versao?: number) => req<RascunhoOperacao>("/financeiro/operacoes/rascunho", { method: "PUT", body: JSON.stringify({ dados, versao }) });
export const descartarRascunhoOperacao = () => req<void>("/financeiro/operacoes/rascunho", { method: "DELETE" });
export const confirmarRascunhoOperacao = (versao?: number) => req<Operacao>("/financeiro/operacoes/rascunho/confirmacao", { method: "POST", body: JSON.stringify({ versao }) });
export async function anexarDocumentoRascunho(input: { arquivo: File; tipo: string; numero?: string }) {
  const form = new FormData(); form.set("arquivo", input.arquivo); form.set("nome", input.arquivo.name); form.set("tipo", input.tipo);
  if (input.numero) form.set("numero", input.numero);
  const resposta = await fetch("/api/financeiro/operacoes/rascunho/documentos", { method: "POST", body: form, headers: comPropriedade() });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.error ?? `Erro HTTP ${resposta.status}`);
  return corpo as DocumentoFinanceiro;
}
export async function removerDocumentoRascunho(id: number) {
  const resposta = await fetch(`/api/financeiro/operacoes/rascunho/documentos/${id}`, { method: "DELETE", headers: comPropriedade() });
  if (!resposta.ok) { const corpo = await resposta.json().catch(() => ({})); throw new Error(corpo.error ?? `Erro HTTP ${resposta.status}`); }
}
export const atualizarDocumentoRascunho = (id: number, input: { tipo?: string; numero?: string | null }) => req<DocumentoFinanceiro>(`/financeiro/operacoes/rascunho/documentos/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export async function anexarDocumentoOperacao(operacaoId: number, input: { arquivo: File; tipo: string; numero?: string }) {
  const form = new FormData();
  form.set("arquivo", input.arquivo);
  form.set("nome", input.arquivo.name);
  form.set("tipo", input.tipo);
  if (input.numero) form.set("numero", input.numero);
  const resposta = await fetch(`/api/financeiro/operacoes/${operacaoId}/documentos`, {
    method: "POST", body: form, headers: comPropriedade(),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.error ?? `Erro HTTP ${resposta.status}`);
  return corpo as DocumentoFinanceiro;
}
export const estornarOperacao = (id: number, motivo: string) => req<Operacao>(`/financeiro/operacoes/${id}/estorno`, { method: "POST", body: JSON.stringify({ motivo }) });

export type LiquidarCompromissoInput = { compromissoId: number; contaId: number; valor: number; data: string; formaPagamento?: string; descricao?: string };

// Update in-place num Compromisso JÁ EXISTENTE (id real — nunca criado
// offline nesta fatia) — sem criarOtimista, a fórmula (saldo zerou?
// LIQUIDADO : PARCIAL) é determinística e lida do próprio cache, não
// duplicada aqui. Extrato/dashboard/saldo de conta são invalidate-only:
// dado agregado no servidor, não dá pra patchar sem duplicar a conta.
export function useLiquidarCompromisso() {
  return useOfflineMutation<LiquidarCompromissoInput, Compromisso>({
    mutationKey: "financeiro-liquidar-compromisso",
    path: (input) => `/financeiro/compromissos/${input.compromissoId}/liquidacoes`,
    method: "POST",
    body: (input) => ({ contaId: input.contaId, valor: input.valor, data: input.data, formaPagamento: input.formaPagamento, descricao: input.descricao }),
    queryKeys: (input) => [
      {
        queryKey: financeiroKeys.compromissos(),
        aplicar: (atual: Compromisso[] | undefined) => (atual ?? []).map((c) => {
          if (c.id !== input.compromissoId) return c;
          const valorLiquidado = arredondar(Number(c.valorLiquidado) + input.valor);
          const saldoPendente = Math.max(0, arredondar(Number(c.valorOriginal) - valorLiquidado));
          return { ...c, valorLiquidado: String(valorLiquidado), saldoPendente: String(saldoPendente), status: saldoPendente <= 0.005 ? "LIQUIDADO" : "PARCIAL" };
        }),
      },
      { queryKey: financeiroKeys.extrato(input.contaId) },
      { queryKey: financeiroKeys.dashboardTodos() },
      { queryKey: financeiroKeys.configuracoes() },
    ],
  });
}

// Mesma forma de entrada que o formulário já monta pro caminho de correção
// (criarOperacao direto, sem rascunho) — é o que o "Confirmar operação"
// offline reaproveita, pulando o rascunho inteiro (ver
// docs/design/offline/PLANO_FINANCEIRO.md).
export type CriarOperacaoInput = OperacaoSchemaInput;

// itemOtimista é construído a partir de preverEfeitosOperacao (mesma função
// pura que o server usa em criarOperacaoTx) — não é uma segunda
// implementação da regra, é a mesma regra lida de outro lugar. Itens/
// movimentos de estoque/transação embutidos na Operação otimista recebem id
// numérico sequencial local (nunca olhado por id em lugar nenhum da UI);
// os compromissos, por serem endereçáveis à parte (liquidação), recebem
// ID_OTIMISTA_PREFIXO e ficam com a ação bloqueada até sincronizar
// (idPendenteDeSync).
function construirOperacaoOtimista(input: CriarOperacaoInput): Operacao {
  const previsto = preverEfeitosOperacao(input);
  const id = criarIdTemporario();
  const dataIso = typeof input.data === "string" ? input.data : (input.data as Date).toISOString();
  let proximoId = -1;
  const itens: ItemOperacao[] = previsto.itens.map((item) => ({
    id: proximoId--, descricao: item.descricao, quantidade: String(item.quantidade), unidade: item.unidade,
    valorUnitario: String(item.valorUnitario), valorTotal: String(item.valorTotal), estocavel: item.estocavel, produtoId: item.produtoId ?? null,
  }));
  const movimentosEstoque: MovimentoEstoqueOperacao[] = previsto.movimentosEstoque.map((m) => ({
    id: proximoId--, tipo: m.tipo, status: "CONFIRMADO", quantidade: String(m.quantidade), valorTotal: String(m.valorTotal), produtoId: m.produtoId,
  }));
  const compromissos: Compromisso[] = previsto.compromissos.map((c) => ({
    id: criarIdOtimista(), tipo: c.tipo, status: "PENDENTE", valorOriginal: String(c.valorOriginal), valorLiquidado: "0",
    saldoPendente: String(c.valorOriginal), dataVencimento: c.dataVencimento.toISOString(), vencido: false, parceiro: null,
    operacao: { id, tipo: input.tipo, descricao: input.descricao },
  }));
  const transacoes: TransacaoOperacao[] = previsto.transacao ? [{
    id: proximoId--, tipo: previsto.transacao.tipo, status: "CONFIRMADA", data: dataIso, valorTotal: String(previsto.transacao.valorTotal),
    formaPagamento: previsto.transacao.formaPagamento ?? null,
    movimentos: [{ id: proximoId--, contaId: previsto.transacao.contaId, direcao: previsto.transacao.direcao, valor: String(previsto.transacao.valorTotal) }],
  }] : [];
  return {
    id, tipo: input.tipo, status: "CONFIRMADA", data: dataIso, descricao: input.descricao, valorTotal: String(previsto.valorTotal),
    parceiro: null, parceiroId: input.parceiroId ?? null, categoriaId: input.categoriaId ?? null, centroCustoId: input.centroCustoId ?? null,
    corrigeOperacaoId: input.corrigeOperacaoId ?? null, itens, compromissos, transacoes, movimentosEstoque, documentos: [],
  };
}

// Patch otimista só na lista de Operações (a tela que o usuário está olhando
// na hora de confirmar) e, quando a operação cria compromissos, na lista de
// Compromissos. Dashboard/configurações (saldo agregado) ficam
// invalidate-only — dado somado no servidor, não dá pra patchar sem duplicar
// a conta (mesmo critério do useLiquidarCompromisso acima). filtrosLista
// precisa ser o filtro ATIVO da tela (inicio/fim) — setQueryData exige a
// chave exata; sem isso o patch escreveria numa entrada de cache que a tela
// não lê.
export function useCriarOperacao(filtrosLista?: { inicio?: string; fim?: string }) {
  return useOfflineMutation<CriarOperacaoInput, Operacao>({
    mutationKey: "financeiro-criar-operacao",
    path: () => "/financeiro/operacoes",
    method: "POST",
    body: (input) => input,
    criarOtimista: construirOperacaoOtimista,
    queryKeys: (_input, itemOtimista) => [
      {
        queryKey: financeiroKeys.operacoes(filtrosLista),
        aplicar: (atual: Operacao[] | undefined) => itemOtimista ? prependItemToCacheList(atual, itemOtimista) : (atual ?? []),
      },
      ...(itemOtimista && itemOtimista.compromissos.length ? [{
        queryKey: financeiroKeys.compromissos(),
        aplicar: (atual: Compromisso[] | undefined) => [...(atual ?? []), ...itemOtimista.compromissos],
      }] : []),
      { queryKey: financeiroKeys.dashboardTodos() },
      { queryKey: financeiroKeys.configuracoes() },
      { queryKey: financeiroKeys.rascunho() },
    ],
  });
}

export const criarConta = (input: unknown) => req<Conta>("/financeiro/contas", { method: "POST", body: JSON.stringify(input) });
export const atualizarConta = (id: number, input: unknown) => req<Conta>(`/financeiro/contas/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const criarParceiro = (input: unknown) => req<Parceiro>("/financeiro/parceiros", { method: "POST", body: JSON.stringify(input) });
export const atualizarParceiro = (id: number, input: unknown) => req<Parceiro>(`/financeiro/parceiros/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export type TransferirInput = { contaOrigemId: number; contaDestinoId: number; valor: number; data: string; descricao?: string };

// A tela que chama isto (Contas) não conhece o filtro inicio/fim ativo em
// Operações — ao contrário de useCriarOperacao, não dá pra patchar a lista
// de Operações com chave exata daqui, só invalidar por prefixo
// (financeiroKeys.operacoesTodos()). Os dois extratos, sim: contaOrigemId/
// contaDestinoId são conhecidos aqui e viram patch otimista de verdade.
export function useTransferir() {
  return useOfflineMutation<TransferirInput, { origem: MovimentoConta; destino: MovimentoConta }>({
    mutationKey: "financeiro-transferir",
    path: () => "/financeiro/transferencias",
    method: "POST",
    body: (input) => input,
    criarOtimista: (input) => {
      // Só a Operação/Transação "primária" de uma escrita ganha id
      // reconciliável (criarIdTemporario) — esta é embutida no extrato e
      // nunca endereçada por id em lugar nenhum da UI, então um placeholder
      // numérico basta (corrige no refetch pós-sync).
      const transacao = {
        id: -1, tipo: "TRANSFERENCIA", status: "CONFIRMADA", data: input.data,
        descricao: input.descricao ?? "Transferência entre contas", formaPagamento: null, parceiro: null, operacao: null,
      };
      return {
        origem: { id: -1, contaId: input.contaOrigemId, direcao: "SAIDA" as const, valor: String(input.valor), transacao },
        destino: { id: -2, contaId: input.contaDestinoId, direcao: "ENTRADA" as const, valor: String(input.valor), transacao },
      };
    },
    queryKeys: (input, itemOtimista) => [
      {
        queryKey: financeiroKeys.extrato(input.contaOrigemId),
        aplicar: (atual: MovimentoConta[] | undefined) => itemOtimista ? prependItemToCacheList(atual, itemOtimista.origem) : (atual ?? []),
      },
      {
        queryKey: financeiroKeys.extrato(input.contaDestinoId),
        aplicar: (atual: MovimentoConta[] | undefined) => itemOtimista ? prependItemToCacheList(atual, itemOtimista.destino) : (atual ?? []),
      },
      { queryKey: financeiroKeys.operacoesTodos() },
      { queryKey: financeiroKeys.dashboardTodos() },
      { queryKey: financeiroKeys.configuracoes() },
    ],
  });
}
