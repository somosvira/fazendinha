import { useState } from "react";
import type { DomainConfig } from "../domains";
import type { Lote, ResumoLote, IaInsight } from "../types";
import { IaInsightBand } from "./IaInsight";

export const COR_TOOLBAR: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 0 18px" };

/* Espelho do LavouraDomainView/HerdDomainView — KPIs + worklists + tabela.
 * A diferença: recebe `lotes` (não só `resumos`) porque algumas worklists
 * precisam do lote para classificar (fase, categoria). */
export function LoteDomainView({
  config, resumos, lotes, insight, onAbrirLote, controles, dicaLinha,
}: {
  config: DomainConfig;
  resumos: ResumoLote[];
  lotes: Lote[];
  insight?: IaInsight;
  onAbrirLote: (id: string) => void;
  controles?: React.ReactNode;
  dicaLinha?: string;
}) {
  const [wlId, setWlId] = useState(config.worklists[0]?.id);
  const wl = config.worklists.find((w) => w.id === wlId);
  const linhas = wl ? wl.selecionar(resumos, lotes) : [];
  const kpis = config.kpis(resumos, lotes);
  const loteById = Object.fromEntries(lotes.map((l) => [l.id, l]));

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">{config.eyebrow}</div>
      <div className="rb-head"><h1>{config.titulo}</h1></div>

      {controles && <div className="rb-toolbar" style={COR_TOOLBAR}>{controles}</div>}

      {kpis.length > 0 && (
        <div className="rb-kstrip" style={{ ["--cols" as any]: kpis.length }}>
          {kpis.map((k) => (
            <div className="rb-k" key={k.lab}>
              <div className="lab">{k.lab}</div>
              <div className="val">{k.val}{k.sufixo && <small style={{ fontSize: 13 }}>{k.sufixo}</small>}</div>
              {k.d && <div className={"d" + (k.tom === "up" ? " rb-up" : k.tom === "ok" ? " rb-ok" : "")}>{k.d}</div>}
            </div>
          ))}
        </div>
      )}

      {insight && <IaInsightBand insight={insight} />}

      {config.worklists.length > 0 && (
        <>
          <h2 className="rb-sec-title">Tarefas do dia</h2>
          <div className="rb-tasks">
            {config.worklists.map((w) => (
              <button key={w.id} className={"rb-task" + (w.id === wlId ? " on" : "") + (w.alerta ? " alert" : "")} onClick={() => setWlId(w.id)}>
                <div className="n">{w.selecionar(resumos, lotes).length}</div>
                <div className="l">{w.label}</div>
              </button>
            ))}
          </div>

          <div className="rb-listhead">
            <h3>{wl?.label} — {linhas.length} {linhas.length === 1 ? "lote" : "lotes"}</h3>
            <span className="hint">{dicaLinha ?? "clique numa linha pra abrir o lote"}</span>
          </div>
          <div className="rb-tbl-wrap"><table className="rb-tbl">
            <thead><tr><th>Lote</th>{config.colunas.map((c) => <th key={c.nome}>{c.nome}</th>)}</tr></thead>
            <tbody>
              {linhas.map((r) => {
                const l = loteById[r.loteId];
                return (
                  <tr className="rb-row" key={r.loteId} onClick={() => onAbrirLote(r.loteId)}>
                    <td className="rb-anm">{l?.nome ?? r.loteId} <small>· {l?.codigo ?? ""}</small></td>
                    {config.colunas.map((c) => <td key={c.nome}>{c.render(r, l)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </>
      )}
    </main>
  );
}
