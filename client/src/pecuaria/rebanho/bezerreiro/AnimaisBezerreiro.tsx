import { RegularizarParticipacao } from "./RegularizarParticipacao";
import { useEffect, useState } from 'react';
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from '@/components/VisualizacaoConsulta';
import { BuscaLista } from '@/components/BuscaLista';
import { Button } from '@/components/ui/button';
import { BarraConsulta } from '@/financeiro/BarraConsulta';
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
function idadeParticipante(p: Participacao) {
  const nascimento = p.animal.dataNascimento;
  if (!nascimento) return 'Não informada';
  const dias = Math.floor((new Date(hojeOperacional()).getTime() - new Date(nascimento).getTime()) / 86400000);
  return `${Math.max(0, dias)} dias`;
}

function abrirParticipante(p: Participacao) {
  navegarPara(`/pecuaria/bezerreiro/animais/${p.animalId}`);
}

function CartoesAnimais({ itens, historico, rotulo }: { itens: Participacao[]; historico: boolean; rotulo: string }) {
  return <ul className="bez-animais-cartoes" aria-label={rotulo}>
    {itens.map(p => {
      const fase = faseParticipacao(p);
      return <li key={p.id} className="bez-animal-cartao">
        <div className="bez-animal-cartao-topo">
          <div>
            <strong>{p.animal.nome ?? 'Sem nome'}</strong>
            <span className="bez-animal-brinco">Brinco {p.animal.brinco}</span>
          </div>
          {!historico && <span className="bez-selo"><ColeiraBadge nome={fase?.coleira?.nome} cor={fase?.coleira?.cor} /></span>}
        </div>
        <div className="bez-animal-cartao-corpo">
          <dl>
            {historico ? <>
              <div><dt>Entrada</dt><dd>{formatarDataBR(p.desde)}</dd></div>
              <div><dt>Saída</dt><dd>{p.ate ? formatarDataBR(p.ate) : '—'}</dd></div>
              <div><dt>Motivo</dt><dd>{p.motivoSaida ?? 'Não informado'}</dd></div>
            </> : <>
              <div><dt>Idade</dt><dd>{idadeParticipante(p)}</dd></div>
              <div><dt>Fase</dt><dd>{fase?.nome ?? 'Sem programação'}</dd></div>
              <div><dt>Leite/dia</dt><dd>{litros(fase?.litrosDia)}</dd></div>
            </>}
          </dl>
          <Button variant="ghost" size="sm" onClick={() => abrirParticipante(p)}
            aria-label={`${historico ? 'Ver histórico' : 'Acompanhar'} · ${p.animal.nome ?? 'Sem nome'} · ${p.animal.brinco}`}>
            {historico ? 'Ver histórico' : 'Acompanhar'} <span aria-hidden>›</span>
          </Button>
        </div>
      </li>;
    })}
  </ul>;
}

export function AnimaisBezerreiro({sitio,podeLancar,config,revisao,aoSalvar,params,mudar}: {sitio:number;podeLancar:boolean;config:Configuracao;revisao:number;aoSalvar:()=>void;params:URLSearchParams;mudar:(valores:Record<string,string>)=>void}) {
  const [entrada,setEntrada]=useState(false), [busca,setBusca]=useState(params.get('busca')??'');
  // Busca enquanto digita, como as demais listas; a espera evita uma consulta por tecla.
  useEffect(()=>{if(busca===(params.get('busca')??''))return;const t=setTimeout(()=>mudar({busca,pagina:''}),300);return()=>clearTimeout(t);},[busca]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rascunho,setRascunho]=useState({coleira:params.get('coleira')??'',fase:params.get('fase')??'',historico:params.get('historico')??''});
  const historico=params.get('historico')==='true', pagina=Math.max(1,Number(params.get('pagina'))||1);
  const visual = useVisualizacaoConsulta("visualAnimaisBezerreiro", "bezerreiro", "visual");
  const rotulo = historico ? "Histórico de saídas do bezerreiro" : "Animais presentes no bezerreiro";
  const q=consultaBezerreiro({historico,pagina,busca:params.get('busca'),coleiraId:params.get('coleira'),faseVersaoId:params.get('fase'),perfilId:params.get('perfil')});
  const consulta=useConsultaBezerreiro<Pagina<Participacao>>(`/participantes${q}`,sitio,revisao);
  return <><div className="bez-sectionhead"><h2>{historico?'Histórico de saídas':'Animais do bezerreiro'}</h2>{podeLancar&&!historico&&<Button variant="outline" onClick={()=>setEntrada(true)}>Regularizar participação</Button>}</div>
    <BarraConsulta resumo={`${consulta.dados?.total??'…'} animais`} criterios={[...(historico?[{id:'historico',rotulo:'Histórico de saídas',limpar:()=>mudar({historico:'',pagina:''})}]:[]),...(params.get('coleira')?[{id:'coleira',rotulo:`Coleira: ${config.coleiras.find(c=>c.id===params.get('coleira'))?.nome??'Selecionada'}`,limpar:()=>mudar({coleira:'',pagina:''})}]:[]),...(params.get('fase')?[{id:'fase',rotulo:`Fase: ${config.fases.find(c=>c.id===params.get('fase'))?.nome??'Selecionada'}`,limpar:()=>mudar({fase:'',pagina:''})}]:[])]} onLimpar={()=>mudar({coleira:'',fase:'',historico:'',busca:'',pagina:''})}
      edicaoFiltros={{iniciar:()=>setRascunho({coleira:params.get('coleira')??'',fase:params.get('fase')??'',historico:params.get('historico')??''}),aplicar:()=>mudar({...rascunho,pagina:''}),limpar:()=>setRascunho({coleira:'',fase:'',historico:''})}}
      adicionais={<><CampoFiltro rotulo="Participação no bezerreiro"><SelectCampo aria-label="Participação no bezerreiro" value={rascunho.historico} onValueChange={v=>setRascunho({...rascunho,historico:v})}><option value="">Presentes</option><option value="true">Histórico de saídas</option></SelectCampo></CampoFiltro><CampoFiltro rotulo="Coleira"><SelectCampo value={rascunho.coleira} onValueChange={v=>setRascunho({...rascunho,coleira:v})}><option value="">Todas</option>{config.coleiras.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</SelectCampo></CampoFiltro><CampoFiltro rotulo="Fase"><SelectCampo value={rascunho.fase} onValueChange={v=>setRascunho({...rascunho,fase:v})}><option value="">Todas</option>{config.fases.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</SelectCampo></CampoFiltro></>}>
      <BuscaLista rotulo="Buscar animal" placeholder="Buscar brinco ou nome" valor={busca} onChange={setBusca}/>
      <AlternarVisualizacaoConsulta {...visual} rotulo="Visualização dos animais do bezerreiro" />
    </BarraConsulta>
    <EstadoConsulta {...consulta} carregando={!consulta.dados}>{consulta.dados&&(consulta.dados.total===0?<p className="bez-estado">{params.get('busca')||params.get('coleira')||params.get('fase')?'Nenhum animal corresponde aos filtros. Ajuste ou limpe os critérios.':historico?'Nenhuma saída registrada.':'Nenhum animal participa do bezerreiro neste sítio.'}</p>:<>{visual.modo === "visual" ? <CartoesAnimais itens={consulta.dados.itens} historico={historico} rotulo={rotulo} /> : <TabelaFinanceira visualizacao="tabela" rotulo={rotulo} itens={consulta.dados.itens} chaveDe={p=>p.id} colunas={[
      {chave:'brinco',titulo:'Brinco',celula:p=>p.animal.brinco},
      {chave:'nome',titulo:'Nome',principal:true,celula:p=><button className="bez-link" onClick={()=>abrirParticipante(p)}>{p.animal.nome??'Sem nome'}</button>},
      ...(historico?[{chave:'entrada',titulo:'Entrada',celula:(p:Participacao)=>formatarDataBR(p.desde)},{chave:'saida',titulo:'Saída',celula:(p:Participacao)=>p.ate?formatarDataBR(p.ate):'—'},{chave:'motivo',titulo:'Motivo',celula:(p:Participacao)=>p.motivoSaida??'Não informado'}]:[
        {chave:'idade',titulo:'Idade',celula:idadeParticipante},
        {chave:'fase',titulo:'Fase',celula:(p:Participacao)=>faseParticipacao(p)?.nome??'Sem programação'},
        {chave:'coleira',titulo:'Coleira',celula:(p:Participacao)=><ColeiraBadge nome={faseParticipacao(p)?.coleira?.nome} cor={faseParticipacao(p)?.coleira?.cor}/>},
        {chave:'leite',titulo:'Leite/dia',alinhamento:'direita' as const,celula:(p:Participacao)=>litros(faseParticipacao(p)?.litrosDia)},
      ]),
      {chave:'acao',titulo:'Ação',acoes:true,celula:p=><Button variant="outline" onClick={()=>abrirParticipante(p)}>{historico?'Ver histórico':'Acompanhar'}</Button>},
    ]}/>}<PaginacaoBezerreiro pagina={pagina} total={consulta.dados.total} mudar={p=>mudar({pagina:String(p)})}/></>)}</EstadoConsulta>
    {entrada&&<RegularizarParticipacao sitio={sitio} config={config} aoFechar={()=>setEntrada(false)} aoSalvar={()=>{setEntrada(false);aoSalvar();}}/>}
  </>;
}
