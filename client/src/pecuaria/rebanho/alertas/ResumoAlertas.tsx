import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, ErrorBox, Panel } from "@/financeiro/financeiro-ui";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { navegarPara } from "../../../router";
import { resumirAlertas, type ConsultaAlertas } from "./api";
import { urlConsulta,urlParticipantes } from "./consulta";
import { CuidadosAlertas } from "./CuidadosAlertas";
export function CoberturaAlertas({cobertura}:{cobertura:ConsultaAlertas["cobertura"]}) {if(cobertura.estado==="ATUALIZADA")return null;return <p className="alertas-cobertura" role="status"><TriangleAlert size={16} aria-hidden/>{cobertura.estado==="FALHA"?"A avaliação dos alertas falhou. A lista pode estar incompleta.":cobertura.estado==="NAO_AVALIADO"?"As regras ainda não foram avaliadas.":"A avaliação dos alertas está desatualizada."}</p>;}
export function ResumoAlertas({animalId,propriedadeId,revisao=0}:{animalId?:string;propriedadeId?:number;revisao?:number}){
 const [dados,setDados]=useState<ConsultaAlertas|null>(null),[erro,setErro]=useState<string|null>(null),[tentativa,setTentativa]=useState(0),[versao,setVersao]=useState(0);
 const visual=useVisualizacaoConsulta(animalId?"visualAlertasAnimal":"visualResumoAlertas");
 useEffect(()=>{const atualizar=()=>setVersao(v=>v+1);window.addEventListener("pecuaria:alertas-atualizados",atualizar);return()=>window.removeEventListener("pecuaria:alertas-atualizados",atualizar);},[]);
 useEffect(()=>{const controller=new AbortController();setDados(null);setErro(null);resumirAlertas({disposicao:"ATENCAO",animalId,propriedadeId,tamanho:3},controller.signal).then(setDados).catch(e=>{if(!controller.signal.aborted)setErro(e instanceof Error?e.message:"Não foi possível consultar os cuidados");});return()=>controller.abort();},[animalId,propriedadeId,revisao,tentativa,versao]);
 return <Panel className="resumo-alertas"><div className="alertas-painel-cabecalho"><div><h2><TriangleAlert size={19} aria-hidden/>Demandam atenção</h2>{dados&&<p>{dados.totaisFiltrados.cuidados} cuidados · {dados.totaisFiltrados.animais} animais{animalId?" · neste animal":""}</p>}</div><Button onClick={()=>navegarPara(urlConsulta({animalId,propriedadeId,disposicao:"ATENCAO"}))}>{animalId?"Ver todos deste animal":"Ver todos os cuidados"}</Button></div>{erro?<div className="p-4"><ErrorBox erro={erro}/><Button secondary onClick={()=>setTentativa(n=>n+1)}>Tentar novamente</Button></div>:!dados?<p className="p-4" role="status">Consultando cuidados…</p>:<><CoberturaAlertas cobertura={dados.cobertura}/><div className="consulta-visual-barra"><span>{dados.itens.length} cuidados em destaque</span><AlternarVisualizacaoConsulta {...visual} rotulo="Visualização do resumo de alertas"/></div>{dados.itens.length?<CuidadosAlertas grupos={dados.itens} modo={visual.modo} individual={!!animalId} onAbrir={g=>navegarPara(urlParticipantes(g,{animalId,propriedadeId,disposicao:"ATENCAO"}))}/>:<p className="p-4">Nenhuma atenção identificada pelas regras ativas.</p>}</> }</Panel>;
}
