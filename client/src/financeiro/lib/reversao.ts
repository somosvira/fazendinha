import { codigoOperacaoFinanceira } from "./codigo";

// Espelha PREFIXO_CANCELAMENTO_OPERACAO de server/src/services/financeiro/operacoes.ts —
// é como o cliente reconhece, na descrição de uma transação REVERSAO, que ela
// veio de um cancelamento de operação (e não de um estorno avulso de liquidação).
export const PREFIXO_CANCELAMENTO_OPERACAO = "Cancelamento da operação #";

export function ehCancelamentoDeOperacao(descricao: string | null | undefined): boolean {
  return descricao?.startsWith(PREFIXO_CANCELAMENTO_OPERACAO) ?? false;
}

export type InfoReversao = { detalhe: string; operacaoId: string | null; operacaoNumero: number | null };

/** Só retorna algo para movimentos de reversão (tipo REVERSAO); o restante do extrato ignora. */
export function infoReversao(transacao: { tipo: string; descricao: string | null; operacao?: { id: string; numero: number | null } | null; reversaoDe?: { tipo: string } | null }): InfoReversao | null {
  if (transacao.tipo !== "REVERSAO") return null;
  if (ehCancelamentoDeOperacao(transacao.descricao) && transacao.operacao) {
    return { detalhe: `Estorno pelo cancelamento da ${codigoOperacaoFinanceira(transacao.operacao.numero)}`, operacaoId: transacao.operacao.id, operacaoNumero: transacao.operacao.numero };
  }
  const tipoOriginal = transacao.reversaoDe?.tipo;
  return { detalhe: tipoOriginal ? `Estorno de ${tipoOriginal.replaceAll("_", " ").toLowerCase()}` : "Estorno de lançamento", operacaoId: null, operacaoNumero: null };
}
