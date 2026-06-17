/* Rio Novo — Vigilância da IA: anomalias + alerta de preço.
 * Port de src/components/Vigilancia.jsx. Recebe o payload (R).
 */

import { useState } from "react";
import type { Tab } from "./Shell";
import type { AnalisePreco } from "../data/anomalias";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type R = any;

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
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anomalias = R.anomalias as any[];
  const lista = anomalias.filter((a) => !dismissed[a.id]).slice(0, max);
  if (lista.length === 0) return null;

  return (
    <div className="anom-strip">
      <div className="anom-strip-head">
        <span className="anom-badge">
          <span className="dot"></span>IA · Vigilância de gastos
        </span>
        <span className="anom-sub">{anomalias.length} desvios detectados no período</span>
      </div>
      <div className="anom-cards">
        {lista.map((a) => (
          <div key={a.id} className={"anom-card sev-" + a.severidade}>
            <button className="anom-dismiss" onClick={() => setDismissed((d) => ({ ...d, [a.id]: true }))} title="Dispensar">
              ×
            </button>
            <div className="anom-card-head">
              <span className={"anom-sev sev-" + a.severidade}>
                {a.severidade === "alta" ? "Alta" : a.severidade === "media" ? "Média" : "Baixa"}
              </span>
              <span className={"anom-delta " + (a.delta > 0 ? "up" : "down")}>
                {a.delta > 0 ? "▲ +" : "▼ "}
                {Math.abs(a.delta)}%
              </span>
            </div>
            <div className="anom-title">{a.titulo}</div>
            <div className="anom-resumo">{a.resumo}</div>
            <div className="anom-pergunta">"{a.pergunta}"</div>
            <div className="anom-actions">
              {onDrill && a.catId && (
                <button className="anom-cta" onClick={() => onDrill(a.catId)}>
                  ver lançamentos →
                </button>
              )}
              {onNav && (
                <button className="anom-cta ghost" onClick={() => onNav("ia")}>
                  perguntar à IA
                </button>
              )}
            </div>
          </div>
        ))}
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
            <line x1={padL} x2={W - padR} y1={yS(a.mediaMercado)} y2={yS(a.mediaMercado)} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 2" />
            <polyline points={pts} fill="none" stroke={a.alerta ? "var(--neg)" : "var(--pos)"} strokeWidth="1.6" />
            {precos.map((v, i) => (
              <circle key={i} cx={xS(i)} cy={yS(v)} r="2.2" fill="var(--bg-card)" stroke={a.alerta ? "var(--neg)" : "var(--pos)"} strokeWidth="1.2" />
            ))}
          </svg>
          <span className="pa-spark-cap">5 últimas compras · linha = média mercado</span>
        </div>
      </div>

      {a.alerta && (
        <div className="preco-alerta-foot">
          Você pagou <strong>{Math.abs(a.deltaUlt).toFixed(0)}% a mais</strong> que na última compra. Vale cotar outro fornecedor ou
          renegociar.
          <button className="pa-cta">Cotar alternativas →</button>
        </div>
      )}
    </div>
  );
}
