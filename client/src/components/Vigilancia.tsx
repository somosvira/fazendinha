/* Rio Novo — Vigilância da IA: anomalias + alerta de preço.
 * Port de src/components/Vigilancia.jsx. Recebe o payload (R).
 */

import { useEffect, useState } from "react";
import type { Tab } from "./Shell";
import type { AnalisePreco } from "../data/anomalias";
import { useToast } from "./Toast";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type R = any;

const DISMISSED_KEY = "rionovo:anomalias:dismissed";

function loadDismissed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

/* ===== Faixa de anomalias (vigilância proativa) ===== */
export function AnomaliasStrip({
  R,
  onDrill,
  onNav,
  max = 3,
}: {
  R: R;
  onDrill?: (id: string) => void;
  onNav?: (t: Tab) => void;
  max?: number;
}) {
  const toast = useToast();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>(() => loadDismissed());

  useEffect(() => {
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed)); } catch { /* storage cheio */ }
  }, [dismissed]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anomalias = R.anomalias as any[];
  const lista = anomalias.filter((a) => !dismissed[a.id]).slice(0, max);
  const totalNaoDispensadas = anomalias.filter((a) => !dismissed[a.id]).length;

  if (anomalias.length === 0) return null;

  if (lista.length === 0) {
    // Todas dispensadas — não escondemos a strip, oferecemos restaurar
    return (
      <div className="border border-border bg-card px-5 pt-[18px] pb-3 mt-[18px] mb-1">
        <div className="flex items-center gap-[14px] flex-wrap mb-[14px]">
          <span className="inline-flex items-center gap-2 font-sans text-sm tracking-[0.14em] uppercase text-foreground">
            <span className="w-[7px] h-[7px] bg-atencao rounded-full"></span>IA · Vigilância de gastos
          </span>
          <span className="text-sm text-ink-3 italic">
            Todos os {anomalias.length} desvios foram dispensados.
          </span>
          <button
            className="ml-auto bg-transparent border border-border px-3 py-1.5 font-sans text-[13px] font-semibold tracking-[0.02em] text-foreground cursor-pointer hover:bg-[var(--bg-card-2)]"
            onClick={() => {
              setDismissed({});
              toast.info("Avisos restaurados", "Você verá novamente os desvios detectados pela IA.");
            }}
          >
            Restaurar avisos
          </button>
        </div>
      </div>
    );
  }

  const dispensar = (id: string, titulo: string) => {
    setDismissed((d) => ({ ...d, [id]: true }));
    toast.info("Aviso dispensado", titulo, {
      action: {
        label: "Desfazer",
        onClick: () => setDismissed((d) => {
          const next = { ...d }; delete next[id]; return next;
        }),
      },
    });
  };

  return (
    <div className="border border-border bg-card px-5 pt-[18px] pb-5 mt-[18px] mb-1">
      <div className="flex items-center gap-[14px] flex-wrap mb-[14px]">
        <span className="inline-flex items-center gap-2 font-sans text-sm tracking-[0.14em] uppercase text-foreground">
          <span className="w-[7px] h-[7px] bg-atencao rounded-full"></span>IA · Vigilância de gastos
        </span>
        <span className="text-sm text-ink-3 italic">
          {totalNaoDispensadas} {totalNaoDispensadas === 1 ? "desvio detectado" : "desvios detectados"} no período
          {anomalias.length !== totalNaoDispensadas && ` · ${anomalias.length - totalNaoDispensadas} dispensados`}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-[14px] max-[1100px]:grid-cols-1">
        {lista.map((a) => {
          const isUp = a.delta > 0;
          const isFlat = a.delta === 0;
          const sevBorder =
            a.severidade === "alta" ? "border-l-prejuizo" : a.severidade === "media" ? "border-l-atencao" : "border-l-ink-3";
          const sevText =
            a.severidade === "alta" ? "text-prejuizo" : a.severidade === "media" ? "text-atencao" : "text-ink-3";
          return (
            <div
              key={a.id}
              className={cn(
                "relative bg-[var(--bg-card-2)] border-l-[3px] px-[18px] py-4 flex flex-col gap-2",
                sevBorder,
              )}
            >
              <button
                className="absolute top-2.5 right-2.5 bg-transparent border-none cursor-pointer font-serif text-[18px] text-ink-2 leading-none hover:text-foreground"
                onClick={() => dispensar(a.id, a.titulo)}
                title="Dispensar"
                aria-label={`Dispensar aviso: ${a.titulo}`}
              >
                ×
              </button>
              <div className="flex items-center gap-2.5">
                <span className={cn("text-sm tracking-[0.14em] uppercase px-2 py-0.5 border border-current", sevText)}>
                  {a.severidade === "alta" ? "Alta" : a.severidade === "media" ? "Média" : "Baixa"}
                </span>
                <span
                  className={cn(
                    "text-sm tabular-nums",
                    isFlat ? "text-ink-3" : isUp ? "text-prejuizo" : "text-lucro",
                  )}
                >
                  {isFlat ? "—" : isUp ? "▲ +" : "▼ "}
                  {!isFlat && `${Math.abs(a.delta)}%`}
                </span>
              </div>
              <div className="font-serif text-[18px] leading-[1.25] tracking-[-0.005em] text-foreground">{a.titulo}</div>
              <div className="text-[15px] text-ink-2 font-medium leading-[1.5]">{a.resumo}</div>
              {typeof a.valor === "number" && a.valor > 0 && (
                <div
                  className={cn(
                    "mono-nums font-sans text-base font-semibold tabular-nums py-1.5",
                    isUp ? "text-prejuizo" : "text-lucro",
                  )}
                >
                  {isUp ? "Custo extra " : "Economia "}
                  R$ {Math.abs(a.valor).toLocaleString("pt-BR")}
                </div>
              )}
              <div className="font-serif italic text-[15px] text-ink-2 leading-[1.4] font-medium pl-2.5 border-l-2 border-l-border">"{a.pergunta}"</div>
              <div className="flex gap-3 mt-0.5">
                {onDrill && a.catId && (
                  <button
                    className="bg-transparent border-none px-0 py-1.5 font-sans text-base text-foreground font-semibold underline underline-offset-4 cursor-pointer hover:text-cafe"
                    onClick={() => onDrill(a.catId)}
                  >
                    Ver lançamentos →
                  </button>
                )}
                {onNav && (
                  <button
                    className="bg-transparent border-none px-0 py-1.5 font-sans text-base text-ink-3 font-semibold underline underline-offset-4 cursor-pointer hover:text-cafe"
                    onClick={() => onNav("ia")}
                  >
                    Explicar com IA
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===== Alerta de preço pago (dentro do drawer de lançamento) ===== */
export function PrecoAlerta({ R, marca }: { R: R; marca: string }) {
  const a: AnalisePreco | null = R.analisePreco(marca);
  if (!a) return null;

  const precos = a.compras.map((c) => c.preco);
  const W = 220,
    H = 54,
    padL = 4,
    padR = 4,
    padT = 8,
    padB = 8;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const mn = Math.min(...precos, a.mediaMercado),
    mx = Math.max(...precos, a.mediaMercado);
  const rng = mx - mn || 1;
  const yS = (v: number) => padT + innerH - ((v - mn) / rng) * innerH;
  const xS = (i: number) => padL + (i / (precos.length - 1)) * innerW;
  const pts = precos.map((v, i) => `${xS(i)},${yS(v)}`).join(" ");
  const fmtP = (v: number) => (a.unidade === "L" ? "R$ " + v.toFixed(2).replace(".", ",") : "R$ " + v.toLocaleString("pt-BR"));

  const warn = a.alerta;

  return (
    <div className={cn("border border-border bg-card border-l-[3px]", warn ? "border-l-atencao" : "border-l-lucro")}>
      <div className="flex justify-between items-center px-4 py-3 border-b border-b-[var(--rule-soft)] bg-[var(--bg-card-2)]">
        <span className="inline-flex items-center gap-2 font-sans text-sm tracking-[0.14em] uppercase text-ink-2">
          <span className={cn("w-1.5 h-1.5 rounded-full", warn ? "bg-atencao" : "bg-lucro")}></span>IA · Preço pago
        </span>
        {a.alerta ? (
          <span className="text-sm tracking-[0.1em] uppercase px-2 py-0.5 border border-current text-atencao">acima do normal</span>
        ) : (
          <span className="text-sm tracking-[0.1em] uppercase px-2 py-0.5 border border-current text-lucro">dentro do padrão</span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-[18px] p-4 items-center max-[1100px]:grid-cols-1">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline gap-2.5">
            <span className="text-sm tracking-[0.1em] uppercase text-ink-3 min-w-[116px]">Pago agora</span>
            <span className="mono-nums font-serif text-[20px] text-foreground tabular-nums">
              {fmtP(a.atual)}
              <small className="text-sm text-ink-3">/{a.unidade}</small>
            </span>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-sm tracking-[0.1em] uppercase text-ink-3 min-w-[116px]">Compra anterior</span>
            <span className="mono-nums font-serif text-base text-ink-2 tabular-nums">{fmtP(a.anterior)}</span>
            <span className={cn("text-sm tabular-nums", a.deltaUlt > 0 ? "text-prejuizo" : "text-lucro")}>
              {a.deltaUlt > 0 ? "▲ +" : "▼ "}
              {Math.abs(a.deltaUlt).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-sm tracking-[0.1em] uppercase text-ink-3 min-w-[116px]">Média mercado</span>
            <span className="mono-nums font-serif text-base text-ink-2 tabular-nums">{fmtP(a.mediaMercado)}</span>
            <span className={cn("text-sm tabular-nums", a.deltaMercado > 0 ? "text-prejuizo" : "text-lucro")}>
              {a.deltaMercado > 0 ? "▲ +" : "▼ "}
              {Math.abs(a.deltaMercado).toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1 w-[220px] max-[1100px]:w-full">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
            <line x1={padL} x2={W - padR} y1={yS(a.mediaMercado)} y2={yS(a.mediaMercado)} stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="3 2" />
            <polyline points={pts} fill="none" stroke={a.alerta ? "var(--prejuizo)" : "var(--lucro)"} strokeWidth="2" />
            {precos.map((v, i) => (
              <circle key={i} cx={xS(i)} cy={yS(v)} r="2.5" fill="var(--bg-card)" stroke={a.alerta ? "var(--prejuizo)" : "var(--lucro)"} strokeWidth="1.5" />
            ))}
          </svg>
          <span className="text-sm text-ink-2 text-center">5 últimas compras · linha = média mercado</span>
        </div>
      </div>

      {a.alerta && <PrecoAlertaFoot delta={Math.abs(a.deltaUlt)} marca={marca} />}
    </div>
  );
}

function PrecoAlertaFoot({ delta, marca }: { delta: number; marca: string }) {
  const toast = useToast();
  return (
    <div className="px-4 py-3 border-t border-t-[var(--rule-soft)] text-sm text-ink-2 leading-[1.5] flex flex-col gap-2 items-start">
      Você pagou <strong className="text-prejuizo">{delta.toFixed(0)}% a mais</strong> que na última compra. Vale cotar outro fornecedor ou
      renegociar.
      <button
        className="bg-transparent border border-[var(--ink)] px-3 py-1.5 font-sans text-sm text-foreground cursor-pointer hover:bg-mast hover:text-mast-ink hover:border-mast"
        onClick={() => toast.info("Cotação solicitada", `Vamos buscar 3 fornecedores alternativos para “${marca}”. Você recebe o resultado no WhatsApp em até 24h.`)}
      >
        Cotar alternativas →
      </button>
    </div>
  );
}
