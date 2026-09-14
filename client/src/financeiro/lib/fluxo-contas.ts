import type { MovimentoConta } from "../novo-api";

export type FluxoDiario = { data: string; entradas: number; saidas: number };

export function fluxoDiario(movimentos: MovimentoConta[], mes: string, consolidado = false): FluxoDiario[] {
  const [ano, numero] = mes.split("-").map(Number);
  const dias = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  const centavos = Array.from({ length: dias }, (_, indice) => ({ data: `${mes}-${String(indice + 1).padStart(2, "0")}`, entradas: 0, saidas: 0 }));
  for (const movimento of movimentos) {
    if (!movimento.transacao.data.startsWith(mes)) continue;
    if (!["CONFIRMADA", "REVERTIDA"].includes(movimento.transacao.status)) continue;
    const transferencia = movimento.transacao.tipo === "TRANSFERENCIA"
      || movimento.transacao.reversaoDe?.tipo === "TRANSFERENCIA"
      || movimento.transacao.operacao?.tipo === "TRANSFERENCIA_FINANCEIRA";
    if (consolidado && transferencia) continue;
    // O razão preserva o movimento original, mesmo revertido, e registra a
    // direção oposta na data do estorno. Ambos compõem o fluxo nas suas datas.
    const dia = centavos[Number(movimento.transacao.data.slice(8, 10)) - 1];
    if (!dia) continue;
    dia[movimento.direcao === "ENTRADA" ? "entradas" : "saidas"] += Math.round(Number(movimento.valor) * 100);
  }
  return centavos.map(dia => ({ ...dia, entradas: dia.entradas / 100, saidas: dia.saidas / 100 }));
}
