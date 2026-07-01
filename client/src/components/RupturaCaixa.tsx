/* Rio Novo — Previsão de ruptura de caixa (aviso antecipado).
 * Port de src/components/RupturaCaixa.jsx. Recebe o payload (R) e onNav.
 */

import type { Tab } from "./Shell";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type R = any;

function fmtBRLrup(n: number, opts: { compact?: boolean } = {}): string {
  const { compact = true } = opts;
  if (n === 0) return "R$ 0";
  const abs = Math.abs(n),
    sign = n < 0 ? "−" : "";
  if (compact && abs >= 1_000_000)
    return `${sign}R$ ${(abs / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (compact && abs >= 10_000)
    return `${sign}R$ ${(abs / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} mil`;
  return `${sign}R$ ${abs.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function RupturaCaixa({ R, onNav }: { R: R; onNav?: (t: Tab) => void }) {
  const rc = R.rupturaCaixa;
  const temRuptura = rc.rupturaDia !== null;

  const data = rc.saldoDiario as { dia: number; saldo: number }[];
  const W = 1180,
    H = 240,
    padL = 64,
    padR = 130,
    padT = 24,
    padB = 40;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const saldos = data.map((d) => d.saldo);
  const mx = Math.max(...saldos, rc.colchao);
  const mn = Math.min(...saldos, 0);
  const range = mx - mn || 1;
  const yS = (v: number) => padT + innerH - ((v - mn) / range) * innerH;
  const xS = (d: number) => padL + (d / (data.length - 1)) * innerW;
  const linePts = data.map((d) => `${xS(d.dia)},${yS(d.saldo)}`).join(" ");
  const areaNeg =
    `M${padL},${yS(0)} ` +
    data.map((d) => `L${xS(d.dia)},${yS(Math.min(0, d.saldo))}`).join(" ") +
    ` L${xS(data.length - 1)},${yS(0)} Z`;

  const ticks: number[] = [];
  const stepT = Math.ceil(mx / 3 / 50000) * 50000;
  for (let v = Math.floor(mn / 50000) * 50000; v <= mx; v += stepT) ticks.push(v);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compromissos = R.compromissos as any[];

  return (
    <section className="ruptura-section">
      <div className="dash-sec-head">
        <div className="dash-sec-titles">
          <span className="eyebrow">IA · Previsão de caixa · próximos 35 dias</span>
          <h2 className="dash-sec-title">Aviso de ruptura de caixa</h2>
        </div>
        {temRuptura ? (
          <span className="ruptura-flag crit">Ruptura em XXX</span>
        ) : (
          <span className="ruptura-flag ok">Sem ruptura no período</span>
        )}
      </div>

      <div className={"ruptura-alert " + (temRuptura ? "crit" : "ok")}>
        <div className="ra-icon">{temRuptura ? "!" : "✓"}</div>
        <div className="ra-body">
          {temRuptura ? (
            <>
              <div className="ra-title">
                O caixa fica negativo em <strong>XXX</strong> — daqui a XXX dias.
              </div>
              <div className="ra-text">
                O menor saldo projetado é <strong className="neg-txt">XXX</strong> em XXX,
                puxado pela folha e pela compra de matrizes. Para manter um colchão de XXX, o ideal é um aporte
                de <strong>XXX</strong> até <strong>XXX</strong>.
              </div>
            </>
          ) : (
            <div className="ra-title">O caixa se mantém positivo nos próximos 35 dias.</div>
          )}
        </div>
        {temRuptura && (
          <div className="ra-aporte">
            <span className="ra-aporte-l">Aporte sugerido</span>
            <span className="ra-aporte-v mono-nums">XXX</span>
            <button className="btn-primary" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => onNav && onNav("lancar")}>
              Registrar aporte →
            </button>
          </div>
        )}
      </div>

      <div className="ruptura-grid">
        <div className="ruptura-chart">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={padL} x2={W - padR} y1={yS(v)} y2={yS(v)} className={v === 0 ? "chart-axis" : "grid-line"} />
                <text x={padL - 8} y={yS(v) + 4} textAnchor="end" className="chart-tick-text">
                  {fmtBRLrup(v)}
                </text>
              </g>
            ))}
            <line x1={padL} x2={W - padR} y1={yS(rc.colchao)} y2={yS(rc.colchao)} stroke="var(--warn)" strokeWidth="1" strokeDasharray="4 3" />
            <text x={W - padR + 6} y={yS(rc.colchao) + 4} className="be-line-label" style={{ fill: "var(--warn)" }}>
              colchão
            </text>

            <path d={areaNeg} fill="var(--neg)" opacity="0.1" />
            <polyline points={linePts} fill="none" stroke="var(--ink)" strokeWidth="1.6" />

            {compromissos
              .filter((c) => c.dias <= 35)
              .map((c, i) => {
                const x = xS(c.dias);
                const pt = data[c.dias];
                return (
                  <g key={i}>
                    <line
                      x1={x}
                      x2={x}
                      y1={padT}
                      y2={padT + innerH}
                      stroke={c.tipo === "entrada" ? "var(--pos)" : "var(--rule)"}
                      strokeWidth="1"
                      strokeDasharray="2 3"
                      opacity="0.6"
                    />
                    <circle cx={x} cy={yS(pt.saldo)} r="3" fill={c.tipo === "entrada" ? "var(--pos)" : "var(--neg)"} />
                  </g>
                );
              })}

            {temRuptura && (
              <g>
                <circle cx={xS(rc.rupturaDia)} cy={yS(0)} r="5" fill="none" stroke="var(--neg)" strokeWidth="1.5" />
                <text x={xS(rc.rupturaDia)} y={yS(0) + 20} textAnchor="middle" style={{ fontFamily: "var(--serif)", fontSize: 13, fill: "var(--neg)" }}>
                  ruptura
                </text>
              </g>
            )}

            {[0, 7, 14, 21, 28, 35].map((d) => (
              <text key={d} x={xS(d)} y={H - padB + 20} textAnchor="middle" className="chart-tick-text">
                {d === 0 ? "hoje" : rc.diaParaData(d)}
              </text>
            ))}
          </svg>
          <div className="legend" style={{ paddingLeft: 64, marginTop: 4 }}>
            <span>
              <span className="legend-dot" style={{ background: "var(--pos)" }}></span>Recebível (Embaré)
            </span>
            <span>
              <span className="legend-dot" style={{ background: "var(--neg)" }}></span>Pagamento
            </span>
            <span>
              <span className="legend-dash" style={{ color: "var(--warn)" }}></span>Colchão mínimo
            </span>
          </div>
        </div>

        <div className="ruptura-list">
          <div className="rl-head">Próximos compromissos</div>
          <div className="rl-body">
            {compromissos.map((c, i) => (
              <div key={i} className={"rl-row " + c.tipo}>
                <span className="rl-data mono-nums">XXX</span>
                <div className="rl-info">
                  <span className="rl-label">{c.label}</span>
                  <span className="rl-cat">{c.categoria}</span>
                </div>
                <span className={"rl-valor mono-nums " + c.tipo}>
                  {c.tipo === "entrada" ? "+" : "−"}
                  XXX
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="footnote" style={{ marginTop: 14 }}>
        <span className="dagger">†</span>
        <span>
          Projeção combina os compromissos conhecidos (folha, ração, matrizes, recebíveis da Embaré) com a queima difusa do dia a dia.
          Não inclui aportes do proprietário — assim que houver, a curva se recalcula. A IA avisa por aqui e no WhatsApp quando o saldo
          projetado cruza o colchão.
        </span>
      </div>
    </section>
  );
}
