import {useEffect,useRef,useState} from "react";
import {DialogFinanceiro} from "@/financeiro/DialogFinanceiro";
import {Button,ErrorBox} from "@/financeiro/financeiro-ui";
import {FormAplicacaoServico} from "../sanidade/FormAplicacaoServico";
import {reqSanidade,type AplicacaoInput} from "../sanidade/api";
import {consultarDetalhe,type ParticipanteAlerta} from "./api";
import {montarAplicacoesAlertas} from "./coletivo";
export function AplicacaoColetivaAlertas({participantes,onFechar,onSalvo}:{participantes:ParticipanteAlerta[];onFechar:()=>void;onSalvo:()=>void}){
 const [produto,setProduto]=useState<string|null>(null),[erro,setErro]=useState<string|null>(null),[tentativa,setTentativa]=useState(0);
 const chave=useRef(crypto.randomUUID());
 useEffect(()=>{let vivo=true;setErro(null);setProduto(null);Promise.all(participantes.map(p=>consultarDetalhe(p.id,p.propriedadeId??undefined))).then(detalhes=>{if(!vivo)return;const produtoId=detalhes[0]?.origem.produto?.id;if(!participantes.length||participantes.length>100||participantes.some(p=>p.propriedadeId==null||p.propriedadeId!==participantes[0].propriedadeId)||!produtoId||detalhes.some((d,i)=>d.revisao!==participantes[i].revisao||!d.acoes.includes("REGISTRAR_APLICACAO")||d.origem.produto?.id!==produtoId))throw new Error("O atendimento coletivo exige até 100 animais do mesmo sítio e cuidado com aplicação disponível. Confira a seleção.");setProduto(produtoId)}).catch(e=>{if(vivo)setErro(e instanceof Error?e.message:"Falha ao conferir a seleção")});return()=>{vivo=false}},[participantes,tentativa]);
 async function confirmar(itens:AplicacaoInput[]){const payload=montarAplicacoesAlertas(participantes,itens,produto!);await reqSanidade("/aplicacoes/coletivas",{method:"POST",body:JSON.stringify({chave:chave.current,propriedadeId:participantes[0].propriedadeId,itens:payload})},participantes[0].propriedadeId!);onSalvo()}
 if(produto&&!erro)return <FormAplicacaoServico animalId={participantes[0].animalId} propriedadeId={participantes[0].propriedadeId!} animais={participantes.map(p=>({id:p.animalId,brinco:p.brinco,propriedadeId:p.propriedadeId}))} parametrosIniciais={{produtoId:produto,dose:"",unidade:""}} onConferirConjunto={confirmar} aoEditarExecucao={()=>{chave.current=crypto.randomUUID()}} onSalvo={onSalvo} onFechar={onFechar}/>;
 return <DialogFinanceiro titulo={`Registrar aplicação · ${participantes.length} animais`} eyebrow="" onClose={onFechar}>{erro?<div className="p-5"><ErrorBox erro={erro}/><Button secondary onClick={()=>setTentativa(v=>v+1)}>Conferir novamente</Button></div>:<p className="p-5" role="status">Conferindo o cuidado e os animais selecionados…</p>}</DialogFinanceiro>
}
