import { useEffect, useMemo, useState } from "react";
import { Columns3 } from "lucide-react";
import type { DomainConfig } from "../domains";
import type { ResumoAnimal, IaInsight } from "../types";
import { getAnimal } from "../mock";
import { IaInsightBand } from "./IaInsight";
import { RebHeader } from "./RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain } from "@/components/rb/RebPrimitives";
import { AnimalIdentity } from "./AnimalIdentity";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Paginacao, usePaginacaoLocal } from "@/components/Paginacao";

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
  const storageKey = `rionovo:tarefas-colunas:${config.titulo.toLowerCase()}`;
  const nomesColunas = useMemo(() => config.colunas.map((c) => c.nome), [config.colunas]);
  const [colunasVisiveis, setColunasVisiveis] = useState<string[]>(() => {
    try {
      const salvas = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      return Array.isArray(salvas) ? salvas : config.colunas.map((c) => c.nome);
    } catch {
      return config.colunas.map((c) => c.nome);
    }
  });
  useEffect(() => {
    setColunasVisiveis((atuais) => {
      const validas = atuais.filter((nome) => nomesColunas.includes(nome));
      return validas.length ? validas : nomesColunas;
    });
  }, [nomesColunas]);
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(colunasVisiveis));
  }, [colunasVisiveis, storageKey]);
  const wl = config.worklists.find((w) => w.id === wlId);
  const linhas = wl ? wl.selecionar(resumos) : [];
  const paginacao = usePaginacaoLocal(linhas, [wlId]);
  const kpis = config.kpis(resumos);
  const colunas = config.colunas.filter((c) => colunasVisiveis.includes(c.nome));
  const alternarColuna = (nome: string) => setColunasVisiveis((atuais) =>
    atuais.includes(nome) ? atuais.filter((item) => item !== nome) : [...atuais, nome]
  );

  return (
    <RebMain>
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
                  type="button"
                  aria-label={w.label}
                  aria-pressed={on}
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

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 font-serif text-lg font-medium">
              {wl?.label} — {linhas.length} {linhas.length === 1 ? "animal" : "animais"}
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-ink-3">{dicaLinha ?? "use o botão do animal para abrir a ficha"}</span>
              {config.colunas.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="inline-flex items-center gap-2 border border-[color:var(--rule)] bg-transparent px-3 py-2 text-sm text-[color:var(--ink)] hover:bg-[color:var(--paper-2)]">
                      <Columns3 size={16} aria-hidden="true" /> Colunas ({colunas.length}/{config.colunas.length})
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-3">
                    <div className="mb-2 text-sm font-semibold">Personalizar tabela</div>
                    <div className="space-y-1">
                      {config.colunas.map((c) => (
                        <label key={c.nome} className="flex cursor-pointer items-center gap-2 px-1 py-1.5 text-sm">
                          <input type="checkbox" checked={colunasVisiveis.includes(c.nome)} onChange={() => alternarColuna(c.nome)} />
                          {c.nome}
                        </label>
                      ))}
                    </div>
                    <button type="button" className="mt-2 text-sm font-medium text-cafe underline underline-offset-2" onClick={() => setColunasVisiveis(nomesColunas)}>
                      Mostrar todas
                    </button>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
          <RebTable>
            <thead><tr><th>Animal</th>{colunas.map((c) => <th key={c.nome}>{c.nome}</th>)}</tr></thead>
            <tbody>
              {paginacao.itens.map((r) => {
                const a = nomes?.[r.animalId] ?? getAnimal(r.animalId);
                return (
                  <tr key={r.animalId}>
                    <td>
                      {a ? (
                        <button
                          type="button"
                          aria-label={`Abrir ficha do animal número ${a.numero}${a.nome ? `, ${a.nome}` : ""}`}
                          className="cursor-pointer border-0 bg-transparent p-0 text-left font-inherit text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cafe"
                          onClick={() => onAbrirAnimal(r.animalId)}
                        >
                          <AnimalIdentity numero={a.numero} nome={a.nome} />
                        </button>
                      ) : "—"}
                    </td>
                    {colunas.map((c) => <td key={c.nome}>{c.render(r)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </RebTable>
          <Paginacao estado={paginacao} nome="animais" />
        </>
      )}
    </RebMain>
  );
}
