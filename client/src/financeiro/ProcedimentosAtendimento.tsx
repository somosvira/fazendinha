import { podeAcessarArea } from "../estoque/navegacao";
import { dataProcedimentoServico, origemProcedimentoServico } from "../pecuaria/rebanho/sanidade/GerenciarProcedimentosServico";
import { linkProcedimentoServico, type ProcedimentoServico } from "./novo-api";
import { brl } from "./financeiro-ui";

export function ProcedimentosAtendimento({ itens }: { itens: ProcedimentoServico[] }) {
  return <div className="mt-4 space-y-3">{itens.length ? itens.map((item) => <div key={`${item.tipo}:${item.id}`} className="space-y-1 rounded-lg border border-border p-3 text-sm">
    <strong>{item.nome}</strong><p>{item.animal.brinco}{item.animal.nome ? ` · ${item.animal.nome}` : ""} · {dataProcedimentoServico(item)}</p>
    <p>{item.propriedade?.nome ?? "Sítio não registrado"} · {origemProcedimentoServico(item)}{["ANULADO", "CANCELADO"].includes(item.status) && ` · ${item.status === "ANULADO" ? "Anulado" : "Cancelado"}`}</p>
    {item.valor != null && <p>{brl(item.valor)}</p>}
    {podeAcessarArea("pecuaria") && <div className="flex flex-wrap gap-3"><a className="underline" href={linkProcedimentoServico(item, window.location.pathname + window.location.search)}>Ver procedimento</a><a className="underline" href={`/pecuaria/rebanho/animais/${encodeURIComponent(item.animalId)}`}>Ver animal</a></div>}
  </div>) : <p className="text-sm text-ink-3">Nenhum procedimento vinculado a este atendimento.</p>}</div>;
}
