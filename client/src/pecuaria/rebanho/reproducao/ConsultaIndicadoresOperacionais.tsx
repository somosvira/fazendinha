import { useEffect, useState } from "react";
import { BarraConsulta } from "../../../financeiro/BarraConsulta";
import { CampoFiltro } from "../../../financeiro/PainelFiltros";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { useRascunhoConsulta } from "../../../financeiro/useRascunhoConsulta";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { DateRangePicker } from "../../../components/DateRangePicker";
import { getHojeISO } from "../../../lib/hoje";
import { usePeriodoConsulta } from "./periodo-consulta";
import { consultarIndicadores, type FiltrosIndicadores, type SnapshotIndicadoresReprodutivos } from "./indicadores-api";
import { reqV4 } from "./api";
import { PainelIndicadores } from "./PainelIndicadores";

type Criterios = { lote: string; tipos: string[]; papeis: string[]; te: string; estimativa: string; perdas: string; iep: string };
const padrao: Criterios = { lote: "", tipos: [], papeis: [], te: "7", estimativa: "", perdas: "", iep: "VIVOS_NATIMORTOS" };
function lerCriterios(): Criterios {
  const p = new URLSearchParams(window.location.search);
  const lista = (chave: string, permitidos: string[]) => (p.get(chave)?.split(",") ?? []).filter(v=>permitidos.includes(v));
  return { lote:p.get("indicadoresLote")??"", tipos:lista("indicadoresTipos",["IA","TE","COBERTURA"]), papeis:lista("indicadoresPapeis",["NENHUM","DOADORA","RECEPTORA"]), te:p.get("indicadoresTe")??"7", estimativa:p.get("indicadoresEstimativa")??"", perdas:p.get("indicadoresPerdas")??"", iep:p.get("indicadoresIep")==="TODOS_PARTOS"?"TODOS_PARTOS":"VIVOS_NATIMORTOS" };
}
export function ConsultaIndicadoresOperacionais({ propriedadeId }: { propriedadeId: number }) {
  const periodo = usePeriodoConsulta("indicadores");
  const [criterios,setCriterios] = useState(lerCriterios);
  const [snapshot,setSnapshot] = useState<SnapshotIndicadoresReprodutivos|null>(null);
  const [lotes,setLotes] = useState<Array<{id:string;nome:string}>>([]);
  const [erro,setErro] = useState<string|null>(null);
  const [erroLotes,setErroLotes] = useState<string|null>(null);
  const [carregando,setCarregando] = useState(true);
  const [revisao,setRevisao] = useState(0);
  useEffect(()=>{const restaurar=()=>setCriterios(c=>{const v=lerCriterios();return JSON.stringify(c)===JSON.stringify(v)?c:v;});window.addEventListener("popstate",restaurar);return()=>window.removeEventListener("popstate",restaurar);},[]);
  useEffect(()=>{let ativo=true;setLotes([]);setErroLotes(null);void reqV4<Array<{id:string;nome:string}>>(`/lotes?propriedadeId=${propriedadeId}`,undefined,"GET",propriedadeId).then(v=>{if(ativo)setLotes(v);}).catch(()=>{if(ativo)setErroLotes("Lotes indisponíveis. Você pode consultar sem esse filtro.");});return()=>{ativo=false;};},[propriedadeId]);
  const edicao = useRascunhoConsulta(criterios,padrao,v=>{
    setCriterios(v);const url=new URL(window.location.href);
    for(const [k,value] of Object.entries({Lote:v.lote,Tipos:v.tipos.join(","),Papeis:v.papeis.join(","),Te:v.te,Estimativa:v.estimativa,Perdas:v.perdas,Iep:v.iep})) value?url.searchParams.set(`indicadores${k}`,value):url.searchParams.delete(`indicadores${k}`);
    window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
  });
  useEffect(()=>{let ativo=true;setCarregando(true);setErro(null);setSnapshot(null);
    const f:FiltrosIndicadores={propriedadeId,inicio:periodo.inicio,fim:periodo.fim,corte:getHojeISO(),deslocamentoTeDias:Number(criterios.te||7),iepModo:criterios.iep as FiltrosIndicadores["iepModo"],...(criterios.lote?{loteId:criterios.lote}:{}),...(criterios.tipos.length?{tiposTentativa:criterios.tipos as FiltrosIndicadores["tiposTentativa"]}:{}),...(criterios.papeis.length?{papeis:criterios.papeis as FiltrosIndicadores["papeis"]}:{}),...(criterios.estimativa!==""?{concepcaoEstimada:Number(criterios.estimativa)}:{}),...(criterios.perdas!==""?{janelaPerdaDias:Number(criterios.perdas)}:{})};
    void consultarIndicadores(f).then(v=>{if(ativo)setSnapshot(v);}).catch(e=>{if(ativo)setErro(e instanceof Error?e.message:"Não foi possível consultar os indicadores.");}).finally(()=>{if(ativo)setCarregando(false);});return()=>{ativo=false;};
  },[propriedadeId,periodo.inicio,periodo.fim,criterios,revisao]);
  function remover<K extends keyof Criterios>(campo: K, chave: string) {
    const url=new URL(window.location.href);url.searchParams.delete(`indicadores${chave}`);window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);setCriterios(c=>({...c,[campo]:padrao[campo]}));
  }
  const r=edicao.rascunho;
  const invalido=(v:string,min:number,max:number,inteiro=false)=>v!==""&&(!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max||inteiro&&!Number.isInteger(Number(v)));
  const erroFiltros=invalido(r.te,0,30,true)||invalido(r.estimativa,0,100)||invalido(r.perdas,1,1000,true)?"Confira os parâmetros: TE de 0 a 30 dias, estimativa de 0 a 100% e perdas de 1 a 1000 dias.":null;
  const alternar=(lista:string[],v:string)=>lista.includes(v)?lista.filter(x=>x!==v):[...lista,v];
  return <section className="space-y-4">
    <BarraConsulta edicaoFiltros={edicao} erroFiltros={erroFiltros} campos={[
      {chave:"lote",conteudo:<CampoFiltro rotulo="Lote"><SelectCampo value={r.lote} onValueChange={v=>edicao.editar("lote",v)}><option value="">Todos os lotes</option>{criterios.lote&&!lotes.some(l=>l.id===criterios.lote)&&<option value={criterios.lote}>Lote selecionado</option>}{lotes.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</SelectCampo></CampoFiltro>},
      {chave:"tipos",conteudo:<fieldset><legend>Tentativas (nenhuma seleção: todas)</legend>{["IA","TE","COBERTURA"].map(v=><label className="mr-3 inline-flex gap-2" key={v}><input type="checkbox" checked={r.tipos.includes(v)} onChange={()=>edicao.editar("tipos",alternar(r.tipos,v))}/>{v}</label>)}</fieldset>},
      {chave:"papeis",conteudo:<fieldset><legend>Papel (nenhuma seleção: todos)</legend>{[["NENHUM","Nenhum"],["DOADORA","Doadora"],["RECEPTORA","Receptora"]].map(([v,t])=><label className="mr-3 inline-flex gap-2" key={v}><input type="checkbox" checked={r.papeis.includes(v)} onChange={()=>edicao.editar("papeis",alternar(r.papeis,v))}/>{t}</label>)}</fieldset>},
      {chave:"parametros",conteudo:<div className="col-span-full space-y-3 border-t pt-4"><h3 className="font-semibold">Parâmetros de cálculo</h3><div className="grid gap-4 sm:grid-cols-2"><CampoFiltro rotulo="Deslocamento TE (dias)"><input className={classeInput} type="number" min={0} max={30} value={r.te} onChange={e=>edicao.editar("te",e.target.value)}/></CampoFiltro><CampoFiltro rotulo="Concepção estimada (%)"><input className={classeInput} type="number" min={0} max={100} value={r.estimativa} placeholder="Sem estimativa" onChange={e=>edicao.editar("estimativa",e.target.value)}/></CampoFiltro><CampoFiltro rotulo="Janela de perdas (dias)"><input className={classeInput} type="number" value={r.perdas} onChange={e=>edicao.editar("perdas",e.target.value)}/></CampoFiltro><CampoFiltro rotulo="Intervalo entre partos"><SelectCampo value={r.iep} onValueChange={v=>edicao.editar("iep",v)}><option value="VIVOS_NATIMORTOS">Vivos e natimortos comprovados</option><option value="TODOS_PARTOS">Todos os partos</option></SelectCampo></CampoFiltro></div></div>},
      {chave:"rascunho",conteudo:JSON.stringify(r)!==JSON.stringify(criterios)?<p role="status" className="col-span-full text-sm">Alterações ainda não aplicadas. O resultado mantém os critérios anteriores.</p>:null},
    ].map(c=>({...c,ativo:false,limpar:edicao.limpar}))} criterios={[
      ...(criterios.lote?[{id:"lote",rotulo:`Lote: ${lotes.find(l=>l.id===criterios.lote)?.nome??"selecionado"}`,limpar:()=>{const u=new URL(window.location.href);u.searchParams.delete("indicadoresLote");window.history.replaceState(null,"",u.pathname+u.search+u.hash);setCriterios(c=>({...c,lote:""}));}}]:[]),
      ...(criterios.tipos.length?[{id:"tipos",rotulo:criterios.tipos.join(", "),limpar:()=>{const u=new URL(window.location.href);u.searchParams.delete("indicadoresTipos");window.history.replaceState(null,"",u.pathname+u.search+u.hash);setCriterios(c=>({...c,tipos:[]}));}}]:[]),
      ...(criterios.papeis.length?[{id:"papeis",rotulo:`Papel: ${criterios.papeis.join(", ")}`,limpar:()=>remover("papeis","Papeis")}]:[]),
      ...(criterios.te!=="7"?[{id:"te",rotulo:`TE: ${criterios.te||7} dias`,limpar:()=>remover("te","Te")}]:[]),
      ...(criterios.estimativa!==""?[{id:"estimativa",rotulo:`Concepção estimada: ${criterios.estimativa}%`,limpar:()=>remover("estimativa","Estimativa")}]:[]),
      ...(criterios.perdas!==""?[{id:"perdas",rotulo:`Perdas: ${criterios.perdas} dias`,limpar:()=>remover("perdas","Perdas")}]:[]),
      ...(criterios.iep!==padrao.iep?[{id:"iep",rotulo:"IEP: todos os partos",limpar:()=>remover("iep","Iep")}]:[]),
    ]}><DateRangePicker value={periodo.range} onChange={periodo.alterar}/></BarraConsulta>
    {periodo.aviso&&<p role="status" className="text-sm">{periodo.aviso}</p>}{erroLotes&&<p role="status" className="text-sm">{erroLotes}</p>}
    <ErrorBox erro={erro}/>{erro&&<Button secondary onClick={()=>setRevisao(v=>v+1)}>Tentar novamente</Button>}
    {carregando&&<p role="status">Carregando indicadores…</p>}
    {!carregando&&snapshot?.filtros.propriedadeId===propriedadeId&&<PainelIndicadores key={JSON.stringify(snapshot.filtros)} snapshot={snapshot}/>}
  </section>;
}
