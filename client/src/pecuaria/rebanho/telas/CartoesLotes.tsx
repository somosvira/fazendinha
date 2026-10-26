import { useEffect, useState, type ReactNode } from "react";
import { MapPin, TrendingUp, Weight } from "lucide-react";
import { Button, Pill } from "@/financeiro/financeiro-ui";
import { buscarResumoLote } from "../api";
import type { Lote, ResumoLote } from "../types";
import { formatarGmd, formatarKg } from "../lib/peso";
import "./lotes-visuais.css";
const cores=["#007f78","#43aaa4","#90c7c2","#285c6c","#6b929f","#b0cecc"];
export function corCategoriaLote(nome:string){let h=0;for(const c of nome)h=(h*31+c.charCodeAt(0))>>>0;return cores[h%cores.length];}
export function Composicao({resumo:r}:{resumo:ResumoLote}){
 const agrupadas = new Map<string,number>();for(const c of r.porCategoria)agrupadas.set(c.categoria,(agrupadas.get(c.categoria)??0)+c.qtd);const categorias=[...agrupadas].map(([categoria,qtd])=>({categoria,categoriaId:categoria,qtd}));
 const total=categorias.reduce((s,c)=>s+c.qtd,0);let acumulado=0;
 if(!total)return <p className="consulta-cartao-meta">Sem animais ativos para distribuir.</p>;
 return <div className="lote-composicao"><svg viewBox="0 0 120 120" role="img" aria-label={`Composição: ${categorias.map(c=>`${c.categoria}: ${c.qtd}`).join(", ")}`}><circle cx="60" cy="60" r="43" fill="none" stroke="#e6eeed" strokeWidth="16"/>{categorias.map(c=>{const proporcao=c.qtd/total;const offset=acumulado;acumulado+=proporcao;return <circle key={c.categoriaId??c.categoria} cx="60" cy="60" r="43" fill="none" stroke={corCategoriaLote(c.categoria)} strokeWidth="16" pathLength="1" strokeDasharray={`${proporcao} ${1-proporcao}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)"/>;})}<text x="60" y="59" textAnchor="middle" className="lote-rosca-total">{r.ativos}</text><text x="60" y="76" textAnchor="middle" className="lote-rosca-unidade">{r.ativos===1?"animal":"animais"}</text></svg><ul>{categorias.map(c=><li key={c.categoriaId??c.categoria}><i style={{background:corCategoriaLote(c.categoria)}}/><span>{c.categoria}</span><strong>{c.qtd}</strong></li>)}</ul></div>;
}
function Cartao({lote:l,acoes,onAbrir}:{lote:Lote;acoes:ReactNode;onAbrir:(id:string)=>void}){
 const [resumo,setResumo]=useState<ResumoLote|null>(null);const[erro,setErro]=useState(false);const[tentativa,setTentativa]=useState(0);
 useEffect(()=>{let vivo=true;setResumo(null);setErro(false);buscarResumoLote(l.id,{periodoDias:30}).then(r=>{if(vivo)setResumo(r);}).catch(()=>{if(vivo)setErro(true);});return()=>{vivo=false;};},[l.id,l.animaisAtivos,tentativa]);
 return <article className="consulta-cartao lote-cartao"><header><div><h2>{l.nome}</h2><p className="consulta-cartao-meta"><MapPin size={14} aria-hidden/>{l.propriedade.nome}</p></div><div className="lote-cartao-acoes"><Pill tone={l.ativo?"green":"neutral"}>{l.ativo?"Ativo":"Inativo"}</Pill>{acoes}</div></header>
  {resumo?<Composicao resumo={resumo}/>:<div className="lote-composicao-vazia"><strong>{l.animaisAtivos} {l.animaisAtivos===1?"animal ativo":"animais ativos"}</strong>{erro?<><span>Resumo indisponível.</span><Button secondary onClick={()=>setTentativa(v=>v+1)}>Tentar novamente</Button></>:<span role="status">Consultando composição e desempenho…</span>}</div>}
  <footer><div className="lote-medidas"><div><span><Weight size={15} aria-hidden/>Peso médio</span><strong>{resumo?formatarKg(resumo.peso.medioKg):"—"}</strong><small>{resumo?resumo.peso.medioKg==null?"Sem pesagens":`${resumo.ativos-resumo.peso.semPeso} de ${resumo.ativos} com pesagem`:""}</small></div><div><span><TrendingUp size={15} aria-hidden/>GMD · últimos 30 dias</span><strong>{resumo?formatarGmd(resumo.gmd.medio):"—"}</strong><small>{resumo?`${resumo.gmd.comGmd} de ${resumo.ativos} com GMD`:""}</small></div></div><Button secondary onClick={()=>onAbrir(l.id)}>Ver lote</Button></footer>
 </article>;
}
export function CartoesLotes({lotes,todos,acoes,onAbrir}:{lotes:Lote[];todos:Lote[];acoes:(l:Lote)=>ReactNode;onAbrir:(id:string)=>void}){
 if(!todos.length)return <p className="p-5 text-sm text-muted-foreground">Nenhum lote corresponde aos filtros atuais.</p>;
 const comparacao=[...todos].sort((a,b)=>b.animaisAtivos-a.animaisAtivos||a.nome.localeCompare(b.nome)).slice(0,8);const maior=Math.max(1,...comparacao.map(l=>l.animaisAtivos));
 return <><div className="consulta-cartoes lotes-cartoes">{lotes.map(l=><Cartao key={l.id} lote={l} acoes={acoes(l)} onAbrir={onAbrir}/>)}</div>{comparacao.length>1&&<section className="lote-distribuicao"><h2>Distribuição do efetivo por lote</h2><p>{comparacao.length===todos.length?"Todos os lotes do recorte filtrado":`${comparacao.length} de ${todos.length} lotes do recorte filtrado`}</p>{comparacao.map(l=><button type="button" key={l.id} onClick={()=>onAbrir(l.id)}><span>{l.nome}</span><span className="lote-distribuicao-barra"><i style={{width:`${l.animaisAtivos/maior*100}%`}}/></span><strong>{l.animaisAtivos}</strong></button>)}</section>}</>;
}
