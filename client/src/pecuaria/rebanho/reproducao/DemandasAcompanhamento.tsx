import {useEffect,useRef,useState} from "react";
import {ChevronDown, Settings2} from "lucide-react";
import {reqV4,type PainelReprodutivo} from "./api";
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell} from "../../../components/ui/table";
import {Button,ErrorBox,Pill} from "../../../financeiro/financeiro-ui";
import {formatBRDateISO} from "../../../lib/hoje";
import {classeInput} from "../../../financeiro/PainelCadastro";
import type {PoliticaAcompanhamento} from "./ConfiguracaoAcompanhamento";
export type DemandaAcompanhamento={id:string;tarefaId?:string|null;finalidade:"DIAGNOSTICO"|"RECONFIRMACAO";ocorrencia:number;tentativaId:string|null;gestacaoId:string|null;previstaPara:string;estado:string;motivoEncerramento:string|null;regraSnapshot:{politicaVersao:number;tipoExameId?:string|null;tipoExameVersao?:number|null};exameResolucaoId:string|null;pendencias?:string[]};
export function DemandasAcompanhamento({animalId,propriedadeId,painel,podeLancar,onAvaliar,atualizacao,onMudou}:{animalId:string;propriedadeId:number;painel:PainelReprodutivo;podeLancar:boolean;onAvaliar:(d:DemandaAcompanhamento)=>void;atualizacao:number;onMudou?:()=>void|Promise<void>}){
 const [demandas,setDemandas]=useState<DemandaAcompanhamento[]>([]),[politicas,setPoliticas]=useState<PoliticaAcompanhamento[]>([]),[politica,setPolitica]=useState(""),[motivo,setMotivo]=useState(""),[erro,setErro]=useState<string|null>(null),[ocupado,setOcupado]=useState(false),[previa,setPrevia]=useState<{revisao:string;propostas:Array<{acao:string;finalidade:string;ocorrencia:number;previstaPara:string;tentativaId?:string|null;gestacaoId?:string|null}>}|null>(null);
 const [carregando,setCarregando]=useState(true);
 const [erroPoliticas,setErroPoliticas]=useState<string|null>(null);
 const geracaoPrevia=useRef(0);
 const geracao=useRef(0),chave=useRef(crypto.randomUUID());
 const selecao={propriedadeId,politicaId:politica,tentativaIds:painel.tentativas.filter(t=>t.animalId===animalId&&t.status!=="ANULADO").map(t=>t.id),gestacaoIds:(painel.gestacoes??[]).filter(g=>g.animalId===animalId&&g.status==="VALIDO"&&!g.encerradaEm).map(g=>g.id)};
 useEffect(()=>{
  const g=++geracao.current;
  setDemandas([]);setPoliticas([]);setErro(null);setErroPoliticas(null);setOcupado(false);setCarregando(true);setPrevia(null);setPolitica("");setMotivo("");
  void reqV4<DemandaAcompanhamento[]>(`/reproducao/acompanhamento?animalId=${encodeURIComponent(animalId)}`,undefined,"GET",propriedadeId)
   .then(d=>{if(g===geracao.current)setDemandas(d);})
   .catch(e=>{if(g===geracao.current)setErro(e instanceof Error?e.message:String(e));})
   .finally(()=>{if(g===geracao.current)setCarregando(false);});
  if(podeLancar)void reqV4<PoliticaAcompanhamento[]>("/reproducao/acompanhamento/politicas",undefined,"GET",propriedadeId)
   .then(p=>{if(g===geracao.current)setPoliticas(p);})
   .catch(e=>{if(g===geracao.current)setErroPoliticas(e instanceof Error?e.message:String(e));});
  return()=>{geracao.current++;};
 },[animalId,propriedadeId,atualizacao,painel,podeLancar]);
 async function conferir(){setOcupado(true);setErro(null);const g=geracao.current;const pedido=++geracaoPrevia.current;try{const p=await reqV4<NonNullable<typeof previa>>("/reproducao/acompanhamento/adocao/previa",selecao,"POST",propriedadeId);if(g===geracao.current&&pedido===geracaoPrevia.current){setPrevia(p);chave.current=crypto.randomUUID();}}catch(e){if(g===geracao.current&&pedido===geracaoPrevia.current)setErro(e instanceof Error?e.message:String(e));}finally{if(g===geracao.current&&pedido===geracaoPrevia.current)setOcupado(false);}}
 async function adotar(){if(!previa||!previa.propostas.some(p=>p.acao==="CRIAR"))return;setOcupado(true);setErro(null);const g=geracao.current;try{await reqV4("/reproducao/acompanhamento/adocao",{...selecao,chave:chave.current,motivo,revisao:previa.revisao},"POST",propriedadeId);const d=await reqV4<DemandaAcompanhamento[]>(`/reproducao/acompanhamento?animalId=${animalId}`,undefined,"GET",propriedadeId);if(g===geracao.current){setDemandas(d);setPrevia(null);await onMudou?.();}}catch(e){if(g===geracao.current)setErro(e instanceof Error?e.message:String(e));}finally{if(g===geracao.current)setOcupado(false);}}
 return <section className="repro-demandas space-y-3" aria-label="Acompanhamentos do animal"><h3 className="sr-only">Acompanhamentos do animal</h3><ErrorBox erro={erro}/>{carregando&&<p role="status">Carregando acompanhamentos…</p>}{!carregando&&!erro&&!demandas.length&&<p className="text-sm">Nenhum acompanhamento planejado registrado para este animal.</p>}{!!demandas.length && <Table className="repro-demandas-tabela consulta-tabela" containerLabel="Acompanhamentos do animal">
  <TableHeader><TableRow><TableHead>Data prevista</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Observações</TableHead>{podeLancar&&<TableHead>Ação</TableHead>}</TableRow></TableHeader>
  <TableBody>{demandas.map(d => {
   const origemInvalida = d.pendencias?.includes("EXAME_ORIGEM_INVALIDO") ?? false;
   return <TableRow key={d.id}>
    <TableCell>{formatBRDateISO(d.previstaPara)}</TableCell>
    <TableCell>{d.finalidade === "DIAGNOSTICO" ? "Diagnóstico" : `Reconfirmação ${d.ocorrencia}`}</TableCell>
    <TableCell><Pill tone={d.estado==="PENDENTE"?"amber":"neutral"}>{({ PENDENTE: "Pendente", RESOLVIDA: "Resolvida", ENCERRADA: "Encerrada" } as Record<string, string>)[d.estado] ?? d.estado}</Pill></TableCell>
    <TableCell><small>Regra versão {d.regraSnapshot.politicaVersao}{d.regraSnapshot.tipoExameId ? ` · exame versão ${d.regraSnapshot.tipoExameVersao}` : ""}{d.motivoEncerramento ? ` · ${d.motivoEncerramento}` : ""}</small>{origemInvalida && <p className="mt-1 text-sm">O DG de origem foi alterado ou anulado. Confira a evidência no histórico; os prazos deste acompanhamento foram preservados.</p>}</TableCell>
    {podeLancar && <TableCell>{d.estado === "PENDENTE" && <Button secondary disabled={origemInvalida} onClick={() => onAvaliar(d)}>Registrar avaliação</Button>}</TableCell>}
   </TableRow>;
  })}</TableBody>
 </Table>}{erroPoliticas&&<p role="alert">Não foi possível consultar as regras para adoção: {erroPoliticas}</p>}{podeLancar&&politicas.length>0&&<details className="repro-adocao"><summary><Settings2 size={18} aria-hidden="true"/><span>Planejar acompanhamentos faltantes<small>Ação administrativa para registros antigos sem previsão</small></span><ChevronDown size={18} aria-hidden="true"/></summary><div className="mt-3 space-y-3"><p className="text-sm">Use quando uma tentativa ou gestação antiga ficou sem acompanhamento planejado. A prévia informa o que será criado; acompanhamentos existentes conservam a regra já aplicada.</p><label>Regra para os acompanhamentos novos<select className={classeInput} value={politica} onChange={e=>{setPolitica(e.target.value);geracaoPrevia.current++;setOcupado(false);setPrevia(null);}}><option value="">Selecione</option>{politicas.map(p=><option key={p.id} value={p.id}>Versão {p.versao} · {formatBRDateISO(p.vigenteDesde)}</option>)}</select></label><Button secondary disabled={!politica||ocupado||!(selecao.tentativaIds.length+selecao.gestacaoIds.length)} onClick={()=>void conferir()}>Ver prévia</Button>{previa&&<><Table containerLabel="Prévia dos acompanhamentos"><TableHeader><TableRow><TableHead>Origem</TableHead><TableHead>Acompanhamento</TableHead><TableHead>Previsão</TableHead><TableHead>Tratamento</TableHead></TableRow></TableHeader><TableBody>{previa.propostas.map((p,i)=><TableRow key={i}><TableCell>{p.tentativaId ? `Tentativa de ${formatBRDateISO(painel.tentativas.find(t=>t.id===p.tentativaId)?.data??"")}` : "Gestação confirmada"}</TableCell><TableCell>{p.finalidade==="DIAGNOSTICO"?"Diagnóstico":`Reconfirmação ${p.ocorrencia}`}</TableCell><TableCell>{formatBRDateISO(p.previstaPara)}</TableCell><TableCell><Pill tone={p.acao==="CRIAR"?"amber":"green"}>{p.acao==="CRIAR"?"Criar acompanhamento":"Preservar regra existente"}</Pill></TableCell></TableRow>)}</TableBody></Table>{!previa.propostas.some(p=>p.acao==="CRIAR")&&<p role="status">Não há acompanhamentos novos a criar. Os existentes foram preservados.</p>}<label>Motivo obrigatório<textarea className={classeInput} minLength={5} maxLength={1000} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label><Button disabled={ocupado||motivo.trim().length<5||!previa.propostas.some(p=>p.acao==="CRIAR")} onClick={()=>void adotar()}>Confirmar criação conferida</Button></>}</div></details>}</section>;
}
