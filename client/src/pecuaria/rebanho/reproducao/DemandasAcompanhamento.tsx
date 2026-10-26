import { AjudaCampo } from "../../../components/Dica";
import { Paginacao } from "../ui";
import { listarDemandasAcompanhamento, type DemandaAcompanhamento } from "./acompanhamento-api";
export type { DemandaAcompanhamento } from "./acompanhamento-api";
import {useEffect,useRef,useState} from "react";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import "./acompanhamentos-animal.css";
import {reqV4,type PainelReprodutivo} from "./api";
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell} from "../../../components/ui/table";
import {ErrorBox,Pill} from "../../../financeiro/financeiro-ui";
import {formatBRDateISO} from "../../../lib/hoje";
import {classeInput} from "../../../financeiro/PainelCadastro";
import type {PoliticaAcompanhamento} from "./ConfiguracaoAcompanhamento";

export function DemandasAcompanhamento({animalId,propriedadeId,painel,podeLancar,onAvaliar,atualizacao,onMudou}:{animalId:string;propriedadeId:number;painel:PainelReprodutivo;podeLancar:boolean;onAvaliar:(d:DemandaAcompanhamento)=>void;atualizacao:number;onMudou?:()=>void|Promise<void>}){
 const [demandas,setDemandas]=useState<DemandaAcompanhamento[]>([]),[politicas,setPoliticas]=useState<PoliticaAcompanhamento[]>([]),[politica,setPolitica]=useState(""),[motivo,setMotivo]=useState(""),[erro,setErro]=useState<string|null>(null),[ocupado,setOcupado]=useState(false),[previa,setPrevia]=useState<{revisao:string;propostas:Array<{acao:string;finalidade:string;ocorrencia:number;previstaPara:string;tentativaId?:string|null;gestacaoId?:string|null}>}|null>(null);
 const [carregando,setCarregando]=useState(true);
 const [pagina,setPagina]=useState(1),[total,setTotal]=useState(0),[estado,setEstado]=useState(""),[finalidade,setFinalidade]=useState(""),[revisaoLista,setRevisaoLista]=useState(0);
 const geracaoConsulta=useRef(0);
 const [erroPoliticas,setErroPoliticas]=useState<string|null>(null);
 const geracaoPrevia=useRef(0);
 const geracao=useRef(0),chave=useRef(crypto.randomUUID());
 const selecao={propriedadeId,politicaId:politica,tentativaIds:painel.tentativas.filter(t=>t.animalId===animalId&&t.status!=="ANULADO").map(t=>t.id),gestacaoIds:(painel.gestacoes??[]).filter(g=>g.animalId===animalId&&g.status==="VALIDO"&&!g.encerradaEm).map(g=>g.id)};
 useEffect(()=>{
  const g=++geracao.current;
  setDemandas([]);setPoliticas([]);setErro(null);setErroPoliticas(null);setOcupado(false);setCarregando(true);setPrevia(null);setPolitica("");setMotivo("");
  if(podeLancar)void reqV4<PoliticaAcompanhamento[]>("/reproducao/acompanhamento/politicas",undefined,"GET",propriedadeId)
   .then(p=>{if(g===geracao.current)setPoliticas(p);})
   .catch(e=>{if(g===geracao.current)setErroPoliticas(e instanceof Error?e.message:String(e));});
  return()=>{geracao.current++;};
 },[animalId,propriedadeId,atualizacao,painel,podeLancar]);
 useEffect(()=>{
  const pedido=++geracaoConsulta.current;let vivo=true;setCarregando(true);setErro(null);setDemandas([]);
  listarDemandasAcompanhamento(propriedadeId,animalId,pagina,estado,finalidade).then(p=>{if(vivo&&pedido===geracaoConsulta.current){setDemandas(p.itens);setTotal(p.total);setPagina(p.pagina);}}).catch(e=>{if(vivo&&pedido===geracaoConsulta.current)setErro(e instanceof Error?e.message:String(e));}).finally(()=>{if(vivo&&pedido===geracaoConsulta.current)setCarregando(false);});
  return()=>{vivo=false;};
 },[animalId,propriedadeId,atualizacao,painel,pagina,estado,finalidade,revisaoLista]);
 async function conferir(){setOcupado(true);setErro(null);const g=geracao.current;const pedido=++geracaoPrevia.current;try{const p=await reqV4<NonNullable<typeof previa>>("/reproducao/acompanhamento/adocao/previa",selecao,"POST",propriedadeId);if(g===geracao.current&&pedido===geracaoPrevia.current){setPrevia(p);chave.current=crypto.randomUUID();}}catch(e){if(g===geracao.current&&pedido===geracaoPrevia.current)setErro(e instanceof Error?e.message:String(e));}finally{if(g===geracao.current&&pedido===geracaoPrevia.current)setOcupado(false);}}
 async function adotar(){if(!previa||!previa.propostas.some(p=>p.acao==="CRIAR"))return;setOcupado(true);setErro(null);const g=geracao.current;try{await reqV4("/reproducao/acompanhamento/adocao",{...selecao,chave:chave.current,motivo,revisao:previa.revisao},"POST",propriedadeId);if(g===geracao.current){setRevisaoLista(v=>v+1);setPrevia(null);await onMudou?.();}}catch(e){if(g===geracao.current)setErro(e instanceof Error?e.message:String(e));}finally{if(g===geracao.current)setOcupado(false);}}
 return <section className="repro-demandas space-y-3" aria-label="Acompanhamentos do animal"><h3 className="sr-only">Acompanhamentos do animal</h3><ErrorBox erro={erro}/>{erro&&<Button variant="outline" onClick={()=>setRevisaoLista(v=>v+1)}>Tentar carregar acompanhamentos novamente</Button>}<div className="grid gap-3 sm:grid-cols-2"><label>Situação do acompanhamento<SelectCampo className={classeInput} value={estado} onValueChange={valor=>{setEstado(valor);setPagina(1);}}><option value="">Todas</option><option value="PENDENTE">Pendentes</option><option value="RESOLVIDA">Resolvidas</option><option value="ENCERRADA">Encerradas</option></SelectCampo></label><label>Finalidade do acompanhamento<SelectCampo className={classeInput} value={finalidade} onValueChange={valor=>{setFinalidade(valor);setPagina(1);}}><option value="">Todas</option><option value="DIAGNOSTICO">Diagnóstico</option><option value="RECONFIRMACAO">Reconfirmação</option><option value="SEXAGEM">Sexagem</option></SelectCampo></label></div>{carregando&&<p role="status">Carregando acompanhamentos…</p>}{!carregando&&!erro&&!demandas.length&&<p className="text-sm">{estado||finalidade ? "Nenhum acompanhamento corresponde aos filtros." : "Nenhum acompanhamento planejado registrado para este animal."}</p>}{!!demandas.length && <Table className="repro-demandas-tabela consulta-tabela" containerLabel="Acompanhamentos do animal">
  <TableHeader><TableRow><TableHead>Data prevista</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Observações</TableHead>{podeLancar&&<TableHead>Ação</TableHead>}</TableRow></TableHeader>
  <TableBody>{demandas.map(d => {
   const origemInvalida = d.pendencias?.includes("EXAME_ORIGEM_INVALIDO") ?? false;
   return <TableRow key={d.id}>
    <TableCell>{d.previstaPara ? formatBRDateISO(d.previstaPara) : "Sem data definida"}</TableCell>
    <TableCell>{d.finalidade === "DIAGNOSTICO" ? "Diagnóstico" : d.finalidade === "SEXAGEM" ? "Sexagem" : `Reconfirmação ${d.ocorrencia}`}</TableCell>
    <TableCell><Pill tone={d.estado==="PENDENTE"?"amber":"neutral"}>{({ PENDENTE: "Pendente", RESOLVIDA: "Resolvida", ENCERRADA: "Encerrada" } as Record<string, string>)[d.estado] ?? d.estado}</Pill></TableCell>
    <TableCell><small>{d.regraSnapshot.politicaVersao ? `Regra versão ${d.regraSnapshot.politicaVersao}` : "Acompanhamento do exame"}{d.regraSnapshot.tipoExameId ? ` · exame versão ${d.regraSnapshot.tipoExameVersao}` : ""}{d.motivoEncerramento ? ` · ${d.motivoEncerramento}` : ""}</small>{origemInvalida && <p className="mt-1 text-sm">O DG de origem foi alterado ou anulado. Confira a evidência no histórico; os prazos deste acompanhamento foram preservados.</p>}</TableCell>
    {podeLancar && <TableCell>{d.estado === "PENDENTE" && <Button variant="outline" disabled={origemInvalida} onClick={() => onAvaliar(d)}>Registrar avaliação</Button>}</TableCell>}
   </TableRow>;
  })}</TableBody>
 </Table>}{!carregando&&!erro&&total>10&&<Paginacao paginaAtual={pagina} totalPaginas={Math.ceil(total/10)} totalItens={total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="acompanhamentos" idSelect="pagina-acompanhamentos-animal"/>}{erroPoliticas&&<p role="alert">Não foi possível consultar as regras para adoção: {erroPoliticas}</p>}{podeLancar&&politicas.length>0&&<section className="acompanhamentos-planejamento" aria-label="Planejar acompanhamentos faltantes"><h4>Planejar acompanhamentos faltantes <AjudaCampo rotulo="Ajuda sobre planejamento de acompanhamentos" texto="Para tentativas e gestações antigas sem previsão. Confira a prévia antes de criar; a regra dos acompanhamentos existentes será preservada."/></h4><div className="mt-3 space-y-3"><label>Regra para os acompanhamentos novos<SelectCampo className={classeInput} value={politica} onValueChange={valor=>{setPolitica(valor);geracaoPrevia.current++;setOcupado(false);setPrevia(null);}}><option value="">Selecione</option>{politicas.map(p=><option key={p.id} value={p.id}>Versão {p.versao} · {formatBRDateISO(p.vigenteDesde)}</option>)}</SelectCampo></label><Button variant="outline" disabled={!politica||ocupado||!(selecao.tentativaIds.length+selecao.gestacaoIds.length)} onClick={()=>void conferir()}>Ver prévia</Button>{previa&&<><Table containerLabel="Prévia dos acompanhamentos"><TableHeader><TableRow><TableHead>Origem</TableHead><TableHead>Acompanhamento</TableHead><TableHead>Previsão</TableHead><TableHead>Tratamento</TableHead></TableRow></TableHeader><TableBody>{previa.propostas.map((p,i)=><TableRow key={i}><TableCell>{p.tentativaId ? `Tentativa de ${formatBRDateISO(painel.tentativas.find(t=>t.id===p.tentativaId)?.data??"")}` : "Gestação confirmada"}</TableCell><TableCell>{p.finalidade==="DIAGNOSTICO"?"Diagnóstico":`Reconfirmação ${p.ocorrencia}`}</TableCell><TableCell>{formatBRDateISO(p.previstaPara)}</TableCell><TableCell><Pill tone={p.acao==="CRIAR"?"amber":"green"}>{p.acao==="CRIAR"?"Criar acompanhamento":"Preservar regra existente"}</Pill></TableCell></TableRow>)}</TableBody></Table>{!previa.propostas.some(p=>p.acao==="CRIAR")&&<p role="status">Não há acompanhamentos novos a criar. Os existentes foram preservados.</p>}<label>Motivo obrigatório<Textarea className={classeInput} minLength={5} maxLength={1000} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label><Button disabled={ocupado||motivo.trim().length<5||!previa.propostas.some(p=>p.acao==="CRIAR")} onClick={()=>void adotar()}>Confirmar criação conferida</Button></>}</div></section>}</section>;
}
