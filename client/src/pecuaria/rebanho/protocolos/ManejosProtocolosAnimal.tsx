import { useEffect,useState } from "react";
import { Button,ErrorBox } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";
import { horarioIatf } from "../reproducao/CampoDataIatf";
import { reqProtocolo } from "./api";
import type { PaginaProtocolo } from "./EtapasProtocolo";
import { DetalheManejoProtocolar } from "./DetalheManejoProtocolar";
type Linha={id:string;tipo:string;data:string;realizadaEm:string|null;precisaoTemporal:"DIA"|"HORA";status:string};
export function ManejosProtocolosAnimal({animalId,propriedadeId,podeLancar,onSalvo}:{animalId:string;propriedadeId:number|null;podeLancar:boolean;onSalvo:()=>void}){
 const [pagina,setPagina]=useState(1);const [dados,setDados]=useState<PaginaProtocolo<Linha>|null>(null);const [erro,setErro]=useState<string|null>(null);const [expandida,setExpandida]=useState<string|null>(()=>new URLSearchParams(window.location.search).get("manejoId"));const [revisao,setRevisao]=useState(0);
 useEffect(()=>{if(propriedadeId==null)return;let vivo=true;reqProtocolo<PaginaProtocolo<Linha>>(`/manejos?animalId=${animalId}&pagina=${pagina}&porPagina=10`,propriedadeId).then(d=>{if(vivo){setDados(d);setErro(null);}}).catch(e=>{if(vivo)setErro(e instanceof Error?e.message:String(e));});return()=>{vivo=false;};},[animalId,propriedadeId,pagina,revisao]);
 if(propriedadeId==null)return null;
 return <section id="manejo" className="grid gap-3" aria-label="Manejos do protocolo"><ErrorBox erro={erro}/>{dados&&dados.total>0&&<><h3 className="font-semibold">Manejos e retiradas do protocolo</h3>{dados.itens.map(i=><article key={i.id} className="border-t border-border pt-3"><p>{i.tipo==="RETIRADA_DISPOSITIVO"?"Retirada de dispositivo":"Manejo protocolar"} · {horarioIatf(i.realizadaEm??i.data,i.precisaoTemporal)} · {i.status}</p><Button secondary aria-expanded={expandida===i.id} onClick={()=>setExpandida(expandida===i.id?null:i.id)}>Ver atendimento</Button>{expandida===i.id&&<DetalheManejoProtocolar id={i.id} propriedadeId={propriedadeId} podeLancar={podeLancar} onSalvo={()=>{setRevisao(v=>v+1);onSalvo();}}/>}</article>)}{dados.total>10&&<Paginacao paginaAtual={dados.pagina} totalPaginas={Math.ceil(dados.total/10)} totalItens={dados.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="manejos do protocolo" idSelect="ficha-manejos-protocolo"/>}</>}</section>;
}
