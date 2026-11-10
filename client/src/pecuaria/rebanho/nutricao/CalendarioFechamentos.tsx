import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/financeiro/financeiro-ui";
import { SelectCampo } from "@/financeiro/SelectCampo";
import type { Fechamento } from "./api";
import { custoTexto, SituacaoFechamento } from "./componentes";
import { quantidadeNutricional, un } from "./quantidades";
import { formatarDataBR } from "../lib/rotulos";
import { LIMITE_DIVERGENCIA } from "./AlertasNutricao";
import "./fechamentos-visuais.css";
export function intervaloMesFechamento(mes:string){const[ano,m]=mes.split("-").map(Number);const fim=new Date(Date.UTC(ano,m,0)).toISOString().slice(0,10);return{de:`${mes}-01`,ate:fim};}
export function semanasMesFechamento(mes:string){const{de,ate}=intervaloMesFechamento(mes);const d=new Date(`${de}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const semanas:string[][]=[];while(d.toISOString().slice(0,10)<=ate){const semana:string[]=[];for(let i=0;i<7;i++){semana.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);}semanas.push(semana);}return semanas;}
/** Distribui as faixas da semana na primeira linha livre, para períodos que não se sobrepõem dividirem a mesma linha. */
export function linhasDaSemana(semana:string[],fechamentos:Fechamento[],maximo=3){
 const linhas:number[]=[];const posicionadas:Array<{f:Fechamento;inicio:number;fim:number;linha:number}>=[];let ocultas=0;
 for(const f of [...fechamentos].sort((a,b)=>a.inicio.localeCompare(b.inicio)||b.fim.localeCompare(a.fim))){
  const inicio=Math.max(0,semana.findIndex(d=>d>=f.inicio.slice(0,10)));const fim=semana.filter(d=>d<=f.fim.slice(0,10)).length-1;
  let linha=linhas.findIndex(ultima=>ultima<inicio);if(linha<0){if(linhas.length>=maximo){ocultas++;continue;}linha=linhas.length;linhas.push(fim);}else linhas[linha]=fim;
  posicionadas.push({f,inicio,fim,linha});
 }
 return {posicionadas,ocultas};
}
export function diferencaConsumo(previsto:string,conferido:string){return Math.round((Number(conferido)-Number(previsto))*1e6)/1e6;}
function ComparacaoIngrediente({item:i}:{item:Fechamento["itens"][number]}){
 const maior=Math.max(Number(i.quantidadePrevista),Number(i.quantidadeConfirmada),1);const diferenca=diferencaConsumo(i.quantidadePrevista,i.quantidadeConfirmada);
 // Mesmo critério dos Alertas: diferença acima do limite merece revisão.
 const divergente=Number(i.quantidadePrevista)>0&&Math.abs(diferenca)/Number(i.quantidadePrevista)>LIMITE_DIVERGENCIA;
 return <div className="fechamento-ingrediente"><strong>{i.produto.nome}</strong><div><span>Previsto <b>{quantidadeNutricional(i.quantidadePrevista)} {un(i.unidade)}</b></span><div className="fechamento-barra"><i className="fechamento-previsto" style={{width:`${Number(i.quantidadePrevista)/maior*100}%`}}/></div><span>Conferido <b>{quantidadeNutricional(i.quantidadeConfirmada)} {un(i.unidade)}</b></span><div className="fechamento-barra"><i style={{width:`${Number(i.quantidadeConfirmada)/maior*100}%`}}/></div></div><small data-divergente={divergente||undefined}>Diferença <strong>{diferenca>0?"+":""}{quantidadeNutricional(String(diferenca))} {un(i.unidade)}{divergente&&` · ${diferenca>0?"+":"−"}${Math.round(Math.abs(diferenca)/Number(i.quantidadePrevista)*100)}%`}</strong></small></div>;
}
export function CalendarioFechamentos({itens,total,de,carregando=false,onMes,onAbrir}:{itens:Fechamento[];total:number;de:string;carregando?:boolean;onMes:(periodo:{de:string;ate:string})=>void;onAbrir:(f:Fechamento)=>void}){
 const hoje=new Date().toLocaleDateString("sv-SE",{timeZone:"America/Sao_Paulo"});
 const [mes,setMes]=useState(()=>de.slice(0,7)||itens[0]?.inicio.slice(0,7)||hoje.slice(0,7));
 const [selecionado,setSelecionado]=useState("");
 useEffect(()=>{if(de)setMes(de.slice(0,7));},[de]);
 const atual=itens.find(f=>f.id===selecionado)??itens[0];
 const semanas=semanasMesFechamento(mes);
 function navegar(delta:number){const[ano,m]=mes.split("-").map(Number);const d=new Date(Date.UTC(ano,m-1+delta,1));const novo=d.toISOString().slice(0,7);setMes(novo);onMes(intervaloMesFechamento(novo));}
 function selecionar(f:Fechamento){setSelecionado(f.id);}
 return <div className="fechamentos-visual"><section className="fechamentos-calendario" aria-label="Calendário dos fechamentos" aria-busy={carregando}><header><Button secondary aria-label="Mês anterior" onClick={()=>navegar(-1)}><ChevronLeft size={17}/></Button><h2>{new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${mes}-01T12:00:00Z`))}</h2><Button secondary aria-label="Próximo mês" onClick={()=>navegar(1)}><ChevronRight size={17}/></Button><Button secondary onClick={()=>{const novo=hoje.slice(0,7);setMes(novo);onMes(intervaloMesFechamento(novo));}}>Hoje</Button></header><p className="fechamento-ajuda">{carregando ? "Consultando fechamentos do mês…" : itens.length ? `${itens.length} ${itens.length===1?"fechamento":"fechamentos"} no mês` : "Nenhum fechamento neste mês"}{total>itens.length?` · exibindo ${itens.length} de ${total}`:""}</p>
  <div className="fechamentos-dias-semana">{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d=><span key={d}>{d}</span>)}</div>
  {semanas.map(semana=>{const visiveis=itens.filter(f=>f.inicio.slice(0,10)<=semana[6]&&f.fim.slice(0,10)>=semana[0]);return <div className="fechamentos-semana" key={semana[0]}><div className="fechamentos-dia-numeros">{semana.map(d=><time key={d} dateTime={d} data-outro-mes={!d.startsWith(mes)||undefined} data-hoje={d===hoje||undefined}>{Number(d.slice(8,10))}</time>)}</div><div className="fechamentos-faixas">{(()=>{const {posicionadas,ocultas}=linhasDaSemana(semana,visiveis);return <>{posicionadas.map(({f,inicio,fim,linha})=><button type="button" key={f.id} aria-pressed={atual?.id===f.id} data-estornado={f.status==="ESTORNADO"||undefined} onClick={()=>selecionar(f)} style={{gridColumn:`${inicio+1} / ${fim+2}`,gridRow:linha+1}} title={`${f.lote.nome}: ${formatarDataBR(f.inicio)} a ${formatarDataBR(f.fim)}`}><span>{f.lote.nome}{f.status==="ESTORNADO"?" · Estornado":""}</span></button>)}{ocultas>0&&<span className="fechamento-mais-periodos" style={{gridColumn:"1 / -1",gridRow:4}}>+{ocultas} {ocultas===1?"período":"períodos"} nesta semana</span>}</>;})()}</div></div>;})}
  {itens.length>0&&<label className="fechamento-seletor">Consultar um fechamento do mês<SelectCampo aria-label="Selecionar fechamento" value={atual?.id??""} onValueChange={id=>{const f=itens.find(f=>f.id===id);if(f)selecionar(f);}}><option value="">Selecione</option>{[...itens].sort((a,b)=>a.inicio.localeCompare(b.inicio)).map(f=><option value={f.id} key={f.id}>{f.lote.nome} · {formatarDataBR(f.inicio)} a {formatarDataBR(f.fim)} · {f.status==="ESTORNADO"?"Estornado":"Confirmado"}</option>)}</SelectCampo></label>}
 </section>
 {carregando ? null : atual?<section className="fechamento-comparacao" aria-label="Consumo do fechamento selecionado"><header><div><h2>{atual.lote.nome}</h2><p>{formatarDataBR(atual.inicio)} a {formatarDataBR(atual.fim)}</p></div><SituacaoFechamento status={atual.status}/></header><p className="fechamento-contexto">{atual.vigencia.dieta.nome} · v{atual.vigencia.dieta.versao} · {atual.propriedade.nome} · {atual.animalDias.toLocaleString("pt-BR")} animal-dias</p><h3>Previsto × conferido</h3>{(atual.itens??[]).slice(0,3).map(i=><ComparacaoIngrediente key={i.produtoId} item={i}/>)}{(atual.itens??[]).length>3&&<details><summary>Ver mais {atual.itens.length-3} ingredientes</summary>{atual.itens.slice(3).map(i=><ComparacaoIngrediente key={i.produtoId} item={i}/>)}</details>}{!(atual.itens??[]).length&&<p className="fechamento-ajuda">Sem composição disponível nesta consulta.</p>}{atual.status==="ESTORNADO"&&<p className="fechamento-aviso">Estornado · os valores e quantidades representam o registro histórico.</p>}<footer>{atual.verValores&&<div><span>Custo conhecido</span><strong>{custoTexto(atual.custoConhecido)}</strong>{!atual.coberturaCustoCompleta&&atual.custoConhecido!=null&&<small>Parcial</small>}</div>}<Button onClick={()=>onAbrir(atual)}>Ver fechamento</Button></footer></section>:<section className="fechamento-sem-selecao"><h2>Nenhum fechamento neste mês</h2><p>Use as setas para consultar outros meses.</p></section>}
 </div>;
}
