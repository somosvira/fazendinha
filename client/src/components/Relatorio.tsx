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

import { ReactNode, useRef, useState } from "react";
import R from "../data/rionovo";
import { fmtMoney } from "./charts";
import type { Tab } from "./Shell";
import { reclassificarCategoria } from "../api";
import { cn } from "@/lib/utils";

/* ============ CONSTANTES DO MÊS FECHADO ============ */
/* Mai/2026 no mock tem receita=0 (marcado "Mai/26*" — mês em curso). O último
 * mês fechado é Abril/2026 = índice 21 do vetor de 23 meses. */
const MES_FECHADO_IDX = 21;
const MES_FECHADO_LABEL = "Abril 2026";
const EMITIDO_EM = "04 de maio de 2026";

/* ============ CÁLCULOS DERIVADOS (funções puras) ============ */

function fluxoDoMes(idx: number) {
  const receita = R.receitaLeite[idx] + R.receitaCafe[idx];
  const custeio = R.custeioLeitePuro[idx] + R.custeioCafe[idx] + R.sedeOutros[idx];
  const invest = R.investLeite[idx] + R.investCafe[idx] + R.animalAquisicao[idx];
  return { receita, custeio, invest, liquido: receita - custeio - invest };
}

function saldoLeiteDoMes(idx: number) {
  return {
    receita: R.receitaLeite[idx],
    custeio: R.custeioLeitePuro[idx],
    saldo: R.saldoOpLeite[idx],
  };
}

type Alta = { nome: string; valorMil: number; delta: number };

function categoriasQueSubiram(): Alta[] {
  // O mock só tem delta YTD 2026 vs YTD 2025 por categoria. Sem série mensal,
  // usamos delta anual como proxy honesta de "onde acelerou".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cats: any[] = R.categoriasReais;
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
}: {
  onExportar: () => void;
  exportando: boolean;
  oculto: boolean;
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
          {MES_FECHADO_LABEL}
        </h1>
        <p className="m-0 font-sans text-sm text-ink-3">
          Emitido em {EMITIDO_EM} · {R.iaScope.lancamentos} do BPO
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
            ◂ Março
          </button>
          <button
            className="cursor-pointer border-0 bg-transparent px-3 py-1.5 font-sans text-xs text-ink-3 hover:enabled:bg-card hover:enabled:text-foreground disabled:cursor-not-allowed disabled:text-[color:var(--ink-mute)] disabled:opacity-50"
            disabled
            title="Maio ainda não fechou."
          >
            Maio ▸
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
  contexto,
  mini,
  full,
  children,
}: {
  pergunta: string;
  resposta: ReactNode;
  tom?: "pos" | "neg" | "neutro";
  contexto?: ReactNode;
  mini?: ReactNode;
  full?: boolean;
  children?: ReactNode;
}) {
  return (
    /* `veredicto` fica como marcador puro (sem CSS): o html2pdf lê `.veredicto`
     * no `pagebreak.avoid` para não quebrar o cartão entre páginas. Idem
     * `.atencao-card`. Preservados como hooks de JS/lib, não como estilo. */
    <section
      className={cn(
        "veredicto flex flex-col gap-3.5 rounded-[10px] border border-[color:var(--rule-soft)] bg-card px-[26px] pt-6 pb-[26px]",
        "print:break-inside-avoid print:border print:border-[#999] print:bg-white",
        full && "min-[900px]:col-[1/-1]",
      )}
    >
      <h2 className="m-0 font-serif text-[22px] font-normal leading-[1.2] tracking-[-0.01em] text-foreground">
        {pergunta}
      </h2>
      <div
        className={cn(
          "grid grid-cols-[minmax(0,auto)_minmax(160px,1fr)] items-center gap-6",
          "max-[720px]:grid-cols-1 max-[720px]:gap-3",
          full && "min-[900px]:grid-cols-[minmax(0,auto)_minmax(200px,1fr)]",
        )}
      >
        <div
          className={cn(
            "whitespace-nowrap font-serif text-[64px] font-medium leading-none tracking-[-0.03em] max-[720px]:whitespace-normal max-[720px]:text-[48px]",
            tom === "pos" ? "text-lucro" : tom === "neg" ? "text-prejuizo" : "text-foreground",
          )}
        >
          {resposta}
        </div>
        {mini ? <div className="self-center">{mini}</div> : null}
      </div>
      {contexto ? (
        <div className="m-0 font-sans text-[13px] leading-[1.5] text-ink-2 [&_strong]:font-medium [&_strong]:text-foreground">
          {contexto}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/* ============ MINI-GRÁFICOS (SVG próprios, sem lib) ============ */

/* Barras assinadas: verde para positivo, vermelho para negativo. Usado no
 * fluxo mensal (mistura sinais) e no saldo operacional do leite (idem). */
function MiniBarsAssinadas({
  data,
  destaqueIdx,
}: {
  data: { x: string; y: number }[];
  destaqueIdx?: number;
}) {
  const W = 320;
  const H = 100;
  const padL = 4;
  const padR = 4;
  const padT = 6;
  const padB = 18;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const values = data.map((d) => d.y);
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);
  const zeroY = padT + innerH / 2;
  const scale = (innerH / 2) / maxAbs;
  const xBand = innerW / data.length;
  const barW = xBand * 0.62;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxWidth: 340 }}>
      <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} className="chart-axis" />
      {data.map((d, i) => {
        const x = padL + i * xBand + (xBand - barW) / 2;
        const h = Math.abs(d.y) * scale;
        const y = d.y >= 0 ? zeroY - h : zeroY;
        const isPos = d.y >= 0;
        const highlight = destaqueIdx === i;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 1)}
              fill={isPos ? "var(--lucro)" : "var(--prejuizo)"}
              opacity={highlight ? 1 : 0.42}
            />
            {highlight ? (
              <rect
                x={x - 1}
                y={y - 1}
                width={barW + 2}
                height={Math.max(h, 1) + 2}
                fill="none"
                stroke="var(--ink)"
                strokeWidth="1"
              />
            ) : null}
            <text x={x + barW / 2} y={H - 5} textAnchor="middle" className="chart-tick-text">
              {d.x}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* Barras positivas simples (usada para receita café — mostra sazonalidade). */
function MiniBarsPositivas({
  data,
  cor = "var(--cafe)",
  destaqueIdx,
}: {
  data: { x: string; y: number }[];
  cor?: string;
  destaqueIdx?: number;
}) {
  const W = 320;
  const H = 100;
  const padL = 4;
  const padR = 4;
  const padT = 10;
  const padB = 18;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...data.map((d) => d.y), 1);
  const scale = innerH / max;
  const xBand = innerW / data.length;
  const barW = xBand * 0.62;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxWidth: 340 }}>
      <line x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} className="chart-axis" />
      {data.map((d, i) => {
        const x = padL + i * xBand + (xBand - barW) / 2;
        const h = d.y * scale;
        const y = padT + innerH - h;
        const highlight = destaqueIdx === i;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 1)}
              fill={cor}
              opacity={d.y === 0 ? 0.15 : highlight ? 1 : 0.55}
            />
            <text x={x + barW / 2} y={H - 5} textAnchor="middle" className="chart-tick-text">
              {d.x}
            </text>
          </g>
        );
      })}
    </svg>
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
        <span className="mono-nums font-serif text-lg text-foreground">R$ {(item.valor / 1000).toFixed(0)}k</span>
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
  // reclassificarCategoria só faz sentido plugado no backend. Aqui é um trigger
  // que força re-render (o mock não muta, mas quando FechamentoMensal existir
  // no server basta trocar por refetch).
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const printRef = useRef<HTMLDivElement>(null);
  const [exportando, setExportando] = useState(false);

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
          filename: `Fechamento-${MES_FECHADO_LABEL.replace(/ /g, "-")}.pdf`,
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

  const meses12m = R.MESES_23M.slice(11, 23); // últimos 12 meses (mai/25 → abr/26 + mai/26*)
  const fluxo12m = R.totalGeral.slice(11, 23).map((v: number, i: number) => ({
    x: meses12m[i].slice(0, 3),
    y: Math.round(v / 1000),
  }));
  const saldoLeite12m = R.saldoOpLeite.slice(11, 23).map((v: number, i: number) => ({
    x: meses12m[i].slice(0, 3),
    y: Math.round(v / 1000),
  }));
  const receitaCafe12m = R.receitaCafe.slice(11, 23).map((v: number, i: number) => ({
    x: meses12m[i].slice(0, 3),
    y: Math.round(v / 1000),
  }));

  const fluxo = fluxoDoMes(MES_FECHADO_IDX);
  const leite = saldoLeiteDoMes(MES_FECHADO_IDX);
  const cafeYtdMargem = R.k2026YTD.receitaCafe - R.k2026YTD.custeioCafe;
  const cafeYtdRec = R.k2026YTD.receitaCafe;
  const investMes = R.investLeite[MES_FECHADO_IDX] + R.investCafe[MES_FECHADO_IDX] + R.animalAquisicao[MES_FECHADO_IDX];
  const altas = categoriasQueSubiram();

  const idxNoUltimo12 = 10; // Abr/26 é o 11º de 12 (índice 10)

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
      <FechamentoHeader onExportar={exportarPDF} exportando={exportando} oculto={exportando} />

      <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-2 print:gap-4">
        {/* 1) Fluxo do mês ---------------------------------------------------- */}
        <Veredicto
          pergunta="Sobrou ou faltou em abril?"
          resposta={fmtMoney(Math.round(fluxo.liquido / 1000))}
          tom={fluxo.liquido >= 0 ? "pos" : "neg"}
          contexto={
            <>
              Receita <strong className="mono-nums">{fmtMoney(Math.round(fluxo.receita / 1000), { compact: false })}</strong>{" "}
              · custeio <strong className="mono-nums">{fmtMoney(Math.round(fluxo.custeio / 1000), { compact: false })}</strong>{" "}
              · investimento <strong className="mono-nums">{fmtMoney(Math.round(fluxo.invest / 1000), { compact: false })}</strong>.
              O peso vem do investimento em máquinas e implementos.
            </>
          }
          mini={<MiniBarsAssinadas data={fluxo12m} destaqueIdx={idxNoUltimo12} />}
        />

        {/* 2) Leite paga o leite? -------------------------------------------- */}
        <Veredicto
          pergunta="Leite pagou o leite?"
          resposta={leite.saldo >= 0 ? "SIM" : "NÃO"}
          tom={leite.saldo >= 0 ? "pos" : "neg"}
          contexto={
            <>
              Receita <strong className="mono-nums">{fmtMoney(Math.round(leite.receita / 1000), { compact: false })}</strong>{" "}
              menos custeio puro <strong className="mono-nums">{fmtMoney(Math.round(leite.custeio / 1000), { compact: false })}</strong>{" "}
              = <strong className="mono-nums">{fmtMoney(Math.round(leite.saldo / 1000), { compact: false })}</strong>.
              Preço médio R$ 3,51/L · custo puro R$ 3,10/L.
            </>
          }
          mini={<MiniBarsAssinadas data={saldoLeite12m} destaqueIdx={idxNoUltimo12} />}
        />

        {/* 3) Café ------------------------------------------------------------ */}
        <Veredicto
          pergunta="E o café?"
          resposta={cafeYtdMargem >= 0 ? `+${fmtMoney(Math.round(cafeYtdMargem / 1000))}` : fmtMoney(Math.round(cafeYtdMargem / 1000))}
          tom={cafeYtdMargem >= 0 ? "pos" : "neg"}
          contexto={
            <>
              Safra 01/2026 rendeu <strong className="mono-nums">{fmtMoney(Math.round(cafeYtdRec / 1000), { compact: false })}</strong>{" "}
              em março · 430 sacas · R$ 707/saca. Custeio YTD abaixo, safra única concentra o risco em uma janela.
            </>
          }
          mini={<MiniBarsPositivas data={receitaCafe12m} cor="var(--cafe)" destaqueIdx={idxNoUltimo12} />}
        />

        {/* 4) Onde vazou ------------------------------------------------------ */}
        <Veredicto
          pergunta="Onde vazou este ano?"
          resposta={
            <span className="font-serif text-[40px] font-medium leading-[1.1] tracking-[-0.02em] text-foreground">
              3 categorias
            </span>
          }
          tom="neg"
          contexto={<>Aceleraram acima do restante — comparadas ao mesmo período de 2025.</>}
        >
          <ul className="m-0 mt-2 flex list-none flex-col gap-0 p-0">
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
        </Veredicto>

        {/* 5) Investimentos --------------------------------------------------- */}
        <Veredicto
          full
          pergunta="Investimentos do mês"
          resposta={fmtMoney(Math.round(investMes / 1000))}
          tom="neutro"
          contexto={
            <>
              Máquinas e Equipamentos concentraram o mês. No acumulado YTD, matrizes leiteiras lideram — entram em produção em ~6 meses.
            </>
          }
        >
          <StackedBarComposicao
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            itens={R.investimentoBreakdown.map((it: any) => ({
              nome: it.nome,
              valorMil: it.value,
              cor: it.atividade === "leite" ? "var(--leite)" : it.atividade === "cafe" ? "var(--cafe)" : "var(--outros)",
            }))}
          />
        </Veredicto>

        {/* 6) Atenção --------------------------------------------------------- */}
        <section className="veredicto flex flex-col gap-3.5 rounded-[10px] border border-[color:var(--rule-soft)] bg-card px-[26px] pt-6 pb-[26px] min-[900px]:col-[1/-1] print:break-inside-avoid print:border print:border-[#999] print:bg-white">
          <h2 className="m-0 font-serif text-[22px] font-normal leading-[1.2] tracking-[-0.01em] text-foreground">
            O que precisa da sua atenção?
          </h2>
          <p className="m-0 mb-1.5 font-sans text-[13px] leading-[1.5] text-ink-2">
            Inconsistências que a IA levantou nos lançamentos deste fechamento. Corrigir na origem melhora o próximo mês.
          </p>
          <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {R.inconsistencias.map((it: any) => (
              <AtencaoCard key={it.id} item={it} onReclassificar={bump} />
            ))}
          </div>
        </section>
      </div>

      {/* Rodapé ------------------------------------------------------------- */}
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-[color:var(--rule-soft)] pt-6 print:justify-start">
        <span className="caption">Fechamento gerado a partir de {R.iaScope.lancamentos} do BPO ({R.iaScope.periodo}).</span>
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
