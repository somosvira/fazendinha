/* Rio Novo — Relatório de Fechamento Mensal (snapshot).
 * TODO: quando FechamentoMensal existir no backend, o mês vira query real —
 * hoje "Abril 2026" é estático porque a única fonte é o mock. Botões
 * ◂ Março / Maio ▸ ficam desabilitados até isso existir.
 *
 * Migrado para Tailwind (Fase 7 shadcn). Regras antes em relatorio.css agora
 * são utilitárias inline; o pipeline de PDF (html2pdf/printRef/estado
 * `exportando`) é preservado byte-a-byte. Impressão via `print:` variants;
 * o estado "gerando-pdf" (antes classe togglada) vira condicional em `exportando`.
 */

import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { fetchDashboard, reclassificarCategoria } from "../api";
import { reconciliarMes } from "../lib/reconciliacao";
import { fmtMoney, fmtBR, fmtBRL } from "./charts";
import type { Tab } from "./Shell";
import { cn } from "@/lib/utils";

/* ============ MÊS FECHADO (derivado do dado real) ============ */
/* A janela é sempre 23 meses (Jul/2024 → Mai/2026); o último é parcial ("*", mês
 * em curso), então o último mês FECHADO é o penúltimo índice. */
const mesFechadoIdx = (R: { MESES_23M: string[] }) => R.MESES_23M.length - 2;

const PT_MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
/* Nome cheio do mês a partir do índice na janela (idx 0 = Jul/2024). */
function mesNome(idx: number): string {
  const total = 6 + idx; // julho (0-indexed = 6) é o idx 0
  return PT_MONTHS_FULL[((total % 12) + 12) % 12];
}
function mesLabelFull(idx: number): string {
  const total = 6 + idx;
  const y = 2024 + Math.floor(total / 12);
  return `${mesNome(idx)} ${y}`;
}
const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");

/* ============ CÁLCULOS DERIVADOS (funções puras) ============ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function saldoLeiteDoMes(R: any, idx: number) {
  return {
    receita: R.receitaLeite[idx],
    custeio: R.custeioLeitePuro[idx],
    saldo: R.saldoOpLeite[idx],
  };
}

type Alta = { nome: string; valorMil: number; delta: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function categoriasQueSubiram(R: any): Alta[] {
  // Delta YTD 2026 vs YTD 2025 por categoria como proxy honesta de "onde acelerou".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cats: any[] = R.categoriasReais ?? [];
  return cats
    .filter((c) => c.delta > 0 && c.ytd2026 > 20000)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
    .map((c) => ({
      nome: c.nome,
      valorMil: Math.round(c.ytd2026 / 1000),
      delta: c.delta,
    }));
}

/* ============ HEADER (substitui o DateRangePicker inútil) ============ */

function FechamentoHeader({
  onExportar,
  exportando,
  oculto,
  mesLabel,
  emitidoEm,
  escopo,
  prevMes,
  nextMes,
}: {
  onExportar: () => void;
  exportando: boolean;
  oculto: boolean;
  mesLabel: string;
  emitidoEm: string;
  escopo: string;
  prevMes: string;
  nextMes: string;
}) {
  return (
    <div
      className={cn(
        "mb-8 grid grid-cols-[1fr_auto] items-end gap-6 border-b border-[color:var(--rule-soft)] pt-8 pb-5 print:hidden",
        "max-[720px]:grid-cols-1 max-[720px]:items-start",
        oculto && "hidden",
      )}
    >
      <div>
        <span className="eyebrow text-[11px] uppercase tracking-[0.14em] text-ink-3">Fechamento mensal</span>
        <h1 className="m-0 mt-1.5 mb-2 font-serif text-[52px] font-normal leading-[1.05] tracking-[-0.02em] text-foreground max-[720px]:text-[36px]">
          {mesLabel}
        </h1>
        <p className="m-0 font-sans text-sm text-ink-3">
          Emitido em {emitidoEm} · {escopo}
        </p>
      </div>
      <div className="flex flex-col items-end gap-3 max-[720px]:items-start">
        <button
          className="btn-ghost font-sans"
          onClick={onExportar}
          disabled={exportando}
          title="Baixa o relatório como PDF direto."
        >
          {exportando ? "Gerando PDF…" : "⤓ Baixar PDF"}
        </button>
        <div
          className="inline-flex gap-1 overflow-hidden rounded-md border border-[color:var(--rule-soft)]"
          aria-label="Navegar entre meses fechados"
        >
          <button
            className="cursor-pointer border-0 bg-transparent px-3 py-1.5 font-sans text-xs text-ink-3 hover:enabled:bg-card hover:enabled:text-foreground disabled:cursor-not-allowed disabled:text-[color:var(--ink-mute)] disabled:opacity-50"
            disabled
            title="Meses anteriores serão liberados quando o backend de fechamento estiver ativo."
          >
            ◂ {prevMes}
          </button>
          <button
            className="cursor-pointer border-0 bg-transparent px-3 py-1.5 font-sans text-xs text-ink-3 hover:enabled:bg-card hover:enabled:text-foreground disabled:cursor-not-allowed disabled:text-[color:var(--ink-mute)] disabled:opacity-50"
            disabled
            title={`${nextMes} ainda não fechou.`}
          >
            {nextMes} ▸
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ COMPONENTE PADRÃO DE VEREDICTO ============ */

function Veredicto({
  pergunta,
  resposta,
  tom = "neutro",
  stats,
  nota,
  visual,
}: {
  pergunta: string;
  resposta: ReactNode;
  tom?: "pos" | "neg" | "neutro";
  /* Dado cru e direto sob o número: label à esquerda, valor à direita. A leitura
   * analítica (o "porquê") vive nos cards de atenção no fim do relatório. */
  stats?: { label: string; valor: string; forte?: boolean }[];
  /* Uma linha curta e direta opcional (não é análise em prosa). */
  nota?: ReactNode;
  visual?: ReactNode;
}) {
  return (
    /* `veredicto` fica como marcador puro (sem CSS): o html2pdf lê `.veredicto`
     * no `pagebreak.avoid` para não quebrar o cartão entre páginas. Idem
     * `.atencao-card`. Preservados como hooks de JS/lib, não como estilo.
     *
     * Layout split: coluna estreita de info (pergunta + número + contexto) à
     * esquerda; visual (gráfico/lista) largo à direita. Colapsa para uma coluna
     * abaixo de 820px (info em cima, gráfico embaixo). */
    <section
      className={cn(
        "veredicto grid grid-cols-1 items-center gap-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-card px-5 py-4",
        "min-[820px]:grid-cols-[minmax(185px,215px)_1fr] min-[820px]:gap-6",
        "print:break-inside-avoid print:border print:border-[#999] print:bg-white",
      )}
    >
      <div className="flex flex-col gap-2 min-[820px]:border-r min-[820px]:border-[color:var(--rule-soft)] min-[820px]:pr-6">
        <h2 className="m-0 font-serif text-[17px] font-normal leading-[1.25] tracking-[-0.01em] text-ink-2">
          {pergunta}
        </h2>
        <div
          className={cn(
            "font-serif text-[40px] font-medium leading-none tracking-[-0.03em] max-[720px]:text-[34px]",
            tom === "pos" ? "text-lucro" : tom === "neg" ? "text-prejuizo" : "text-foreground",
          )}
        >
          {resposta}
        </div>
        {stats?.length ? (
          <dl className="m-0 mt-1 flex flex-col gap-1.5">
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between gap-3">
                <dt className="font-sans text-[12px] text-ink-3">{s.label}</dt>
                <dd
                  className={cn(
                    "m-0 mono-nums font-sans text-[13px]",
                    s.forte ? "font-semibold text-foreground" : "font-medium text-ink-2",
                  )}
                >
                  {s.valor}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {nota ? <div className="m-0 font-sans text-[12px] leading-[1.45] text-ink-3">{nota}</div> : null}
      </div>
      {visual ? <div className="min-w-0">{visual}</div> : null}
    </section>
  );
}

/* ============ MINI-GRÁFICOS (SVG próprios, sem lib) ============ */

/* Passo "redondo" (…50, 100, 200…) para o eixo Y mirando ~4 divisões. */
function passoEixo(span: number): number {
  const alvo = span / 4 || 1;
  const passos = [25, 50, 100, 150, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
  return passos.find((p) => p >= alvo) ?? passos[passos.length - 1];
}

/* Sparkline de linha com área suave, eixo Y com grade rotulada e legenda. O mês
 * em foco ganha um ponto + o valor sobre ele. `assinado` desenha a linha do zero
 * (fluxo/saldo do leite misturam sinais) e colore o foco por lucro/prejuízo;
 * séries só positivas (café) usam a cor da atividade. Valores em milhares. */
function SparklineTendencia({
  data,
  destaqueIdx,
  cor = "var(--ink-3)",
  assinado = false,
  titulo,
  focoLabel,
  unidade = "R$ mil",
}: {
  data: { x: string; y: number }[];
  destaqueIdx?: number;
  cor?: string;
  assinado?: boolean;
  titulo: string;
  focoLabel?: string;
  unidade?: string;
}) {
  const clipId = useId(); // ids únicos p/ os clips de área verde/vermelha (3 sparklines na página)
  const W = 720;
  const H = 210; // mais alto para leitura vertical mais folgada
  const padL = 88; // espaço p/ rótulos do eixo Y com R$ ("−R$ 1.129 mil"/"−R$ 1,4 mi" sem cortar)
  const padR = 16;
  const padT = 26; // espaço para o rótulo de valor acima do ponto
  const padB = 22; // espaço para os ticks + rótulos de mês
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const values = data.map((d) => d.y);
  const rawMax = Math.max(...values, 0);
  const rawMin = Math.min(...values, 0);
  const passo = passoEixo(rawMax - rawMin);
  const domMax = Math.ceil(rawMax / passo) * passo;
  const domMin = Math.floor(rawMin / passo) * passo;
  const span = domMax - domMin || 1;
  const n = data.length;
  const px = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const py = (v: number) => padT + innerH - ((v - domMin) / span) * innerH;

  const gridTicks: number[] = [];
  for (let t = domMin; t <= domMax + 1e-6; t += passo) gridTicks.push(t);

  const linePts = data.map((d, i) => `${px(i)},${py(d.y)}`).join(" ");
  const zeroY = py(Math.min(Math.max(0, domMin), domMax)); // linha do zero (clampeada ao domínio)
  const areaBaseY = py(Math.max(domMin, 0));
  const areaPts = `${px(0)},${areaBaseY} ${linePts} ${px(n - 1)},${areaBaseY}`;
  const eixoBaseY = padT + innerH; // reta do eixo X (base do plot)
  const zeroInterno = domMin < 0 && domMax > 0; // zero fica no meio → merece destaque próprio

  const fi = destaqueIdx ?? n - 1;
  const fx = px(fi);
  const fy = py(data[fi].y);
  const focoCor = assinado ? (data[fi].y >= 0 ? "var(--lucro)" : "var(--prejuizo)") : cor;
  const labelAnchor = fi >= n - 2 ? "end" : fi <= 1 ? "start" : "middle";
  const labelY = Math.max(fy - 11, 13);

  // Rótulo com moeda + unidade: valores em milhares → < 1000 = "R$ … mil", ≥ 1000 = "R$ … mi".
  const rotuloUnid = (v: number) => {
    const abs = Math.abs(v);
    const sinal = v < 0 ? "−" : "";
    return abs >= 1000
      ? `${sinal}R$ ${(abs / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`
      : `${sinal}R$ ${fmtBR(abs)} mil`;
  };

  // Pontos de máximo e mínimo da série (marcados além do mês em foco).
  const maxIdx = values.indexOf(Math.max(...values));
  const minIdx = values.indexOf(Math.min(...values));
  const extremos = [maxIdx, minIdx].filter(
    (idx, k, arr) => idx !== fi && arr.indexOf(idx) === k,
  );
  const tagAnchor = (idx: number) => (idx >= n - 1 ? "end" : idx <= 0 ? "start" : "middle");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {/* clips p/ colorir a área pelo sinal: acima do zero = verde, abaixo = vermelho */}
        <defs>
          <clipPath id={`${clipId}-pos`}>
            <rect x={0} y={padT} width={W} height={Math.max(0, zeroY - padT)} />
          </clipPath>
          <clipPath id={`${clipId}-neg`}>
            <rect x={0} y={zeroY} width={W} height={Math.max(0, eixoBaseY - zeroY)} />
          </clipPath>
        </defs>
        {/* grade + rótulos do eixo Y (o zero ganha uma reta própria mais forte adiante) */}
        {gridTicks.map((t) => {
          const gy = py(t);
          const isZero = t === 0;
          return (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={gy} y2={gy} stroke="var(--rule-soft)" strokeWidth={1} />
              <text x={padL - 8} y={gy + 3} textAnchor="end" fontSize={12} className="chart-tick-text">
                {isZero ? "0" : rotuloUnid(t)}
              </text>
            </g>
          );
        })}
        {/* reta do eixo Y (régua vertical à esquerda) + reta do eixo X (base) — pretas */}
        <line x1={padL} x2={padL} y1={padT} y2={eixoBaseY} stroke="var(--ink)" strokeWidth={1} />
        <line x1={padL} x2={W - padR} y1={eixoBaseY} y2={eixoBaseY} stroke="var(--ink)" strokeWidth={1} />
        {/* ticks do eixo X (um por mês) */}
        {data.map((_, i) => (
          <line
            key={`xt-${i}`}
            x1={px(i)}
            x2={px(i)}
            y1={eixoBaseY}
            y2={eixoBaseY + 4}
            stroke="var(--rule-soft)"
            strokeWidth={1}
          />
        ))}
        {/* área colorida pelo sinal (assinado) ou pela cor da atividade (café etc.) */}
        {assinado ? (
          <>
            <polyline points={areaPts} fill="var(--lucro)" fillOpacity={0.14} stroke="none" clipPath={`url(#${clipId}-pos)`} />
            <polyline points={areaPts} fill="var(--prejuizo)" fillOpacity={0.12} stroke="none" clipPath={`url(#${clipId}-neg)`} />
          </>
        ) : (
          <polyline points={areaPts} fill={cor} fillOpacity={0.1} stroke="none" />
        )}
        {/* reta do zero em destaque quando fica no meio do gráfico (referência principal) */}
        {zeroInterno && (
          <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke="var(--ink-2)" strokeWidth={1.4} />
        )}
        <polyline
          points={linePts}
          fill="none"
          stroke={cor}
          strokeOpacity={0.65}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* pontos de máximo e mínimo (discretos, atrás do foco) */}
        {extremos.map((idx) => {
          const ex = px(idx);
          const ey = py(data[idx].y);
          const acima = idx === maxIdx;
          const ty = acima ? Math.max(ey - 8, 10) : Math.min(ey + 14, H - padB - 1);
          const sinalCor = data[idx].y >= 0 ? "var(--lucro)" : "var(--prejuizo)";
          return (
            <g key={idx}>
              <circle cx={ex} cy={ey} r={3} fill={sinalCor} />
              <text
                x={ex}
                y={ty}
                textAnchor={tagAnchor(idx)}
                fill={sinalCor}
                fontSize={13}
                fontWeight={700}
                style={{ fontFeatureSettings: '"tnum"' }}
              >
                {rotuloUnid(data[idx].y)}
              </text>
            </g>
          );
        })}
        {/* ponto em foco + valor */}
        <circle cx={fx} cy={fy} r={6} fill={focoCor} fillOpacity={0.18} />
        <circle cx={fx} cy={fy} r={3.5} fill={focoCor} />
        <text
          x={fx}
          y={labelY}
          textAnchor={labelAnchor}
          fill={focoCor}
          fontSize={16}
          fontWeight={700}
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {fmtMoney(data[fi].y)}
        </text>
        {/* ticks de mês */}
        {data.map((d, i) => (
          <text key={i} x={px(i)} y={H - 4} textAnchor="middle" fontSize={11} className="chart-tick-text">
            {d.x}
          </text>
        ))}
      </svg>
      {/* legenda */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-[11px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-4 rounded-full" style={{ background: cor }} />
          {titulo}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="legend-dot" style={{ background: focoCor }} />
          {focoLabel ? `${focoLabel} · ` : ""}
          <span className="mono-nums">{fmtMoney(data[fi].y)}</span>
        </span>
        <span className="text-ink-mute">{unidade}</span>
      </div>
    </div>
  );
}

/* Stacked bar horizontal para composição do investimento. */
function StackedBarComposicao({
  itens,
}: {
  itens: { nome: string; valorMil: number; cor: string }[];
}) {
  const total = itens.reduce((s, x) => s + x.valorMil, 0);
  if (total <= 0) return null;
  return (
    <div className="mt-1 flex flex-col gap-2.5">
      <div className="flex h-3 overflow-hidden rounded-[3px] bg-[color:var(--rule-soft)]">
        {itens.map((it, i) => (
          <div
            key={i}
            className="h-full"
            style={{ width: `${(it.valorMil / total) * 100}%`, background: it.cor }}
            title={`${it.nome}: ${fmtMoney(it.valorMil, { compact: false })}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-4 font-sans text-xs text-ink-2">
        {itens.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <span className="legend-dot" style={{ background: it.cor }} />
            <span>{it.nome}</span>
            <span className="mono-nums font-medium text-foreground">{fmtMoney(it.valorMil, { compact: false })}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============ VEREDICTO 6: ATENÇÃO (lista de inconsistências) ============ */

function AtencaoCard({
  item,
  onReclassificar,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any;
  onReclassificar: () => void;
}) {
  const sevLabel = item.severidade === "alta" ? "Crítica" : item.severidade === "media" ? "Média" : "Baixa";
  const stripe =
    item.severidade === "alta"
      ? "var(--prejuizo)"
      : item.severidade === "media"
        ? "var(--leite)"
        : item.severidade === "baixa"
          ? "var(--outros)"
          : "var(--ink-mute)";
  const chipCls =
    item.severidade === "alta"
      ? "bg-[rgba(198,40,40,0.14)] text-prejuizo"
      : item.severidade === "media"
        ? "bg-[rgba(184,154,92,0.22)] text-cafe"
        : item.severidade === "baixa"
          ? "bg-[rgba(107,122,92,0.20)] text-ink-2"
          : "bg-[color:var(--rule-soft)] text-ink-2";
  return (
    <div
      className="atencao-card flex flex-col gap-2 rounded-md border border-[color:var(--rule-soft)] bg-background p-4 print:break-inside-avoid print:bg-white"
      style={{ borderLeft: `3px solid ${stripe}` }}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "rounded-[3px] px-2 py-[3px] font-sans text-[10px] font-medium uppercase tracking-[0.1em]",
            chipCls,
          )}
        >
          {sevLabel}
        </span>
        <span className="mono-nums font-serif text-lg text-foreground">{fmtBRL(item.valor)}</span>
      </div>
      <div className="font-sans text-[13px] font-medium leading-[1.35] text-foreground">{item.titulo}</div>
      <div className="font-sans text-xs leading-[1.45] text-ink-3">{item.impacto}</div>
      {item.categoriaId ? (
        <button
          className="btn-primary mt-1 self-start px-3 py-1.5 text-xs font-sans"
          onClick={() => reclassificarCategoria(item.categoriaId, "INVESTIMENTO").then(onReclassificar)}
        >
          {item.acao} →
        </button>
      ) : (
        <button className="btn-primary mt-1 self-start px-3 py-1.5 text-xs font-sans">{item.acao} →</button>
      )}
    </div>
  );
}

/* ============ PÁGINA ============ */

export function Relatorio({ onNav }: { onNav: (t: Tab) => void }) {
  // Dado REAL do fechamento — mesmo payload que o Dashboard usa (fetchDashboard).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  // `tick` reexecuta o fetch (ex.: após reclassificar uma categoria no backend).
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const printRef = useRef<HTMLDivElement>(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setData(null);
    setErro(null);
    fetchDashboard()
      .then((d) => vivo && setData(d))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
    };
  }, [tick]);

  const exportarPDF = async () => {
    if (!printRef.current || exportando) return;
    setExportando(true);
    try {
      // Dynamic import: html2pdf + jspdf + html2canvas (~400kb) só entram no bundle
      // quando o dono clica em "Baixar PDF". Não penaliza o load inicial.
      const mod = await import("html2pdf.js");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2pdf = (mod as any).default ?? (mod as any);
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `Fechamento-${(data ? mesLabelFull(mesFechadoIdx(data)) : "mes").replace(/ /g, "-")}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#F2EDE2" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"], avoid: [".veredicto", ".atencao-card"] },
        })
        .from(printRef.current)
        .save();
    } catch (e) {
      console.error("[exportarPDF] falhou:", e);
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Falha ao gerar PDF: ${msg}\n\nAbra o console (F12) para o stack completo.`);
    } finally {
      setExportando(false);
    }
  };

  if (erro) {
    return (
      <div className="shell-wide pb-24">
        <p className="mt-16 text-center font-sans text-sm text-prejuizo">
          Falha ao carregar o fechamento: {erro}
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="shell-wide pb-24">
        <p className="mt-16 text-center font-sans text-sm text-ink-3">Carregando fechamento…</p>
      </div>
    );
  }
  const R = data;

  const IDX = mesFechadoIdx(R); // último mês fechado (penúltimo da janela)
  const ini12 = Math.max(0, IDX - 11); // janela de 12 meses completos terminando em IDX
  const meses12m: string[] = R.MESES_23M.slice(ini12, IDX + 1);
  const foco12 = meses12m.length - 1; // posição do mês fechado dentro da janela de 12m
  // Rótulo do eixo: só a inicial do mês (M · J · J · A …). A barra do mês em foco
  // é quem o identifica; a ambiguidade (M=Mar/Mai, J=Jan/Jun/Jul) é aceitável.
  const inicialMes = (i: number) => meses12m[i].slice(0, 1).toUpperCase();
  const serie12 = (arr: number[]) =>
    arr.slice(ini12, IDX + 1).map((v, i) => ({ x: inicialMes(i), y: Math.round(v / 1000) }));
  const fluxo12m = serie12(R.totalGeral);
  const saldoLeite12m = serie12(R.saldoOpLeite);
  const receitaCafe12m = serie12(R.receitaCafe);
  // Café é safra única: destaca o mês de maior receita (a colheita), não o último
  // mês fechado — que em geral é 0 e fazia o ponto do gráfico apontar para nada.
  const cafeMaxIdx = receitaCafe12m.reduce((best, d, i, a) => (d.y > a[best].y ? i : best), 0);
  const cafeFocoIdx = receitaCafe12m[cafeMaxIdx].y > 0 ? cafeMaxIdx : foco12;

  // Reconciliação: manchete = líquido (== ponto do gráfico), + gasto total do mês.
  const recon = reconciliarMes(R, IDX);
  const leite = saldoLeiteDoMes(R, IDX);
  const cafeYtdMargem = R.k2026YTD.receitaCafe - R.k2026YTD.custeioCafe;
  const cafeYtdRec = R.k2026YTD.receitaCafe;
  // Composição do investimento DO MÊS (bate com a manchete, que é do mês) — antes
  // usava um breakdown YTD que nem vem no payload real.
  const investItens = [
    { nome: "Invest. leite", valorMil: Math.round(R.investLeite[IDX] / 1000), cor: "var(--leite)" },
    { nome: "Invest. café", valorMil: Math.round(R.investCafe[IDX] / 1000), cor: "var(--cafe)" },
    { nome: "Animais (aquisição)", valorMil: Math.round(R.animalAquisicao[IDX] / 1000), cor: "var(--leite)" },
    { nome: "Caminhão / trator", valorMil: Math.round(R.rnCaminhao[IDX] / 1000), cor: "var(--outros)" },
  ].filter((it) => it.valorMil > 0);
  const investMes = recon.investimento;
  const maiorInvest = [...investItens].sort((a, b) => b.valorMil - a.valorMil)[0];
  const altas = categoriasQueSubiram(R);

  // Stats do fluxo: líquido é a manchete; entrada − gasto === líquido; o breakdown
  // do gasto (subordinado com ↳) soma exatamente ao gasto total.
  const mil = (v: number) => fmtMoney(Math.round(v / 1000), { compact: false });
  const statsFluxo = [
    { label: "Entrada", valor: mil(recon.entrada) },
    { label: "Gasto total", valor: mil(recon.gastoTotal), forte: true },
    ...recon.breakdown.map((b) => ({ label: `↳ ${b.label}`, valor: mil(b.valor) })),
  ];

  const mesLabel = mesLabelFull(IDX);
  const emitidoEm = String(R.UPDATED_AT ?? "").split(",")[0] || String(R.REPORT_DATE_LABEL ?? "");
  const escopo = `${fmtInt(R.nLancamentos ?? 0)} lançamentos do BPO`;
  const periodo = `${R.MESES_23M[0]} — ${R.MESES_23M[R.MESES_23M.length - 1]}`;
  const prevMes = IDX - 1 >= 0 ? mesNome(IDX - 1) : "—";
  const nextMes = IDX + 1 < R.MESES_23M.length ? mesNome(IDX + 1) : "—";

  return (
    /* shell-wide (largura) permanece — classe compartilhada em base.css. Padding
     * inferior 96px; em `exportando` (antes .gerando-pdf) vira p-0 para o
     * html2canvas capturar como folha. print:pb-0 replica o @media print. */
    <div
      className={cn(
        "shell-wide pb-24 print:pb-0",
        exportando && "!p-0",
      )}
      key={tick}
      ref={printRef}
    >
      <FechamentoHeader
        onExportar={exportarPDF}
        exportando={exportando}
        oculto={exportando}
        mesLabel={mesLabel}
        emitidoEm={emitidoEm}
        escopo={escopo}
        prevMes={prevMes}
        nextMes={nextMes}
      />

      <div className="grid grid-cols-1 gap-4 print:gap-4 min-[1080px]:grid-cols-[minmax(0,1fr)_320px] min-[1080px]:items-start">
        {/* Coluna principal: os veredictos (métrica + gráfico) --------------- */}
        <div className="flex min-w-0 flex-col gap-4">
        {/* 1) Fluxo do mês ---------------------------------------------------- */}
        <Veredicto
          pergunta={`Sobrou ou faltou em ${mesNome(IDX).toLowerCase()}?`}
          resposta={fmtMoney(Math.round(recon.liquido / 1000))}
          tom={recon.liquido >= 0 ? "pos" : "neg"}
          stats={statsFluxo}
          nota={`${escopo} · o gasto total é a soma dos itens acima.`}
          visual={
            <SparklineTendencia
              data={fluxo12m}
              destaqueIdx={foco12}
              assinado
              titulo="Fluxo líquido"
              focoLabel={meses12m[foco12]}
            />
          }
        />

        {/* 2) Leite paga o leite? -------------------------------------------- */}
        <Veredicto
          pergunta="Leite pagou o leite?"
          resposta={leite.saldo >= 0 ? "SIM" : "NÃO"}
          tom={leite.saldo >= 0 ? "pos" : "neg"}
          stats={[
            { label: "Receita", valor: fmtMoney(Math.round(leite.receita / 1000), { compact: false }) },
            { label: "Custeio puro", valor: fmtMoney(Math.round(leite.custeio / 1000), { compact: false }), forte: true },
            // Preço médio (R$/L) e Custo/L omitidos: dependem do volume de leite,
            // que o backend financeiro ainda não modela. Reexibir só com dado real.
          ]}
          visual={
            <SparklineTendencia
              data={saldoLeite12m}
              destaqueIdx={foco12}
              assinado
              titulo="Saldo do leite"
              focoLabel={meses12m[foco12]}
            />
          }
        />

        {/* 3) Café ------------------------------------------------------------ */}
        <Veredicto
          pergunta="E o café?"
          resposta={cafeYtdMargem >= 0 ? `+${fmtMoney(Math.round(cafeYtdMargem / 1000))}` : fmtMoney(Math.round(cafeYtdMargem / 1000))}
          tom={cafeYtdMargem >= 0 ? "pos" : "neg"}
          stats={[
            { label: "Receita safra", valor: fmtMoney(Math.round(cafeYtdRec / 1000), { compact: false }), forte: true },
            // Sacas e Preço/saca omitidos: dependem do volume colhido, que o backend
            // financeiro ainda não modela. Reexibir só com dado real.
          ]}
          nota="Safra única (mar/26) concentra o risco."
          visual={
            <SparklineTendencia
              data={receitaCafe12m}
              cor="var(--cafe)"
              destaqueIdx={cafeFocoIdx}
              titulo="Receita do café"
              focoLabel={meses12m[cafeFocoIdx]}
            />
          }
        />

        {/* 4) Onde vazou ------------------------------------------------------ */}
        <Veredicto
          pergunta="Onde vazou este ano?"
          resposta={
            <span className="font-serif text-[38px] font-medium leading-[1.1] tracking-[-0.02em] text-foreground">
              3 categorias
            </span>
          }
          tom="neg"
          nota="Aceleração YTD 2026 vs. 2025."
          visual={
            <>
              <ul className="m-0 flex list-none flex-col gap-0 p-0">
                {altas.map((a) => (
                  <li
                    key={a.nome}
                    className="grid grid-cols-[1fr_auto_auto] items-baseline gap-4 border-b border-[color:var(--rule-soft)] py-3 last:border-b-0 max-[720px]:grid-cols-[1fr_auto] max-[720px]:gap-y-1"
                  >
                    <span className="font-sans text-sm text-foreground">{a.nome}</span>
                    <span className="mono-nums font-serif text-lg text-foreground">R$ {a.valorMil}k</span>
                    <span className="mono-nums font-sans text-[13px] text-prejuizo max-[720px]:col-start-2">▲ {a.delta}%</span>
                  </li>
                ))}
              </ul>
              <button
                className="btn-ghost mt-2.5 self-start px-3.5 py-2 text-[13px] font-sans print:hidden"
                onClick={() => onNav("dashboard")}
              >
                Ver detalhe no Dashboard →
              </button>
            </>
          }
        />

        {/* 5) Investimentos --------------------------------------------------- */}
        <Veredicto
          pergunta="Investimentos do mês"
          resposta={fmtMoney(Math.round(investMes / 1000))}
          tom="neutro"
          nota={
            maiorInvest ? (
              <>
                Maior peso: <strong className="font-medium text-foreground">{maiorInvest.nome}</strong>{" "}
                <span className="mono-nums">({fmtMoney(maiorInvest.valorMil, { compact: false })})</span>
              </>
            ) : undefined
          }
          visual={<StackedBarComposicao itens={investItens} />}
        />

        </div>
        {/* fecha a coluna principal */}

        {/* 6) Atenção — sidebar secundário à direita dos gráficos ------------- */}
        <aside className="flex flex-col gap-3 min-[1080px]:sticky min-[1080px]:top-4">
          <div className="flex flex-col gap-1.5 border-b border-[color:var(--rule-soft)] pb-3">
            <h2 className="m-0 font-serif text-[17px] font-normal leading-[1.25] tracking-[-0.01em] text-ink-2">
              O que precisa da sua atenção?
            </h2>
            <p className="m-0 font-sans text-[12px] leading-[1.45] text-ink-3">
              Inconsistências que a IA levantou nos lançamentos deste fechamento. Corrigir na origem melhora o próximo mês.
            </p>
          </div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {R.inconsistencias.map((it: any) => (
            <AtencaoCard key={it.id} item={it} onReclassificar={bump} />
          ))}
        </aside>
      </div>

      {/* Rodapé ------------------------------------------------------------- */}
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-[color:var(--rule-soft)] pt-6 print:justify-start">
        <span className="caption">Fechamento gerado a partir de {escopo} ({periodo}).</span>
        <div className={cn("flex gap-3 print:hidden", exportando && "hidden")}>
          <button className="btn-ghost font-sans" onClick={exportarPDF} disabled={exportando}>
            {exportando ? "Gerando PDF…" : "⤓ Baixar PDF"}
          </button>
          <button className="btn-primary font-sans" onClick={() => onNav("dashboard")}>
            Abrir Dashboard interativo →
          </button>
        </div>
      </footer>
    </div>
  );
}
