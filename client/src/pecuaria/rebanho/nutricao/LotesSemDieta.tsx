import { useCallback } from "react";
import { consultarVisaoNutricional } from "./api";
import { useConsulta } from "./consulta";
import { EstadoConsulta, LinkNutricional, rotaNutricao } from "./componentes";
import { rotaOperacaoNutricional } from "./navegacao";
export function LotesSemDieta({ podeLancar }: { podeLancar: boolean }) {
  const consulta = useConsulta(useCallback(consultarVisaoNutricional, []));
  const sem = consulta.dados?.lotes.filter(l => !l.vigente) ?? [];
  return <section><h2>Lotes sem dieta vigente</h2><EstadoConsulta erro={consulta.erro} carregando={consulta.carregando} recarregar={consulta.carregar} />{consulta.dados && (!sem.length ? <p>Todos os lotes ativos têm dieta vigente cadastrada.</p> : sem.map(r => <article className="mensal-linha" key={r.lote.id}><div><h3>{r.lote.nome} · {r.lote.propriedade.nome}</h3><p>{r.lote.animaisAtivos} animais · sem dieta vigente cadastrada.</p>{r.programada && <p>Há uma dieta programada para {r.programada.desde.slice(0,10).split("-").reverse().join("/")}.</p>}</div><LinkNutricional className="nutricao-botao-secundario" href={podeLancar ? rotaOperacaoNutricional("atribuir", r.lote.id) : rotaNutricao({ loteId: r.lote.id })}>{podeLancar ? "Atribuir dieta" : "Ver lote"}</LinkNutricional></article>))}</section>;
}
