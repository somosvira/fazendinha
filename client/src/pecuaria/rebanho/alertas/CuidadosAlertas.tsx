import { Button, TabelaFinanceira, Pill, type ColunaTabela } from "@/financeiro/financeiro-ui";
import type { GrupoAlerta } from "./api";
import { situacoesDoGrupo, rotuloTipo } from "./consulta";
import "./alertas.css";
export function CuidadosAlertas({grupos,modo,onAbrir,individual=false}:{grupos:GrupoAlerta[];modo:"visual"|"tabela";onAbrir:(g:GrupoAlerta)=>void;individual?:boolean}){
 const publico=(g:GrupoAlerta)=>individual?"Este animal":g.animais?`${g.animais} ${g.animais===1?"animal":"animais"}`:`${g.necessidades} cuidados`;
 const colunas:ColunaTabela<GrupoAlerta>[]=[
  {chave:"cuidado",titulo:"Cuidado / produto",principal:true,larguraMinima:220,celula:g=><strong>{g.titulo}</strong>},
  {chave:"origem",titulo:"Origem",larguraMinima:100,celula:()=> <Pill>Sanidade</Pill>},
  {chave:"programacao",titulo:"Programação / motivo",larguraMinima:220,larguraFlexivel:true,celula:g=>g.motivo},
  {chave:"publico",titulo:"Público",larguraMinima:100,celula:publico},
  {chave:"situacao",titulo:"Situação",larguraMinima:150,celula:situacoesDoGrupo},
  {chave:"acoes",titulo:"Ações",larguraMinima:130,alinhamento:"direita",acoes:true,celula:g=><Button secondary onClick={()=>onAbrir(g)}>{individual?"Ver cuidado":"Ver animais"}</Button>},
 ];
 return modo==="tabela"?<TabelaFinanceira colunas={colunas} itens={grupos} chaveDe={g=>g.chave} rotulo="Cuidados agrupados"/>:<div className="consulta-cartoes cuidados-alertas-cartoes">{grupos.map(g=><article className="consulta-cartao" key={g.chave}><header><h2>{g.titulo}</h2><Pill>Sanidade</Pill></header><p className="consulta-cartao-meta">{g.motivo}</p><dl className="alertas-cartao-dados"><div><dt>Público</dt><dd>{publico(g)}</dd></div><div><dt>Situação</dt><dd>{situacoesDoGrupo(g)}</dd></div></dl><footer><Pill>{rotuloTipo(g.tipo)}</Pill><Button secondary onClick={()=>onAbrir(g)}>{individual?"Ver cuidado":"Ver animais"}</Button></footer></article>)}</div>;
}
