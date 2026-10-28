import { useEffect, useState } from 'react';
import { Baby, HeartPulse, Milk, Wallet, FlaskConical, Settings2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/financeiro/financeiro-ui';
import { SubTabs } from '@/components/SubTabs';
import { getPropriedadeAtiva } from '../../../propriedadeScope';
import { navegarPara } from '../../../router';
import { executarComGuardaNavegacao } from '../../../navegacaoGuardada';
import { AnimaisBezerreiro } from './AnimaisBezerreiro';
import { AlimentacaoBezerreiro } from './AlimentacaoBezerreiro';
import { ColostragemBezerreiro } from './ColostragemBezerreiro';
import { AcompanhamentoBezerreiro } from './AcompanhamentoBezerreiro';
import { CustosBezerreiro, SanidadeBezerreiro } from './ConsultasBezerreiro';
import { EstadoConsulta, useConsultaBezerreiro } from './ui';
import type { Configuracao } from './types';
import './bezerreiro.css';
const rotinas=[{id:'animais',label:'Animais',icon:Baby},{id:'alimentacao',label:'Alimentação',icon:Milk},{id:'colostragem',label:'Colostragem',icon:FlaskConical},{id:'sanidade',label:'Sanidade',icon:HeartPulse},{id:'custos',label:'Custos',icon:Wallet}];
export function BezerreiroModulo({podeLancar}: {podeLancar:boolean}) {
  const sitio=getPropriedadeAtiva(),[localizacao,setLocalizacao]=useState(()=>location.pathname+location.search),[revisao,setRevisao]=useState(0);
  useEffect(()=>{const atualizar=()=>setLocalizacao(location.pathname+location.search);window.addEventListener('popstate',atualizar);return()=>window.removeEventListener('popstate',atualizar);},[]);
  const url=new URL(localizacao,location.origin),params=url.searchParams,aba=rotinas.some(r=>r.id===params.get('aba'))?params.get('aba')!:'animais',animalId=/^\/pecuaria\/bezerreiro\/animais\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  const consulta=useConsultaBezerreiro<Configuracao>('/configuracoes',sitio,revisao);
  function mudar(valores:Record<string,string>){const nova=new URL(location.href);for(const[k,v]of Object.entries(valores))if(v)nova.searchParams.set(k,v);else nova.searchParams.delete(k);void executarComGuardaNavegacao(()=>navegarPara(nova.pathname+nova.search));}
  function selecionar(id:string){void executarComGuardaNavegacao(()=>navegarPara(`/pecuaria/bezerreiro?aba=${id}`));}
  return <div className="bezerreiro bez-modulo"><PageHeader titulo="Bezerreiro" acao={<div className="bez-acoes">{animalId&&<Button variant="outline" onClick={()=>selecionar('animais')}><ArrowLeft size={16} aria-hidden/>Animais</Button>}<Button variant="outline" onClick={()=>navegarPara('/configuracoes/pecuaria/producao/bezerreiro')}><Settings2 size={16} aria-hidden/>Configurações</Button></div>}/><SubTabs variant="financeiro" ariaLabel="Rotinas do bezerreiro" tabs={rotinas} active={animalId?'animais':aba} onSelect={selecionar}/><div className="bez-superficie">
    {sitio==null?<p className="bez-estado">Selecione um sítio para consultar o bezerreiro.</p>:animalId?<AcompanhamentoBezerreiro animalId={animalId} sitio={sitio} podeLancar={podeLancar}/>:<EstadoConsulta {...consulta} carregando={!consulta.dados}>{consulta.dados&&(aba==='animais'?<AnimaisBezerreiro sitio={sitio} config={consulta.dados} podeLancar={podeLancar} revisao={revisao} aoSalvar={()=>setRevisao(n=>n+1)} params={params} mudar={mudar}/>:aba==='alimentacao'?<AlimentacaoBezerreiro sitio={sitio} config={consulta.dados} podeLancar={podeLancar} revisao={revisao} aoSalvar={()=>setRevisao(n=>n+1)} params={params} mudar={mudar}/>:aba==='colostragem'?<ColostragemBezerreiro sitio={sitio} config={consulta.dados} podeLancar={podeLancar} revisao={revisao} aoSalvar={()=>setRevisao(n=>n+1)} params={params} mudar={mudar}/>:aba==='sanidade'?<SanidadeBezerreiro sitio={sitio} params={params} mudar={mudar} revisao={revisao} podeLancar={podeLancar} aoSalvar={()=>setRevisao(n=>n+1)}/>:<CustosBezerreiro sitio={sitio} params={params} mudar={mudar} revisao={revisao}/>)}</EstadoConsulta>}
  </div></div>;
}
