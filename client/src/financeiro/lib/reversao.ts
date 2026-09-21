// Espelha PREFIXO_CANCELAMENTO_OPERACAO de server/src/services/financeiro/operacoes.ts —
// é como o cliente reconhece, na descrição de uma transação REVERSAO, que ela
// veio de um cancelamento de operação (e não de um estorno avulso de liquidação).
export const PREFIXO_CANCELAMENTO_OPERACAO = "Cancelamento da operação #";

export function operacaoDoCancelamento(descricao: string | null | undefined): number | null {
  if (!descricao?.startsWith(PREFIXO_CANCELAMENTO_OPERACAO)) return null;
  const id = Number(descricao.slice(PREFIXO_CANCELAMENTO_OPERACAO.length).split(":")[0]);
  return Number.isFinite(id) ? id : null;
}

export type InfoReversao = { detalhe: string; operacaoId: number | null };

/** Só retorna algo para movimentos de reversão (tipo REVERSAO); o restante do extrato ignora. */
export function infoReversao(transacao: { tipo: string; descricao: string | null; reversaoDe?: { tipo: string } | null }): InfoReversao | null {
  if (transacao.tipo !== "REVERSAO") return null;
  const operacaoId = operacaoDoCancelamento(transacao.descricao);
  if (operacaoId != null) return { detalhe: `Estorno pelo cancelamento da OP-${String(operacaoId).padStart(4, "0")}`, operacaoId };
  const tipoOriginal = transacao.reversaoDe?.tipo;
  return { detalhe: tipoOriginal ? `Estorno de ${tipoOriginal.replaceAll("_", " ").toLowerCase()}` : "Estorno de lançamento", operacaoId: null };
}
