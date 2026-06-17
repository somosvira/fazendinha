/* Rio Novo — projeção, fôlego de caixa e break-even.
 * Port de src/dataProjecao.js. As IIFEs do protótipo liam window.RioNovo;
 * aqui são builders que derivam do payload do /api/dashboard (`d`).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = any;

export type Folego = {
  caixa: number;
  queimaMensal: number;
  queimaCusteioMensal: number;
  mesesTotal: number;
  mesesOperacional: number;
  aporteMensalNecessario: number;
};

export type ProjMes = {
  mes: string;
  volume: number;
  custeio: number;
  receita: number;
  custoLitro: number;
  preco: number;
  margem: number;
};

export type ProjecaoLeite = {
  precoLitro: number;
  custoLitroHoje: number;
  volMesHoje: number;
  proj: ProjMes[];
  breakEvenIdx: number;
  breakEvenMes: string | null;
};

export type FluxoMes = { mes: string; operacional: number; investimento: number; fluxo: number; caixaFim: number };
export type ProjecaoFluxo = { fluxoProj: FluxoMes[]; caixaZeraIdx: number; caixaZeraMes: string | null };

const MESES_FUT = ["Jun/26", "Jul/26", "Ago/26", "Set/26", "Out/26", "Nov/26", "Dez/26", "Jan/27", "Fev/27", "Mar/27", "Abr/27", "Mai/27"];

// últimos 4 meses fechados de 2026 (Jan-Abr; Mai parcial fica de fora)
const FECHADOS_2026 = [18, 19, 20, 21];

export function buildFolego(d: Payload): Folego {
  const queimaMensal = FECHADOS_2026.reduce((s, i) => s + d.totalGeral[i], 0) / FECHADOS_2026.length; // ~ -987k
  const queimaCusteioMensal =
    FECHADOS_2026.reduce(
      (s, i) => s + (d.custeioLeitePuro[i] + d.custeioCafe[i] + d.sedeOutros[i] - d.receitaLeite[i] - d.receitaCafe[i]),
      0,
    ) / FECHADOS_2026.length; // déficit operacional puro (sem investimento)

  const caixa = d.caixaHoje.total;

  return {
    caixa,
    queimaMensal,
    queimaCusteioMensal,
    mesesTotal: caixa / Math.abs(queimaMensal),
    mesesOperacional: caixa / Math.abs(queimaCusteioMensal),
    aporteMensalNecessario: Math.abs(queimaMensal),
  };
}

export function buildProjecaoLeite(d: Payload): ProjecaoLeite {
  const precoLitro = 3.5;
  const custeioLeiteMes2026 = FECHADOS_2026.reduce((s, i) => s + d.custeioLeitePuro[i], 0) / 4;
  const volMes2026 = FECHADOS_2026.reduce((s, i) => s + d.receitaLeite[i], 0) / 4 / precoLitro;
  const custoLitroHoje = custeioLeiteMes2026 / volMes2026;

  const proj: ProjMes[] = [];
  let vol = volMes2026;
  let custeio = custeioLeiteMes2026;
  for (let m = 0; m < 12; m++) {
    const growth = m < 7 ? 0.085 : 0.02; // novilhas parindo, depois estabiliza
    vol = vol * (1 + growth);
    custeio = custeio * 1.015;
    const preco = precoLitro * (1 + m * 0.004); // leve alta sazonal
    const custoLitro = custeio / vol;
    const receita = vol * preco;
    proj.push({
      mes: MESES_FUT[m],
      volume: Math.round(vol),
      custeio: Math.round(custeio),
      receita: Math.round(receita),
      custoLitro: +custoLitro.toFixed(2),
      preco: +preco.toFixed(2),
      margem: Math.round(receita - custeio),
    });
  }
  const beIdx = proj.findIndex((p) => p.margem >= 0);

  return {
    precoLitro,
    custoLitroHoje: +custoLitroHoje.toFixed(2),
    volMesHoje: Math.round(volMes2026),
    proj,
    breakEvenIdx: beIdx,
    breakEvenMes: beIdx >= 0 ? proj[beIdx].mes : null,
  };
}

export function buildProjecaoFluxo(d: Payload, projLeite: ProjecaoLeite): ProjecaoFluxo {
  const fluxoProj: FluxoMes[] = [];
  let caixaAcc = d.caixaHoje.total;
  const invDecaimento = [820000, 600000, 420000, 280000, 180000, 120000]; // investimento desacelera
  for (let m = 0; m < 6; m++) {
    const p = projLeite.proj[m];
    const sedeMes = 9000;
    const opMes = p.receita - p.custeio - sedeMes; // resultado operacional do mês
    const fluxoMes = opMes - invDecaimento[m];
    caixaAcc += fluxoMes;
    fluxoProj.push({
      mes: p.mes,
      operacional: Math.round(opMes),
      investimento: -invDecaimento[m],
      fluxo: Math.round(fluxoMes),
      caixaFim: Math.round(caixaAcc),
    });
  }
  const zeraIdx = fluxoProj.findIndex((f) => f.caixaFim < 0);
  return {
    fluxoProj,
    caixaZeraIdx: zeraIdx,
    caixaZeraMes: zeraIdx >= 0 ? fluxoProj[zeraIdx].mes : null,
  };
}
