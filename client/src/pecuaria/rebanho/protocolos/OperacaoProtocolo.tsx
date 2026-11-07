import { etapaPrioritaria } from "./prioridade-etapa";
import { DetalheFatoSanitario } from "./DetalheFatoSanitario";
import { SubTabs } from "../../../components/SubTabs";
import { Button as BotaoUI } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../../components/ui/dropdown-menu";
import { ClipboardList, Users, CalendarDays, Coins, ChevronDown } from "lucide-react";
import { abrirPreparacaoIatf } from "../reproducao/preparar-iatf";
import { AgendaEtapasProtocolo } from "./AgendaEtapasProtocolo";
import { AutomacoesProtocolo, type Automacao } from "./AutomacoesProtocolo";
import { AjudaCampo } from "../../../components/Dica";
import { ExamesTarefaProtocolo } from "./ExamesTarefaProtocolo";
import { EditorExecucaoClinica } from "./EditorExecucaoClinica";
import { EditorExecucaoManejo } from "./EditorExecucaoManejo";
import { DetalheManejoProtocolar } from "./DetalheManejoProtocolar";
import { EditorExecucaoProtocolo } from "./EditorExecucaoProtocolo";
import { Paginacao } from "../ui";
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
export type PropsOperacao = ContextoProtocolo & { aoRetirar?: (participacaoId: string) => void; ocultarCabecalho?: boolean; propriedadeId?: number; podeLancar: boolean; revisao?: number; acoes?: ReactNode; gestao?: ReactNode; custos?: ReactNode; aoSalvar?: () => void; aoExecutar?: (tarefas: TarefaOperacional[], aoSalvar: () => void) => void; regularizacao?: (tarefa: TarefaOperacional, aoSalvar: () => void) => ReactNode };
export function OperacaoProtocolo(props: PropsOperacao) {
  const identidade = props.programacaoId ?? props.participacaoId;
  return <ConteudoOperacao key={`${identidade}:${props.propriedadeId}`} {...props} />;
}
function ConteudoOperacao(props: PropsOperacao) {
  const contextoUrl = new URLSearchParams(window.location.search).get("protocoloContexto");
  const mudouContextoUrl = !!contextoUrl && contextoUrl !== (props.programacaoId ?? props.participacaoId);
  const [secao, setSecao] = useState<"etapas" | "custos" | "historico" | "participantes" | "agenda">("etapas");
  const [automacoesDisponiveis,setAutomacoesDisponiveis] = useState<Automacao[]>([]);
  const [erroAutomacoes,setErroAutomacoes] = useState(false);
  const selecaoInicial = useRef(false);
  const [automacoesAbertas, setAutomacoesAbertas] = useState(false);
  const [historicoId, setHistoricoId] = useState("");
  const [execucaoAplicacao, setExecucaoAplicacao] = useState<TarefaOperacional[] | null>(null);
  const [momentos, setMomentos] = useState<PaginaProtocolo<MomentoProtocolo> | null>(null);
  const [momentoId, setMomentoId] = useState(() => mudouContextoUrl ? "" : new URLSearchParams(window.location.search).get("momentoId") ?? "");
  const [paginaMomentos] = useState(1);
  const [avisoSelecao, setAvisoSelecao] = useState("");
  const [cabecalho, setCabecalho] = useState<CabecalhoProtocolo | null>(null);
  const [etapas, setEtapas] = useState<PaginaProtocolo<EtapaProtocolo> | null>(null);
  const [tarefas, setTarefas] = useState<PaginaProtocolo<TarefaOperacional> | null>(null);
  const [etapaId, setEtapaId] = useState(() => (() => { const p = new URLSearchParams(window.location.search); return p.get("protocoloContexto") && p.get("protocoloContexto") !== (props.programacaoId ?? props.participacaoId) ? "" : p.get("etapaId") ?? ""; })());
  const [paginaEtapas, setPaginaEtapas] = useState(() => mudouContextoUrl ? 1 : Math.max(1, Number(new URLSearchParams(window.location.search).get("paginaEtapas")) || 1));
  const [pagina, setPagina] = useState(() => mudouContextoUrl ? 1 : Math.max(1, Number(new URLSearchParams(window.location.search).get("paginaTarefas")) || 1));
  const [busca, setBusca] = useState(() => new URLSearchParams(window.location.search).get("protocoloBusca") ?? "");
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
  useEffect(() => { let vivo = true; setErro(null); Promise.all([obterCabecalhoProtocolo(contexto, props.propriedadeId), obterEtapasProtocolo(contexto, paginaEtapas, props.propriedadeId, momentoId || undefined)]).then(async ([c, e]) => { if (!vivo) return; setCabecalho(c); setEtapas(e); if (!selecaoInicial.current && e.itens.length) {
      const atual=e.itens.find(x=>x.id===etapaId);
      const concluida=atual && atual.contagens.atendidos>0 && !atual.contagens.pendentes && !atual.contagens.previstos && !atual.contagens.acompanhamentosPendentes;
      if (!atual || concluida) {
        const todas=[...e.itens];
        for(let pagina=1; vivo && pagina<=Math.ceil(e.total/e.porPagina); pagina++) if(pagina!==e.pagina) todas.push(...(await obterEtapasProtocolo(contexto,pagina,props.propriedadeId,momentoId || undefined)).itens);
        if(!vivo)return;
        const ordenadas=todas.sort((a,b)=>a.ordem-b.ordem);
        const prioridade=etapaPrioritaria(ordenadas,getHoje());
        if(prioridade){setEtapaId(prioridade.id);setPagina(1);setPaginaEtapas(Math.floor(ordenadas.indexOf(prioridade)/e.porPagina)+1);}
      }
      selecaoInicial.current=true;
    } }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [contextoId, props.propriedadeId, revisao, props.revisao, paginaEtapas, momentoId]);
  useEffect(()=>{let vivo=true; reqProtocolo<Automacao[]>(`${caminhoContexto(contexto)}/automacoes`,props.propriedadeId).then(d=>{if(vivo){setAutomacoesDisponiveis(Array.isArray(d) ? d : []);setErroAutomacoes(false);}}).catch(()=>{if(vivo)setErroAutomacoes(true);});return()=>{vivo=false;};},[contextoId,props.propriedadeId,revisao,props.revisao]);
  useEffect(() => { let vivo=true; obterMomentosProtocolo(contexto,paginaMomentos,props.propriedadeId).then(d=>{if(vivo)setMomentos(d);}).catch(e=>{if(vivo)setErro(e instanceof Error?e.message:String(e));});return()=>{vivo=false;}; },[contextoId,props.propriedadeId,paginaMomentos,revisao,props.revisao]);
  useEffect(() => { if (!etapaId) return; let vivo = true; setTarefas(null); setErro(null); obterTarefasProtocolo(contexto, { etapaId, pagina, busca, situacao: acompanhamentos ? "ACOMPANHAMENTO_PENDENTE" : pendentes ? "PENDENTES" : undefined }, props.propriedadeId).then(t => { if (!vivo) return; if (!t.itens.length && t.total && pagina > 1) setPagina(Math.max(1, Math.ceil(t.total / 10))); else setTarefas(t); }).catch(e => { if (vivo) { if (e instanceof ProtocoloApiError && e.status === 404) setEtapaInvalida(true); else setErro(e instanceof Error ? e.message : String(e)); } }); return () => { vivo = false; }; }, [contextoId, props.propriedadeId, etapaId, pagina, busca, pendentes, acompanhamentos, revisao, props.revisao]);
  useEffect(() => { if (etapaInvalida && etapas?.itens.length) { if (etapas.itens[0].id === etapaId) setErro("Não foi possível consultar esta etapa neste contexto. Atualize a consulta."); else { setEtapaId(etapas.itens[0].id); setPagina(1); } setEtapaInvalida(false); } }, [etapaInvalida, etapas, etapaId]);
  useEffect(() => { const u = new URL(window.location.href); u.searchParams.set("protocoloContexto", contextoId!); if (etapaId) u.searchParams.set("etapaId", etapaId); else u.searchParams.delete("etapaId"); momentoId ? u.searchParams.set("momentoId",momentoId) : u.searchParams.delete("momentoId"); pagina > 1 ? u.searchParams.set("paginaTarefas", String(pagina)) : u.searchParams.delete("paginaTarefas"); busca ? u.searchParams.set("protocoloBusca", busca) : u.searchParams.delete("protocoloBusca"); acompanhamentos ? u.searchParams.set("protocoloSituacao", "ACOMPANHAMENTO_PENDENTE") : pendentes ? u.searchParams.set("protocoloSituacao", "PENDENTES") : u.searchParams.delete("protocoloSituacao"); paginaEtapas > 1 ? u.searchParams.set("paginaEtapas", String(paginaEtapas)) : u.searchParams.delete("paginaEtapas"); window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash); }, [etapaId, pagina, busca, pendentes, acompanhamentos, paginaEtapas, momentoId]);
  useEffect(() => { const restaurar = () => { const p = new URLSearchParams(window.location.search); setEtapaId(p.get("etapaId") ?? ""); setMomentoId(p.get("momentoId") ?? ""); setPagina(Math.max(1, Number(p.get("paginaTarefas")) || 1)); setPaginaEtapas(Math.max(1, Number(p.get("paginaEtapas")) || 1)); setBusca(p.get("protocoloBusca") ?? ""); setPendentes(p.get("protocoloSituacao") === "PENDENTES"); setAcompanhamentos(p.get("protocoloSituacao") === "ACOMPANHAMENTO_PENDENTE"); }; window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar); }, []);
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
      setSelecionadas(Object.fromEntries(elegiveis.filter(t=>t.acoes.atender||t.acoes.reavaliar).map(t=>[t.id,t])));
      setAvisoSelecao("Selecionadas as pendências elegíveis desta ação, incluindo outras páginas.");
    }catch(e){setErro(e instanceof Error?e.message:String(e));}finally{setOcupado(false);}
  }
  const individual = cabecalho?.modo === "INDIVIDUAL";
  const etapa = etapas?.itens.find(e => e.id === etapaId);
  function podeSelecionar(t: TarefaOperacional) { return props.podeLancar && !!(props.aoExecutar || ["APLICACAO","MANEJO","RETIRADA","EXAME","TENTATIVA","AVALIACAO"].includes(t.tarefaOrigem.tipo ?? etapa?.tipo ?? "")) && (t.acoes.atender || t.acoes.reavaliar); }
  const linhas = tarefas ? { ...tarefas, itens: tarefas.itens.map(t => ({ ...t, identificacao: individual ? etapa?.nome ?? "Etapa" : `${t.animal.brinco}${t.animal.nome ? ` · ${t.animal.nome}` : ""}`, href: `/pecuaria/rebanho/animais/${encodeURIComponent(t.animal.id)}?participacaoId=${encodeURIComponent(t.participacaoId)}${props.programacaoId ? `&programacaoId=${encodeURIComponent(props.programacaoId)}` : ""}${props.propriedadeId != null ? `&sitio=${props.propriedadeId}` : ""}&retorno=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}#${cabecalho?.tipo === "SANITARIO" ? "sanidade" : "reproducao"}`, resultado: resultadoTarefa(t), pendencia: pendenciaTarefa(t), situacao: rotulos[t.situacao] ?? t.situacao, realizada: t.realizadaEm ? data(t.realizadaEm, t.precisaoRealizacao ?? "DIA") : data(t.previstaPara, t.precisaoTemporal), excecaoPrevisao: t.previsaoIndividual ? data(t.previstaPara, t.precisaoTemporal) : undefined })) } : null;
  return <div className="protocolos-superficie protocolo-conteudo grid gap-5">{cabecalho && !props.ocultarCabecalho && <header><h2 className="text-xl font-semibold">{cabecalho.nome}</h2><p className="text-sm text-ink-3">{cabecalho.protocolo.nome} · v{cabecalho.protocolo.versao}{individual ? ` · ${cabecalho.animal?.brinco ?? "Animal"}` : " · Programação coletiva"}</p></header>}
    {!cabecalho && !erro && <EsqueletoFicha label="Carregando protocolo" />}
    <SubTabs active={secao} onSelect={setSecao} ariaLabel="Conteúdo do protocolo" tabs={[{id:"etapas",label:"Etapas",icon:ClipboardList}, ...(props.gestao ? [{id:"participantes" as const,label:"Participantes",icon:Users}] : []), ...(cabecalho?.tipo === "SANITARIO" ? [{id:"agenda" as const,label:"Agenda",icon:CalendarDays}] : []),{id:"custos",label:"Custos",icon:Coins}]} />
    <div hidden={secao !== "etapas"} className="grid gap-4">
    {momentoId && <div className="flex items-center gap-3"><span className="text-sm">Etapa da agenda: {momentos?.itens.find(m => m.id === momentoId)?.nome ?? "selecionada"}</span><Button secondary onClick={() => { setMomentoId(""); setPaginaEtapas(1); setSelecionadas({}); }}>Ver todas as etapas</Button></div>}
    {avisoSelecao&&<p role="status" className="sr-only">{avisoSelecao}</p>}
    <EtapasProtocolo compacta individual={individual} referencia={`Hoje: ${getHoje().toLocaleDateString("pt-BR")}${cabecalho ? ` · início de referência ${data(cabecalho.inicioReferencia, cabecalho.precisaoTemporal)}` : ""}`} etapas={etapas ? { ...etapas, itens: etapas.itens.map(e => ({ id: e.id, nome: e.nome, referencia: `${e.unidadeIntervalo === "HORAS" ? "H" : "D"}${e.diaRelativo}`, previsao: data(e.previstaPara, e.precisaoTemporal), resumo: `${e.contagens.atendidos} atendidos · ${e.contagens.pendentes} pendentes` })) } : null} etapaId={etapaId} aoSelecionarEtapa={id => { setEtapaId(id); setPagina(1); setExpandida(null); setEditor(null); setSelecionadas({}); setAvisoSelecao("Seleção limpa ao mudar de ação."); }} aoPaginarEtapas={setPaginaEtapas} tarefas={linhas} aoPaginar={setPagina} busca={busca} aoBuscar={v => { setBusca(v); setPagina(1); }} pendentes={pendentes} aoFiltrarPendentes={v => { setPendentes(v); setAcompanhamentos(false); setPagina(1); }} acompanhamentos={acompanhamentos} aoFiltrarAcompanhamentos={() => { setAcompanhamentos(true); setPendentes(false); setPagina(1); }} acompanhamentosEtapa={etapa?.contagens.acompanhamentosPendentes} totalEtapa={etapa?.contagens.total} pendentesEtapa={etapa?.contagens.pendentes} erro={expandida ? null : erro} aoTentarNovamente={atualizar} acoes={props.podeLancar && etapaId ? <Button secondary disabled={ocupado} onClick={() => { void selecionarPendentes(); }}>Selecionar pendentes elegíveis</Button> : undefined}
      tituloDetalhe={editor ? editor.tipo === "NAO_ATENDIDO" ? "Não atender esta etapa" : editor.tipo === "ADIAMENTO" ? "Adiar atendimento" : "Editar justificativa" : "Atendimento"}
      cabecalhoEtapa={<div className="flex flex-wrap items-center gap-2"><Button secondary onClick={() => setSecao("historico")}>Histórico da etapa</Button>{(erroAutomacoes || automacoesDisponiveis.some(a=>a.procedimentos?.some(p=>p.tarefaId && tarefas?.itens.some(t=>t.id===p.tarefaId)) || a.momentoId===etapa?.momento?.id)) && <><Button secondary onClick={()=>setAutomacoesAbertas(true)}>Automações da etapa</Button><AjudaCampo rotulo="Sobre automações" texto="Consulte agendamentos, revise falhas e cancele ou reverta aplicações e dispositivos programados."/></>}</div>}

      selecaoPagina={props.podeLancar && <Checkbox aria-label="Selecionar esta página" checked={!!tarefas?.itens.filter(podeSelecionar).length && tarefas.itens.filter(podeSelecionar).every(t => !!selecionadas[t.id])} onCheckedChange={valor => setSelecionadas(atual => { const n = {...atual}; for (const t of tarefas?.itens.filter(podeSelecionar) ?? []) { if (valor && Object.keys(n).length < 100) n[t.id] = t; else if (!valor) delete n[t.id]; } return n; })} />}
      selecaoLinha={props.podeLancar ? t => podeSelecionar(t) && <Checkbox aria-label={`Selecionar ${t.animal.brinco}`} checked={!!selecionadas[t.id]} disabled={!selecionadas[t.id] && Object.keys(selecionadas).length >= 100} onCheckedChange={valor => setSelecionadas(atual => { const n = {...atual}; if (valor) n[t.id] = t; else delete n[t.id]; return n; })} /> : undefined}
      detalheBloqueado={ocupado}
      aoFecharDetalhe={() => { if (!ocupado) { setExpandida(null); setEditor(null); } }}
      acoesLinha={t => <>{podeSelecionar(t) && <Button secondary onClick={() => executar([t])}>{t.acoes.reavaliar ? "Reavaliar acompanhamento" : "Atender"}</Button>}{(t.vinculoAtual || registroLegadoSemFato(t)) && <Button secondary onClick={() => { setEditor(null); setExpandida(t.id); }}>Ver atendimento</Button>}<DropdownMenu><DropdownMenuTrigger asChild><BotaoUI variant="outline" aria-label={`Mais ações para ${t.animal.brinco}`}>Mais ações<ChevronDown size={14}/></BotaoUI></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setEditor(null); setExpandida(t.id); }}>Histórico nesta etapa</DropdownMenuItem>{t.ultimoEvento && <DropdownMenuItem onSelect={() => { setEditor(null); setExpandida(t.id); }}>Ver motivo</DropdownMenuItem>}{props.podeLancar && t.acoes.justificar && <DropdownMenuItem onSelect={() => editar(t,"NAO_ATENDIDO")}>Não atender esta etapa</DropdownMenuItem>}{props.podeLancar && t.acoes.adiar && <DropdownMenuItem onSelect={() => editar(t,"ADIAMENTO")}>Adiar atendimento</DropdownMenuItem>}{props.aoRetirar && <DropdownMenuItem className="text-destructive" onSelect={() => props.aoRetirar?.(t.participacaoId)}>Retirar do protocolo</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>{props.podeLancar && t.acoes.regularizar && props.regularizacao?.(t,aoSalvar)}</>}
      expandida={expandida} detalhesLinha={t => <div className="grid gap-3"><ErrorBox erro={erro}/>{editor?.tarefa.id === t.id ? <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void salvar(); }}>{editor.tipo === "ADIAMENTO" && <CampoDataIatf rotulo="Nova previsão" valor={prevista} onChange={v => { setPrevista(v); chave.current = crypto.randomUUID(); }} />}<label className="relative">Justificativa<textarea autoFocus required minLength={5} maxLength={1000} className={classeInput} value={motivo} onChange={e => { setMotivo(e.target.value); chave.current = crypto.randomUUID(); }} /><span className="absolute right-0 top-0"> <AjudaCampo rotulo="Ajuda sobre alteração da tarefa" texto="A alteração vale somente para esta etapa e este animal. O histórico anterior permanece."/></span></label><div className="flex gap-2"><Button type="submit" disabled={ocupado}>Salvar</Button><Button secondary disabled={ocupado} onClick={() => { setEditor(null); setExpandida(null); }}>Cancelar</Button></div></form> : <>{registroLegadoSemFato(t)&&<section className="grid gap-2 text-sm"><h4 className="font-semibold">Registro legado sem fato individual vinculado </h4>{t.tarefaOrigem.realizadoSnapshot?.dados && <>{typeof t.tarefaOrigem.realizadoSnapshot.dados.responsavel === "string" && <p>Responsável registrado: {t.tarefaOrigem.realizadoSnapshot.dados.responsavel}</p>}{typeof t.tarefaOrigem.realizadoSnapshot.dados.observacao === "string" && <p>Observação registrada: {t.tarefaOrigem.realizadoSnapshot.dados.observacao}</p>}</>}</section>}{t.vinculoAtual?.tipo==="MANEJO"?<DetalheManejoProtocolar id={t.vinculoAtual.id} propriedadeId={t.propriedadeId} tarefa={t} reprodutivo={cabecalho?.tipo==="REPRODUTIVO"} podeLancar={props.podeLancar} podeEditarValores={cabecalho?.podeEditarValores} onSalvo={aoSalvar}/>:t.vinculoAtual && <div>{["APLICACAO", "EXAME"].includes(t.vinculoAtual.tipo) && <DetalheFatoSanitario id={t.vinculoAtual.id} tipo={t.vinculoAtual.tipo === "APLICACAO" ? "aplicacao" : "exame"} propriedadeId={t.propriedadeId}/>}<p>Atendimento de origem: {t.vinculoAtual.origem}</p><LinkInterno aparencia="botao-secundario" area="pecuaria" href={t.vinculoAtual.tipo === "TENTATIVA" ? `/pecuaria/reproducao?animalId=${encodeURIComponent(t.animal.id)}&fatoId=${encodeURIComponent(t.vinculoAtual.id)}&sitio=${t.propriedadeId}&retorno=${encodeURIComponent(window.location.pathname + window.location.search)}` : `/pecuaria/sanidade?animalId=${encodeURIComponent(t.animal.id)}&detalheTipo=${t.vinculoAtual.tipo === "APLICACAO" ? "aplicacao" : "exame"}&detalheId=${encodeURIComponent(t.vinculoAtual.id)}&propriedadeId=${t.propriedadeId}&retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Abrir fato de origem</LinkInterno></div>}{t.ultimoEvento && <><p>{t.ultimoEvento.motivo}</p><p className="text-sm text-ink-3">Registrado em {data(t.ultimoEvento.ocorridaEm, "HORA")}</p>{props.podeLancar && t.acoes.retificar && <Button secondary onClick={() => editar(t, "RETIFICACAO_JUSTIFICATIVA")}>Editar justificativa</Button>}</>}{["EXAME","AVALIACAO"].includes(t.tarefaOrigem.tipo)&&<ExamesTarefaProtocolo key={`${t.id}:${revisao}`} tarefa={t} podeLancar={props.podeLancar} onSalvo={aoSalvar}/>}<HistoricoTarefa id={t.id} propriedadeId={t.propriedadeId} /><Button secondary onClick={() => { setExpandida(null); requestAnimationFrame(() => document.getElementById(`protocolo-tarefa-${t.id}`)?.querySelector<HTMLButtonElement>("button")?.focus()); }}>Fechar detalhe</Button></>}</div>}
      atendimento={Object.keys(selecionadas).length > 0 && <div className="p-4"><p className="text-sm">{Object.keys(selecionadas).filter(id=>!tarefas?.itens.some(t=>t.id===id)).length} selecionadas fora desta página.</p><Button disabled={Object.keys(selecionadas).length > 100} onClick={() => executar(Object.values(selecionadas))}>Atender selecionadas ({Object.keys(selecionadas).length})</Button></div>} />
    {automacoesAbertas && <PainelCadastro aberto rodape={<Button secondary onClick={()=>setAutomacoesAbertas(false)}>Fechar</Button>} titulo="Automações da etapa" onFechar={()=>setAutomacoesAbertas(false)}><AutomacoesProtocolo contexto={contexto} propriedadeId={props.propriedadeId} momentoId={etapa?.momento?.id ?? momentoId} revisao={revisao + (props.revisao ?? 0)} podeLancar={props.podeLancar} onSalvo={aoSalvar} /></PainelCadastro>}
    {execucaoAplicacao&&(()=>{const Editor=["MANEJO","RETIRADA"].includes(execucaoAplicacao[0].tarefaOrigem.tipo)?EditorExecucaoManejo:["EXAME","TENTATIVA","AVALIACAO"].includes(execucaoAplicacao[0].tarefaOrigem.tipo)?EditorExecucaoClinica:EditorExecucaoProtocolo;return <Editor key={execucaoAplicacao.map(t=>t.id).join(":")} tarefas={execucaoAplicacao} onPrepararIatf={ids => { abrirPreparacaoIatf(ids, execucaoAplicacao[0].propriedadeId); setExecucaoAplicacao(null); aoSalvar(); }} reprodutivo={cabecalho?.tipo === "REPRODUTIVO"} podeEditarValores={cabecalho?.podeEditarValores} onFechar={()=>setExecucaoAplicacao(null)} onSalvo={()=>{setExecucaoAplicacao(null);aoSalvar();}}/>;})()}
    </div>
    {secao === "agenda" && <AgendaEtapasProtocolo embutida contexto={contexto} propriedadeId={props.propriedadeId} onFechar={() => setSecao("etapas")} onAbrir={(momento, etapa) => { setMomentoId(momento ?? ""); setEtapaId(etapa); setPagina(1); setPaginaEtapas(1); setSelecionadas({}); setSecao("etapas"); }} />}
    {secao === "participantes" && <section className="grid gap-6" aria-label="Participantes do protocolo"><div>{props.acoes}</div>{props.gestao}</section>}
    {secao === "historico" && <section className="grid gap-4" aria-label="Histórico do protocolo"><div><Button secondary onClick={() => setSecao("etapas")}>Voltar à etapa</Button></div><h3 className="font-semibold">Histórico por atendimento</h3><p className="text-sm">Consulte a autoria e as alterações de cada tarefa. A seleção de etapa é compartilhada com o atendimento.</p><label>Etapa<select className={classeInput} value={etapaId} onChange={e => { setEtapaId(e.target.value); setHistoricoId(""); setPagina(1); }}>{etapas?.itens.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label><label>Animal<select className={classeInput} value={historicoId} onChange={e => setHistoricoId(e.target.value)}><option value="">Selecione um atendimento</option>{tarefas?.itens.map(t => <option key={t.id} value={t.id}>{t.animal.brinco}{t.animal.nome ? ` · ${t.animal.nome}` : ""}</option>)}</select></label>{tarefas && tarefas.total > 10 && <Paginacao paginaAtual={tarefas.pagina} totalPaginas={Math.ceil(tarefas.total / 10)} totalItens={tarefas.total} itensPorPagina={10} onPaginaChange={p => { setPagina(p); setHistoricoId(""); }} rotulo="animais" idSelect="historico-animais" />}{historicoId && tarefas?.itens.some(t => t.id === historicoId) && <HistoricoTarefa id={historicoId} propriedadeId={tarefas.itens.find(t => t.id === historicoId)!.propriedadeId} />}</section>}
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
