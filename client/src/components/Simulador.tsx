/* Rio Novo — Simulador de cenários (what-if) na aba IA.
 * Port de src/components/Simulador.jsx. Recebe o payload (R); o formatador
 * global window.fmtBRLsim do protótipo virou uma função de módulo.
 */

import { useMemo, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type R = any;

type Params = {
  precoLeite: number;
  volGrowth: number;
  custeioGrowth: number;
  investMensal: number;
  cafeSafra: number;
};

type SimMes = {
  mes: string;
  vol: number;
  custeio: number;
  custoLitro: number;
  preco: number;
  receitaLeite: number;
  margemLeite: number;
  cafeReceita: number;
  opMes: number;
  fluxoMes: number;
  caixa: number;
};

type SimResult = {
  proj: SimMes[];
  breakEvenIdx: number;
  breakEvenMes: string | null;
  caixaZeraIdx: number;
  caixaZeraMes: string | null;
  folegoMeses: number;
  caixaFinal: number;
  custoLitroFinal: number;
};

function fmtBRLsim(n: number, perUnit?: boolean): string {
  if (perUnit) return "R$ " + n.toFixed(2).replace(".", ",");
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return sign + "R$ " + (abs / 1e6).toFixed(2).replace(".", ",") + " mi";
  if (abs >= 1000) return sign + "R$ " + (abs / 1000).toFixed(0) + " mil";
  return sign + "R$ " + abs.toFixed(0);
}

const MESES = ["Jun/26", "Jul/26", "Ago/26", "Set/26", "Out/26", "Nov/26", "Dez/26", "Jan/27", "Fev/27", "Mar/27", "Abr/27", "Mai/27"];

/* modelo de simulação — 12 meses à frente, ancorado nos dados reais */
function simular(R: R, p: Params): SimResult {
  const pl = R.projecaoLeite;
  const caixa0 = R.folego.caixa;

  const volBase = pl.volMesHoje;
  const custeioBase = pl.custoLitroHoje * volBase;
  const sedeMes = 9000;
  const custeioCafeMes = 1500;

  const proj: SimMes[] = [];
  let vol = volBase;
  let custeio = custeioBase;
  let caixa = caixa0;
  let breakEvenIdx = -1;
  let caixaZeraIdx = -1;

  for (let m = 0; m < 12; m++) {
    vol = vol * (1 + p.volGrowth / 100);
    custeio = custeio * (1 + p.custeioGrowth / 100);
    const custoLitro = custeio / vol;
    const receitaLeite = vol * p.precoLeite;
    const margemLeite = receitaLeite - custeio;
    if (breakEvenIdx < 0 && margemLeite >= 0) breakEvenIdx = m;

    const cafeReceita = m === 9 ? p.cafeSafra : 0; // safra única ~ Mar/27 (idx 9)

    const opMes = receitaLeite + cafeReceita - custeio - sedeMes - custeioCafeMes;
    const fluxoMes = opMes - p.investMensal;
    caixa += fluxoMes;
    if (caixaZeraIdx < 0 && caixa < 0) caixaZeraIdx = m;

    proj.push({
      mes: MESES[m],
      vol: Math.round(vol),
      custeio: Math.round(custeio),
      custoLitro: +custoLitro.toFixed(2),
      preco: p.precoLeite,
      receitaLeite: Math.round(receitaLeite),
      margemLeite: Math.round(margemLeite),
      cafeReceita,
      opMes: Math.round(opMes),
      fluxoMes: Math.round(fluxoMes),
      caixa: Math.round(caixa),
    });
  }

  let folegoMeses: number;
  if (caixaZeraIdx < 0) folegoMeses = 12.5;
  else {
    const prev = caixaZeraIdx === 0 ? caixa0 : proj[caixaZeraIdx - 1].caixa;
    const cur = proj[caixaZeraIdx].caixa;
    const frac = prev / (prev - cur);
    folegoMeses = caixaZeraIdx + frac;
  }

  return {
    proj,
    breakEvenIdx,
    breakEvenMes: breakEvenIdx >= 0 ? proj[breakEvenIdx].mes : null,
    caixaZeraIdx,
    caixaZeraMes: caixaZeraIdx >= 0 ? proj[caixaZeraIdx].mes : null,
    folegoMeses,
    caixaFinal: proj[proj.length - 1].caixa,
    custoLitroFinal: proj[proj.length - 1].custoLitro,
  };
}

/* narrativa "IA" baseada no resultado */
function narrarCenario(sim: SimResult, params: Params, base: SimResult): string[] {
  const frases: string[] = [];
  if (sim.breakEvenIdx < 0) {
    frases.push(`Com esses parâmetros, o leite **não atinge o break-even** dentro de 12 meses — segue no vermelho operacional o período todo.`);
  } else {
    const baseBE = base.breakEvenIdx;
    if (baseBE >= 0 && sim.breakEvenIdx < baseBE) {
      frases.push(`O leite passa a se pagar em **${sim.breakEvenMes}** — ${baseBE - sim.breakEvenIdx} ${baseBE - sim.breakEvenIdx === 1 ? "mês" : "meses"} antes do cenário base.`);
    } else if (baseBE >= 0 && sim.breakEvenIdx > baseBE) {
      frases.push(`O break-even atrasa para **${sim.breakEvenMes}** — ${sim.breakEvenIdx - baseBE} ${sim.breakEvenIdx - baseBE === 1 ? "mês" : "meses"} depois do base.`);
    } else {
      frases.push(`O leite passa a se pagar em **${sim.breakEvenMes}**.`);
    }
  }
  if (sim.caixaZeraMes) {
    frases.push(`Mas atenção: **o caixa zera em ${sim.caixaZeraMes}** — seria preciso aporte ou cortar investimento antes disso.`);
  } else {
    frases.push(`O caixa **não zera** no horizonte: fecha o período em **${fmtBRLsim(sim.caixaFinal)}**.`);
  }
  if (params.investMensal <= 200000) {
    frases.push(`Como o investimento está baixo (${fmtBRLsim(params.investMensal)}/mês), quase toda a queima vira operacional — o fôlego estica bastante.`);
  } else if (params.investMensal >= 800000) {
    frases.push(`O investimento de ${fmtBRLsim(params.investMensal)}/mês é o que mais pesa no caixa. É crescimento, mas consome fôlego rápido.`);
  }
  if (params.precoLeite >= 3.9) {
    frases.push(`O preço de ${fmtBRLsim(params.precoLeite, true)}/L está otimista — acima da média CEPEA recente; trate como teto.`);
  }
  return frases;
}

/* mini chart: custo vs preço */
function SimLineChart({
  proj,
  accessorA,
  accessorB,
  colorA,
  colorB,
  labelA,
  labelB,
  fmtY,
}: {
  proj: SimMes[];
  accessorA: (p: SimMes) => number;
  accessorB: (p: SimMes) => number;
  colorA: string;
  colorB: string;
  labelA: string;
  labelB: string;
  fmtY: (v: number) => string;
}) {
  const W = 520,
    H = 180,
    padL = 44,
    padR = 70,
    padT = 16,
    padB = 28;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const all = [...proj.map(accessorA), ...proj.map(accessorB)];
  const yMax = Math.max(...all) * 1.12;
  const yMin = Math.min(0, ...all);
  const yS = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
  const xS = (i: number) => padL + (i / (proj.length - 1)) * innerW;
  const ptsA = proj.map((p, i) => `${xS(i)},${yS(accessorA(p))}`).join(" ");
  const ptsB = proj.map((p, i) => `${xS(i)},${yS(accessorB(p))}`).join(" ");
  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={yS(v)} y2={yS(v)} className={v === 0 ? "chart-axis" : "grid-line"} />
          <text x={padL - 6} y={yS(v) + 3} textAnchor="end" className="chart-tick-text">
            {fmtY(v)}
          </text>
        </g>
      ))}
      <polyline points={ptsB} fill="none" stroke={colorB} strokeWidth="2" />
      <polyline points={ptsA} fill="none" stroke={colorA} strokeWidth="2" />
      {proj.map(
        (p, i) =>
          (i % 3 === 0 || i === proj.length - 1) && (
            <text key={i} x={xS(i)} y={H - 8} textAnchor="middle" className="chart-tick-text">
              {p.mes.replace(/\/\d{2}/, "")}
            </text>
          ),
      )}
      <text x={xS(proj.length - 1) + 6} y={yS(accessorA(proj[proj.length - 1])) + 3} style={{ fontSize: 11, fill: colorA, fontFamily: "var(--sans)", fontWeight: 500 }}>
        {labelA}
      </text>
      <text x={xS(proj.length - 1) + 6} y={yS(accessorB(proj[proj.length - 1])) + 3} style={{ fontSize: 11, fill: colorB, fontFamily: "var(--sans)", fontWeight: 500 }}>
        {labelB}
      </text>
    </svg>
  );
}

function SimSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
  hint?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="sim-slider">
      <div className="sim-slider-top">
        <span className="sim-slider-label">{label}</span>
        <span className="sim-slider-val mono-nums">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ ["--pct" as string]: pct + "%" } as React.CSSProperties}
        className="sim-range"
      />
      {hint && <span className="sim-slider-hint">{hint}</span>}
    </div>
  );
}

export function Simulador({ R }: { R: R }) {
  const [precoLeite, setPreco] = useState(3.5);
  const [volGrowth, setVolGrowth] = useState(6);
  const [custeioGrowth, setCusteioGrowth] = useState(1.5);
  const [investMensal, setInvest] = useState(470000);
  const [cafeSafra, setCafe] = useState(320000);

  const params: Params = { precoLeite, volGrowth, custeioGrowth, investMensal, cafeSafra };
  const sim = useMemo(() => simular(R, params), [R, precoLeite, volGrowth, custeioGrowth, investMensal, cafeSafra]);
  const base = useMemo(() => simular(R, { precoLeite: 3.5, volGrowth: 6, custeioGrowth: 1.5, investMensal: 470000, cafeSafra: 320000 }), [R]);
  const narrativa = useMemo(() => narrarCenario(sim, params, base), [sim, base]); // eslint-disable-line react-hooks/exhaustive-deps

  const presets = [
    { nome: "Pausar investimento 3m", apply: () => setInvest(120000) },
    { nome: "Leite a R$ 4,00", apply: () => setPreco(4.0) },
    { nome: "Ração +10% (custeio)", apply: () => setCusteioGrowth(3) },
    {
      nome: "Voltar ao base",
      apply: () => {
        setPreco(3.5);
        setVolGrowth(6);
        setCusteioGrowth(1.5);
        setInvest(470000);
        setCafe(320000);
      },
    },
  ];

  const folegoTxt = sim.folegoMeses >= 12 ? "12+ meses" : sim.folegoMeses.toFixed(1) + " meses";
  const folegoSev = sim.folegoMeses < 4 ? "neg" : sim.folegoMeses < 9 ? "warn" : "pos";

  return (
    <div className="sim-wrap">
      <div className="sim-grid">
        <div className="sim-controls">
          <div className="sim-controls-head">
            <span className="eyebrow">Ajuste as variáveis</span>
            <h3>Cenário</h3>
          </div>
          <SimSlider label="Preço do leite" value={precoLeite} min={3.0} max={4.5} step={0.05} onChange={setPreco} fmt={(v) => "R$ " + v.toFixed(2).replace(".", ",") + "/L"} hint="média CEPEA recente ~R$ 3,50" />
          <SimSlider label="Crescimento do volume" value={volGrowth} min={0} max={12} step={0.5} onChange={setVolGrowth} fmt={(v) => "+" + v.toFixed(1).replace(".", ",") + "%/mês"} hint="matrizes entrando em produção" />
          <SimSlider label="Variação do custeio" value={custeioGrowth} min={-2} max={4} step={0.5} onChange={setCusteioGrowth} fmt={(v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1).replace(".", ",") + "%/mês"} hint="ração, curral, pessoal" />
          <SimSlider label="Investimento mensal" value={investMensal} min={0} max={1200000} step={20000} onChange={setInvest} fmt={(v) => fmtBRLsim(v) + "/mês"} hint="compra de gado, máquina, benfeitoria" />
          <SimSlider label="Receita safra de café" value={cafeSafra} min={0} max={600000} step={10000} onChange={setCafe} fmt={(v) => fmtBRLsim(v)} hint="safra única ~Mar/27" />

          <div className="sim-presets">
            {presets.map((p, i) => (
              <button key={i} className="sim-preset" onClick={p.apply}>
                {p.nome}
              </button>
            ))}
          </div>
        </div>

        <div className="sim-results">
          <div className="sim-kpis">
            <div className="sim-kpi">
              <span className="l">Break-even do leite</span>
              <span className="v mono-nums">{sim.breakEvenMes || "—"}</span>
              <span className="s">{sim.breakEvenIdx >= 0 ? `em ${sim.breakEvenIdx + 1} meses` : "fora de 12m"}</span>
            </div>
            <div className="sim-kpi">
              <span className="l">Fôlego de caixa</span>
              <span className={"v mono-nums " + folegoSev}>{folegoTxt}</span>
              <span className="s">{sim.caixaZeraMes ? "zera em " + sim.caixaZeraMes : "não zera no período"}</span>
            </div>
            <div className="sim-kpi">
              <span className="l">Caixa em 12 meses</span>
              <span className={"v mono-nums " + (sim.caixaFinal < 0 ? "neg" : "pos")}>{fmtBRLsim(sim.caixaFinal)}</span>
              <span className="s">vs base {fmtBRLsim(base.caixaFinal)}</span>
            </div>
          </div>

          <div className="sim-narr">
            <div className="ai-signature">
              <span className="dot"></span>
              <span>Rio Novo · IA analista</span>
              <span style={{ color: "var(--ink-mute)" }}>· simulação ao vivo</span>
            </div>
            <div className="sim-narr-body">
              {narrativa.map((f, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: f.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }}></p>
              ))}
            </div>
          </div>

          <div className="sim-charts">
            <div className="sim-chart">
              <div className="sim-chart-title">Custo × preço por litro</div>
              <SimLineChart proj={sim.proj} accessorA={(p) => p.custoLitro} accessorB={(p) => p.preco} colorA="var(--neg)" colorB="var(--leite)" labelA="custo" labelB="preço" fmtY={(v) => "R$" + v.toFixed(1)} />
            </div>
            <div className="sim-chart">
              <div className="sim-chart-title">Caixa projetado</div>
              <SimLineChart proj={sim.proj} accessorA={(p) => p.caixa} accessorB={() => 0} colorA="var(--ink)" colorB="var(--neg)" labelA="caixa" labelB="R$0" fmtY={(v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "mi" : (v / 1000).toFixed(0) + "k")} />
            </div>
          </div>

          <div className="caption" style={{ fontStyle: "italic", marginTop: 4 }}>
            Modelo simplificado a partir dos dados reais (caixa, volume e custeio de Abr/26). Premissas editáveis acima — não substitui projeção contábil formal.
          </div>
        </div>
      </div>
    </div>
  );
}
