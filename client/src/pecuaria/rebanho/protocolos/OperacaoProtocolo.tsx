import { ResultadosProtocolo, useResultadosProtocolo } from "./ResultadosProtocolo";
import { Tooltip } from "radix-ui";
import { etapaPrioritaria } from "./prioridade-etapa";
import { DetalheFatoSanitario } from "./DetalheFatoSanitario";
import { SubTabs } from "../../../components/SubTabs";
import { Button as BotaoUI } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../../components/ui/dropdown-menu";
import { ClipboardList, Users, CalendarDays, Coins, ChartNoAxesCombined, ChevronDown, MoreHorizontal, Eye, Check, CalendarClock, Ban, type LucideIcon } from "lucide-react";
import { abrirPreparacaoIatf } from "../reproducao/preparar-iatf";
import { AgendaEtapasProtocolo } from "./AgendaEtapasProtocolo";
import { AutomacoesProtocolo, type Automacao } from "./AutomacoesProtocolo";
import { AjudaCampo } from "../../../components/Dica";
import { ExamesTarefaProtocolo } from "./ExamesTarefaProtocolo";
import { EditorExecucaoClinica } from "./EditorExecucaoClinica";
import { EditorExecucaoManejo } from "./EditorExecucaoManejo";
import { DetalheManejoProtocolar } from "./DetalheManejoProtocolar";
import { EditorExecucaoProtocolo } from "./EditorExecucaoProtocolo";
import { LinkInterno } from "../../../components/LinkInterno";
import { HistoricoTarefa } from "./HistoricoTarefa";
import { ProcedimentosProtocolo } from "./ProcedimentosProtocolo";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { PainelCadastro, classeInput } from "../../../financeiro/PainelCadastro";
import { getHoje } from "../../../lib/hoje";
import { CampoDataIatf, dataHoraISO, inputHorarioIatf, horarioIatf } from "../reproducao/CampoDataIatf";
import { EtapasProtocolo, type PaginaProtocolo } from "./EtapasProtocolo";
import { caminhoContexto, reqProtocolo, ProtocoloApiError, obterCabecalhoProtocolo, obterEtapasProtocolo, obterMomentosProtocolo, obterTarefasProtocolo, registrarEventoProtocolo, type ContextoProtocolo, type CabecalhoProtocolo, type EtapaProtocolo, type MomentoProtocolo, type TarefaOperacional, type EventoProtocolo } from "./api";
import { EsqueletoFicha } from "../../../components/Esqueleto";
const rotulos: Record<string, string> = { ATENDIDO: "Atendido", NAO_ATENDIDO: "Não atendido", SEM_REGISTRO: "Sem registro", PREVISTO: "Previsto", ADIADO: "Adiado", REGULARIZACAO_PENDENTE: "A regularizar", ENCERRADO: "Encerrada", DISPENSADO: "Dispensada", RETIRADO: "Retirada" };
const data = (valor: string | null, precisao: "DIA" | "HORA" = "DIA") => valor ? horarioIatf(valor, precisao).replace(" · horário não informado", "") : "Previsão a definir";
export type PropsOperacao = ContextoProtocolo & { aoRetirar?: (participacaoId: string) => void; ocultarCabecalho?: boolean; propriedadeId?: number; podeLancar: boolean; revisao?: number; acaoCabecalho?: ReactNode; acoes?: ReactNode; gestao?: ReactNode; custos?: ReactNode; aoSalvar?: () => void; aoExecutar?: (tarefas: TarefaOperacional[], aoSalvar: () => void) => void; regularizacao?: (tarefa: TarefaOperacional, aoSalvar: () => void) => ReactNode };
export function OperacaoProtocolo(props: PropsOperacao) {
  const identidade = props.programacaoId ?? props.participacaoId;
  return <ConteudoOperacao key={`${identidade}:${props.propriedadeId}`} {...props} />;
}
function ConteudoOperacao(props: PropsOperacao) {
  const contextoUrl = new URLSearchParams(window.location.search).get("protocoloContexto");
  const mudouContextoUrl = !!contextoUrl && contextoUrl !== (props.programacaoId ?? props.participacaoId);
  const [secao, setSecao] = useState<"etapas" | "resultados" | "custos" | "participantes" | "agenda">(() => {const aba=new URLSearchParams(window.location.search).get("protocoloAba");return ["resultados","custos","participantes","agenda"].includes(aba??"")?aba as "resultados"|"custos"|"participantes"|"agenda":"etapas";});
  const [automacoesDisponiveis,setAutomacoesDisponiveis] = useState<Automacao[]>([]);
  const [erroAutomacoes,setErroAutomacoes] = useState(false);
  const selecaoInicial = useRef(false);
  const [automacoesAbertas, setAutomacoesAbertas] = useState(false);
  const [execucaoAplicacao, setExecucaoAplicacao] = useState<TarefaOperacional[] | null>(null);
  const [momentos, setMomentos] = useState<PaginaProtocolo<MomentoProtocolo> | null>(null);
  const [momentoId, setMomentoId] = useState(() => mudouContextoUrl ? "" : new URLSearchParams(window.location.search).get("momentoId") ?? "");
  const [paginaMomentos] = useState(1);
  const [avisoSelecao, setAvisoSelecao] = useState("");
  const [cabecalho, setCabecalho] = useState<CabecalhoProtocolo | null>(null);
  const faseConsulta=cabecalho?.tipo === "REPRODUTIVO" ? secao === "resultados" ? "RESULTADOS" as const : "EXECUCAO" as const : undefined;
  const [etapas, setEtapas] = useState<PaginaProtocolo<EtapaProtocolo> | null>(null);
  const [tarefas, setTarefas] = useState<PaginaProtocolo<TarefaOperacional> | null>(null);
  const [etapaId, setEtapaId] = useState(() => (() => { const p = new URLSearchParams(window.location.search); return p.get("protocoloContexto") && p.get("protocoloContexto") !== (props.programacaoId ?? props.participacaoId) ? "" : p.get("etapaId") ?? ""; })());
  const etapaSolicitadaUrl=useRef(etapaId);
  const [paginaEtapas, setPaginaEtapas] = useState(() => mudouContextoUrl ? 1 : Math.max(1, Number(new URLSearchParams(window.location.search).get("paginaEtapas")) || 1));
  const [pagina, setPagina] = useState(() => mudouContextoUrl ? 1 : Math.max(1, Number(new URLSearchParams(window.location.search).get("paginaTarefas")) || 1));
  const [busca, setBusca] = useState(() => new URLSearchParams(window.location.search).get("protocoloBusca") ?? "");
  const [atendidos, setAtendidos] = useState(() => !mudouContextoUrl && new URLSearchParams(window.location.search).get("protocoloSituacao") === "ATENDIDO");
  const [pendentes, setPendentes] = useState(() => new URLSearchParams(window.location.search).get("protocoloSituacao") === "PENDENTES");
  const [acompanhamentos, setAcompanhamentos] = useState(() => !mudouContextoUrl && new URLSearchParams(window.location.search).get("protocoloSituacao") === "ACOMPANHAMENTO_PENDENTE");
  const [etapaInvalida, setEtapaInvalida] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ tarefa: TarefaOperacional; tipo: EventoProtocolo["tipo"] } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [prevista, setPrevista] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Record<string, TarefaOperacional>>({});
  const chave = useRef(crypto.randomUUID());
  const ocorridaEm = useRef(new Date().toISOString());
  const contexto = props.programacaoId ? { programacaoId: props.programacaoId } : { participacaoId: props.participacaoId! };
  const contextoId = props.programacaoId ?? props.participacaoId;
  const atualizar = () => { setRevisao(v => v + 1); setSelecionadas({}); };
  const aoSalvar = () => { atualizar(); props.aoSalvar?.(); };
  const resultados=useResultadosProtocolo(contexto,props.propriedadeId,revisao+(props.revisao??0),cabecalho?.tipo==="REPRODUTIVO");
  useEffect(()=>{if(resultados.dados?.liberado&&etapaSolicitadaUrl.current){if(resultados.dados.etapasAcompanhamento?.includes(etapaSolicitadaUrl.current)){setSecao("resultados");setEtapaId(etapaSolicitadaUrl.current);setMomentoId("");setPaginaEtapas(1);selecaoInicial.current=false;}etapaSolicitadaUrl.current="";}},[resultados.dados]);
  useEffect(()=>{if(resultados.dados?.liberado===false&&secao==="resultados"){setSecao("etapas");setEtapaId("");selecaoInicial.current=false;}},[resultados.dados?.liberado,secao]);
  useEffect(() => { let vivo = true; setErro(null); Promise.all([obterCabecalhoProtocolo(contexto, props.propriedadeId), (faseConsulta ? obterEtapasProtocolo(contexto, paginaEtapas, props.propriedadeId, momentoId || undefined, faseConsulta) : obterEtapasProtocolo(contexto, paginaEtapas, props.propriedadeId, momentoId || undefined))]).then(async ([c, e]) => { if (!vivo) return; setCabecalho(c); setEtapas(e); if ((!selecaoInicial.current || !!faseConsulta && !e.itens.some(x=>x.id===etapaId)) && e.itens.length) {
      const atual=e.itens.find(x=>x.id===etapaId);
      const concluida=atual && atual.contagens.atendidos>0 && !atual.contagens.pendentes && !atual.contagens.previstos && !atual.contagens.acompanhamentosPendentes;
      if (!atual || concluida) {
        const todas=[...e.itens];
        for(let pagina=1; vivo && pagina<=Math.ceil(e.total/e.porPagina); pagina++) if(pagina!==e.pagina) todas.push(...(await obterEtapasProtocolo(contexto,pagina,props.propriedadeId,momentoId || undefined,faseConsulta)).itens);
        if(!vivo)return;
        const ordenadas=todas.sort((a,b)=>a.ordem-b.ordem);
        const prioridade=etapaPrioritaria(ordenadas,getHoje());
        if(prioridade){setEtapaId(prioridade.id);setPagina(1);setPaginaEtapas(Math.floor(ordenadas.indexOf(prioridade)/e.porPagina)+1);}
      }
      selecaoInicial.current=true;
    } }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [contextoId, props.propriedadeId, revisao, props.revisao, paginaEtapas, momentoId, faseConsulta]);
  useEffect(()=>{let vivo=true; reqProtocolo<Automacao[]>(`${caminhoContexto(contexto)}/automacoes`,props.propriedadeId).then(d=>{if(vivo){setAutomacoesDisponiveis(Array.isArray(d) ? d : []);setErroAutomacoes(false);}}).catch(()=>{if(vivo)setErroAutomacoes(true);});return()=>{vivo=false;};},[contextoId,props.propriedadeId,revisao,props.revisao]);
  useEffect(() => { let vivo=true; obterMomentosProtocolo(contexto,paginaMomentos,props.propriedadeId).then(d=>{if(vivo)setMomentos(d);}).catch(e=>{if(vivo)setErro(e instanceof Error?e.message:String(e));});return()=>{vivo=false;}; },[contextoId,props.propriedadeId,paginaMomentos,revisao,props.revisao]);
  useEffect(() => { if (!etapaId) return; let vivo = true; setTarefas(null); setErro(null); obterTarefasProtocolo(contexto, { etapaId, pagina, busca, situacao: acompanhamentos ? "ACOMPANHAMENTO_PENDENTE" : pendentes ? "PENDENTES" : atendidos ? "ATENDIDO" : undefined }, props.propriedadeId).then(t => { if (!vivo) return; if (!t.itens.length && t.total && pagina > 1) setPagina(Math.max(1, Math.ceil(t.total / 10))); else setTarefas(t); }).catch(e => { if (vivo) { if (e instanceof ProtocoloApiError && e.status === 404) setEtapaInvalida(true); else setErro(e instanceof Error ? e.message : String(e)); } }); return () => { vivo = false; }; }, [contextoId, props.propriedadeId, etapaId, pagina, busca, pendentes, atendidos, acompanhamentos, revisao, props.revisao]);
  useEffect(() => { if (etapaInvalida && etapas?.itens.length) { if (etapas.itens[0].id === etapaId) setErro("Não foi possível consultar esta etapa neste contexto. Atualize a consulta."); else { setEtapaId(etapas.itens[0].id); setPagina(1); } setEtapaInvalida(false); } }, [etapaInvalida, etapas, etapaId]);
  useEffect(() => { const u = new URL(window.location.href); secao === "etapas" ? u.searchParams.delete("protocoloAba") : u.searchParams.set("protocoloAba",secao); u.searchParams.set("protocoloContexto", contextoId!); if (etapaId) u.searchParams.set("etapaId", etapaId); else u.searchParams.delete("etapaId"); momentoId ? u.searchParams.set("momentoId",momentoId) : u.searchParams.delete("momentoId"); pagina > 1 ? u.searchParams.set("paginaTarefas", String(pagina)) : u.searchParams.delete("paginaTarefas"); busca ? u.searchParams.set("protocoloBusca", busca) : u.searchParams.delete("protocoloBusca"); acompanhamentos ? u.searchParams.set("protocoloSituacao", "ACOMPANHAMENTO_PENDENTE") : pendentes ? u.searchParams.set("protocoloSituacao", "PENDENTES") : atendidos ? u.searchParams.set("protocoloSituacao", "ATENDIDO") : u.searchParams.delete("protocoloSituacao"); paginaEtapas > 1 ? u.searchParams.set("paginaEtapas", String(paginaEtapas)) : u.searchParams.delete("paginaEtapas"); window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash); }, [secao, etapaId, pagina, busca, pendentes, atendidos, acompanhamentos, paginaEtapas, momentoId]);
  useEffect(() => { const restaurar = () => { const p = new URLSearchParams(window.location.search); const aba=p.get("protocoloAba");setSecao(["resultados","custos","participantes","agenda"].includes(aba??"")?aba as "resultados"|"custos"|"participantes"|"agenda":"etapas");setEtapaId(p.get("etapaId") ?? ""); setMomentoId(p.get("momentoId") ?? ""); setPagina(Math.max(1, Number(p.get("paginaTarefas")) || 1)); setPaginaEtapas(Math.max(1, Number(p.get("paginaEtapas")) || 1)); setBusca(p.get("protocoloBusca") ?? ""); setAtendidos(p.get("protocoloSituacao") === "ATENDIDO"); setPendentes(p.get("protocoloSituacao") === "PENDENTES"); setAcompanhamentos(p.get("protocoloSituacao") === "ACOMPANHAMENTO_PENDENTE"); }; window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar); }, []);
  function editar(tarefa: TarefaOperacional, tipo: EventoProtocolo["tipo"]) { setEditor({ tarefa, tipo }); setExpandida(tarefa.id); setMotivo(tipo === "RETIFICACAO_JUSTIFICATIVA" ? tarefa.ultimoEvento?.motivo ?? "" : ""); setPrevista(tarefa.previstaPara ? inputHorarioIatf(tarefa.previstaPara, tarefa.precisaoTemporal) : ""); chave.current = crypto.randomUUID(); ocorridaEm.current = new Date().toISOString(); }
  async function salvar() { if (!editor || ocupado) return; setOcupado(true); setErro(null); try { await registrarEventoProtocolo(editor.tarefa.id, { chave: chave.current, propriedadeId: editor.tarefa.propriedadeId, tipo: editor.tipo, ocorridaEm: ocorridaEm.current, motivo: motivo.trim(), ...(editor.tipo === "ADIAMENTO" ? { previstaPara: dataHoraISO(prevista) } : {}), ...(editor.tipo === "RETIFICACAO_JUSTIFICATIVA" ? { eventoCorrigidoId: editor.tarefa.ultimoEvento?.id } : {}) }); setEditor(null); setExpandida(null); aoSalvar(); } catch(e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); } }
  function executar(tarefas: TarefaOperacional[]) {
    if (["APLICACAO","MANEJO","RETIRADA","EXAME","TENTATIVA","AVALIACAO"].includes(tarefas[0]?.tarefaOrigem.tipo??etapa?.tipo??"")) setExecucaoAplicacao(tarefas);
    else props.aoExecutar?.(tarefas, aoSalvar);
  }
  async function selecionarPendentes() {
    if (!etapaId || ocupado) return;
    setOcupado(true); setErro(null);
    try {
      const primeira=await obterTarefasProtocolo(contexto,{etapaId,pagina:1,situacao:"PENDENTES"},props.propriedadeId);
      if(primeira.total>100)throw new Error("Há mais de cem pendências. Escolha um subconjunto de até cem animais.");
      const elegiveis=[...primeira.itens];
      for(let p=2;p<=Math.ceil(primeira.total/10);p++)elegiveis.push(...(await obterTarefasProtocolo(contexto,{etapaId,pagina:p,situacao:"PENDENTES"},props.propriedadeId)).itens);
      setSelecionadas(Object.fromEntries(elegiveis.filter(podeSelecionar).map(t=>[t.id,t])));
      setAvisoSelecao("Selecionadas as pendências elegíveis desta ação, incluindo outras páginas.");
    }catch(e){setErro(e instanceof Error?e.message:String(e));}finally{setOcupado(false);}
  }
  const reprodutivo = cabecalho?.tipo === "REPRODUTIVO";
  const individual = cabecalho?.modo === "INDIVIDUAL";
  const etapa = etapas?.itens.find(e => e.id === etapaId);
  function podeSelecionar(t: TarefaOperacional) { return !(reprodutivo && t.situacao === "ATENDIDO") && props.podeLancar && !!(props.aoExecutar || ["APLICACAO","MANEJO","RETIRADA","EXAME","TENTATIVA","AVALIACAO"].includes(t.tarefaOrigem.tipo ?? etapa?.tipo ?? "")) && (t.acoes.atender || t.acoes.reavaliar); }
  const linhas = tarefas ? { ...tarefas, itens: tarefas.itens.map(t => ({ ...t, identificacao: individual ? etapa?.nome ?? "Etapa" : `${t.animal.brinco}${t.animal.nome ? ` · ${t.animal.nome}` : ""}`, href: `/pecuaria/rebanho/animais/${encodeURIComponent(t.animal.id)}?participacaoId=${encodeURIComponent(t.participacaoId)}${props.programacaoId ? `&programacaoId=${encodeURIComponent(props.programacaoId)}` : ""}${props.propriedadeId != null ? `&sitio=${props.propriedadeId}` : ""}&retorno=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}#${cabecalho?.tipo === "SANITARIO" ? "sanidade" : "reproducao"}`, resultado: resultadoTarefa(t), pendencia: pendenciaTarefa(t), situacaoRotulo: reprodutivo && t.situacao === "SEM_REGISTRO" ? "Sem atendimento registrado" : rotulos[t.situacao] ?? t.situacao, realizada: t.realizadaEm ? data(t.realizadaEm, t.precisaoRealizacao ?? "DIA") : reprodutivo ? "—" : data(t.previstaPara, t.precisaoTemporal), excecaoPrevisao: t.previsaoIndividual ? data(t.previstaPara, t.precisaoTemporal) : undefined })) } : null;
  if (execucaoAplicacao?.[0]?.tarefaOrigem.tipo === "AVALIACAO") return <EditorExecucaoClinica key={execucaoAplicacao.map(t=>t.id).join(":")} tarefas={execucaoAplicacao} reprodutivo={reprodutivo} podeEditarValores={cabecalho?.podeEditarValores} onPrepararIatf={ids=>{abrirPreparacaoIatf(ids,execucaoAplicacao[0].propriedadeId);setExecucaoAplicacao(null);aoSalvar();}} onFechar={()=>setExecucaoAplicacao(null)} onSalvo={()=>{setExecucaoAplicacao(null);aoSalvar();}}/>;
  return <div className="protocolos-superficie protocolo-conteudo grid gap-5">
    {cabecalho && !props.ocultarCabecalho ? <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-[1_1_220px]">
        <h2 className="break-words text-xl font-semibold">{cabecalho.nome}</h2>
        <p className="text-sm text-ink-3">{cabecalho.protocolo.nome} · v{cabecalho.protocolo.versao}{individual ? ` · ${cabecalho.animal?.brinco ?? "Animal"}` : " · Programação coletiva"}</p>
      </div>
      {props.acaoCabecalho}
    </header> : props.acaoCabecalho && <div className="flex justify-end">{props.acaoCabecalho}</div>}
    {!cabecalho && !erro && <EsqueletoFicha label="Carregando protocolo" />}
    {resultados.erro&&<ErrorBox erro={`Não foi possível consultar os resultados: ${resultados.erro}`}/>}
    <SubTabs active={secao} onSelect={aba=>{setSecao(aba);if(aba === "etapas" || aba === "resultados"){selecaoInicial.current=false;setEtapaId("");setMomentoId("");setPaginaEtapas(1);setPagina(1);setSelecionadas({});}}} ariaLabel="Conteúdo do protocolo" tabs={[{id:"etapas",label:reprodutivo ? "Execução" : "Etapas",icon:ClipboardList}, ...(props.gestao ? [{id:"participantes" as const,label:"Participantes",icon:Users}] : []), ...(cabecalho?.tipo === "SANITARIO" ? [{id:"agenda" as const,label:"Agenda",icon:CalendarDays}] : []),...(reprodutivo&&resultados.dados?.liberado?[{id:"resultados" as const,label:"Resultados",icon:ChartNoAxesCombined}]:[]),{id:"custos",label:"Custos",icon:Coins}]} />
    <div hidden={secao !== "etapas" && secao !== "resultados"} className="grid gap-4">
    {secao === "resultados"&&<ResultadosProtocolo consulta={resultados} propriedadeId={props.propriedadeId} podeLancar={props.podeLancar} aoSalvar={aoSalvar} aoOperarEtapa={id=>{setEtapaId(id);setPagina(1);setSelecionadas({});}}/>}
    {momentoId && <div className="flex items-center gap-3"><span className="text-sm">Etapa da agenda: {momentos?.itens.find(m => m.id === momentoId)?.nome ?? "selecionada"}</span><Button secondary onClick={() => { setMomentoId(""); setPaginaEtapas(1); setSelecionadas({}); }}>Ver todas as etapas</Button></div>}
    {avisoSelecao&&<p role="status" className="sr-only">{avisoSelecao}</p>}
    {(secao !== "resultados" || (etapas?.total??0)>0)&&<EtapasProtocolo compacta conectada={reprodutivo} individual={individual} referencia={`Hoje: ${getHoje().toLocaleDateString("pt-BR")}${cabecalho ? ` · início de referência ${data(cabecalho.inicioReferencia, cabecalho.precisaoTemporal)}` : ""}`} etapas={etapas ? { ...etapas, itens: etapas.itens.map(e => ({ id: e.id, nome: e.nome, referencia: `${e.unidadeIntervalo === "HORAS" ? "H" : "D"}${e.diaRelativo}`, previsao: data(e.previstaPara, e.precisaoTemporal), resumo: `${e.contagens.atendidos} atendidos · ${e.contagens.pendentes + (e.contagens.previstos ?? 0)} pendentes`, concluida: e.contagens.total > 0 && e.contagens.atendidos + (e.contagens.encerradas ?? 0) === e.contagens.total })) } : null} etapaId={etapaId} aoSelecionarEtapa={id => { setEtapaId(id); setPagina(1); setExpandida(null); setEditor(null); setSelecionadas({}); setAvisoSelecao("Seleção limpa ao mudar de ação."); }} aoPaginarEtapas={setPaginaEtapas} tarefas={linhas} aoPaginar={setPagina} busca={busca} aoBuscar={v => { setBusca(v); setPagina(1); }} pendentes={pendentes} aoFiltrarPendentes={v => { setPendentes(v); setAtendidos(false); setAcompanhamentos(false); setPagina(1); }} atendidos={atendidos} atendidosEtapa={etapa?.contagens.atendidos} aoFiltrarAtendidos={reprodutivo ? () => { setAtendidos(true); setPendentes(false); setAcompanhamentos(false); setPagina(1); } : undefined} acompanhamentos={acompanhamentos} aoFiltrarAcompanhamentos={() => { setAcompanhamentos(true); setPendentes(false); setAtendidos(false); setPagina(1); }} acompanhamentosEtapa={etapa?.contagens.acompanhamentosPendentes} totalEtapa={etapa?.contagens.total} pendentesEtapa={etapa?.contagens.pendentes} erro={expandida ? null : erro} aoTentarNovamente={atualizar} acoes={props.podeLancar && etapaId && (etapa?.contagens.pendentes??0)+(etapa?.contagens.previstos??0)>0 ? <Button secondary disabled={ocupado} onClick={() => { void selecionarPendentes(); }}>Selecionar pendentes elegíveis</Button> : undefined}
      tituloDetalhe={`${editor ? (editor.tipo === "NAO_ATENDIDO" || editor.tipo === "DISPENSA") ? editor.tipo === "DISPENSA" ? "Dispensar etapa" : "Não atender esta etapa" : editor.tipo === "ADIAMENTO" ? "Reagendar atendimento" : "Editar justificativa" : "Atendimento"} · ${etapa?.nome ?? "Etapa"}`}
      cabecalhoEtapa={<div className="flex flex-wrap items-center gap-2">{(erroAutomacoes || automacoesDisponiveis.some(a=>a.procedimentos?.some(p=>p.tarefaId && tarefas?.itens.some(t=>t.id===p.tarefaId)) || a.momentoId===etapa?.momento?.id)) && <><Button secondary onClick={()=>setAutomacoesAbertas(true)}>Automações da etapa</Button><AjudaCampo rotulo="Sobre automações" texto="Consulte agendamentos, revise falhas e cancele ou reverta aplicações e dispositivos programados."/></>}</div>}

      selecaoPagina={props.podeLancar && <Checkbox aria-label="Selecionar esta página" disabled={!tarefas?.itens.some(podeSelecionar)} checked={!!tarefas?.itens.filter(podeSelecionar).length && tarefas.itens.filter(podeSelecionar).every(t => !!selecionadas[t.id])} onCheckedChange={valor => setSelecionadas(atual => { const n = {...atual}; for (const t of tarefas?.itens.filter(podeSelecionar) ?? []) { if (valor && Object.keys(n).length < 100) n[t.id] = t; else if (!valor) delete n[t.id]; } return n; })} />}
      selecaoLinha={props.podeLancar || reprodutivo ? t => reprodutivo && t.situacao === "ATENDIDO" ? <Checkbox aria-label={`Atendido ${t.animal.brinco}`} checked disabled /> : podeSelecionar(t) ? <Checkbox aria-label={`Selecionar ${t.animal.brinco}`} checked={!!selecionadas[t.id]} disabled={!selecionadas[t.id] && Object.keys(selecionadas).length >= 100} onCheckedChange={valor => setSelecionadas(atual => { const n = {...atual}; if (valor) n[t.id] = t; else delete n[t.id]; return n; })} /> : null : undefined}
      detalheBloqueado={ocupado}
      aoFecharDetalhe={() => { if (!ocupado) { setExpandida(null); setEditor(null); } }}
      acoesLinha={t => <>{(podeSelecionar(t) || props.podeLancar && t.acoes.reavaliar) && (reprodutivo ? <AcaoEtapa rotulo={t.acoes.reavaliar ? "Reavaliar acompanhamento" : "Atender"} icone={Check} onClick={() => executar([t])}/> : <Button secondary onClick={() => executar([t])}>{t.acoes.reavaliar ? "Reavaliar acompanhamento" : "Atender"}</Button>)}{reprodutivo && props.podeLancar && t.acoes.adiar && <AcaoEtapa rotulo="Reagendar" icone={CalendarClock} onClick={() => editar(t, "ADIAMENTO")}/>} {reprodutivo && props.podeLancar && t.acoes.justificar && <AcaoEtapa rotulo="Dispensar etapa" icone={Ban} onClick={() => editar(t, "DISPENSA")}/>} {(t.vinculoAtual || registroLegadoSemFato(t)) && (reprodutivo ? <AcaoEtapa rotulo="Ver atendimento" icone={Eye} onClick={() => { setEditor(null); setExpandida(t.id); }}/> : <Button secondary onClick={() => { setEditor(null); setExpandida(t.id); }}>Ver atendimento</Button>)}<DropdownMenu><DropdownMenuTrigger asChild><BotaoUI variant="outline" size={reprodutivo ? "icon" : "default"} aria-label={`Mais ações para ${t.animal.brinco}`} title={`Mais ações para ${t.animal.brinco}`}>{reprodutivo?<MoreHorizontal size={17} aria-hidden="true"/>:<>Mais ações<ChevronDown size={14}/></>}</BotaoUI></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setEditor(null); setExpandida(t.id); }}>Histórico nesta etapa</DropdownMenuItem>{t.ultimoEvento && <DropdownMenuItem onSelect={() => { setEditor(null); setExpandida(t.id); }}>Ver motivo</DropdownMenuItem>}{!reprodutivo && props.podeLancar && t.acoes.justificar && <DropdownMenuItem onSelect={() => editar(t,"NAO_ATENDIDO")}>Não atender esta etapa</DropdownMenuItem>}{!reprodutivo && props.podeLancar && t.acoes.adiar && <DropdownMenuItem onSelect={() => editar(t,"ADIAMENTO")}>Adiar atendimento</DropdownMenuItem>}{props.aoRetirar && <DropdownMenuItem className="text-destructive" onSelect={() => props.aoRetirar?.(t.participacaoId)}>Retirar do protocolo</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>{props.podeLancar && t.acoes.regularizar && props.regularizacao?.(t,aoSalvar)}</>}
      expandida={expandida} detalhesLinha={t => <div className="grid gap-3"><ErrorBox erro={erro}/>{editor?.tarefa.id === t.id ? <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void salvar(); }}>{editor.tipo === "DISPENSA" && t.tarefaOrigem.tipo === "RETIRADA" && <p>A dispensa desta etapa não comprova a retirada física do dispositivo. O cuidado permanece até haver um registro de retirada.</p>}{editor.tipo === "ADIAMENTO" && <CampoDataIatf rotulo="Nova previsão" valor={prevista} onChange={v => { setPrevista(v); chave.current = crypto.randomUUID(); }} />}<label className="relative">Justificativa<textarea autoFocus required minLength={5} maxLength={1000} className={classeInput} value={motivo} onChange={e => { setMotivo(e.target.value); chave.current = crypto.randomUUID(); }} /><span className="absolute right-0 top-0"> <AjudaCampo rotulo="Ajuda sobre alteração da tarefa" texto="A alteração vale somente para esta etapa e este animal. O histórico anterior permanece."/></span></label><div className="flex gap-2"><Button type="submit" disabled={ocupado}>Salvar</Button><Button secondary disabled={ocupado} onClick={() => { setEditor(null); setExpandida(null); }}>Cancelar</Button></div></form> : <>{registroLegadoSemFato(t)&&<section className="grid gap-2 text-sm"><h4 className="font-semibold">Registro legado sem fato individual vinculado </h4>{t.tarefaOrigem.realizadoSnapshot?.dados && <>{typeof t.tarefaOrigem.realizadoSnapshot.dados.responsavel === "string" && <p>Responsável registrado: {t.tarefaOrigem.realizadoSnapshot.dados.responsavel}</p>}{typeof t.tarefaOrigem.realizadoSnapshot.dados.observacao === "string" && <p>Observação registrada: {t.tarefaOrigem.realizadoSnapshot.dados.observacao}</p>}</>}</section>}{t.vinculoAtual?.tipo==="MANEJO"?<DetalheManejoProtocolar id={t.vinculoAtual.id} propriedadeId={t.propriedadeId} tarefa={t} reprodutivo={cabecalho?.tipo==="REPRODUTIVO"} podeLancar={props.podeLancar} podeEditarValores={cabecalho?.podeEditarValores} onSalvo={aoSalvar}/>:t.vinculoAtual && <div>{["APLICACAO", "EXAME"].includes(t.vinculoAtual.tipo) && <DetalheFatoSanitario id={t.vinculoAtual.id} tipo={t.vinculoAtual.tipo === "APLICACAO" ? "aplicacao" : "exame"} propriedadeId={t.propriedadeId}/>}<p>Atendimento de origem: {t.vinculoAtual.origem}</p><LinkInterno aparencia="botao-secundario" area="pecuaria" href={t.vinculoAtual.tipo === "TENTATIVA" ? `/pecuaria/reproducao?animalId=${encodeURIComponent(t.animal.id)}&fatoId=${encodeURIComponent(t.vinculoAtual.id)}&sitio=${t.propriedadeId}&retorno=${encodeURIComponent(window.location.pathname + window.location.search)}` : `/pecuaria/sanidade?animalId=${encodeURIComponent(t.animal.id)}&detalheTipo=${t.vinculoAtual.tipo === "APLICACAO" ? "aplicacao" : "exame"}&detalheId=${encodeURIComponent(t.vinculoAtual.id)}&propriedadeId=${t.propriedadeId}&retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Abrir fato de origem</LinkInterno></div>}{t.ultimoEvento && <><p>{t.ultimoEvento.motivo}</p><p className="text-sm text-ink-3">Registrado em {data(t.ultimoEvento.ocorridaEm, "HORA")}</p>{props.podeLancar && t.acoes.retificar && <Button secondary onClick={() => editar(t, "RETIFICACAO_JUSTIFICATIVA")}>Editar justificativa</Button>}</>}{["EXAME","AVALIACAO"].includes(t.tarefaOrigem.tipo)&&<ExamesTarefaProtocolo key={`${t.id}:${revisao}`} tarefa={t} podeLancar={props.podeLancar} onSalvo={aoSalvar}/>}<HistoricoTarefa id={t.id} propriedadeId={t.propriedadeId} /><Button secondary onClick={() => { setExpandida(null); requestAnimationFrame(() => document.getElementById(`protocolo-tarefa-${t.id}`)?.querySelector<HTMLButtonElement>("button")?.focus()); }}>Fechar detalhe</Button></>}</div>}
      atendimento={Object.keys(selecionadas).length > 0 && <div className="p-4">{Object.keys(selecionadas).some(id=>!tarefas?.itens.some(t=>t.id===id))&&<p className="text-sm">{Object.keys(selecionadas).filter(id=>!tarefas?.itens.some(t=>t.id===id)).length} selecionadas fora desta página.</p>}<Button disabled={Object.keys(selecionadas).length > 100} onClick={() => executar(Object.values(selecionadas))}>Atender selecionadas ({Object.keys(selecionadas).length})</Button></div>} />}
    {automacoesAbertas && <PainelCadastro aberto rodape={<Button secondary onClick={()=>setAutomacoesAbertas(false)}>Fechar</Button>} titulo="Automações da etapa" onFechar={()=>setAutomacoesAbertas(false)}><AutomacoesProtocolo contexto={contexto} propriedadeId={props.propriedadeId} momentoId={etapa?.momento?.id ?? momentoId} revisao={revisao + (props.revisao ?? 0)} podeLancar={props.podeLancar} onSalvo={aoSalvar} /></PainelCadastro>}
    {execucaoAplicacao&&(()=>{const Editor=["MANEJO","RETIRADA"].includes(execucaoAplicacao[0].tarefaOrigem.tipo)?EditorExecucaoManejo:["EXAME","TENTATIVA","AVALIACAO"].includes(execucaoAplicacao[0].tarefaOrigem.tipo)?EditorExecucaoClinica:EditorExecucaoProtocolo;return <Editor key={execucaoAplicacao.map(t=>t.id).join(":")} tarefas={execucaoAplicacao} onPrepararIatf={ids => { abrirPreparacaoIatf(ids, execucaoAplicacao[0].propriedadeId); setExecucaoAplicacao(null); aoSalvar(); }} reprodutivo={cabecalho?.tipo === "REPRODUTIVO"} podeEditarValores={cabecalho?.podeEditarValores} onFechar={()=>setExecucaoAplicacao(null)} onSalvo={()=>{setExecucaoAplicacao(null);aoSalvar();}}/>;})()}
    </div>
    {secao === "agenda" && <AgendaEtapasProtocolo embutida contexto={contexto} propriedadeId={props.propriedadeId} onFechar={() => setSecao("etapas")} onAbrir={(momento, etapa) => { setMomentoId(momento ?? ""); setEtapaId(etapa); setPagina(1); setPaginaEtapas(1); setSelecionadas({}); setSecao("etapas"); }} />}
    {secao === "participantes" && <section className="grid gap-6" aria-label="Participantes do protocolo"><div>{props.acoes}</div>{props.gestao}</section>}
    {secao === "custos" && <ProcedimentosProtocolo contexto={contexto} propriedadeId={props.propriedadeId} revisao={revisao + (props.revisao ?? 0)} />}
    {erro && !etapas && <ErrorBox erro={erro} />}
  </div>;
}

function resultadoTarefa(t: TarefaOperacional): string | undefined {
  if (t.revisaoAutomacaoRetroativa) return t.revisaoAutomacaoRetroativa.decisao === "DISPENSAR" ? "Revisão retroativa · dispensada" : "Revisão retroativa · atendimento manual";
  if ((t.tarefaOrigem.realizadoSnapshot as { origemExecucao?: string } | null)?.origemExecucao === "AUTOMATICA_PROGRAMADA") return "Executado automaticamente";
  if (registroLegadoSemFato(t)) return "Registro legado sem fato individual vinculado";
  const resultado = t.resultadoProcedimento;
  if (!resultado) return undefined;
  if (resultado.realizacao === "COLETA_REGISTRADA") return "Coleta registrada";
  if (resultado.realizacao === "NAO_REALIZADO") return "Registro legado de exame não realizado";
  const conclusao = resultado.resultados.find(r => r.campo === "CONCLUSAO_GESTACIONAL")?.valor;
  const rotulo = typeof conclusao === "string" ? ({ POSITIVO: "Gestação confirmada", NEGATIVO: "Gestação não confirmada", INCONCLUSIVO: "Exame inconclusivo" } as Record<string,string>)[conclusao] ?? "Exame realizado" : "Exame realizado";
  return resultado.resultadoAptidao ? `${rotulo} · Aptidão: ${({ APTO: "Apta", NAO_APTO: "Não apta", INCONCLUSIVO: "Pendente" } as Record<string,string>)[resultado.resultadoAptidao] ?? "Não informada"}` : rotulo;
}

function registroLegadoSemFato(t: TarefaOperacional): boolean {
  return ["MANEJO", "RETIRADA"].includes(t.tarefaOrigem.tipo) && !t.vinculoAtual && !!(t.realizadaEm || t.tarefaOrigem.realizadoSnapshot);
}
function pendenciaTarefa(t: TarefaOperacional): string | undefined {
  const motivos = [
    ...(t.situacao === "REGULARIZACAO_PENDENTE" ? ["Regularize o procedimento anterior antes de novo atendimento."] : []),
    ...(t.acompanhamentoPendente ? [t.resultadoProcedimento?.realizacao === "COLETA_REGISTRADA" ? "Aguardando resultado" : "Acompanhamento pendente"] : []),
  ];
  return motivos.length ? motivos.join(" · ") : undefined;
}

/** O tooltip não intercepta o comando: o mesmo botão opera com mouse, toque e teclado. */
function AcaoEtapa({ rotulo, icone: Icone, onClick }: { rotulo: string; icone: LucideIcon; onClick: () => void }) {
  return <Tooltip.Provider delayDuration={200}><Tooltip.Root><Tooltip.Trigger asChild><BotaoUI variant="outline" size="icon" aria-label={rotulo} title={rotulo} onClick={onClick}><Icone size={17} aria-hidden="true"/></BotaoUI></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="protocolo-acao-tooltip" sideOffset={6}>{rotulo}<Tooltip.Arrow/></Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider>;
}
