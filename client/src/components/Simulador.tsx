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
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-2">{label}</span>
        <span className="mono-nums font-serif text-[17px] tabular-nums text-foreground">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ ["--pct" as string]: pct + "%" } as React.CSSProperties}
        className="my-0.5 h-1 w-full cursor-pointer appearance-none bg-[linear-gradient(90deg,var(--ink)_var(--pct),var(--rule-soft)_var(--pct))] outline-none [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[color:var(--ink)] [&::-moz-range-thumb]:bg-card [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[color:var(--ink)] [&::-webkit-slider-thumb]:bg-card"
      />
      {hint && <span className="text-[11px] tracking-[0.02em] text-[color:var(--ink-mute)]">{hint}</span>}
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
    <div className="mt-[18px] border-t border-[color:var(--rule)] pt-1">
      <div className="grid min-h-[calc(100vh-220px)] grid-cols-[360px_1fr] gap-0 max-[1100px]:grid-cols-1">
        <div className="flex flex-col gap-[22px] border-r border-[color:var(--rule)] bg-card px-[22px] py-6 max-[1100px]:border-b max-[1100px]:border-r-0">
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Ajuste as variáveis</span>
            <h3 className="m-0 font-serif text-2xl font-normal tracking-[-0.01em]">Cenário</h3>
          </div>
          <SimSlider label="Preço do leite" value={precoLeite} min={3.0} max={4.5} step={0.05} onChange={setPreco} fmt={(v) => "R$ " + v.toFixed(2).replace(".", ",") + "/L"} hint="média CEPEA recente ~R$ 3,50" />
          <SimSlider label="Crescimento do volume" value={volGrowth} min={0} max={12} step={0.5} onChange={setVolGrowth} fmt={(v) => "+" + v.toFixed(1).replace(".", ",") + "%/mês"} hint="matrizes entrando em produção" />
          <SimSlider label="Variação do custeio" value={custeioGrowth} min={-2} max={4} step={0.5} onChange={setCusteioGrowth} fmt={(v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1).replace(".", ",") + "%/mês"} hint="ração, curral, pessoal" />
          <SimSlider label="Investimento mensal" value={investMensal} min={0} max={1200000} step={20000} onChange={setInvest} fmt={(v) => fmtBRLsim(v) + "/mês"} hint="compra de gado, máquina, benfeitoria" />
          <SimSlider label="Receita safra de café" value={cafeSafra} min={0} max={600000} step={10000} onChange={setCafe} fmt={(v) => fmtBRLsim(v)} hint="safra única ~Mar/27" />

          <div className="mt-1.5 flex flex-wrap gap-2 border-t border-[color:var(--rule-soft)] pt-[18px]">
            {presets.map((p, i) => (
              <button
                key={i}
                className="cursor-pointer border border-[color:var(--rule)] bg-transparent px-3 py-[7px] font-sans text-[12.5px] tracking-[0.01em] text-ink-2 hover:border-mast hover:bg-mast hover:text-mast-ink"
                onClick={p.apply}
              >
                {p.nome}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-[22px] bg-background px-7 py-6">
          <div className="grid grid-cols-3 border border-[color:var(--rule)] bg-card max-[1100px]:grid-cols-1">
            <div className="flex flex-col gap-[5px] border-r border-[color:var(--rule-soft)] px-[22px] py-[18px] last:border-r-0">
              <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">Break-even do leite</span>
              <span className="mono-nums font-serif text-[32px] leading-none tracking-[-0.015em]">{sim.breakEvenMes || "—"}</span>
              <span className="text-xs text-[color:var(--ink-mute)]">{sim.breakEvenIdx >= 0 ? `em ${sim.breakEvenIdx + 1} meses` : "fora de 12m"}</span>
            </div>
            <div className="flex flex-col gap-[5px] border-r border-[color:var(--rule-soft)] px-[22px] py-[18px] last:border-r-0">
              <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">Fôlego de caixa</span>
              <span className={"mono-nums font-serif text-[32px] leading-none tracking-[-0.015em] " + (folegoSev === "neg" ? "text-prejuizo" : folegoSev === "warn" ? "text-atencao" : "text-lucro")}>{folegoTxt}</span>
              <span className="text-xs text-[color:var(--ink-mute)]">{sim.caixaZeraMes ? "zera em " + sim.caixaZeraMes : "não zera no período"}</span>
            </div>
            <div className="flex flex-col gap-[5px] border-r border-[color:var(--rule-soft)] px-[22px] py-[18px] last:border-r-0">
              <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">Caixa em 12 meses</span>
              <span className={"mono-nums font-serif text-[32px] leading-none tracking-[-0.015em] " + (sim.caixaFinal < 0 ? "text-prejuizo" : "text-lucro")}>{fmtBRLsim(sim.caixaFinal)}</span>
              <span className="text-xs text-[color:var(--ink-mute)]">vs base {fmtBRLsim(base.caixaFinal)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-l-[3px] border-l-[color:var(--pos)] bg-card px-5 py-[18px]">
            <div className="ai-signature">
              <span className="dot"></span>
              <span>Rio Novo · IA analista</span>
              <span style={{ color: "var(--ink-mute)" }}>· simulação ao vivo</span>
            </div>
            <div className="flex flex-col gap-2 [&_p]:m-0 [&_p]:font-serif [&_p]:text-[17px] [&_p]:leading-[1.5] [&_p]:text-ink-2 [&_strong]:font-medium [&_strong]:text-foreground">
              {narrativa.map((f, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: f.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }}></p>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 max-[1100px]:grid-cols-1">
            <div className="border border-[color:var(--rule)] bg-card px-[18px] py-4">
              <div className="mb-2 font-sans text-xs uppercase tracking-[0.12em] text-ink-3">Custo × preço por litro</div>
              <SimLineChart proj={sim.proj} accessorA={(p) => p.custoLitro} accessorB={(p) => p.preco} colorA="var(--neg)" colorB="var(--leite)" labelA="custo" labelB="preço" fmtY={(v) => "R$" + v.toFixed(1)} />
            </div>
            <div className="border border-[color:var(--rule)] bg-card px-[18px] py-4">
              <div className="mb-2 font-sans text-xs uppercase tracking-[0.12em] text-ink-3">Caixa projetado</div>
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
