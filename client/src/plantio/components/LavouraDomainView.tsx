import { useState } from "react";
import type { DomainConfig } from "../domains";
import type { ResumoTalhao, IaInsight } from "../types";
import { getTalhao } from "../mock";
import { IaInsightBand } from "./IaInsight";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain, RebAnm } from "@/components/rb/RebPrimitives";

// Toolbar do header (filtros/controles) — reaproveitada por TalhaoTab etc.
export const PLA_TOOLBAR = "mb-[18px] flex flex-wrap items-center gap-2.5";

// Tabelas da lavoura: 1ª coluna larga (talhão), demais alinhadas à direita e tabulares.
export const RB_TBL_LAVOURA =
  "table-fixed [&_thead_th:first-child]:w-[30%] [&_tbody_td:first-child]:w-[30%] [&_thead_th:not(:first-child)]:text-right [&_tbody_td:not(:first-child)]:text-right [&_tbody_td:not(:first-child)]:tabular-nums";

/* Espelho do HerdDomainView do rebanho — recebe a config do domínio (Fenologia,
 * Fitossanidade, Nutrição) e renderiza KPIs + worklists + tabela. Toda a tela
 * de "domínio coletivo" passa por aqui. */
export function LavouraDomainView({
  config, resumos, insight, onAbrirTalhao, nomes, controles, dicaLinha,
}: {
  config: DomainConfig;
  resumos: ResumoTalhao[];
  insight?: IaInsight;
  onAbrirTalhao: (id: string) => void;
  nomes?: Record<string, { nome: string; codigo: string }>;
  controles?: React.ReactNode;
  dicaLinha?: string;
}) {
  const [wlId, setWlId] = useState(config.worklists[0]?.id);
  const wl = config.worklists.find((w) => w.id === wlId);
  const linhas = wl ? wl.selecionar(resumos) : [];
  const kpis = config.kpis(resumos);

  return (
    <RebMain>
      <RebHeader eyebrow={config.eyebrow} title={config.titulo} />

      {controles && <div className={PLA_TOOLBAR}>{controles}</div>}

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
                    {w.selecionar(resumos).length}
                  </div>
                  <div className="mt-1.5 text-sm text-ink-3">{w.label}</div>
                </button>
              );
            })}
          </div>

          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="m-0 font-serif text-lg font-medium">
              {wl?.label} — {linhas.length} {linhas.length === 1 ? "talhão" : "talhões"}
            </h3>
            <span className="text-sm text-ink-3">{dicaLinha ?? "clique numa linha pra abrir o talhão"}</span>
          </div>
          <RebTable className={RB_TBL_LAVOURA}>
            <thead><tr><th>Talhão</th>{config.colunas.map((c) => <th key={c.nome}>{c.nome}</th>)}</tr></thead>
            <tbody>
              {linhas.map((r) => {
                const t = nomes?.[r.talhaoId] ?? getTalhao(r.talhaoId);
                return (
                  <tr className="rb-row" key={r.talhaoId} onClick={() => onAbrirTalhao(r.talhaoId)}>
                    <td><RebAnm>{t?.nome} <small>· {(t as any)?.codigo ?? ""}</small></RebAnm></td>
                    {config.colunas.map((c) => <td key={c.nome}>{c.render(r)}</td>)}
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
