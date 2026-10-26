export type SituacaoEntrega =
  | "PENDENTE"
  | "ACEITE_INFORMADO"
  | "DIVERGENCIA"
  | "REJEITADA"
  | "DESTINACAO_POSTERIOR";
export interface ConferenciaEntrega {
  versao: number;
  volumeAceito: string | null;
  situacao: SituacaoEntrega;
  motivo: string;
  destinacaoInformada: string | null;
  criadoEm: string;
  criadoPorId: number | null;
}
export interface EntregaComercial {
  id: string;
  propriedadeId: number;
  parceiroId: string;
  parceiroNome: string | null;
  retiradaId: string;
  produtoId: string;
  data: string;
  operacaoId: string;
  numeroOperacao: number;
  versaoVendaId: string;
  pontoColeta: string | null;
  horarioColeta: string | null;
  referencia: string;
  expedidoLitros: string;
  volumeAceito: string | null;
  versao: number;
  situacao: SituacaoEntrega;
  motivo: string;
  destinacaoInformada: string | null;
  quantidadeFaturada: string;
  valorFaturado: string | null;
  quantidadeDisponivel: string | null;
  limiteExpedidoPendenteLitros: string | null;
  valorDisponivel: string | null;
  aceitePendente: boolean;
  historico: ConferenciaEntrega[];
  comprovantes: {
    id: string;
    nome: string;
    mimeType: string;
    tamanhoBytes: number;
    criadoEm: string;
  }[];
}
export interface PaginaComercial<T> {
  propriedadeId: number;
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
}
export interface VendaVinculavel {
  operacaoId: string;
  numero: number;
  data: string;
  parceiroId: string | null;
  parceiroNome: string | null;
  valorTotal: string | null;
  retiradaId: string | null;
  produtoId: string | null;
  quantidadeLitros: string | null;
  podeVincular: boolean;
  impedimento: string | null;
}
export interface ComponenteDemonstrativo {
  natureza: "BONUS" | "DESCONTO" | "RETENCAO" | "ADIANTAMENTO";
  valor: string;
  referencia: string;
}
export interface DemonstrativoComercial {
  id: string;
  propriedadeId: number;
  parceiroId: string;
  inicio: string;
  fim: string;
  referencia: string;
  precoBase: string;
  volumeReconhecido: string;
  valorComercial: string;
  valorPagamentoInformado: string | null;
  componentes: { natureza: string; valor: number; referencia: string }[];
  versao: number;
  status: string;
  motivoAnulacao: string | null;
  criadoEm: string;
  alocacoes: {
    id: string;
    entregaId: string;
    quantidade: string;
    valor: string;
    ativo: boolean;
    motivoAceitePendente: string | null;
  }[];
}
export interface ConferenciaDraft {
  situacao: SituacaoEntrega;
  aceito: string;
  motivo: string;
  destinacao: string;
}
export const novaConferencia = (): ConferenciaDraft => ({
  situacao: "PENDENTE",
  aceito: "",
  motivo: "",
  destinacao: "",
});
export const nomeSituacaoEntrega = (s: string) =>
  (
    ({
      PENDENTE: "Aceite pendente",
      ACEITE_INFORMADO: "Aceite informado",
      DIVERGENCIA: "Divergência",
      REJEITADA: "Rejeitada integralmente",
      DESTINACAO_POSTERIOR: "Destinação posterior informada",
    }) as Record<string, string>
  )[s] ?? s;
export const nomeComponente = (s: string) =>
  (
    ({
      BONUS: "Bônus",
      DESCONTO: "Desconto",
      RETENCAO: "Retenção",
      ADIANTAMENTO: "Adiantamento",
    }) as Record<string, string>
  )[s] ?? s;
export function numeroComercial(
  texto: string,
  casas: number,
  positivo = false,
): number {
  const valor = texto.trim();
  if (!new RegExp(`^\\d+(?:[.,]\\d{1,${casas}})?$`).test(valor))
    throw new Error(
      `Informe uma quantidade válida com até ${casas} casas decimais.`,
    );
  const n = Number(valor.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || (positivo && n === 0))
    throw new Error(
      positivo
        ? "Informe um valor maior que zero."
        : "Informe um valor não negativo.",
    );
  return n;
}
export function montarConferencia(c: ConferenciaDraft) {
  if (c.motivo.trim().length < 5)
    throw new Error("Explique a conferência com ao menos 5 caracteres.");
  const volumeAceito =
    c.situacao === "PENDENTE"
      ? null
      : c.aceito.trim() === ""
        ? null
        : numeroComercial(c.aceito, 3);
  if (
    ["ACEITE_INFORMADO", "REJEITADA"].includes(c.situacao) &&
    volumeAceito === null
  )
    throw new Error("Informe o volume aceito, inclusive zero explícito.");
  if (c.situacao === "REJEITADA" && volumeAceito !== 0)
    throw new Error(
      "Uma rejeição integral exige volume aceito zero explícito.",
    );
  if (c.situacao === "DESTINACAO_POSTERIOR" && c.destinacao.trim().length < 5)
    throw new Error("Descreva a destinação realmente informada.");
  return {
    situacao: c.situacao,
    volumeAceito,
    motivo: c.motivo.trim(),
    destinacaoInformada:
      c.situacao === "DESTINACAO_POSTERIOR" ? c.destinacao.trim() : null,
  };
}
