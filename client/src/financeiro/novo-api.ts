import { comPropriedade } from "../propriedadeScope";
import type { RelatorioGerencialDTO } from "../components/relatorio-gerencial/types";
import { prepararPublicacaoRascunho } from "./rascunhoAtivo";
import { prepararPublicacaoRascunhoRelatorio } from "./rascunhoRelatorioAtivo";
import type { UnidadeMedida } from "../lib/unidades";
import { SEM_VINCULO } from "../lib/ids";

export type TipoConta = "BANCO" | "CAIXA" | "APLICACAO";
export type PapelParceiro = "CLIENTE" | "FORNECEDOR" | "PRESTADOR_SERVICO" | "FUNCIONARIO" | "PROPRIETARIO" | "OUTRO";
export type TipoBancario = "CORRENTE" | "POUPANCA" | "PAGAMENTO";
export type DadosConta = {
  tipoBancario?: TipoBancario | null; agencia?: string | null; numeroConta?: string | null; digito?: string | null;
  titular?: string | null; local?: string | null; responsavel?: string | null; observacoes?: string | null; ordem?: number;
};
export type DadosParceiro = {
  papeis?: PapelParceiro[]; nomeFantasia?: string | null; pessoaContato?: string | null; telefoneWhatsapp?: boolean;
  cep?: string | null; logradouro?: string | null; numero?: string | null; complemento?: string | null;
  bairro?: string | null; cidade?: string | null; uf?: string | null; referencia?: string | null; observacoes?: string | null;
  formaPagamentoPreferida?: string | null; condicaoPagamentoPreferida?: "A_VISTA" | "A_PRAZO" | null; prazosPagamento?: number[];
};
export type TipoParceiro = "CLIENTE" | "FORNECEDOR" | "AMBOS" | "FUNCIONARIO" | "PROPRIETARIO" | "OUTRO";
export type ContaBase = { id: string; nome: string; tipo: TipoConta; instituicao: string | null; identificacao: string | null; saldoAbertura: string; dataSaldoAbertura: string; incluirNoSaldoGeral: boolean; ativo: boolean };
export type Conta = ContaBase & DadosConta & { saldoAtual: string; temMovimentos: boolean; ultimaOperacao?: { data: string; descricao: string | null; tipo: string } | null };
export type ParceiroBase = { id: string; nome: string; documento: string | null; tipo: TipoParceiro; telefone: string | null; email: string | null; ativo: boolean };
export type Parceiro = ParceiroBase & DadosParceiro & { referencias: number };
export type ContaInput = { nome: string; tipo: TipoConta; instituicao?: string | null; identificacao?: string | null; saldoAbertura: number; dataSaldoAbertura: string; incluirNoSaldoGeral: boolean };
export type ContaPatch = Partial<ContaInput> & DadosConta & { ativo?: boolean };
export type ParceiroInput = DadosParceiro & { nome: string; documento?: string | null; tipo?: TipoParceiro; telefone?: string | null; email?: string | null };
export type ParceiroPatch = Partial<ParceiroInput> & { ativo?: boolean };
export type Categoria = { id: string; nome: string; classificacao: "CUSTEIO" | "INVESTIMENTO" | null; ativo: boolean; ordem: number; usoAgricola: boolean; usoGenetico: boolean; usoSanitario?: boolean; usoNutricional?: boolean; _count?: { operacoes: number; produtos: number; itens?: number } };
export type CentroCusto = { id: string; nome: string; ativo: boolean; ordem: number; _count?: { operacoes: number; produtos: number; safras: number } };
// Comportamento (agrícola/genético) é da categoria do produto — mesmo que ela
// esteja inativa (situação é do produto, uso é da categoria).
export type ProdutoCategoria = { id: string; nome: string; usoAgricola: boolean; usoGenetico: boolean; usoSanitario?: boolean; usoNutricional?: boolean };
export type Produto = {
  id: string; nome: string;
  rastrearPartidas?: boolean;
  unidade: UnidadeMedida;
  minimoEstoque?: string | null; ativo?: boolean;
  categoriaId?: string | null; categoriaNome?: string | null; classificacao?: "CUSTEIO" | "INVESTIMENTO" | null;
  categoria?: ProdutoCategoria | null;
  centroCustoIds?: string[]; centrosCusto?: { id: string; nome: string; ativo: boolean }[];
  fornecedores?: { id: string; nome: string; ativo: boolean }[];
};
export type ProdutoInput = {
  nome: string; unidade: UnidadeMedida;
  // Categoria obrigatória (define o uso). Se o produto entra no estoque quem decide é a operação.
  minimoEstoque: number | null; categoriaId: string; centroCustoIds: string[]; fornecedorIds: string[];
};
export type ConfiguracoesFinanceiras = { contas: Conta[]; parceiros: Parceiro[]; categorias: Categoria[]; centrosCusto: CentroCusto[]; produtos: Produto[]; produtosCadastro?: Produto[]; centrosAtividade?: { cafe: string | null } };
export type ContaHistorico = { id: string; nome: string };
export type ReferenciaReversao = { id: string; tipo: string; status: string; data: string; descricao: string | null };
export type MovimentoOperacao = { id: string; seq: number; contaId: string; direcao: "ENTRADA" | "SAIDA"; valor: string; conta: ContaHistorico };
export type TransacaoOperacao = { id: string; seq: number; tipo: string; status: string; data: string; valorTotal: string; formaPagamento: string | null; movimentos: MovimentoOperacao[]; reversaoDe?: ReferenciaReversao | null; revertidaPor?: ReferenciaReversao | null; operacaoId?: string | null };
export type Liquidacao = { id: string; valor: string; transacao: TransacaoOperacao };
export type Compromisso = { id: string; seq: number; tipo: "PAGAR" | "RECEBER"; status: string; valorOriginal: string; valorLiquidado: string; saldoPendente: string; saldoExigivel?: string; dataVencimento: string; numeroParcela: number | null; totalParcelas: number | null; vencido?: boolean; parceiro: ParceiroBase | null; operacao: { id: string; numero: number; tipo: string; descricao: string | null }; liquidacoes?: Liquidacao[] };
export type ItemOperacao = { categoriaId?: string | null; categoriaNome?: string | null; classificacao?: "CUSTEIO" | "INVESTIMENTO" | null; centroCustoId?: string | null; centroCustoNome?: string | null; id: string; ordem: number; descricao: string; quantidade: string; unidade: string; valorUnitario: string; valorTotal: string; estocavel: boolean; produtoId: string | null };
export type MovimentoEstoqueOperacao = { id: string; seq: number; tipo: string; status: string; quantidade: string; valorTotal: string; produtoId: string; reversaoDeId?: string | null; revertidoPor?: { id: string } | null };
export type DocumentoFinanceiro = { id: string; tipo: string; nome: string; numero: string | null; mimeType: string | null; tamanhoBytes: number | null };
export type RascunhoOperacao = { id: string; dados: { formulario?: Record<string, unknown>; operacao?: Record<string, unknown> }; versao: number; updatedAt: string; documentos: DocumentoFinanceiro[] };
export type SimulacaoParcelas = { totalOperacao: string; valorPagoAgora: string; saldoAPrazo: string; parcelas: { valor: string; dataVencimento: string }[] };
export type ResumoCancelamento = { compromissos: { id: string; numeroParcela: number | null; status: string; valorOriginal: string; valorLiquidado: string; saldoExigivel: string }[]; transacoes: { id: string; seq: number; tipo: string; data: string; valorTotal: string; movimentos: (MovimentoOperacao & { direcaoInversa: "ENTRADA" | "SAIDA" })[] }[]; estoque: { id: string; produtoId: string; produtoNome: string; quantidade: string; unidade: string; tipo: string }[]; impactosPorConta: { conta: ContaHistorico; entrada: string; saida: string }[]; documentosPreservados: number };
export type Operacao = { categoriaNome?: string | null; classificacao?: "CUSTEIO" | "INVESTIMENTO" | null; id: string; numero: number; tipo: string; status: string; data: string; descricao: string | null; valorTotal: string; parceiro: ParceiroBase | null; parceiroId?: string | null; categoriaId?: string | null; centroCustoId?: string | null; centroCusto?: { id: string; nome: string } | null; corrigeOperacaoId?: string | null; corrigeOperacao?: { id: string; numero: number; descricao: string | null } | null; correcoes?: { id: string; numero: number; descricao: string | null; status: string }[]; itens: ItemOperacao[]; compromissos: Compromisso[]; transacoes: TransacaoOperacao[]; movimentosEstoque: MovimentoEstoqueOperacao[]; documentos: DocumentoFinanceiro[]; resumoCancelamento?: ResumoCancelamento };
export type MovimentoConta = { id: string; seq: number; contaId?: string; direcao: "ENTRADA" | "SAIDA"; valor: string; transacao: { id: string; seq: number; tipo: string; status: string; data: string; descricao: string | null; formaPagamento: string | null; parceiro: ParceiroBase | null; operacao: { id: string; numero: number; descricao: string | null; tipo: string } | null; reversaoDe?: { id?: string; tipo: string; descricao?: string | null; operacaoId?: string | null } | null } };
export type BaseFinanceira = {
  operacoes: { total: number; estados: Record<string, number>; comEstoque: number; semParceiro: number; semEfeitos: number };
  compromissos: { total: number; estados: Record<string, number> };
  transacoes: { total: number; estados: Record<string, number>; estornos: number; avulsas: number; comLiquidacao: number; semMovimentos: number; transferenciasIncompletas: number };
  movimentos: { total: number; confirmados: number; revertidos: number; estornos: number };
  volumeEconomico: string;
  porTipo: { tipo: string; valor: string }[];
  vinculosAusentes: { transacaoId: string; transacaoSeq: number; operacaoId: string | null; operacaoNumero: number | null; motivo: string }[];
};
export type DashboardFinanceiro = { periodo: { inicio: string; fim: string }; saldoGeral: string; contas: Conta[]; realizado: { entradas: string; saidas: string; resultado: string }; fluxo: { data: string; entradas: string; saidas: string }[]; compromissos: { aPagar: string; aReceber: string }; proximosCompromissos: Compromisso[]; base: BaseFinanceira; despesasPorCategoria: { categoriaId: string | null; categoria: string; valor: string }[] };
export type RegimeRelatorioFinanceiro = "ambos" | "realizado" | "previsto";
export type ClassificacaoRelatorio = "CUSTEIO" | "INVESTIMENTO" | "SEM_CLASSIFICACAO";
export type ConfiguracaoRelatorioFinanceiro = { nome: string; dataInicio: string; dataFim: string; regime: RegimeRelatorioFinanceiro; tipos: string[]; status: string[]; centroCustoIds: (string | typeof SEM_VINCULO)[]; parceiroIds: (string | typeof SEM_VINCULO)[]; categoriaIds: (string | typeof SEM_VINCULO)[]; classificacoes: ClassificacaoRelatorio[] };
export type RascunhoRelatorioFinanceiro = { id: string; configuracao: Partial<ConfiguracaoRelatorioFinanceiro>; versao: number; updatedAt: string };
export type RelatorioFinanceiro = { id: string; nome: string; status: "PROCESSANDO" | "CONCLUIDO" | "FALHOU"; parametros: ConfiguracaoRelatorioFinanceiro; propriedadeId: number; propriedade: string; autor: string; geradoEm: string; concluidoEm: string | null; erro: string | null };
export type LinhaComposicaoRelatorio = { operacaoId: string; operacaoNumero: number | null; data: string; tipo: string; status: string; descricao: string | null; item: string | null; quantidade: string | null; unidade: string | null; parceiro: string | null; categoriaId: string | null; categoria: string; centroCusto: string; classificacao: "CUSTEIO" | "INVESTIMENTO" | null; valor: string };
export type TotalGrupoRelatorio = { nome: string; total: string; pct: number };
export type SnapshotRelatorioFinanceiro = {
  versao: 1; nome: string; geradoEm: string; autor: string; propriedade: { id: number; nome: string } | null;
  configuracao: ConfiguracaoRelatorioFinanceiro;
  filtros: { tipos: string[]; status: string[]; centrosCusto: string[]; parceiros: string[]; categorias: string[]; classificacoes: string[] };
  gerencial: RelatorioGerencialDTO;
  composicao: {
    linhas: LinhaComposicaoRelatorio[]; totalLinhas: number; truncado: boolean;
    porTipo: { tipo: string; rotulo: string; operacoes: number; total: string }[];
    despesas: { total: string; custeio: string; investimento: string; semClassificacao: string; porCategoria: (TotalGrupoRelatorio & { custeio: string; investimento: string; semClassificacao: string })[]; porCentro: TotalGrupoRelatorio[] };
  };
};
export type RelatorioFinanceiroDetalhe = RelatorioFinanceiro & { snapshot: SnapshotRelatorioFinanceiro | null };

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
export const obterOperacao = (id: string) => req<Operacao>(`/financeiro/operacoes/${id}`);
export const listarCompromissos = (periodo?: { inicio: string; fim: string }) => req<Compromisso[]>(`/financeiro/compromissos${periodo?.inicio && periodo.fim ? `?${new URLSearchParams(periodo)}` : ""}`);
export const obterExtratoConta = (id: string) => req<MovimentoConta[]>(`/financeiro/contas/${id}/extrato`);
export const criarOperacao = (input: unknown) => req<Operacao>("/financeiro/operacoes", { method: "POST", body: JSON.stringify(input) });
export type AjusteEstoqueInput = { produtoId: string; quantidadeContada: number; saldoEsperado: number; observacao: string; centroCustoId?: string | null };
export type AjusteEstoqueResultado = { id: string; operacaoId: string; saldoAnterior: number; quantidadeContada: number; diferenca: number };
/** Ajuste por contagem de estoque: o servidor recalcula o saldo, recusa (CONFLITO/409) se ele mudou desde `saldoEsperado` e cria a Operacao AJUSTE_ESTOQUE + movimento físico. */
export const registrarAjusteEstoque = (input: AjusteEstoqueInput) => req<AjusteEstoqueResultado>("/estoque/ajustes", { method: "POST", body: JSON.stringify(input) });
export const simularParcelasOperacao = (input: unknown) => req<SimulacaoParcelas>("/financeiro/operacoes/simulacao-parcelas", { method: "POST", body: JSON.stringify(input) });
// As quatro chamadas abaixo publicam o resultado em `rascunhoAtivo`, que alimenta
// o atalho "Trabalho ativo" da sidebar e a própria tela de operações.
export const obterRascunhoOperacao = () => {
  const publicar = prepararPublicacaoRascunho("leitura");
  return req<RascunhoOperacao | null>("/financeiro/operacoes/rascunho").then(publicar);
};
export const salvarRascunhoOperacao = (dados: unknown, versao?: number) => {
  const publicar = prepararPublicacaoRascunho("escrita");
  return req<RascunhoOperacao>("/financeiro/operacoes/rascunho", { method: "PUT", body: JSON.stringify({ dados, versao }) }).then(publicar);
};
export const descartarRascunhoOperacao = () => {
  const publicar = prepararPublicacaoRascunho("escrita");
  return req<void>("/financeiro/operacoes/rascunho", { method: "DELETE" }).then(() => { publicar(null); });
};
export const confirmarRascunhoOperacao = (versao?: number) => {
  const publicar = prepararPublicacaoRascunho("escrita");
  return req<Operacao>("/financeiro/operacoes/rascunho/confirmacao", { method: "POST", body: JSON.stringify({ versao }) }).then((operacao) => { publicar(null); return operacao; });
};
export const listarRelatoriosFinanceiros = () => req<RelatorioFinanceiro[]>("/financeiro/relatorios");
export const obterRascunhoRelatorioFinanceiro = () => {
  const publicar = prepararPublicacaoRascunhoRelatorio("leitura");
  return req<RascunhoRelatorioFinanceiro | null>("/financeiro/relatorios/rascunho").then(publicar);
};
export const salvarRascunhoRelatorioFinanceiro = (configuracao: Partial<ConfiguracaoRelatorioFinanceiro>, versao?: number) => {
  const publicar = prepararPublicacaoRascunhoRelatorio("escrita");
  return req<RascunhoRelatorioFinanceiro>("/financeiro/relatorios/rascunho", { method: "PUT", body: JSON.stringify({ configuracao, versao }) }).then(publicar);
};
export const descartarRascunhoRelatorioFinanceiro = () => {
  const publicar = prepararPublicacaoRascunhoRelatorio("escrita");
  return req<void>("/financeiro/relatorios/rascunho", { method: "DELETE" }).then(() => { publicar(null); });
};
export const gerarRelatorioFinanceiro = (configuracao: ConfiguracaoRelatorioFinanceiro, versaoRascunho?: number) => {
  const publicar = prepararPublicacaoRascunhoRelatorio("escrita");
  return req<RelatorioFinanceiro>("/financeiro/relatorios", { method: "POST", body: JSON.stringify({ configuracao, versaoRascunho }) }).then((relatorio) => {
    if (versaoRascunho) publicar(null);
    return relatorio;
  });
};
export const obterRelatorioFinanceiro = (id: string) => req<RelatorioFinanceiroDetalhe>(`/financeiro/relatorios/${id}`);
export async function baixarRelatorioFinanceiro(id: string) {
  const resposta = await fetch(`/api/financeiro/relatorios/${id}/download`, { headers: comPropriedade() });
  if (!resposta.ok) { const corpo = await resposta.json().catch(() => ({})); throw new ApiError(corpo.error ?? `Erro HTTP ${resposta.status}`, resposta.status); }
  return resposta.blob();
}
/** Baixa o PDF guardado e entrega ao navegador como download. */
export async function salvarPdfRelatorioFinanceiro(relatorio: Pick<RelatorioFinanceiro, "id" | "nome">) {
  const url = URL.createObjectURL(await baixarRelatorioFinanceiro(relatorio.id));
  const link = document.createElement("a");
  link.href = url; link.download = `${relatorio.nome}.pdf`;
  document.body.appendChild(link); link.click(); link.remove();
  // Revogar no mesmo tick cancela o download em alguns navegadores.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type UploadIntent = { uploadToken: string; uploadUrl: string; headers: Record<string, string>; expiresAt: string };

async function sha256(arquivo: File) {
  const digest = await crypto.subtle.digest("SHA-256", await arquivo.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function enviarDocumentoDireto(intencaoPath: string, confirmacaoPath: string, input: { arquivo: File; tipo: string; numero?: string }) {
  const intent = await req<UploadIntent>(intencaoPath, { method: "POST", body: JSON.stringify({
    tipo: input.tipo, nome: input.arquivo.name, numero: input.numero || null, mimeType: input.arquivo.type || "application/octet-stream",
    tamanhoBytes: input.arquivo.size, sha256: await sha256(input.arquivo),
  }) });
  const envio = await fetch(intent.uploadUrl, { method: "PUT", headers: intent.headers, body: input.arquivo });
  if (!envio.ok) throw new ApiError("Não foi possível enviar o arquivo ao armazenamento", envio.status);
  return req<DocumentoFinanceiro>(confirmacaoPath, { method: "POST", body: JSON.stringify({ uploadToken: intent.uploadToken }) });
}

export const anexarDocumentoRascunho = (input: { arquivo: File; tipo: string; numero?: string }) =>
  enviarDocumentoDireto("/financeiro/operacoes/rascunho/documentos/intencao", "/financeiro/operacoes/rascunho/documentos/confirmacao-upload", input);
export async function removerDocumentoRascunho(id: string) {
  const resposta = await fetch(`/api/financeiro/operacoes/rascunho/documentos/${id}`, { method: "DELETE", headers: comPropriedade() });
  if (!resposta.ok) { const corpo = await resposta.json().catch(() => ({})); throw new Error(corpo.error ?? `Erro HTTP ${resposta.status}`); }
}
export const atualizarDocumentoRascunho = (id: string, input: { tipo?: string; numero?: string | null }) => req<DocumentoFinanceiro>(`/financeiro/operacoes/rascunho/documentos/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const anexarDocumentoOperacao = (operacaoId: string, input: { arquivo: File; tipo: string; numero?: string }) =>
  enviarDocumentoDireto(`/financeiro/operacoes/${operacaoId}/documentos/intencao`, `/financeiro/operacoes/${operacaoId}/documentos/confirmacao-upload`, input);
export const estornarOperacao = (id: string, motivo: string) => req<Operacao>(`/financeiro/operacoes/${id}/estorno`, { method: "POST", body: JSON.stringify({ motivo }) });
export const estornarTransacao = (id: string, motivo: string) => req<TransacaoOperacao>(`/financeiro/transacoes/${id}/estorno`, { method: "POST", body: JSON.stringify({ motivo }) });
export const liquidarCompromisso = (id: string, input: unknown) => req(`/financeiro/compromissos/${id}/liquidacoes`, { method: "POST", body: JSON.stringify(input) });
export const criarConta = (input: ContaInput & DadosConta) => req<Conta>("/financeiro/contas", { method: "POST", body: JSON.stringify(input) });
export const atualizarConta = (id: string, input: ContaPatch) => req<Conta>(`/financeiro/contas/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const criarParceiro = (input: ParceiroInput) => req<Parceiro>("/financeiro/parceiros", { method: "POST", body: JSON.stringify(input) });
export const atualizarParceiro = (id: string, input: ParceiroPatch) => req<Parceiro>(`/financeiro/parceiros/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export type CategoriaInput = { nome: string; classificacao?: "CUSTEIO" | "INVESTIMENTO" | null; ordem?: number; usoAgricola?: boolean; usoGenetico?: boolean; usoSanitario?: boolean; usoNutricional?: boolean };
export type CentroCustoInput = { nome: string; ordem?: number };
export const criarCategoria = (input: CategoriaInput) => req<Categoria>("/financeiro/categorias", { method: "POST", body: JSON.stringify(input) });
export const atualizarCategoria = (id: string, input: Partial<CategoriaInput> & { ativo?: boolean }) => req<Categoria>(`/financeiro/categorias/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const criarCentroCusto = (input: CentroCustoInput) => req<CentroCusto>("/financeiro/centros-custo", { method: "POST", body: JSON.stringify(input) });
export const atualizarCentroCusto = (id: string, input: Partial<CentroCustoInput> & { ativo?: boolean }) => req<CentroCusto>(`/financeiro/centros-custo/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const criarProduto = (input: ProdutoInput) => req<Produto>("/financeiro/produtos", { method: "POST", body: JSON.stringify(input) });
export const atualizarProduto = (id: string, input: Partial<ProdutoInput> & { ativo?: boolean }) => req<Produto>(`/financeiro/produtos/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const transferir = (input: unknown) => req("/financeiro/transferencias", { method: "POST", body: JSON.stringify(input) });

export type MovimentoGeral = MovimentoConta & { contaId: string; conta: { id: string; nome: string; instituicao: string | null } };
export const obterExtratoGeral = () => req<MovimentoGeral[]>("/financeiro/extrato-geral");

export type AnaliseCategorias = {
  base: string; total: string;
  categorias: { categoria: string; valor: string }[];
  linhas: { operacaoId: string | null; contaId?: string; movimentoId?: string; descricao: string | null; data: string; categoria: string; centroCusto: string; classificacao: string | null; valor: string }[];
};
export const obterAnaliseCategorias = (filtros: Record<string, string>) => req<AnaliseCategorias>(`/financeiro/analise-categorias?${new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== ""))}`);
