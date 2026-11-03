import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DatePicker } from '@/components/DatePicker';
import { AjudaCampo } from '@/components/Dica';
import { getPropriedadeAtiva } from '../../../propriedadeScope';
import { consultarLeite } from './operacoes-api';
import { hojeOperacional, dataValida } from './modelo';
import { resumirOperacionalPeriodo, type ResumoOperacionalProducao } from './resumo-producao';
import { DistribuicaoConsumoLeite } from './DistribuicaoConsumoLeite';
export function ResumoDestinosLeite({ revisao = 0 }: {revisao?:number}) {
  const sitio=getPropriedadeAtiva();
  const [data,setData]=useState(()=>{const v=new URLSearchParams(location.search).get('producaoData');return dataValida(v)?v!:hojeOperacional()});
  const [dados,setDados]=useState<ResumoOperacionalProducao|null>(null),[erro,setErro]=useState(''),[tentativa,setTentativa]=useState(0);
  useEffect(()=>{let ativa=true;setDados(null);setErro('');if(!dataValida(data))return;
    void consultarLeite<ResumoOperacionalProducao>(`/consultas-producao/resumo-operacional?${new URLSearchParams({inicio:data,fim:data})}`,sitio)
      .then(r=>{if(ativa)setDados(r)}).catch(e=>{if(ativa)setErro(e instanceof Error?e.message:'Não foi possível consultar os destinos.')});
    return()=>{ativa=false};
  },[sitio,data,revisao,tentativa]);
  return <Card className="leite-resumo-destinos"><header><h2>Distribuição do dia<AjudaCampo rotulo="Sobre a distribuição do dia" texto="Alimentação inclui os fornecimentos nutricionais e destinos diretos confirmados deste sítio. Os históricos abaixo têm seus próprios filtros e conservam os estornos. Casa e Funcionários são retiradas internas rastreadas, separadas de alimentação animal e descarte físico."/></h2><label>Data do resumo<DatePicker aria-label="Data do resumo de destinos" value={data} onChange={setData}/></label></header>
    {erro?<div role="alert">{erro}<Button variant="outline" onClick={()=>setTentativa(v=>v+1)}>Tentar novamente</Button></div>:<DistribuicaoConsumoLeite dados={dados?resumirOperacionalPeriodo(dados.dias,data):null} carregando={!dados}/>}
  </Card>;
}
