import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { useRascunhoConsulta } from "@/financeiro/useRascunhoConsulta";
import { filtrosDasColunas, type CampoConsulta } from "@/financeiro/FiltroColunaConsulta";
import { DatePicker } from "@/components/DatePicker";
import { BuscaLista } from "@/components/BuscaLista";
import { useEffect, useState } from "react";
import { dataValida } from "./periodo-consulta";
import { navegarPara } from "../../../router";
import { MultiSelect } from "../../../components/MultiSelect";
import { Baby, CalendarDays, ClipboardList, HeartPulse, History, Syringe } from "lucide-react";
import { CartaoConsulta, LinhaTempoConsulta } from "../../../components/ConsultaVisual";
import { Button } from "../../../components/ui/button";
import { DateRangePicker, dateFromIso, isoDate } from "../../../components/DateRangePicker";
import { TabelaFinanceira, Pill } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO, getHojeISO } from "../../../lib/hoje";
import { Paginacao } from "../ui";
import type { FatoReprodutivo } from "./api";
import { OrigensFatoProtocolo } from "../protocolos/OrigensFatoProtocolo";
import { dataRelativaFato } from "../lib/historicoAnimal";
import "./historico-reprodutivo.css";

export type FatoHistorico = FatoReprodutivo & { grupo: string; chaveHistorico?: string; registro?: string; urlDetalhe?: string };
export const rotulosReprodutivos: Record<string, string> = { VAZIA: "Vazia", GESTANTE: "Gestante", DESCONHECIDA: "Desconhecida", POSITIVO: "Positivo", NEGATIVO: "Negativo", INCONCLUSIVO: "Inconclusivo", IA: "Inseminação artificial", TE: "Transferência de embrião", COBERTURA: "Cobertura", NAO_AVALIADO: "Não avaliado", ABORTO: "Aborto registrado", NASCIMENTO: "Nascimento", NATIMORTO: "Natimorto", NORMAL: "Parto", DISTOCICO: "Parto distócico", PARTO_DISTOCICO: "Parto distócico", PARTO_NORMAL: "Parto normal", GESTACAO_ENCERRADA_PARTO: "Gestação encerrada pelo parto", GESTACAO_ENCERRADA_PERDA: "Gestação encerrada por perda", PERDA: "Perda gestacional", RECONFIRMACAO: "Reconfirmação", SEXAGEM: "Sexagem", ANULADO: "Anulado", ENCERRADA: "Encerrada", ATIVA: "Confirmada" };
const filtros = [["Todos", ""], ["Tentativas", "Tentativa"], ["Avaliações", "Avaliação"], ["Gestações e perdas", "Gestação"], ["Partos", "Parto"], ["Restrições", "Restrição"], ["Situações iniciais", "Situação inicial"], ["Protocolos", "Protocolo"]] as const;
export function tituloFato(f: FatoHistorico) { return f.grupo === "Tentativa" ? rotulosReprodutivos[f.tipo ?? ""] ?? "Tentativa" : f.grupo === "Parto" ? rotulosReprodutivos[f.desfecho ?? f.tipo ?? ""] ?? "Parto" : f.grupo; }
/** Preserva links da ficha anteriores à separação de tentativas e partos. */
function parametrosHistorico(chave: string) {
  const p = new URLSearchParams(window.location.search);
  const legados = p.getAll("historicoTipos");
  const tipo = chave === "tentativas" ? "Tentativa" : chave === "partos" ? "Parto" : null;
  if (tipo && ["Tipos", "Inicio", "Fim", "Pagina", "Tamanho"].some(sufixo => p.has(`historico${sufixo}`)) && (!legados.length || legados.includes(tipo)) && !["Tipos", "Inicio", "Fim", "Pagina", "Tamanho"].some(sufixo => p.has(`${chave}${sufixo}`))) {
    p.set(`${chave}Tipos`, tipo);
    for (const sufixo of ["Inicio", "Fim", "Pagina", "Tamanho"]) {
      const valor = p.get(`historico${sufixo}`);
      if (valor !== null) p.set(`${chave}${sufixo}`, valor);
    }
  }
  return p;
}
export function HistoricoReprodutivo({ fatos, animalId, propriedadeId, onAbrir, visual: visualExterno, chaveUrl = "historico" }: { visual?: "linha" | "tabela"; chaveUrl?: string; fatos: FatoHistorico[]; animalId: string; propriedadeId?: number; onAbrir: (fato: FatoHistorico) => void }) {
  const [visualLocal,setVisual]=useState<"linha"|"tabela">("linha");
  const visual = visualExterno ?? visualLocal;
  const [tipos, setTipos] = useState<string[]>(()=>parametrosHistorico(chaveUrl).getAll(`${chaveUrl}Tipos`));
  const [inicio, setInicio] = useState<string | null>(()=>parametrosHistorico(chaveUrl).get(`${chaveUrl}Inicio`));
  const [fim, setFim] = useState<string | null>(()=>parametrosHistorico(chaveUrl).get(`${chaveUrl}Fim`));
  const [pagina, setPagina] = useState(()=>Math.max(1,Math.floor(Number(parametrosHistorico(chaveUrl).get(`${chaveUrl}Pagina`))||1)));
  const [tamanho, setTamanho] = useState(()=>{const valor=Number(parametrosHistorico(chaveUrl).get(`${chaveUrl}Tamanho`));return [5,10].includes(valor)?valor:10;});
  useEffect(()=>{const restaurar=()=>{const p=parametrosHistorico(chaveUrl);setTipos(p.getAll(`${chaveUrl}Tipos`));setInicio(p.get(`${chaveUrl}Inicio`));setFim(p.get(`${chaveUrl}Fim`));setPagina(Math.max(1,Math.floor(Number(p.get(`${chaveUrl}Pagina`))||1)));const n=Number(p.get(`${chaveUrl}Tamanho`));setTamanho([5,10].includes(n)?n:10);};window.addEventListener("popstate",restaurar);return()=>window.removeEventListener("popstate",restaurar);},[chaveUrl]);
  useEffect(()=>{const u=new URL(window.location.href);[`${chaveUrl}Tipos`,`${chaveUrl}Inicio`,`${chaveUrl}Fim`,`${chaveUrl}Pagina`,`${chaveUrl}Tamanho`].forEach(k=>u.searchParams.delete(k));tipos.forEach(t=>u.searchParams.append(`${chaveUrl}Tipos`,t));if(inicio!=null)u.searchParams.set(`${chaveUrl}Inicio`,inicio);if(fim!=null)u.searchParams.set(`${chaveUrl}Fim`,fim);if(pagina>1)u.searchParams.set(`${chaveUrl}Pagina`,String(pagina));if(tamanho!==10)u.searchParams.set(`${chaveUrl}Tamanho`,String(tamanho));window.history.replaceState(window.history.state,"",u.pathname+u.search+u.hash);},[tipos,inicio,fim,pagina,tamanho,chaveUrl]);
  const hoje = getHojeISO();
  const primeiro = [...fatos].filter(f => f.data && f.data.slice(0, 10) <= hoje).sort((a,b) => a.data.localeCompare(b.data))[0]?.data.slice(0,10) ?? "";
  const de = inicio ?? primeiro, ate = fim ?? hoje;
  const invalido = !!de&&!dataValida(de)||!!ate&&!dataValida(ate)||!!de && !!ate && de > ate;
  const [busca,setBusca] = useState("");
  const edicao = useRascunhoConsulta({tipos,inicio:de,fim:ate},{tipos:[] as string[],inicio:"",fim:""},v=>{setTipos(v.tipos);setInicio(v.inicio);setFim(v.fim);setPagina(1);});
  const campos: CampoConsulta[] = [
    {chave:"evento",ativo:!!tipos.length,limpar:()=>edicao.editar("tipos",[]),conteudo:<MultiSelect compacto label="Tipos de registro" placeholder="Todos os tipos" options={filtros.filter(([,v])=>v).map(([label,value])=>({label,value}))} value={edicao.rascunho.tipos} onValueChange={v=>edicao.editar("tipos",v)}/>},
    {chave:"data", naBarra: true,ativo:inicio!=null||fim!=null,limpar:()=>{edicao.editar("inicio","");edicao.editar("fim","");},conteudo:<div className="filtros-grupo-campos"><label>De<DatePicker value={edicao.rascunho.inicio} onChange={v=>edicao.editar("inicio",v)}/></label><label>Até<DatePicker value={edicao.rascunho.fim} onChange={v=>edicao.editar("fim",v)}/></label></div>},
  ];
  const erroFiltro = edicao.rascunho.inicio&&edicao.rascunho.fim&&edicao.rascunho.inicio>edicao.rascunho.fim?"A data inicial deve ser igual ou anterior à final.":null;
  const selecionados = invalido ? [] : fatos.filter(f => `${tituloFato(f)} ${f.registro??""} ${f.resultado??""} ${f.status??""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")) && (!tipos.length || tipos.includes(f.grupo)) && (!f.data ? inicio == null && fim == null : (!de || f.data.slice(0,10) >= de) && (!ate || f.data.slice(0,10) <= ate))).sort((a,b)=>b.data.localeCompare(a.data)||(a.chaveHistorico??a.id).localeCompare(b.chaveHistorico??b.id));
  const totalPaginas = Math.max(1, Math.ceil(selecionados.length / tamanho));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const itens=selecionados.slice((paginaAtual-1)*tamanho,paginaAtual*tamanho);
  const resultado=(f:FatoHistorico)=>f.status==="ANULADO"?"Anulado":f.grupo==="Tentativa"?rotulosReprodutivos[f.resultado??""]??"Consultar avaliações":rotulosReprodutivos[f.resultado??f.desfecho??f.tipo??""]??f.resultado??(f.motivo?"Encerramento registrado":"Registrado");
  const registro=(f:FatoHistorico)=>f.registro??(f.grupo==="Avaliação"?f.exame?.formatoSnapshot.nome??(f.exame?.finalidadePrincipal==="DIAGNOSTICO_GESTACAO"?"Diagnóstico de gestação":f.exame?.finalidadePrincipal==="RECONFIRMACAO"?"Reconfirmação da gestação":f.tipo?rotulosReprodutivos[f.tipo]??f.tipo:"Avaliação reprodutiva"):f.grupo==="Gestação"?f.tipo==="GESTANTE"?"Confirmação da gestação":"Encerramento da gestação":f.grupo==="Situação inicial"?"Início do acompanhamento":tituloFato(f));
  const abrir=(f:FatoHistorico)=>f.urlDetalhe?navegarPara(f.urlDetalhe):f.grupo==="Parto"?navegarPara(`/pecuaria/reproducao/partos/${f.id}?retorno=${encodeURIComponent(window.location.pathname+window.location.search+window.location.hash)}${f.propriedadeId!=null?`&sitio=${f.propriedadeId}`:""}`):onAbrir(f);
  const acoes=(f:FatoHistorico)=><Button size="sm" onClick={()=>abrir(f)}>{f.grupo==="Parto"?"Ver parto":"Detalhes"}</Button>;

  return <div className="repro-historico">
      {chaveUrl==="historico"&&!visualExterno&&<div className="repro-historico-visual" role="group" aria-label="Visualização do histórico reprodutivo"><Button variant={visual==="linha"?"default":"outline"} aria-pressed={visual==="linha"} onClick={()=>setVisual("linha")}>Linha do tempo</Button><Button variant={visual==="tabela"?"default":"outline"} aria-pressed={visual==="tabela"} onClick={()=>setVisual("tabela")}>Tabela</Button></div>}
    <BarraConsulta campos={campos} edicaoFiltros={edicao} erroFiltros={erroFiltro} criterios={tipos.map(t=>({id:t,rotulo:filtros.find(([,v])=>v===t)?.[0]??"Tipo selecionado",limpar:()=>{setTipos(v=>v.filter(x=>x!==t));setPagina(1);}}))}>
      <BuscaLista rotulo="Buscar evento" placeholder="Evento ou resultado" valor={busca} onChange={v=>{setBusca(v);setPagina(1);}}/>
      <DateRangePicker value={{start:dataValida(de)?dateFromIso(de):null,end:dataValida(ate)?dateFromIso(ate):null}} onChange={range => { setInicio(range.start ? isoDate(range.start) : ""); setFim(range.end ? isoDate(range.end) : ""); setPagina(1); }} showPresets={false} triggerAriaLabel="Período do histórico reprodutivo" showIcon triggerLabel={inicio == null && fim == null ? "Todo o período" : "Período selecionado"}/>

    </BarraConsulta>
    {invalido && <p role="alert">O início deve ser anterior ou igual ao fim do período.</p>}
    {chaveUrl==="historico"&&visual==="linha"?<LinhaTempoConsulta rotulo="Histórico reprodutivo por data" itens={itens} dataDe={f=>f.data} chaveDe={f=>f.chaveHistorico??`${f.grupo}:${f.id}`} complementoData={data=><span className="font-normal text-ink-3"> - {dataRelativaFato(data)}</span>} render={f=><CartaoConsulta titulo={f.grupo} icon={f.grupo==="Protocolo"?ClipboardList:f.grupo==="Avaliação"?HeartPulse:f.grupo==="Tentativa"?Syringe:f.grupo==="Parto"?Baby:History} acoes={acoes(f)}><div className="flex flex-wrap gap-2 text-sm"><strong>{registro(f)}</strong><span>- {resultado(f)}</span></div></CartaoConsulta>}/>:<TabelaFinanceira filtrosColunas={filtrosDasColunas(campos,edicao,erroFiltro)} rotulo="Histórico reprodutivo" itens={itens} chaveDe={f => f.chaveHistorico ?? `${f.grupo}:${f.id}`} colunas={[
      { chave: "data", titulo: "Data", principal: true, celula: f => f.data ? <><strong>{formatBRDateISO(f.data)}</strong><small className="block text-ink-3">{dataRelativaFato(f.data)}</small></> : "Não informada" },
      { chave: "evento", titulo: "Evento", larguraFlexivel: true, celula: tituloFato },
      ...(chaveUrl==="partos"?[{chave:"crias",titulo:"Cria",celula:(f:FatoHistorico)=><div className="grid gap-1">{f.crias?.length?f.crias.map((c,i)=>{const id=c.animal?.id??c.animalId;return id?<a key={c.id??i} className="text-primary underline" href={`/pecuaria/rebanho/animais/${encodeURIComponent(id)}${propriedadeId!=null?`?sitio=${propriedadeId}`:""}`}>{c.animal?.brinco??c.brinco??"Ver cria"} · {c.sexo==="FEMEA"?"Fêmea":c.sexo==="MACHO"?"Macho":c.sexo}</a>:<span key={c.id??i}>{c.brinco??"Cria sem cadastro"} · {c.viva?"Viva":"Natimorta"}</span>; }):"Sem cria registrada"}</div>},{chave:"responsavel",titulo:"Responsável",celula:(f:FatoHistorico)=>f.responsavel??"Não informado"}]:[{ chave: "protocolo", titulo: "Protocolo / programação", celula: (f:FatoHistorico) => f.grupo === "Tentativa" || f.grupo === "Avaliação" ? <OrigensFatoProtocolo animalId={animalId} fatoId={f.id} exameId={f.exame?.id} propriedadeId={propriedadeId}/> : f.registro??"Sem vínculo registrado" }]),
      ...(chaveUrl==="tentativas"?[]:[{ chave: "resultado", titulo: chaveUrl==="partos"?"Desfecho":"Resultado", celula: (f:FatoHistorico) => <Pill>{resultado(f)}</Pill> }]),
      { chave: "acao", titulo: "Ação", acoes: true, celula: acoes },
    ]}/>}
    {!selecionados.length && <p className="p-4 text-ink-3">Nenhum evento registrado neste período e tipo.</p>}
    {selecionados.length > 0 && <div className="repro-historico-rodape"><div className="repro-historico-tamanho"><label>Por página <select aria-label="Registros por página" value={tamanho} onChange={e => { setTamanho(Number(e.target.value)); setPagina(1); }}>{[5,10].map(n => <option key={n}>{n}</option>)}</select></label></div>
    <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} totalItens={selecionados.length} itensPorPagina={tamanho} onPaginaChange={setPagina} rotulo="registros" idSelect={`pagina-${chaveUrl}-animal`}/></div>}
  </div>;
}
