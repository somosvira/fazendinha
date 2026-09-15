import type { MovimentoConta } from "../novo-api";

export type FluxoDiario = { data: string; entradas: number; saidas: number };
export type FluxoPeriodo = FluxoDiario & { rotulo?: string };

function entraNoFluxo(movimento: MovimentoConta, consolidado: boolean) {
  if (!["CONFIRMADA", "REVERTIDA"].includes(movimento.transacao.status)) return false;
  const transferencia = movimento.transacao.tipo === "TRANSFERENCIA"
    || movimento.transacao.reversaoDe?.tipo === "TRANSFERENCIA"
    || movimento.transacao.operacao?.tipo === "TRANSFERENCIA_FINANCEIRA";
  return !(consolidado && transferencia);
}

export function fluxoDiario(movimentos: MovimentoConta[], mes: string, consolidado = false): FluxoDiario[] {
  const [ano, numero] = mes.split("-").map(Number);
  const dias = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  const centavos = Array.from({ length: dias }, (_, indice) => ({ data: `${mes}-${String(indice + 1).padStart(2, "0")}`, entradas: 0, saidas: 0 }));
  for (const movimento of movimentos) {
    if (!movimento.transacao.data.startsWith(mes)) continue;
    if (!entraNoFluxo(movimento, consolidado)) continue;
    // O razão preserva o movimento original, mesmo revertido, e registra a
    // direção oposta na data do estorno. Ambos compõem o fluxo nas suas datas.
    const dia = centavos[Number(movimento.transacao.data.slice(8, 10)) - 1];
    if (!dia) continue;
    dia[movimento.direcao === "ENTRADA" ? "entradas" : "saidas"] += Math.round(Number(movimento.valor) * 100);
  }
  return centavos.map(dia => ({ ...dia, entradas: dia.entradas / 100, saidas: dia.saidas / 100 }));
}

function mesesEntre(inicio: string, fim: string) {
  const [anoInicio, mesInicio] = inicio.split("-").map(Number);
  const [anoFim, mesFim] = fim.split("-").map(Number);
  const meses: string[] = [];
  let ano = anoInicio; let mes = mesInicio;
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    meses.push(`${ano}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes === 13) { ano += 1; mes = 1; }
  }
  return meses;
}

/** Um único mês mantém o detalhe diário; intervalos maiores são consolidados por mês. */
export function fluxoPeriodo(movimentos: MovimentoConta[], inicio: string, fim: string, consolidado = false): FluxoPeriodo[] {
  if (inicio === fim) return fluxoDiario(movimentos, inicio, consolidado);
  const meses = mesesEntre(inicio, fim);
  const indice = new Map(meses.map((mes, posicao) => [mes, posicao]));
  const centavos = meses.map((mes) => ({
    data: `${mes}-01`,
    rotulo: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" })
      .format(new Date(`${mes}-01T00:00:00Z`)).replace(" de ", "/"),
    entradas: 0,
    saidas: 0,
  }));
  for (const movimento of movimentos) {
    const posicao = indice.get(movimento.transacao.data.slice(0, 7));
    if (posicao == null || !entraNoFluxo(movimento, consolidado)) continue;
    centavos[posicao][movimento.direcao === "ENTRADA" ? "entradas" : "saidas"] += Math.round(Number(movimento.valor) * 100);
  }
  return centavos.map((ponto) => ({ ...ponto, entradas: ponto.entradas / 100, saidas: ponto.saidas / 100 }));
}
