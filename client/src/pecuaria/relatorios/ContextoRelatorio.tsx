import {useEffect,useState} from 'react';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {SelectCampo} from '@/financeiro/SelectCampo';
import {listarAnimais,listarLotes} from '../rebanho/api';
import {reqV4} from '../rebanho/reproducao/api';

/** Busca escopada explicitamente ao sítio local da consulta, inclusive em Consolidado. */
export function ContextoRelatorio({tipo,propriedadeId,valor,onChange,historico=false}:{historico?:boolean;tipo:'animal'|'lote';propriedadeId:number;valor:string;onChange:(id:string)=>void}){
 const [busca,setBusca]=useState(''),[opcoes,setOpcoes]=useState<{id:string;nome:string}[]>([]),[erro,setErro]=useState(''),[ocupado,setOcupado]=useState(false),[revisao,setRevisao]=useState(0);
 useEffect(()=>{let ativo=true;setOcupado(true);setErro('');const timer=setTimeout(()=>{
  const historicos=()=>reqV4<{propriedadeId:number;itens:{id:string;brinco:string;nome:string|null}[]}>(`/relatorios/animais-historicos?${new URLSearchParams({busca:busca.trim(),propriedadeId:String(propriedadeId)})}`,undefined,'GET',propriedadeId).then(r=>{if(r.propriedadeId!==propriedadeId)throw Error('O resultado não pertence ao sítio da consulta.');return {itens:r.itens}});
  const chamada=tipo==='animal'?(historico?historicos():listarAnimais({busca:busca.trim(),situacao:'TODOS',page:1,pageSize:20},propriedadeId)).then(r=>r.itens.map(a=>({id:a.id,nome:`${a.brinco}${a.nome?` · ${a.nome}`:''}`}))):listarLotes({incluirInativos:true},propriedadeId).then(r=>r.filter(l=>l.nome.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))).map(l=>({id:l.id,nome:l.nome})));
  void chamada.then(r=>{if(ativo)setOpcoes(r)}).catch(e=>{if(ativo){setOpcoes([]);setErro(e instanceof Error?e.message:'Não foi possível carregar as opções.')}}).finally(()=>{if(ativo)setOcupado(false)});
 },200);return()=>{ativo=false;clearTimeout(timer)}},[tipo,propriedadeId,busca,revisao,historico]);
 return <div className="rel-contexto"><label>Buscar {tipo==='animal'?'animal':'lote'}<Input value={busca} onChange={e=>setBusca(e.target.value)} placeholder={tipo==='animal'?'Brinco ou nome':'Nome do lote'}/></label><label>{tipo==='animal'?'Animal da consulta':'Lote da consulta'}<SelectCampo value={valor} onValueChange={onChange} disabled={ocupado||!!erro}><option value="">{ocupado?'Carregando opções…':'Selecione para consultar'}</option>{valor&&!opcoes.some(o=>o.id===valor)&&<option value={valor}>Seleção preservada da consulta</option>}{opcoes.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</SelectCampo></label>{erro&&<div role="alert"><span>{erro}</span><Button size="sm" variant="outline" onClick={()=>setRevisao(v=>v+1)}>Tentar novamente</Button></div>}</div>;
}
