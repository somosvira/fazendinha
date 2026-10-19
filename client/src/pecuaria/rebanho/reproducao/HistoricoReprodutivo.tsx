import { useEffect, useRef, useState } from "react";
import { dataValida } from "./periodo-consulta";
import { navegarPara } from "../../../router";
import { MultiSelect } from "../../../components/MultiSelect";
import { CalendarDays } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { DateRangePicker, dateFromIso, isoDate } from "../../../components/DateRangePicker";
import { TabelaFinanceira, Pill } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO, getHojeISO } from "../../../lib/hoje";
import { Paginacao } from "../ui";
import type { FatoReprodutivo } from "./api";
import type { ProgramacaoIatf } from "./Iatf";

export type FatoHistorico = FatoReprodutivo & { grupo: string; chaveHistorico?: string };
export const rotulosReprodutivos: Record<string, string> = { VAZIA: "Vazia", GESTANTE: "Gestante", DESCONHECIDA: "Desconhecida", POSITIVO: "Positivo", NEGATIVO: "Negativo", INCONCLUSIVO: "Inconclusivo", IA: "Inseminação artificial", TE: "Transferência de embrião", COBERTURA: "Cobertura", NAO_AVALIADO: "Não avaliado", ABORTO: "Aborto registrado", NASCIMENTO: "Nascimento", NATIMORTO: "Natimorto", NORMAL: "Parto", DISTOCICO: "Parto distócico", PARTO_DISTOCICO: "Parto distócico", PARTO_NORMAL: "Parto normal", GESTACAO_ENCERRADA_PARTO: "Gestação encerrada pelo parto", GESTACAO_ENCERRADA_PERDA: "Gestação encerrada por perda", PERDA: "Perda gestacional", RECONFIRMACAO: "Reconfirmação", SEXAGEM: "Sexagem", ANULADO: "Anulado", ENCERRADA: "Encerrada", ATIVA: "Confirmada" };
const filtros = [["Todos", ""], ["Tentativas", "Tentativa"], ["Avaliações", "Avaliação"], ["Gestações e perdas", "Gestação"], ["Partos", "Parto"], ["Restrições", "Restrição"], ["Situações iniciais", "Situação inicial"]] as const;
export function tituloFato(f: FatoHistorico) { return f.grupo === "Tentativa" ? rotulosReprodutivos[f.tipo ?? ""] ?? "Tentativa" : f.grupo === "Parto" ? rotulosReprodutivos[f.desfecho ?? f.tipo ?? ""] ?? "Parto" : f.grupo; }
export function HistoricoReprodutivo({ fatos, programacoes, origemDisponivel = true, onAbrir }: { fatos: FatoHistorico[]; programacoes: ProgramacaoIatf[]; origemDisponivel?: boolean; onAbrir: (fato: FatoHistorico) => void }) {
  const periodo = useRef<HTMLDivElement>(null);
  const [tipos, setTipos] = useState<string[]>(()=>new URLSearchParams(window.location.search).getAll("historicoTipos"));
  const [inicio, setInicio] = useState<string | null>(()=>new URLSearchParams(window.location.search).get("historicoInicio"));
  const [fim, setFim] = useState<string | null>(()=>new URLSearchParams(window.location.search).get("historicoFim"));
  const [pagina, setPagina] = useState(()=>Math.max(1,Math.floor(Number(new URLSearchParams(window.location.search).get("historicoPagina"))||1)));
  const [tamanho, setTamanho] = useState(()=>{const valor=Number(new URLSearchParams(window.location.search).get("historicoTamanho"));return [5,10,20,50].includes(valor)?valor:10;});
  useEffect(()=>{const restaurar=()=>{const p=new URLSearchParams(window.location.search);setTipos(p.getAll("historicoTipos"));setInicio(p.get("historicoInicio"));setFim(p.get("historicoFim"));setPagina(Math.max(1,Math.floor(Number(p.get("historicoPagina"))||1)));const n=Number(p.get("historicoTamanho"));setTamanho([5,10,20,50].includes(n)?n:10);};window.addEventListener("popstate",restaurar);return()=>window.removeEventListener("popstate",restaurar);},[]);
  useEffect(()=>{const u=new URL(window.location.href);["historicoTipos","historicoInicio","historicoFim","historicoPagina","historicoTamanho"].forEach(k=>u.searchParams.delete(k));tipos.forEach(t=>u.searchParams.append("historicoTipos",t));if(inicio!=null)u.searchParams.set("historicoInicio",inicio);if(fim!=null)u.searchParams.set("historicoFim",fim);if(pagina>1)u.searchParams.set("historicoPagina",String(pagina));if(tamanho!==10)u.searchParams.set("historicoTamanho",String(tamanho));window.history.replaceState(window.history.state,"",u.pathname+u.search+u.hash);},[tipos,inicio,fim,pagina,tamanho]);
  const hoje = getHojeISO();
  const primeiro = [...fatos].filter(f => f.data && f.data.slice(0, 10) <= hoje).sort((a,b) => a.data.localeCompare(b.data))[0]?.data.slice(0,10) ?? "";
  const de = inicio ?? primeiro, ate = fim ?? hoje;
  const invalido = !!de&&!dataValida(de)||!!ate&&!dataValida(ate)||!!de && !!ate && de > ate;
  const selecionados = invalido ? [] : fatos.filter(f => (!tipos.length || tipos.includes(f.grupo)) && (!f.data ? inicio == null && fim == null : (!de || f.data.slice(0,10) >= de) && (!ate || f.data.slice(0,10) <= ate)));
  const totalPaginas = Math.max(1, Math.ceil(selecionados.length / tamanho));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const origem = (f: FatoHistorico) => { if (!origemDisponivel) return "Vínculo não consultado"; const g = programacoes.filter(g => g.participantes.some(p => p.tarefas.some(t => [t.tentativaId, t.avaliacaoId, t.fatoId].includes(f.id) || !!f.exame && [t.avaliacaoId, t.fatoId].includes(f.exame.id)))); return g.length ? g.map(g => g.protocolo ? `${g.protocolo.nome} · v${g.protocolo.versao} · ${g.nome}` : g.nome).join("; ") : "Sem vínculo registrado"; };
  return <div className="repro-historico">
    <div className="repro-historico-periodo"><span className="text-ink-3">Período</span><div ref={periodo}><DateRangePicker value={{start:dataValida(de)?dateFromIso(de):null,end:dataValida(ate)?dateFromIso(ate):null}} onChange={range => { setInicio(range.start ? isoDate(range.start) : ""); setFim(range.end ? isoDate(range.end) : ""); setPagina(1); }} showPresets={false} triggerAriaLabel="Período do histórico reprodutivo" triggerLabel={<span className="inline-flex items-center gap-3"><CalendarDays size={18} aria-hidden="true"/>{inicio == null && fim == null ? primeiro ? `Desde o início registrado · ${formatBRDateISO(primeiro)}–${formatBRDateISO(hoje)}` : "Início não informado" : `${de ? formatBRDateISO(de) : "Sem início"}–${ate ? formatBRDateISO(ate) : "Sem fim"}`}</span>}/></div><Button variant="outline" className="repro-personalizar-periodo" onClick={() => periodo.current?.querySelector("button")?.click()}>Personalizar período</Button>{(inicio != null || fim != null) && <Button variant="outline" onClick={() => { setInicio(null); setFim(null); setPagina(1); }}>Restaurar período</Button>}</div>
    {invalido && <p role="alert">O início deve ser anterior ou igual ao fim do período.</p>}
    <div className="repro-historico-filtros"><MultiSelect compacto label="Tipos de registro" placeholder="Todos os tipos" options={filtros.filter(([,v])=>v).map(([label,value])=>({label,value}))} value={tipos} onValueChange={v=>{setTipos(v);setPagina(1);}}/></div>
    {tipos.length>0&&<div className="flex flex-wrap gap-2 pb-4" aria-label="Tipos selecionados">{tipos.map(t=><Button variant="outline" key={t} onClick={()=>{setTipos(v=>v.filter(x=>x!==t));setPagina(1);}}>{filtros.find(([,v])=>v===t)?.[0]??"Tipo selecionado"} ×</Button>)}</div>}
    <TabelaFinanceira rotulo="Histórico reprodutivo" itens={selecionados.slice((paginaAtual-1)*tamanho, paginaAtual*tamanho)} chaveDe={f => f.chaveHistorico ?? `${f.grupo}:${f.id}`} colunas={[
      { chave: "data", titulo: "Data", principal: true, celula: f => f.data ? formatBRDateISO(f.data) : "Não informada" },
      { chave: "evento", titulo: "Evento", larguraFlexivel: true, celula: tituloFato },
      { chave: "protocolo", titulo: "Protocolo / programação", celula: origem },
      { chave: "resultado", titulo: "Resultado", celula: f => <Pill>{f.status === "ANULADO" ? "Anulado" : f.grupo === "Tentativa" ? rotulosReprodutivos[f.resultado ?? ""] ?? "Consultar avaliações" : rotulosReprodutivos[f.resultado ?? f.desfecho ?? f.tipo ?? ""] ?? (f.motivo ? "Encerramento registrado" : "Registrado")}</Pill> },
      { chave: "acao", titulo: "Ação", acoes: true, celula: f => <Button variant="outline" size="sm" onClick={() => f.grupo === "Parto" ? navegarPara(`/pecuaria/reproducao/partos/${f.id}?retorno=${encodeURIComponent(window.location.pathname+window.location.search+window.location.hash)}${f.propriedadeId != null ? `&sitio=${f.propriedadeId}` : ""}`) : onAbrir(f)}>Ver detalhes</Button> },
    ]}/>
    {!selecionados.length && <p className="p-4 text-ink-3">Nenhum evento registrado neste período e tipo.</p>}
    <div className="repro-historico-tamanho"><label>Por página <select aria-label="Registros por página" value={tamanho} onChange={e => { setTamanho(Number(e.target.value)); setPagina(1); }}>{[5,10,20,50].map(n => <option key={n}>{n}</option>)}</select></label></div>
    <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} totalItens={selecionados.length} itensPorPagina={tamanho} onPaginaChange={setPagina} rotulo="registros" idSelect="pagina-historico-animal"/>
  </div>;
}
