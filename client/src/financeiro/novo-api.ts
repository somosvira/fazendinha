import { comPropriedade } from "../propriedadeScope";

export type TipoConta = "BANCO" | "CAIXA" | "APLICACAO" | "DINHEIRO";
export type TipoParceiro = "CLIENTE" | "FORNECEDOR" | "AMBOS" | "FUNCIONARIO" | "PROPRIETARIO" | "OUTRO";
export type ContaBase = { id: number; nome: string; tipo: TipoConta; instituicao: string | null; identificacao: string | null; saldoAbertura: string; dataSaldoAbertura: string; incluirNoSaldoGeral: boolean; ativo: boolean };
export type Conta = ContaBase & { saldoAtual: string; temMovimentos: boolean };
export type ParceiroBase = { id: number; nome: string; documento: string | null; tipo: TipoParceiro; telefone: string | null; email: string | null; ativo: boolean };
export type Parceiro = ParceiroBase & { referencias: number };
export type ContaInput = { nome: string; tipo: TipoConta; instituicao?: string | null; identificacao?: string | null; saldoAbertura: number; dataSaldoAbertura: string; incluirNoSaldoGeral: boolean };
export type ContaPatch = Partial<ContaInput> & { ativo?: boolean };
export type ParceiroInput = { nome: string; documento?: string | null; tipo: TipoParceiro; telefone?: string | null; email?: string | null };
export type ParceiroPatch = Partial<ParceiroInput> & { ativo?: boolean };
export type Categoria = { id: number; nome: string };
export type GrupoCategoria = { id: number; nome: string; categorias: Categoria[] };
export type CentroCusto = { id: number; nome: string; ehInvestimento: boolean };
export type Produto = { id: number; nome: string; unidade: string; estocavel: boolean; custoUnitario: string | null };
export type ConfiguracoesFinanceiras = { contas: Conta[]; parceiros: Parceiro[]; gruposCategorias: GrupoCategoria[]; centrosCusto: CentroCusto[]; produtos: Produto[] };
export type Compromisso = { id: number; tipo: "PAGAR" | "RECEBER"; status: string; valorOriginal: string; valorLiquidado: string; saldoPendente: string; dataVencimento: string; vencido: boolean; parceiro: ParceiroBase | null; operacao: { id: number; tipo: string; descricao: string | null } };
export type ItemOperacao = { id: number; descricao: string; quantidade: string; unidade: string; valorUnitario: string; valorTotal: string; estocavel: boolean; produtoId: number | null };
export type MovimentoEstoqueOperacao = { id: number; tipo: string; status: string; quantidade: string; valorTotal: string; produtoId: number };
export type TransacaoOperacao = { id: number; tipo: string; status: string; data?: string; valorTotal: string; formaPagamento?: string | null; movimentos?: { id: number; contaId: number; direcao: "ENTRADA" | "SAIDA"; valor: string }[] };
export type DocumentoFinanceiro = { id: number; tipo: string; nome: string; numero: string | null; mimeType: string | null; tamanhoBytes: number | null };
export type RascunhoOperacao = { id: number; dados: { formulario?: Record<string, unknown>; operacao?: Record<string, unknown> }; versao: number; updatedAt: string; documentos: DocumentoFinanceiro[] };
export type Operacao = { id: number; tipo: string; status: string; data: string; descricao: string | null; valorTotal: string; parceiro: ParceiroBase | null; parceiroId?: number | null; categoriaId?: number | null; centroCustoId?: number | null; corrigeOperacaoId?: number | null; corrigeOperacao?: { id: number; descricao: string | null } | null; correcoes?: { id: number; descricao: string | null; status: string }[]; itens: ItemOperacao[]; compromissos: Compromisso[]; transacoes: TransacaoOperacao[]; movimentosEstoque: MovimentoEstoqueOperacao[]; documentos: DocumentoFinanceiro[] };
export type MovimentoConta = { id: number; contaId?: number; direcao: "ENTRADA" | "SAIDA"; valor: string; transacao: { id: number; tipo: string; status: string; data: string; descricao: string | null; formaPagamento: string | null; parceiro: ParceiroBase | null; operacao: { id: number; descricao: string | null; tipo: string } | null } };
export type DashboardFinanceiro = { periodo: { inicio: string; fim: string }; saldoGeral: string; contas: Conta[]; realizado: { entradas: string; saidas: string; resultado: string }; compromissos: { aPagar: string; aReceber: string }; despesasPorCategoria: { categoria: string; valor: string }[] };

/** Erro da API financeira: `campo` indica o input ao qual a mensagem se refere. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public campo?: string) { super(message); this.name = "ApiError"; }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api${path}`, {
    ...init,
    headers: comPropriedade({ ...(init?.body ? { "content-type": "application/json" } : {}), ...((init?.headers as Record<string, string>) ?? {}) }),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new ApiError(corpo.error ?? `Erro HTTP ${resposta.status}`, resposta.status, corpo.code, corpo.campo);
  return corpo as T;
}

export const obterDashboardFinanceiro = (inicio?: string, fim?: string) => req<DashboardFinanceiro>(`/financeiro/dashboard${inicio && fim ? `?inicio=${inicio}&fim=${fim}` : ""}`);
export const obterConfiguracoesFinanceiras = () => req<ConfiguracoesFinanceiras>("/financeiro/configuracoes");
export const listarOperacoes = (filtros?: { inicio?: string; fim?: string }) => {
  const query = new URLSearchParams(Object.entries(filtros ?? {}).filter(([, valor]) => !!valor) as [string, string][]).toString();
  return req<Operacao[]>(`/financeiro/operacoes${query ? `?${query}` : ""}`);
};
export const obterOperacao = (id: number) => req<Operacao>(`/financeiro/operacoes/${id}`);
export const listarCompromissos = () => req<Compromisso[]>("/financeiro/compromissos");
export const obterExtratoConta = (id: number) => req<MovimentoConta[]>(`/financeiro/contas/${id}/extrato`);
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
  if (!resposta.ok) throw new ApiError(corpo.error ?? `Erro HTTP ${resposta.status}`, resposta.status, corpo.code, corpo.campo);
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
  if (!resposta.ok) throw new ApiError(corpo.error ?? `Erro HTTP ${resposta.status}`, resposta.status, corpo.code, corpo.campo);
  return corpo as DocumentoFinanceiro;
}
export const estornarOperacao = (id: number, motivo: string) => req<Operacao>(`/financeiro/operacoes/${id}/estorno`, { method: "POST", body: JSON.stringify({ motivo }) });
export const liquidarCompromisso = (id: number, input: unknown) => req(`/financeiro/compromissos/${id}/liquidacoes`, { method: "POST", body: JSON.stringify(input) });
export const criarConta = (input: ContaInput) => req<Conta>("/financeiro/contas", { method: "POST", body: JSON.stringify(input) });
export const atualizarConta = (id: number, input: ContaPatch) => req<Conta>(`/financeiro/contas/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const criarParceiro = (input: ParceiroInput) => req<Parceiro>("/financeiro/parceiros", { method: "POST", body: JSON.stringify(input) });
export const atualizarParceiro = (id: number, input: ParceiroPatch) => req<Parceiro>(`/financeiro/parceiros/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const transferir = (input: unknown) => req("/financeiro/transferencias", { method: "POST", body: JSON.stringify(input) });
