import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {consultarRadar,type RadarDTO,type PrioridadeRadar,type FonteRadar} from './radar-api';
import {ROTULO_URGENCIA} from './HojeNaFazenda';
import {Skeleton} from '../components/ui/skeleton';
import { navegarPara } from '../router';
import './radar.css';
export function Radar({propriedadeId,onPerguntar,onAbrirFonte=navegarPara}:{propriedadeId:number|null;onPerguntar:(pergunta:string)=>void;onAbrirFonte?:(url:string)=>void}) {
 const [snapshot,setDados]=useState<RadarDTO|null>(null),[carregadoPara,setCarregadoPara]=useState<number|null|undefined>(undefined),[erro,setErro]=useState(''),[carregando,setCarregando]=useState(true),[tentativa,setTentativa]=useState(0);
 const dados=carregadoPara===propriedadeId?snapshot:null;
 useEffect(()=>{const controller=new AbortController();setDados(null);setErro('');setCarregando(true);consultarRadar(tentativa>0,controller.signal).then(r=>{if(!controller.signal.aborted){setCarregadoPara(propriedadeId);setDados(r);}}).catch(e=>{if(!controller.signal.aborted)setErro(e instanceof Error?e.message:'Falha ao consultar o Radar.');}).finally(()=>{if(!controller.signal.aborted)setCarregando(false);});return()=>controller.abort();},[propriedadeId,tentativa]);
 const abrir=(fonte:FonteRadar)=>(e:React.MouseEvent)=>{e.preventDefault();onAbrirFonte(fonte.url);};
 return <section className="ia-radar" aria-label="Radar diário" aria-busy={carregando}>
  <header className="ia-radar-header"><div><h2>Hoje na fazenda</h2><p>{dados?`${dados.escopo.nome} · consultado em ${new Date(dados.geradoEm).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'Leitura dos registros autorizados'}</p></div><button type="button" disabled={carregando} onClick={()=>setTentativa(v=>v+1)}><RefreshCw size={16} aria-hidden/>Atualizar</button></header>
  {carregando&&<div role="status" aria-label="Preparando a leitura do seu recorte" className="ia-radar-colunas"><div className="ia-radar-prioridades">{[0,1,2,3].map(i=><Skeleton key={i} className="h-20 w-full rounded-lg"/>)}</div><Skeleton className="h-64 w-full rounded-xl"/></div>}
  {erro&&<div role="alert" className="ia-radar-erro"><p>{erro}</p><button type="button" onClick={()=>setTentativa(v=>v+1)}>Tentar novamente</button></div>}
  {dados&&<>{dados.sintese.modo==='ia'?<div className="ia-radar-sintese"><h3>Síntese da IA</h3><p>{dados.sintese.texto}</p><small>Análise diária. Atualizar consulta a análise disponível; não repete a IA no mesmo dia.</small></div>:<p className="ia-radar-modo"><strong>Leitura automática dos registros</strong> · {dados.sintese.texto}</p>}
   <div className="ia-radar-colunas">
    <div className="ia-radar-prioridades">{dados.prioridades.length?dados.prioridades.map(p=><Prioridade key={p.id} p={p} abrir={abrir(p.fonte)} onPerguntar={onPerguntar}/>):<p className="ia-radar-vazio">Nenhuma prioridade apresentada neste recorte. Confira a cobertura antes de concluir que não há pendências.</p>}</div>
    <section className="ia-radar-leitura" aria-label="Leitura da fazenda"><h3>Leitura da fazenda</h3>{dados.leitura.length?<dl>{dados.leitura.map((l,i)=><div key={i}><dt>{l.titulo}</dt><dd>{l.valor??<a href={l.fonte.url} onClick={abrir(l.fonte)}>Conferir</a>}</dd><span>{l.texto}{l.valor&&<> · <a href={l.fonte.url} onClick={abrir(l.fonte)}>fonte</a></>}</span></div>)}</dl>:<p className="ia-radar-vazio">Sem dados disponíveis para este acesso.</p>}</section>
   </div>
   {dados.cobertura.length>0&&<details className="ia-radar-cobertura"><summary>De onde vem esta leitura · {dados.cobertura.length} {dados.cobertura.length===1?'fonte':'fontes'}</summary><dl className="ia-radar-cobertura-grade">{dados.cobertura.map((c,i)=><div key={i}><dt>{c.titulo}{c.valor&&<strong> · {c.valor}</strong>}</dt><dd>{c.texto} <a href={c.fonte.url} onClick={abrir(c.fonte)}>Conferir registros</a></dd></div>)}</dl></details>}
  </>}
 </section>;
}
/** Uma prioridade: quantidade, prazo pela urgência, título, descrição e a ação que resolve. */
function Prioridade({p,abrir,onPerguntar}:{p:PrioridadeRadar;abrir:(e:React.MouseEvent)=>void;onPerguntar:(pergunta:string)=>void}) {
 const prazo=p.prazo??(p.urgencia?ROTULO_URGENCIA[p.urgencia]:null);
 return <article className={`ia-radar-prioridade${p.urgencia?` ${p.urgencia}`:''}`}>
  {p.quantidade?<div className="ia-radar-qtd">{p.quantidade.valor.toLocaleString('pt-BR')}<small>{p.quantidade.unidade}</small></div>:<div className="ia-radar-qtd" aria-hidden/>}
  <div className="min-w-0">{prazo&&<span className="ia-radar-urgencia">{prazo}</span>}<h3>{p.titulo}</h3><p>{p.descricao}</p></div>
  <div className="ia-radar-acoes"><a className="ia-radar-abrir" href={p.fonte.url} onClick={abrir} aria-label={p.acao?`${p.acao}: ${p.fonte.titulo}`:undefined}>{p.acao??p.fonte.titulo}</a><button type="button" onClick={()=>onPerguntar(p.pergunta)}>Perguntar à IA</button></div>
 </article>;
}
