import { Loader } from "../../components/Loading";
import { RebButton } from "@/components/rb/RebButton";
import { RebEmpty, RebMain } from "@/components/rb/RebPrimitives";
import { RebTable } from "@/components/rb/RebTable";
import { type ChaveWorklistRebanho, type WorklistItemRebanho, type WorklistRebanho, useWorklist } from "../api";

export interface AcaoItemWorklist {
  item: WorklistItemRebanho;
  worklist: WorklistRebanho;
}

export function WorklistCanonica({ chave, snapshot, onAcao, onAbrirFicha }: { chave: ChaveWorklistRebanho; snapshot?: WorklistRebanho; onAcao: (acao: AcaoItemWorklist) => void; onAbrirFicha: (id: string) => void }) {
  const { data, loading, erro, recarregar } = useWorklist(chave, snapshot);
  if (loading && !data) return <RebMain><Loader /></RebMain>;
  if (!data) return <RebMain><RebEmpty>Erro ao carregar a lista{erro ? `: ${erro}` : "."} <RebButton className="ml-2" onClick={recarregar}>Tentar novamente</RebButton></RebEmpty></RebMain>;
  return <RebMain>
    <div className="mb-5"><p className="text-[11px] font-semibold uppercase tracking-[.12em] text-leite">Tarefa operacional</p><h1 className="mt-1 font-serif text-[30px] font-medium">{data.label}</h1><p className="mt-1 text-sm text-ink-3">{data.detalhe}</p></div>
    <div className="mb-3 flex items-baseline justify-between"><h2 className="font-serif text-xl font-medium">{data.quantidade} {data.quantidade === 1 ? "animal" : "animais"}</h2>{data.acao && <span className="text-xs text-ink-3">Ação: {data.acao.tipoEvento.toLowerCase()}</span>}</div>
    {data.itens.length ? <RebTable><thead><tr><th>Animal</th><th>Grupo / setor</th><th>Motivo</th><th>Ações</th></tr></thead><tbody>{data.itens.map((i) => <tr key={i.animalId}><td><strong>{i.nome || "Sem nome"}</strong> <small>#{i.numero}</small></td><td>{[i.grupo, i.setor].filter(Boolean).join(" · ") || "—"}</td><td>{i.motivo}</td><td><div className="flex gap-2">{data.acao && <RebButton variant="pri" onClick={() => onAcao({ item: i, worklist: data })}>Registrar</RebButton>}<RebButton onClick={() => onAbrirFicha(String(i.animalId))}>Abrir ficha</RebButton></div></td></tr>)}</tbody></RebTable> : <RebEmpty>Nenhum animal nesta tarefa.</RebEmpty>}
  </RebMain>;
}
