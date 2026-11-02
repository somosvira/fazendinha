import { RegularizarParticipacao } from "./RegularizarParticipacao";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BarraConsulta, SituacoesConsulta } from '@/financeiro/BarraConsulta';
import { CampoFiltro } from '@/financeiro/PainelFiltros';
import { SelectCampo } from '@/financeiro/SelectCampo';
import { TabelaFinanceira } from '@/financeiro/financeiro-ui';
import { navegarPara } from '../../../router';
import { formatarDataBR } from '../lib/rotulos';
import { hojeOperacional } from '../leite/modelo';
import { consultaBezerreiro } from './api';
import { faseParticipacao, litros } from './modelo';
import { ColeiraBadge, EstadoConsulta, PaginacaoBezerreiro, useConsultaBezerreiro } from './ui';
import type { Configuracao, Pagina, Participacao } from './types';
export function AnimaisBezerreiro({sitio,podeLancar,config,revisao,aoSalvar,params,mudar}: {sitio:number;podeLancar:boolean;config:Configuracao;revisao:number;aoSalvar:()=>void;params:URLSearchParams;mudar:(valores:Record<string,string>)=>void}) {
  const [entrada,setEntrada]=useState(false), [busca,setBusca]=useState(params.get('busca')??'');
  const [rascunho,setRascunho]=useState({coleira:params.get('coleira')??'',fase:params.get('fase')??''});
  const historico=params.get('historico')==='true', pagina=Math.max(1,Number(params.get('pagina'))||1);
  const q=consultaBezerreiro({historico,pagina,busca:params.get('busca'),coleiraId:params.get('coleira'),faseVersaoId:params.get('fase'),perfilId:params.get('perfil')});
  const consulta=useConsultaBezerreiro<Pagina<Participacao>>(`/participantes${q}`,sitio,revisao);
  return <><div className="bez-sectionhead"><h2>{historico?'Histórico de saídas':'Animais do bezerreiro'}</h2>{podeLancar&&!historico&&<Button variant="outline" onClick={()=>setEntrada(true)}>Regularizar participação</Button>}</div>
    <BarraConsulta resumo={`${consulta.dados?.total??'…'} animais`} criterios={[...(params.get('coleira')?[{id:'coleira',rotulo:`Coleira: ${config.coleiras.find(c=>c.id===params.get('coleira'))?.nome??'Selecionada'}`,limpar:()=>mudar({coleira:'',pagina:''})}]:[]),...(params.get('fase')?[{id:'fase',rotulo:`Fase: ${config.fases.find(c=>c.id===params.get('fase'))?.nome??'Selecionada'}`,limpar:()=>mudar({fase:'',pagina:''})}]:[])]} onLimpar={()=>mudar({coleira:'',fase:'',busca:'',pagina:''})}
      edicaoFiltros={{iniciar:()=>setRascunho({coleira:params.get('coleira')??'',fase:params.get('fase')??''}),aplicar:()=>mudar({...rascunho,pagina:''}),limpar:()=>setRascunho({coleira:'',fase:''})}}
      adicionais={<><CampoFiltro rotulo="Coleira"><SelectCampo value={rascunho.coleira} onValueChange={v=>setRascunho({...rascunho,coleira:v})}><option value="">Todas</option>{config.coleiras.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</SelectCampo></CampoFiltro><CampoFiltro rotulo="Fase"><SelectCampo value={rascunho.fase} onValueChange={v=>setRascunho({...rascunho,fase:v})}><option value="">Todas</option>{config.fases.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</SelectCampo></CampoFiltro></>}>
      <form className="bez-busca" onSubmit={e=>{e.preventDefault();mudar({busca,pagina:''});}}><input aria-label="Buscar animal" placeholder="Buscar brinco ou nome" value={busca} onChange={e=>setBusca(e.target.value)}/><Button variant="outline">Buscar</Button></form>
      <SituacoesConsulta valor={historico?'historico':'presentes'} rotulo="Participação no bezerreiro" opcoes={[{valor:'presentes',texto:'Presentes'},{valor:'historico',texto:'Histórico de saídas'}]} onChange={v=>mudar({historico:v==='historico'?'true':'',pagina:''})}/>
    </BarraConsulta>
    <EstadoConsulta {...consulta} carregando={!consulta.dados}>{consulta.dados&&(consulta.dados.total===0?<p className="bez-estado">{params.get('busca')||params.get('coleira')||params.get('fase')?'Nenhum animal corresponde aos filtros. Ajuste ou limpe os critérios.':historico?'Nenhuma saída registrada.':'Nenhum animal participa do bezerreiro neste sítio.'}</p>:<><TabelaFinanceira rotulo={historico?'Histórico de saídas do bezerreiro':'Animais presentes no bezerreiro'} itens={consulta.dados.itens} chaveDe={p=>p.id} colunas={[
      {chave:'brinco',titulo:'Brinco',celula:p=>p.animal.brinco},
      {chave:'nome',titulo:'Nome',principal:true,celula:p=><button className="bez-link" onClick={()=>navegarPara(`/pecuaria/bezerreiro/animais/${p.animalId}`)}>{p.animal.nome??'Sem nome'}</button>},
      ...(historico?[{chave:'entrada',titulo:'Entrada',celula:(p:Participacao)=>formatarDataBR(p.desde)},{chave:'saida',titulo:'Saída',celula:(p:Participacao)=>p.ate?formatarDataBR(p.ate):'—'},{chave:'motivo',titulo:'Motivo',celula:(p:Participacao)=>p.motivoSaida??'Não informado'}]:[
        {chave:'idade',titulo:'Idade',celula:(p:Participacao)=>p.animal.dataNascimento?`${Math.max(0,Math.floor((new Date(hojeOperacional()).getTime()-new Date(p.animal.dataNascimento).getTime())/86400000))} dias`:'Não informada'},
        {chave:'fase',titulo:'Fase',celula:(p:Participacao)=>faseParticipacao(p)?.nome??'Sem programação'},
        {chave:'coleira',titulo:'Coleira',celula:(p:Participacao)=><ColeiraBadge nome={faseParticipacao(p)?.coleira?.nome} cor={faseParticipacao(p)?.coleira?.cor}/>},
        {chave:'leite',titulo:'Leite/dia',alinhamento:'direita' as const,celula:(p:Participacao)=>litros(faseParticipacao(p)?.litrosDia)},
      ]),
      {chave:'acao',titulo:'Ação',acoes:true,celula:p=><Button variant="outline" onClick={()=>navegarPara(`/pecuaria/bezerreiro/animais/${p.animalId}`)}>{historico?'Ver histórico':'Acompanhar'}</Button>},
    ]}/><PaginacaoBezerreiro pagina={pagina} total={consulta.dados.total} mudar={p=>mudar({pagina:String(p)})}/></>)}</EstadoConsulta>
    {entrada&&<RegularizarParticipacao sitio={sitio} config={config} aoFechar={()=>setEntrada(false)} aoSalvar={()=>{setEntrada(false);aoSalvar();}}/>}
  </>;
}
