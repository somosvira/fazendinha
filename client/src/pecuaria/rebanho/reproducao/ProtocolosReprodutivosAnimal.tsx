import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { BuscaLista } from "../../../components/BuscaLista";
import { DateRangePicker, isoDate, type DateRange } from "../../../components/DateRangePicker";
import { Button } from "../../../components/ui/button";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO } from "../../../lib/hoje";
import { navegarPara } from "../../../router";
import { Paginacao } from "../ui";
import { consultaProtocolo, reqProtocolo } from "../protocolos/api";
import type { PaginaProtocolo } from "../protocolos/EtapasProtocolo";
import type { FatoHistorico } from "./HistoricoReprodutivo";
import "./protocolos-ficha.css";

type ParticipacaoFicha = { id:string;animalId:string;propriedadeId:number|null;protocolo:{id:string;nome:string;versao:number};programacao:{id:string;nome:string}|null;inicioReferencia:string;inicioEfetivo:string|null;dataInicio?:string;encerradoEm:string|null;motivoEncerramento:string|null;fase:{escopoCompleto?:boolean;total:number;atendidas:number;situacao:string;atual:{nome:string;numero:number;situacao:string}|null} };
const listar = (animalId:string,propriedadeId:number|undefined,pagina:number,busca?:string,inicio?:string,fim?:string,participacaoId?:string) => reqProtocolo<PaginaProtocolo<ParticipacaoFicha>>(`/ficha-animal${consultaProtocolo({animalId,pagina,busca,inicio,fim,participacaoId})}`,propriedadeId);
export function urlParticipacaoReprodutiva(p:Pick<ParticipacaoFicha,"id"|"programacao">, propriedadeId?:number) {
  const q=new URLSearchParams({retorno:window.location.pathname+window.location.search+window.location.hash});
  if(propriedadeId!=null)q.set("sitio",String(propriedadeId));
  if(p.programacao)q.set("participacaoId",p.id);
  return `/pecuaria/reproducao/${p.programacao?"programacoes":"participacoes"}/${encodeURIComponent(p.programacao?.id??p.id)}?${q}`;
}
const rotulos:Record<string,string>={ENCERRADO:"Participação encerrada",CONCLUIDO:"Concluído",EM_ANDAMENTO:"Em andamento",ETAPAS_ENCERRADAS:"Etapas encerradas",SEM_ETAPAS:"Etapas não informadas",ESCOPO_PARCIAL:"Fase geral não aferida neste sítio"};
const situacoesEtapa:Record<string,string>={ADIADO:"Etapa adiada",NAO_ATENDIDO:"Etapa não atendida",REGULARIZACAO_PENDENTE:"Regularização pendente",SEM_REGISTRO:"Etapa pendente",PREVISTO:"Etapa prevista",ACOMPANHAMENTO_PENDENTE:"Acompanhamento pendente"};
export function ProtocolosReprodutivosAnimal({animalId,propriedadeId,revisao=0}: {animalId:string;propriedadeId?:number;podeLancar?:boolean;aoSalvar?:()=>void;revisao?:number}) {
  const [busca,setBusca]=useState("");const [periodo,setPeriodo]=useState<DateRange>({start:null,end:null});const [pagina,setPagina]=useState(1);
  const [dados,setDados]=useState<PaginaProtocolo<ParticipacaoFicha>|null>(null);const [erro,setErro]=useState<string|null>(null);const [repetir,setRepetir]=useState(0);
  const selecionadaUrl=()=>window.location.hash==="#reproducao"?new URLSearchParams(window.location.search).get("participacaoId"):null;
  const [selecionadaId,setSelecionadaId]=useState(selecionadaUrl);const [selecionada,setSelecionada]=useState<ParticipacaoFicha|null>(null);
  useEffect(()=>{const restaurar=()=>setSelecionadaId(selecionadaUrl());window.addEventListener("popstate",restaurar);return()=>window.removeEventListener("popstate",restaurar);},[]);
  useEffect(()=>{let vivo=true;setSelecionada(null);if(selecionadaId)void listar(animalId,propriedadeId,1,undefined,undefined,undefined,selecionadaId).then(d=>{if(vivo)setSelecionada(d.itens.find(p=>p.id===selecionadaId)??null);}).catch(e=>{if(vivo)setErro(e instanceof Error?e.message:String(e));});return()=>{vivo=false;};},[animalId,propriedadeId,selecionadaId,revisao]);
  useEffect(()=>{if(!selecionada)return;document.getElementById("protocolos-reprodutivos-animal")?.dispatchEvent(new Event("revelar-secao"));requestAnimationFrame(()=>document.getElementById(`participacao-protocolo-${selecionada.id}`)?.scrollIntoView?.({block:"center"}));},[selecionada]);
  const inicio=periodo.start?isoDate(periodo.start):undefined,fim=periodo.end?isoDate(periodo.end):undefined;
  useEffect(()=>{let vivo=true;setDados(null);setErro(null);listar(animalId,propriedadeId,pagina,busca,inicio,fim).then(d=>{if(vivo)setDados(d);}).catch(e=>{if(vivo)setErro(e instanceof Error?e.message:String(e));});return()=>{vivo=false;};},[animalId,propriedadeId,pagina,busca,inicio,fim,revisao,repetir]);
  return <div className="repro-protocolos-ficha">
    <div className="repro-protocolos-toolbar"><BuscaLista rotulo="Buscar protocolo" placeholder="Buscar protocolo" valor={busca} onChange={v=>{setBusca(v);setPagina(1);}}/><DateRangePicker value={periodo} onChange={v=>{setPeriodo(v);setPagina(1);}} allowAll showIcon triggerAriaLabel="Período dos protocolos"/></div>
    <ErrorBox erro={erro}/>{erro&&<Button variant="outline" onClick={()=>setRepetir(v=>v+1)}>Tentar novamente</Button>}
    {!dados&&!erro&&<p role="status">Consultando protocolos…</p>}
    {(selecionada?[selecionada,...(dados?.itens??[]).filter(p=>p.id!==selecionada.id)]:dados?.itens??[]).map(p=><article id={`participacao-protocolo-${p.id}`} aria-label={p.id===selecionada?.id?"Participação selecionada":undefined} className={`repro-protocolo-compacto ${p.id===selecionada?.id?"ring-2 ring-primary":""}`} key={p.id}><span className="repro-protocolo-icone"><ClipboardList size={23} aria-hidden/></span><div><h3>{p.protocolo.nome} · v{p.protocolo.versao}</h3><p>{p.programacao?"Coletiva":"Individual"} · {p.inicioEfetivo?`Início: ${formatBRDateISO(p.dataInicio??p.inicioEfetivo)}`:`Início previsto: ${formatBRDateISO(p.dataInicio??p.inicioReferencia)}`}</p>{p.programacao&&<small>{p.programacao.nome}</small>}</div><div className="repro-protocolo-fase"><strong>{p.fase.escopoCompleto===false?p.fase.atual?`Etapa neste sítio: ${p.fase.atual.nome}`:`${p.fase.atendidas} etapas atendidas neste sítio`:p.fase.atual?`${p.fase.atual.nome} · etapa ${p.fase.atual.numero} de ${p.fase.total}`:`${p.fase.atendidas} de ${p.fase.total} etapas atendidas`}</strong><span>{!p.inicioEfetivo&&!p.encerradoEm?"Início não confirmado":rotulos[p.fase.situacao]??p.fase.situacao}{p.fase.atual&&<> · {situacoesEtapa[p.fase.atual.situacao]??p.fase.atual.situacao}</>}</span></div><Button asChild><a href={urlParticipacaoReprodutiva(p,propriedadeId)} onClick={e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey){e.preventDefault();navegarPara(urlParticipacaoReprodutiva(p,propriedadeId));}}}>Ver protocolo</a></Button></article>)}
    {dados&&!dados.total&&!selecionada&&<p className="repro-protocolos-vazio"><ClipboardList aria-hidden size={24}/>Nenhum protocolo reprodutivo encontrado neste período e busca.</p>}
    {dados&&dados.total>10&&<Paginacao paginaAtual={dados.pagina} totalPaginas={Math.ceil(dados.total/10)} totalItens={dados.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="protocolos" idSelect="protocolos-reprodutivos-ficha"/>}
  </div>;
}

/** O histórico da ficha já reúne os fatos individuais antes de paginar. Cada leitura pública permanece limitada a dez. */
export function useHistoricoProtocolosReprodutivos(animalId:string,propriedadeId?:number,revisao=0) {
  const [eventos,setEventos]=useState<FatoHistorico[]>([]);const [erro,setErro]=useState<string|null>(null);
  useEffect(()=>{let vivo=true;setEventos([]);setErro(null);
    void (async()=>{const participacoes:ParticipacaoFicha[]=[];let pagina=1;let total=1;while(participacoes.length<total){const d=await listar(animalId,propriedadeId,pagina);participacoes.push(...d.itens);total=d.total;if(!d.itens.length)break;pagina++;if(!vivo)return;}
      const fatos=participacoes.flatMap(p=>{const base={id:p.id,animalId,grupo:"Protocolo",propriedadeId:p.propriedadeId,registro:p.protocolo.nome,urlDetalhe:urlParticipacaoReprodutiva(p,propriedadeId)};
        return [...(p.inicioEfetivo?[{...base,data:p.dataInicio??p.inicioEfetivo,tipo:"PROTOCOLO_INICIADO",resultado:"Iniciado",chaveHistorico:`protocolo:inicio:${p.id}`}]:[]),...(p.encerradoEm?[{...base,data:p.encerradoEm,tipo:"PROTOCOLO_ENCERRADO",resultado:"Participação encerrada",motivo:p.motivoEncerramento,chaveHistorico:`protocolo:encerramento:${p.id}`}]:[])];});if(vivo)setEventos(fatos);
    })().catch(e=>{if(vivo)setErro(e instanceof Error?e.message:String(e));});return()=>{vivo=false;};
  },[animalId,propriedadeId,revisao]);
  return {eventos,erro};
}
