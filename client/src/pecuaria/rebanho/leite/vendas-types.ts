export interface VendaLeiteHistorico {
  operacaoId: string;
  numero: number;
  retiradaId: string;
  versaoComercial: number;
  status: string;
  parceiroId: string | null;
  parceiroNome: string | null;
  data: string;
  produtoId: string;
  quantidadeLitros: string;
  valorTotal: string;
  valorRecebidoConfirmado: string;
  estadoFinanceiro: string;
  podeCorrigir: boolean;
  motivoBloqueio: string | null;
  categoriaId: string | null;
  centroCustoId: string | null;
  motivoCorrecao: string | null;
  corrigeOperacaoId: string | null;
}
export interface VendasLeiteHistorico {
  total: number;
  pagina: number;
  porPagina: number;
  itens: VendaLeiteHistorico[];
}
export function lerValorCorrecao(valor: string): number {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(valor.trim()))
    throw new Error("Informe o valor total com até duas casas decimais.");
  const numero = Number(valor.trim().replace(",", "."));
  if (!Number.isFinite(numero) || numero <= 0 || numero > 999999999999.99)
    throw new Error(
      "Informe um valor total positivo dentro do limite permitido.",
    );
  return numero;
}
export function nomeEstadoVenda(estado: string) {
  return (
    (
      {
        SUBSTITUIDA: "Substituída",
        RECEBIDA: "Recebida",
        PARCIAL: "Recebida parcialmente",
        A_RECEBER: "A receber",
        SEM_MOVIMENTACAO: "Sem movimentação financeira",
      } as Record<string, string>
    )[estado] ?? estado
  );
}
