import { useState } from "react";
import type { DomainConfig } from "../domains";
import type { ResumoAnimal, IaInsight } from "../types";
import { getAnimal } from "../mock";
import { IaInsightBand } from "./IaInsight";
import { RebHeader } from "./RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";

// Toolbar do header (filtros/controles) — reaproveitada por AnimalTab etc.
export const RB_TOOLBAR = "mb-[18px] flex flex-wrap items-center gap-2.5";

export function HerdDomainView({
  config, resumos, insight, onAbrirAnimal, nomes, controles, dicaLinha, topo,
}: {
  config: DomainConfig;
  resumos: ResumoAnimal[];
  insight?: IaInsight;
  onAbrirAnimal: (id: string) => void;
  nomes?: Record<string, { nome: string; numero: string }>;
  controles?: React.ReactNode;
  dicaLinha?: string;
  topo?: React.ReactNode; // bloco extra logo abaixo do título (ex.: KPI de taxa de concepção)
}) {
  const [wlId, setWlId] = useState(config.worklists[0]?.id);
  const wl = config.worklists.find((w) => w.id === wlId);
  const linhas = wl ? wl.selecionar(resumos) : [];
  const kpis = config.kpis(resumos);

  return (
    <main className="rb-main">
      <RebHeader eyebrow={config.eyebrow} title={config.titulo} />

      {topo}

      {controles && <div className={RB_TOOLBAR}>{controles}</div>}

      {kpis.length > 0 && (
        <RebKpiStrip cols={kpis.length}>
          {kpis.map((k) => (
            <RebKpi
              key={k.lab}
              lab={k.lab}
              val={k.val}
              sufixo={k.sufixo}
              d={k.d}
              tom={k.tom}
            />
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
                    (on
                      ? "border-t-cafe"
                      : "border-t-[color:var(--rule-soft)] hover:border-t-ink-2")
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
              {wl?.label} — {linhas.length} {linhas.length === 1 ? "animal" : "animais"}
            </h3>
            <span className="text-sm text-ink-3">{dicaLinha ?? "clique numa linha pra abrir a ficha"}</span>
          </div>
          <RebTable>
            <thead><tr><th>Animal</th>{config.colunas.map((c) => <th key={c.nome}>{c.nome}</th>)}</tr></thead>
            <tbody>
              {linhas.map((r) => {
                const a = nomes?.[r.animalId] ?? getAnimal(r.animalId);
                return (
                  <tr className="rb-row" key={r.animalId} onClick={() => onAbrirAnimal(r.animalId)}>
                    <td className="font-semibold text-[color:var(--ink)] [&_small]:font-medium [&_small]:text-ink-2">{a?.nome} <small>#{a?.numero}</small></td>
                    {config.colunas.map((c) => <td key={c.nome}>{c.render(r)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </RebTable>
        </>
      )}
    </main>
  );
}
