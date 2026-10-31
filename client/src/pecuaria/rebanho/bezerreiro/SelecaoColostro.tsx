import { useState } from 'react';
import { SelectCampo } from '@/financeiro/SelectCampo';
import { Button } from '@/components/ui/button';
import { consultaBezerreiro, consultarBezerreiro } from './api';
import { PaginacaoBezerreiro, RecuperacaoConflito, useConsultaBezerreiro, useRecuperacaoConflito } from './ui';
import { formatarDataBR } from '../lib/rotulos';
import type { ContextoBezerreiro, OrigemColostro } from './types';
export type PartoColostro = Omit<ContextoBezerreiro['partos'][number],'matrizId'> & {matrizId:string|null};
export type PartosColostro = {itens:PartoColostro[];selecionado:PartoColostro|null;total:number;pagina:number;porPagina:number};
export function usePartosColostro(sitio:number,data:string,valor:string,alvo:'MATRIZ'|'CRIA') {
  const [busca,setBusca]=useState(''),[pagina,setPagina]=useState(1);
  const path=`/colostro/partos${consultaBezerreiro({data,alvo,busca,pagina,porPagina:20,...(alvo==='MATRIZ'?{partoId:valor||undefined}:{criaId:valor||undefined})})}`;
  const consulta=useConsultaBezerreiro<PartosColostro>(path,sitio);
  const selecionado=consulta.dados?.selecionado??null;
  const itens=[...(selecionado?[selecionado]:[]),...(consulta.dados?.itens??[]).filter(p=>p.id!==selecionado?.id)];
  const valido=!!selecionado&&(alvo==='MATRIZ'?selecionado.id===valor:selecionado.crias.some(c=>c.id===valor));
  return {...consulta,itens,selecionado,valido,busca,pagina,setBusca:(v:string)=>{setBusca(v);setPagina(1);},setPagina};
}
export function SelecaoColostro({consulta,valor,alvo,aoSelecionar}:{consulta:ReturnType<typeof usePartosColostro>;valor:string;alvo:'MATRIZ'|'CRIA';aoSelecionar:(v:string)=>void}) {
  return <div className="bez-campo"><label>Buscar {alvo==='MATRIZ'?'parto / matriz':'cria'} por brinco ou nome<input type="search" value={consulta.busca} onChange={e=>consulta.setBusca(e.target.value)}/></label>
    <label>{alvo==='MATRIZ'?'Parto / matriz':'Cria destinatária'}<SelectCampo required={alvo==='MATRIZ'} value={valor} onValueChange={aoSelecionar}>
      <option value="">{alvo==='MATRIZ'?'Selecione um parto existente':'Somente banco / selecione a cria'}</option>
      {valor&&!consulta.itens.some(p=>alvo==='MATRIZ'?p.id===valor:p.crias.some(c=>c.id===valor))&&<option value={valor}>Seleção {valor} · {consulta.dados?'indisponível nesta data':'revalidando…'}</option>}
      {consulta.itens.flatMap(p=>alvo==='MATRIZ'?[<option key={p.id} value={p.id}>{p.matriz.brinco} · {p.matriz.nome??'Sem nome'} · {formatarDataBR(p.data)}</option>]:p.crias.map(c=><option key={c.id} value={c.id}>{c.animal?.brinco??'Cria cadastrada'} · {c.animal?.nome??'Sem nome'} · nascimento {formatarDataBR(p.data)}</option>))}
    </SelectCampo></label>
    {consulta.erro&&<p role="alert" className="bez-erro">{consulta.erro}<Button type="button" variant="outline" onClick={consulta.tentar}>Tentar novamente</Button></p>}
    {!consulta.erro&&!consulta.dados&&<p role="status">Carregando seleção nesta data…</p>}
    {valor&&consulta.dados&&!consulta.valido&&<p role="alert" className="bez-aviso">A seleção não está disponível neste sítio e data. Escolha outro registro; os demais campos foram preservados.</p>}
    {consulta.dados&&<PaginacaoBezerreiro pagina={consulta.pagina} total={consulta.dados.total} tamanho={consulta.dados.porPagina} mudar={consulta.setPagina}/>}
  </div>;
}
export function useOrigemConferida(sitio:number,origem:OrigemColostro,contexto:ContextoBezerreiro,data:string,alvo:string) {
 const identidade=JSON.stringify([sitio,origem.id,data,alvo]);
 const recuperacao=useRecuperacaoConflito(identidade,async()=>{const [atual,novoContexto]=await Promise.all([consultarBezerreiro<OrigemColostro>(`/colostro/origens/${origem.id}`,sitio),consultarBezerreiro<ContextoBezerreiro>(`/contexto${consultaBezerreiro({data})}`,sitio)]);return{origem:atual,contexto:novoContexto};});
 return {recuperacao,origem:recuperacao.conferido?recuperacao.atual!.origem:origem,contexto:recuperacao.conferido?recuperacao.atual!.contexto:contexto,identidade};
}
export function ConferirOrigemColostro({estado,conflito,aoConferir}:{estado:ReturnType<typeof useOrigemConferida>;conflito:boolean;aoConferir?:()=>void}) {
 const r=estado.recuperacao;
 return <RecuperacaoConflito conflito={conflito} carregando={r.carregando} erro={r.erro} atualizado={!!r.atual} conferido={r.conferido} aoAtualizar={()=>void r.atualizar()} aoConferir={()=>{r.conferir();aoConferir?.();}}>{r.atual&&<p>Versão {estado.origem.versao} → {r.atual.origem.versao} · volume livre {r.atual.origem.livreLitros} L · Brix {r.atual.origem.brix.resultado??'não aferido'} · situação {r.atual.origem.status}. Confira também data, destinatário e quantidades preservadas.</p>}</RecuperacaoConflito>;
}
export function aguardaConferencia(conflito:boolean,estado:ReturnType<typeof useOrigemConferida>){return (conflito||!!estado.recuperacao.atual)&&!estado.recuperacao.conferido;}
