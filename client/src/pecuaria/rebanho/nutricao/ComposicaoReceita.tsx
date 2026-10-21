import { useState } from "react";
import type { Dieta } from "./api";
import { quantidadeNutricional } from "./quantidades";
import "./composicao-receita.css";

export function ComposicaoReceita({ dieta, titulo = true }: { dieta: Dieta; titulo?: boolean }) {
  const [modo, setModo] = useState<"grafico" | "tabela">("grafico");
  const grupos = new Map<string, Dieta["itens"]>();
  for (const item of dieta.itens) grupos.set(item.unidade, [...(grupos.get(item.unidade) ?? []), item]);
  return <div className="receita-composicao">
    <div className="receita-composicao-topo">{titulo && <div><h4>Composição por cabeça/dia</h4><p>{dieta.itens.length} ingredientes</p></div>}<div className="receita-composicao-modos" role="group" aria-label={`Visualização de ${dieta.nome}`}><button type="button" aria-pressed={modo === "grafico"} onClick={() => setModo("grafico")}>Gráfico</button><button type="button" aria-pressed={modo === "tabela"} onClick={() => setModo("tabela")}>Tabela</button></div></div>
    {modo === "tabela" ? <div className="nutricao-tabela-scroll"><table className="nutricao-tabela consulta-tabela"><caption className="sr-only">Ingredientes de {dieta.nome} · versão {dieta.versao}</caption><thead><tr><th>Ingrediente</th><th>Quantidade por cabeça/dia</th><th>Matéria seca</th></tr></thead><tbody>{dieta.itens.map(i => <tr key={i.produtoId}><td>{i.produto?.nome ?? "Produto indisponível"}</td><td>{quantidadeNutricional(i.quantidadeCabecaDia)} {i.unidade}</td><td>{i.materiaSecaPercentualSnapshot == null ? "Não informada" : `${quantidadeNutricional(i.materiaSecaPercentualSnapshot)}%`}</td></tr>)}</tbody></table></div> : <div>{[...grupos].map(([unidade, itens]) => {
      const maximo = Math.max(0, ...itens.map(i => Number(i.quantidadeCabecaDia)));
      const total = itens.reduce((soma, i) => soma + Number(i.quantidadeCabecaDia), 0);
      return <section className="receita-composicao-grupo" key={unidade} aria-label={`Quantidades em ${unidade}`}><div className="receita-composicao-colunas" aria-hidden="true"><span>Ingrediente</span><span>Quantidade ({unidade}/cabeça/dia)</span><span>Matéria seca</span></div>{itens.map((i, indice) => <div className="receita-composicao-item" key={i.produtoId}><span>{i.produto?.nome ?? "Produto indisponível"}</span><div className="receita-composicao-quantidade"><div className="receita-composicao-trilho" aria-hidden="true"><span className={`receita-cor-${indice % 3}`} style={{width: `${maximo > 0 ? Number(i.quantidadeCabecaDia) / maximo * 100 : 0}%`}} /></div><strong>{quantidadeNutricional(i.quantidadeCabecaDia)} {unidade}</strong></div><span className="receita-composicao-ms"><span className="sr-only">Matéria seca: </span>{i.materiaSecaPercentualSnapshot == null ? "Não informada" : `${quantidadeNutricional(i.materiaSecaPercentualSnapshot)}%`}</span></div>)}{Number.isFinite(total) && <div className="receita-composicao-total"><span>Total por cabeça/dia{grupos.size > 1 ? ` (${unidade})` : ""}</span><strong>{quantidadeNutricional(total.toFixed(6))} {unidade}</strong></div>}</section>;
    })}</div>}
    {!dieta.itens.length && <p>Nenhum ingrediente nesta receita.</p>}
  </div>;
}
