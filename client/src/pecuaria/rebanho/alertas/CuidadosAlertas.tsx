import { Button, TabelaFinanceira, Pill, type ColunaTabela } from "@/financeiro/financeiro-ui";
import type { GrupoAlerta } from "./api";
import { situacoesDoGrupo } from "./consulta";
import { formatBRDateISO } from "@/lib/hoje";
import "./alertas.css";
import { iconeDoCuidado } from "@/components/iconesTabela";
export function CuidadosAlertas({grupos,onAbrir,individual=false}:{grupos:GrupoAlerta[];onAbrir:(g:GrupoAlerta)=>void;individual?:boolean}){
 const publico=(g:GrupoAlerta)=>individual?"Este animal":g.animais?`${g.animais} ${g.animais===1?"animal":"animais"}`:`${g.necessidades} cuidados`;
 const desde=(g:GrupoAlerta)=>[g.produtoNome,g.primeiraData?`desde ${formatBRDateISO(g.primeiraData.slice(0,10))}`:""].filter(Boolean).join(" · ");
 const colunas:ColunaTabela<GrupoAlerta>[]=[
  {chave:"cuidado",titulo:"Cuidado / produto",principal:true,larguraMinima:220,celula:g=><><strong>{g.titulo}</strong>{desde(g)&&<div className="text-sm text-muted-foreground">{desde(g)}</div>}</>},
  {chave:"origem",titulo:"Origem",larguraMinima:100,celula:g=> <Pill>{g.produtor==="reproducao"?"Reprodução":"Sanidade"}</Pill>},
  {chave:"programacao",titulo:"Programação / motivo",larguraMinima:220,larguraFlexivel:true,celula:g=>g.motivo},
  {chave:"publico",titulo:"Público",larguraMinima:100,celula:publico},
  {chave:"situacao",titulo:"Situação",larguraMinima:150,celula:situacoesDoGrupo},
  {chave:"acoes",titulo:"Ações",larguraMinima:130,alinhamento:"direita",acoes:true,celula:g=><Button secondary onClick={()=>onAbrir(g)}>{individual?"Ver cuidado":"Ver animais"}</Button>},
 ];
 return <TabelaFinanceira iconeDe={g=>iconeDoCuidado(g.produtor,g.tipo)} colunas={colunas} itens={grupos} chaveDe={g=>g.chave} rotulo="Cuidados agrupados"/>;
}
