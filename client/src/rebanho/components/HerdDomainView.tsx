import { useState } from "react";
import type { DomainConfig } from "../domains";
import type { ResumoAnimal, IaInsight } from "../types";
import { getAnimal } from "../mock";
import { IaInsightBand } from "./IaInsight";

export const RB_TOOLBAR: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 0 18px" };

export function HerdDomainView({
  config, resumos, insight, onAbrirAnimal, nomes, controles,
}: {
  config: DomainConfig;
  resumos: ResumoAnimal[];
  insight?: IaInsight;
  onAbrirAnimal: (id: string) => void;
  nomes?: Record<string, { nome: string; numero: string }>;
  controles?: React.ReactNode;
}) {
  const [wlId, setWlId] = useState(config.worklists[0]?.id);
  const wl = config.worklists.find((w) => w.id === wlId);
  const linhas = wl ? wl.selecionar(resumos) : [];
  const kpis = config.kpis(resumos);

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">{config.eyebrow}</div>
      <div className="rb-head">
        <h1>{config.titulo}</h1>
        <div className="period">📅 Junho 2026 ▾</div>
      </div>

      {controles && <div className="rb-toolbar" style={RB_TOOLBAR}>{controles}</div>}

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
                <div className="n">{w.selecionar(resumos).length}</div>
                <div className="l">{w.label}</div>
              </button>
            ))}
          </div>

          <div className="rb-listhead">
            <h3>{wl?.label} — {linhas.length} {linhas.length === 1 ? "animal" : "animais"}</h3>
            <span className="hint">clique numa linha pra abrir a ficha</span>
          </div>
          <table className="rb-tbl">
            <thead><tr><th>Animal</th>{config.colunas.map((c) => <th key={c.nome}>{c.nome}</th>)}</tr></thead>
            <tbody>
              {linhas.map((r) => {
                const a = nomes?.[r.animalId] ?? getAnimal(r.animalId);
                return (
                  <tr className="row" key={r.animalId} onClick={() => onAbrirAnimal(r.animalId)}>
                    <td className="rb-anm">{a?.nome} <small>#{a?.numero}</small></td>
                    {config.colunas.map((c) => <td key={c.nome}>{c.render(r)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
