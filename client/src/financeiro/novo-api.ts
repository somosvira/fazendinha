import { comPropriedade } from "../propriedadeScope";
import {
  contaSchema,
  liquidacaoSchema,
  operacaoSchema,
  parceiroSchema,
  rascunhoOperacaoSchema,
  transferenciaSchema,
  type EntityId,
} from "@fazendinha/shared";

export type Conta = { id: EntityId; nome: string; tipo: "BANCO" | "CAIXA" | "APLICACAO" | "DINHEIRO"; instituicao: string | null; identificacao: string | null; saldoAbertura: string; dataSaldoAbertura: string; saldoAtual: string; incluirNoSaldoGeral: boolean; ativo: boolean };
export type Parceiro = { id: EntityId; nome: string; documento: string | null; tipo: string; telefone: string | null; email: string | null; ativo: boolean };
export type Categoria = { id: EntityId; nome: string };
export type GrupoCategoria = { id: EntityId; nome: string; categorias: Categoria[] };
export type CentroCusto = { id: EntityId; nome: string; ehInvestimento: boolean };
export type Produto = { id: number; nome: string; unidade: string; estocavel: boolean; custoUnitario: string | null };
export type ConfiguracoesFinanceiras = { contas: Conta[]; parceiros: Parceiro[]; gruposCategorias: GrupoCategoria[]; centrosCusto: CentroCusto[]; produtos: Produto[] };
export type Compromisso = { id: EntityId; tipo: "PAGAR" | "RECEBER"; status: string; valorOriginal: string; valorLiquidado: string; saldoPendente: string; dataVencimento: string; numeroParcela: number; totalParcelas: number; vencido: boolean; parceiro: Parceiro | null; operacao: { id: EntityId; numero: number; tipo: string; descricao: string | null } };
export type ItemOperacao = { id: EntityId; ordem: number; descricao: string; quantidade: string; unidade: string; valorUnitario: string; valorTotal: string; estocavel: boolean; produtoId: number | null };
export type MovimentoEstoqueOperacao = { id: number; tipo: string; status: string; quantidade: string; valorTotal: string; produtoId: number };
export type TransacaoOperacao = { id: EntityId; tipo: string; status: string; data?: string; valorTotal: string; formaPagamento?: string | null; movimentos?: { id: EntityId; contaId: EntityId; direcao: "ENTRADA" | "SAIDA"; valor: string }[] };
export type DocumentoFinanceiro = { id: EntityId; tipo: string; nome: string; numero: string | null; mimeType: string | null; tamanhoBytes: number | null };
export type RascunhoOperacao = { id: EntityId; dados: { formulario?: Record<string, unknown>; operacao?: Record<string, unknown> }; versao: number; updatedAt: string; documentos: DocumentoFinanceiro[] };
export type Operacao = { id: EntityId; numero: number; registradoEm: string; tipo: string; status: string; data: string; descricao: string | null; valorTotal: string; parceiro: Parceiro | null; parceiroId?: EntityId | null; categoriaId?: EntityId | null; centroCustoId?: EntityId | null; corrigeOperacaoId?: EntityId | null; corrigeOperacao?: { id: EntityId; numero?: number; descricao: string | null } | null; correcoes?: { id: EntityId; numero?: number; descricao: string | null; status: string }[]; itens: ItemOperacao[]; compromissos: Compromisso[]; transacoes: TransacaoOperacao[]; movimentosEstoque: MovimentoEstoqueOperacao[]; documentos: DocumentoFinanceiro[] };
export type MovimentoConta = { id: EntityId; contaId?: EntityId; direcao: "ENTRADA" | "SAIDA"; valor: string; transacao: { id: EntityId; tipo: string; status: string; data: string; descricao: string | null; formaPagamento: string | null; parceiro: Parceiro | null; operacao: { id: EntityId; numero: number; descricao: string | null; tipo: string } | null } };
export type DashboardFinanceiro = { periodo: { inicio: string; fim: string }; saldoGeral: string; contas: Conta[]; realizado: { entradas: string; saidas: string; resultado: string }; compromissos: { aPagar: string; aReceber: string }; despesasPorCategoria: { categoria: string; valor: string }[] };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api${path}`, {
    ...init,
    headers: comPropriedade({ ...(init?.body ? { "content-type": "application/json" } : {}), ...((init?.headers as Record<string, string>) ?? {}) }),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.error ?? `Erro HTTP ${resposta.status}`);
  return corpo as T;
}

export const obterDashboardFinanceiro = (inicio?: string, fim?: string) => req<DashboardFinanceiro>(`/financeiro/dashboard${inicio && fim ? `?inicio=${inicio}&fim=${fim}` : ""}`);
export const obterConfiguracoesFinanceiras = () => req<ConfiguracoesFinanceiras>("/financeiro/configuracoes");
export const listarOperacoes = (filtros?: { inicio?: string; fim?: string }) => {
  const query = new URLSearchParams(Object.entries(filtros ?? {}).filter(([, valor]) => !!valor) as [string, string][]).toString();
  return req<Operacao[]>(`/financeiro/operacoes${query ? `?${query}` : ""}`);
};
export const obterOperacao = (id: EntityId) => req<Operacao>(`/financeiro/operacoes/${id}`);
export const listarCompromissos = () => req<Compromisso[]>("/financeiro/compromissos");
export const obterExtratoConta = (id: EntityId) => req<MovimentoConta[]>(`/financeiro/contas/${id}/extrato`);
export const criarOperacao = (input: unknown) => req<Operacao>("/financeiro/operacoes", { method: "POST", body: JSON.stringify(operacaoSchema.parse(input)) });
export const obterRascunhoOperacao = () => req<RascunhoOperacao | null>("/financeiro/operacoes/rascunho");
export const salvarRascunhoOperacao = (dados: unknown, versao: number | undefined, id: EntityId) => req<RascunhoOperacao>("/financeiro/operacoes/rascunho", { method: "PUT", body: JSON.stringify(rascunhoOperacaoSchema.parse({ id, dados, versao })) });
export const descartarRascunhoOperacao = () => req<void>("/financeiro/operacoes/rascunho", { method: "DELETE" });
export const confirmarRascunhoOperacao = (versao?: number) => req<Operacao>("/financeiro/operacoes/rascunho/confirmacao", { method: "POST", body: JSON.stringify({ versao }) });
export async function anexarDocumentoRascunho(input: { id: EntityId; arquivo: File; tipo: string; numero?: string }) {
  const form = new FormData(); form.set("id", input.id); form.set("arquivo", input.arquivo); form.set("nome", input.arquivo.name); form.set("tipo", input.tipo);
  if (input.numero) form.set("numero", input.numero);
  const resposta = await fetch("/api/financeiro/operacoes/rascunho/documentos", { method: "POST", body: form, headers: comPropriedade() });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.error ?? `Erro HTTP ${resposta.status}`);
  return corpo as DocumentoFinanceiro;
}
export async function removerDocumentoRascunho(id: EntityId) {
  const resposta = await fetch(`/api/financeiro/operacoes/rascunho/documentos/${id}`, { method: "DELETE", headers: comPropriedade() });
  if (!resposta.ok) { const corpo = await resposta.json().catch(() => ({})); throw new Error(corpo.error ?? `Erro HTTP ${resposta.status}`); }
}
export const atualizarDocumentoRascunho = (id: EntityId, input: { tipo?: string; numero?: string | null }) => req<DocumentoFinanceiro>(`/financeiro/operacoes/rascunho/documentos/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export async function anexarDocumentoOperacao(operacaoId: EntityId, input: { id: EntityId; arquivo: File; tipo: string; numero?: string }) {
  const form = new FormData();
  form.set("id", input.id);
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
export const estornarOperacao = (id: EntityId, motivo: string) => req<Operacao>(`/financeiro/operacoes/${id}/estorno`, { method: "POST", body: JSON.stringify({ motivo }) });
export const liquidarCompromisso = (id: EntityId, input: unknown) => req(`/financeiro/compromissos/${id}/liquidacoes`, { method: "POST", body: JSON.stringify(liquidacaoSchema.parse(input)) });
export const criarConta = (input: unknown) => req<Conta>("/financeiro/contas", { method: "POST", body: JSON.stringify(contaSchema.parse(input)) });
export const atualizarConta = (id: EntityId, input: unknown) => req<Conta>(`/financeiro/contas/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const criarParceiro = (input: unknown) => req<Parceiro>("/financeiro/parceiros", { method: "POST", body: JSON.stringify(parceiroSchema.parse(input)) });
export const atualizarParceiro = (id: EntityId, input: unknown) => req<Parceiro>(`/financeiro/parceiros/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const transferir = (input: unknown) => req("/financeiro/transferencias", { method: "POST", body: JSON.stringify(transferenciaSchema.parse(input)) });
