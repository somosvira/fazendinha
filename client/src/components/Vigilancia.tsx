/* Rio Novo — Vigilância da IA: anomalias + alerta de preço.
 * Port de src/components/Vigilancia.jsx. Recebe o payload (R).
 */

import { useEffect, useState } from "react";
import type { Tab } from "./Shell";
import type { AnalisePreco } from "../data/anomalias";
import { useToast } from "./Toast";

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
      <div className="anom-strip is-empty">
        <div className="anom-strip-head">
          <span className="anom-badge">
            <span className="dot"></span>IA · Vigilância de gastos
          </span>
          <span className="anom-sub">
            Todos os {anomalias.length} desvios foram dispensados.
          </span>
          <button
            className="anom-restore"
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
    <div className="anom-strip">
      <div className="anom-strip-head">
        <span className="anom-badge">
          <span className="dot"></span>IA · Vigilância de gastos
        </span>
        <span className="anom-sub">
          {totalNaoDispensadas} {totalNaoDispensadas === 1 ? "desvio detectado" : "desvios detectados"} no período
          {anomalias.length !== totalNaoDispensadas && ` · ${anomalias.length - totalNaoDispensadas} dispensados`}
        </span>
      </div>
      <div className="anom-cards">
        {lista.map((a) => {
          const isUp = a.delta > 0;
          const isFlat = a.delta === 0;
          return (
            <div key={a.id} className={"anom-card sev-" + a.severidade}>
              <button
                className="anom-dismiss"
                onClick={() => dispensar(a.id, a.titulo)}
                title="Dispensar"
                aria-label={`Dispensar aviso: ${a.titulo}`}
              >
                ×
              </button>
              <div className="anom-card-head">
                <span className={"anom-sev sev-" + a.severidade}>
                  {a.severidade === "alta" ? "Alta" : a.severidade === "media" ? "Média" : "Baixa"}
                </span>
                <span className={"anom-delta " + (isFlat ? "flat" : isUp ? "up" : "down")}>
                  {isFlat ? "—" : isUp ? "▲ +" : "▼ "}
                  {!isFlat && `${Math.abs(a.delta)}%`}
                </span>
              </div>
              <div className="anom-title">{a.titulo}</div>
              <div className="anom-resumo">{a.resumo}</div>
              {typeof a.valor === "number" && a.valor > 0 && (
                <div className={"anom-impacto mono-nums " + (isUp ? "is-neg" : "is-pos")}>
                  {isUp ? "Custo extra " : "Economia "}
                  R$ {Math.abs(a.valor).toLocaleString("pt-BR")}
                </div>
              )}
              <div className="anom-pergunta">"{a.pergunta}"</div>
              <div className="anom-actions">
                {onDrill && a.catId && (
                  <button className="anom-cta" onClick={() => onDrill(a.catId)}>
                    Ver lançamentos →
                  </button>
                )}
                {onNav && (
                  <button className="anom-cta ghost" onClick={() => onNav("ia")}>
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

  const tone = a.alerta ? "warn" : "ok";

  return (
    <div className={"preco-alerta " + tone}>
      <div className="preco-alerta-head">
        <span className="pa-badge">
          <span className="dot"></span>IA · Preço pago
        </span>
        {a.alerta ? <span className="pa-flag warn">acima do normal</span> : <span className="pa-flag ok">dentro do padrão</span>}
      </div>

      <div className="preco-alerta-body">
        <div className="pa-nums">
          <div className="pa-cell">
            <span className="pa-l">Pago agora</span>
            <span className="pa-v mono-nums">
              {fmtP(a.atual)}
              <small>/{a.unidade}</small>
            </span>
          </div>
          <div className="pa-cell">
            <span className="pa-l">Compra anterior</span>
            <span className="pa-v sub mono-nums">{fmtP(a.anterior)}</span>
            <span className={"pa-delta " + (a.deltaUlt > 0 ? "up" : "down")}>
              {a.deltaUlt > 0 ? "▲ +" : "▼ "}
              {Math.abs(a.deltaUlt).toFixed(0)}%
            </span>
          </div>
          <div className="pa-cell">
            <span className="pa-l">Média mercado</span>
            <span className="pa-v sub mono-nums">{fmtP(a.mediaMercado)}</span>
            <span className={"pa-delta " + (a.deltaMercado > 0 ? "up" : "down")}>
              {a.deltaMercado > 0 ? "▲ +" : "▼ "}
              {Math.abs(a.deltaMercado).toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="pa-spark">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
            <line x1={padL} x2={W - padR} y1={yS(a.mediaMercado)} y2={yS(a.mediaMercado)} stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="3 2" />
            <polyline points={pts} fill="none" stroke={a.alerta ? "var(--prejuizo)" : "var(--lucro)"} strokeWidth="2" />
            {precos.map((v, i) => (
              <circle key={i} cx={xS(i)} cy={yS(v)} r="2.5" fill="var(--bg-card)" stroke={a.alerta ? "var(--prejuizo)" : "var(--lucro)"} strokeWidth="1.5" />
            ))}
          </svg>
          <span className="pa-spark-cap">5 últimas compras · linha = média mercado</span>
        </div>
      </div>

      {a.alerta && <PrecoAlertaFoot delta={Math.abs(a.deltaUlt)} marca={marca} />}
    </div>
  );
}

function PrecoAlertaFoot({ delta, marca }: { delta: number; marca: string }) {
  const toast = useToast();
  return (
    <div className="preco-alerta-foot">
      Você pagou <strong>{delta.toFixed(0)}% a mais</strong> que na última compra. Vale cotar outro fornecedor ou
      renegociar.
      <button
        className="pa-cta"
        onClick={() => toast.info("Cotação solicitada", `Vamos buscar 3 fornecedores alternativos para “${marca}”. Você recebe o resultado no WhatsApp em até 24h.`)}
      >
        Cotar alternativas →
      </button>
    </div>
  );
}
