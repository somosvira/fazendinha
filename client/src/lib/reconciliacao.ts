/* Reconciliação do fluxo mensal — fonte única da verdade p/ Relatório e Dashboard.
 *
 * Contexto: `totalGeral[mês]` é o líquido *lossless* (Σcrédito − Σdébito de todo
 * lançamento liquidado). Os "baldes" (receita/custeio/investimento por atividade)
 * são uma classificação editorial *lossy*: créditos de atividade "outros" e débitos
 * de investimento "outros" entram no total mas em nenhum balde. Recompor
 * `receita − custeio − invest` NUNCA fecha com `totalGeral` — nem no dado real.
 *
 * Este módulo devolve o único enquadramento que fecha por construção:
 *
 *   liquido      = totalGeral[i]              (= creditoTotal[i] − debitoTotal[i])
 *   entrada      = creditoTotal[i]            (Σ créditos)
 *   gastoTotal   = debitoTotal[i]             (Σ débitos = dinheiro que saiu de fato)
 *   gastoTotal   = custeio + investimento + naoClassificado   (breakdown SOMA ao total)
 *
 * A linha "não classificado" absorve o vazamento (invest "outros") e o torna visível
 * em vez de escondê-lo — antes ele aparecia como uma divergência silenciosa entre o
 * número do card e o ponto do gráfico. */

export interface FluxoData {
  totalGeral: number[];
  /** Σ créditos/débitos por mês. Opcionais p/ tolerar payload antigo (fallback abaixo). */
  creditoTotal?: number[];
  debitoTotal?: number[];
  receitaLeite: number[];
  receitaCafe: number[];
  custeioLeitePuro: number[];
  custeioCafe: number[];
  sedeOutros: number[];
  investLeite: number[];
  investCafe: number[];
  animalAquisicao: number[];
  rnCaminhao: number[];
}

export interface LinhaGasto {
  label: string;
  valor: number;
  /** cor da atividade p/ a barra/legenda; ausente = neutro. */
  atividade?: "leite" | "cafe" | "outros";
}

export interface ReconMes {
  /** Líquido do mês (sobrou/faltou). Canônico — casa com o gráfico. */
  liquido: number;
  /** Total que entrou (Σ créditos). */
  entrada: number;
  /** Total que saiu (Σ débitos) — "quanto a fazenda gastou". */
  gastoTotal: number;
  custeio: number;
  investimento: number;
  /** Débitos que nenhum balde capturou (invest "outros"). ≥ 0 no dado real. */
  naoClassificado: number;
  /** Composição do gasto; soma exatamente a `gastoTotal`. */
  breakdown: LinhaGasto[];
}

const at = (a: number[] | undefined, i: number) => (a && a[i] != null ? a[i] : 0);

/** Reconcilia um mês (índice na janela de 23 meses). Puro, sem I/O. */
export function reconciliarMes(R: FluxoData, idx: number): ReconMes {
  const liquido = at(R.totalGeral, idx);

  // Custeio operacional (leite + café + estrutura/sede).
  const custeio = at(R.custeioLeitePuro, idx) + at(R.custeioCafe, idx) + at(R.sedeOutros, idx);
  // Investimento correto + os misclassificados (Animal Aquisição e RN-Caminhão são,
  // pela natureza, investimento/imobilizado — aqui já entram no lugar certo).
  const investimento =
    at(R.investLeite, idx) + at(R.investCafe, idx) + at(R.animalAquisicao, idx) + at(R.rnCaminhao, idx);

  // Gasto total = Σ débitos. Fallback (payload antigo, sem debitoTotal): usa os baldes
  // e, na falta, deriva do próprio líquido — entrada − liquido = gasto.
  const entrada = R.creditoTotal
    ? at(R.creditoTotal, idx)
    : at(R.receitaLeite, idx) + at(R.receitaCafe, idx);
  const gastoTotal = R.debitoTotal ? at(R.debitoTotal, idx) : entrada - liquido;

  // Plug que fecha a conta: o que sobra do gasto além de custeio+investimento.
  const naoClassificado = gastoTotal - custeio - investimento;

  const breakdown: LinhaGasto[] = [
    { label: "Custeio", valor: custeio, atividade: "leite" },
    { label: "Investimento", valor: investimento, atividade: "cafe" },
  ];
  // Só mostra a linha residual quando ela é material (evita "R$ 0" e ruído de arredondamento).
  if (Math.abs(naoClassificado) >= 500) {
    breakdown.push({ label: "Outros / não classificado", valor: naoClassificado, atividade: "outros" });
  }

  return { liquido, entrada, gastoTotal, custeio, investimento, naoClassificado, breakdown };
}

/** Soma os totais reconciliáveis de um objeto `totals23m` (ou período). */
export function reconciliarTotais(t: {
  totalGeral: number;
  creditoTotal?: number;
  debitoTotal?: number;
  custeioLeitePuro: number;
  custeioCafe: number;
  sedeOutros: number;
  investLeite: number;
  investCafe: number;
  animalAquisicao: number;
  rnCaminhao: number;
  receitaLeite: number;
  receitaCafe: number;
}): ReconMes {
  const arr = (v: number) => [v];
  return reconciliarMes(
    {
      totalGeral: arr(t.totalGeral),
      creditoTotal: t.creditoTotal != null ? arr(t.creditoTotal) : undefined,
      debitoTotal: t.debitoTotal != null ? arr(t.debitoTotal) : undefined,
      receitaLeite: arr(t.receitaLeite),
      receitaCafe: arr(t.receitaCafe),
      custeioLeitePuro: arr(t.custeioLeitePuro),
      custeioCafe: arr(t.custeioCafe),
      sedeOutros: arr(t.sedeOutros),
      investLeite: arr(t.investLeite),
      investCafe: arr(t.investCafe),
      animalAquisicao: arr(t.animalAquisicao),
      rnCaminhao: arr(t.rnCaminhao),
    },
    0,
  );
}
