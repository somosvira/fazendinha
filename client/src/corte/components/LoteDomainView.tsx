import { useState } from "react";
import type { DomainConfig } from "../domains";
import type { Lote, ResumoLote, IaInsight } from "../types";
import { IaInsightBand } from "./IaInsight";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain, RebAnm } from "@/components/rb/RebPrimitives";

// Toolbar do header (filtros/controles) — reaproveitada por LoteTab etc.
export const COR_TOOLBAR = "mb-[18px] flex flex-wrap items-center gap-2.5";

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
    <RebMain>
      <RebHeader eyebrow={config.eyebrow} title={config.titulo} />

      {controles && <div className={COR_TOOLBAR}>{controles}</div>}

      {kpis.length > 0 && (
        <RebKpiStrip cols={kpis.length}>
          {kpis.map((k) => (
            <RebKpi key={k.lab} lab={k.lab} val={k.val} sufixo={k.sufixo} d={k.d} tom={k.tom} />
          ))}
        </RebKpiStrip>
      )}

      {insight && <IaInsightBand insight={insight} />}

      {config.worklists.length > 0 && (
        <>
          <h2 className="mb-3 font-serif text-xl font-medium">Tarefas do dia</h2>
          <div className="mb-[22px] flex gap-3.5 max-[900px]:overflow-x-auto max-[900px]:pb-1">
            {config.worklists.map((w) => {
              const on = w.id === wlId;
              return (
                <button
                  key={w.id}
                  className={
                    "flex-1 cursor-pointer border-t-2 bg-transparent px-1 pb-1.5 pt-3 text-left transition-colors max-[900px]:min-w-[130px] max-[900px]:flex-none " +
                    (on ? "border-t-cafe" : "border-t-[color:var(--rule-soft)] hover:border-t-ink-2")
                  }
                  onClick={() => setWlId(w.id)}
                >
                  <div className={"font-serif text-[30px] font-medium leading-none " + (w.alerta ? "text-prejuizo" : "text-[color:var(--ink)]")}>
                    {w.selecionar(resumos, lotes).length}
                  </div>
                  <div className="mt-1.5 text-sm text-ink-3">{w.label}</div>
                </button>
              );
            })}
          </div>

          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="m-0 font-serif text-lg font-medium">{wl?.label} — {linhas.length} {linhas.length === 1 ? "lote" : "lotes"}</h3>
            <span className="text-sm text-ink-3">{dicaLinha ?? "clique numa linha pra abrir o lote"}</span>
          </div>
          <RebTable>
            <thead><tr><th>Lote</th>{config.colunas.map((c) => <th key={c.nome}>{c.nome}</th>)}</tr></thead>
            <tbody>
              {linhas.map((r) => {
                const l = loteById[r.loteId];
                return (
                  <tr className="rb-row" key={r.loteId} onClick={() => onAbrirLote(r.loteId)}>
                    <td><RebAnm>{l?.nome ?? r.loteId} <small>· {l?.codigo ?? ""}</small></RebAnm></td>
                    {config.colunas.map((c) => <td key={c.nome}>{c.render(r, l)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </RebTable>
        </>
      )}
    </RebMain>
  );
}
