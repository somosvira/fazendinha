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
import { classeInput } from "../../../financeiro/PainelCadastro";
import { getHoje } from "../../../lib/hoje";
import { CampoDataIatf, dataHoraISO, inputHorarioIatf, horarioIatf } from "../reproducao/CampoDataIatf";
import { EtapasProtocolo, type PaginaProtocolo } from "./EtapasProtocolo";
import { ProtocoloApiError, obterCabecalhoProtocolo, obterEtapasProtocolo, obterMomentosProtocolo, obterTarefasProtocolo, registrarEventoProtocolo, type ContextoProtocolo, type CabecalhoProtocolo, type EtapaProtocolo, type MomentoProtocolo, type TarefaOperacional, type EventoProtocolo } from "./api";
const rotulos: Record<string, string> = { ATENDIDO: "Atendido", NAO_ATENDIDO: "Não atendido", SEM_REGISTRO: "Sem registro", PREVISTO: "Previsto", ADIADO: "Adiado", REGULARIZACAO_PENDENTE: "A regularizar", ENCERRADO: "Encerrada", DISPENSADO: "Dispensada", RETIRADO: "Retirada" };
const data = (valor: string | null, precisao: "DIA" | "HORA" = "DIA") => valor ? horarioIatf(valor, precisao) : "Previsão a definir";
export type PropsOperacao = ContextoProtocolo & { propriedadeId?: number; podeLancar: boolean; revisao?: number; acoes?: ReactNode; gestao?: ReactNode; custos?: ReactNode; aoSalvar?: () => void; aoExecutar?: (tarefas: TarefaOperacional[], aoSalvar: () => void) => void; regularizacao?: (tarefa: TarefaOperacional, aoSalvar: () => void) => ReactNode };
export function OperacaoProtocolo(props: PropsOperacao) {
  const identidade = props.programacaoId ?? props.participacaoId;
  return <ConteudoOperacao key={`${identidade}:${props.propriedadeId}`} {...props} />;
}
function ConteudoOperacao(props: PropsOperacao) {
  const contextoUrl = new URLSearchParams(window.location.search).get("protocoloContexto");
  const mudouContextoUrl = !!contextoUrl && contextoUrl !== (props.programacaoId ?? props.participacaoId);
  const [execucaoAplicacao, setExecucaoAplicacao] = useState<TarefaOperacional[] | null>(null);
  const [momentos, setMomentos] = useState<PaginaProtocolo<MomentoProtocolo> | null>(null);
  const [momentoId, setMomentoId] = useState(() => mudouContextoUrl ? "" : new URLSearchParams(window.location.search).get("momentoId") ?? "");
  const [paginaMomentos, setPaginaMomentos] = useState(1);
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
  useEffect(() => { let vivo = true; setErro(null); Promise.all([obterCabecalhoProtocolo(contexto, props.propriedadeId), obterEtapasProtocolo(contexto, paginaEtapas, props.propriedadeId, momentoId || undefined)]).then(([c, e]) => { if (!vivo) return; setCabecalho(c); setEtapas(e); if (!etapaId && e.itens.length) setEtapaId(e.itens[0].id); }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [contextoId, props.propriedadeId, revisao, props.revisao, paginaEtapas, momentoId]);
  useEffect(() => { let vivo=true; obterMomentosProtocolo(contexto,paginaMomentos,props.propriedadeId).then(d=>{if(vivo)setMomentos(d);}).catch(e=>{if(vivo)setErro(e instanceof Error?e.message:String(e));});return()=>{vivo=false;}; },[contextoId,props.propriedadeId,paginaMomentos,revisao,props.revisao]);
  useEffect(() => { if (!etapaId) return; let vivo = true; setTarefas(null); setErro(null); obterTarefasProtocolo(contexto, { etapaId, pagina, busca, situacao: acompanhamentos ? "ACOMPANHAMENTO_PENDENTE" : pendentes ? "PENDENTES" : undefined }, props.propriedadeId).then(t => { if (!vivo) return; if (!t.itens.length && t.total && pagina > 1) setPagina(Math.max(1, Math.ceil(t.total / 10))); else setTarefas(t); }).catch(e => { if (vivo) { if (e instanceof ProtocoloApiError && e.status === 404) setEtapaInvalida(true); else setErro(e instanceof Error ? e.message : String(e)); } }); return () => { vivo = false; }; }, [contextoId, props.propriedadeId, etapaId, pagina, busca, pendentes, acompanhamentos, revisao, props.revisao]);
  useEffect(() => { if (etapaInvalida && etapas?.itens.length) { if (etapas.itens[0].id === etapaId) setErro("Não foi possível consultar esta etapa neste contexto. Atualize a consulta."); else { setEtapaId(etapas.itens[0].id); setPagina(1); } setEtapaInvalida(false); } }, [etapaInvalida, etapas, etapaId]);
  useEffect(() => { const u = new URL(window.location.href); u.searchParams.set("protocoloContexto", contextoId!); if (etapaId) u.searchParams.set("etapaId", etapaId); else u.searchParams.delete("etapaId"); momentoId ? u.searchParams.set("momentoId",momentoId) : u.searchParams.delete("momentoId"); pagina > 1 ? u.searchParams.set("paginaTarefas", String(pagina)) : u.searchParams.delete("paginaTarefas"); busca ? u.searchParams.set("protocoloBusca", busca) : u.searchParams.delete("protocoloBusca"); acompanhamentos ? u.searchParams.set("protocoloSituacao", "ACOMPANHAMENTO_PENDENTE") : pendentes ? u.searchParams.set("protocoloSituacao", "PENDENTES") : u.searchParams.delete("protocoloSituacao"); paginaEtapas > 1 ? u.searchParams.set("paginaEtapas", String(paginaEtapas)) : u.searchParams.delete("paginaEtapas"); window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash); }, [etapaId, pagina, busca, pendentes, acompanhamentos, paginaEtapas, momentoId]);
  useEffect(() => { const restaurar = () => { const p = new URLSearchParams(window.location.search); setEtapaId(p.get("etapaId") ?? ""); setMomentoId(p.get("momentoId") ?? ""); setPagina(Math.max(1, Number(p.get("paginaTarefas")) || 1)); setPaginaEtapas(Math.max(1, Number(p.get("paginaEtapas")) || 1)); setBusca(p.get("protocoloBusca") ?? ""); setPendentes(p.get("protocoloSituacao") === "PENDENTES"); setAcompanhamentos(p.get("protocoloSituacao") === "ACOMPANHAMENTO_PENDENTE"); }; window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar); }, []);
  function editar(tarefa: TarefaOperacional, tipo: EventoProtocolo["tipo"]) { setEditor({ tarefa, tipo }); setExpandida(tarefa.id); setMotivo(tipo === "RETIFICACAO_JUSTIFICATIVA" ? tarefa.ultimoEvento?.motivo ?? "" : ""); setPrevista(tarefa.previstaPara ? inputHorarioIatf(tarefa.previstaPara, tarefa.precisaoTemporal) : ""); chave.current = crypto.randomUUID(); ocorridaEm.current = new Date().toISOString(); }
  async function salvar() { if (!editor || ocupado) return; setOcupado(true); setErro(null); try { await registrarEventoProtocolo(editor.tarefa.id, { chave: chave.current, propriedadeId: editor.tarefa.propriedadeId, tipo: editor.tipo, ocorridaEm: ocorridaEm.current, motivo: motivo.trim(), ...(editor.tipo === "ADIAMENTO" ? { previstaPara: dataHoraISO(prevista) } : {}), ...(editor.tipo === "RETIFICACAO_JUSTIFICATIVA" ? { eventoCorrigidoId: editor.tarefa.ultimoEvento?.id } : {}) }); setEditor(null); atualizar(); } catch(e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); } }
  function executar(tarefas: TarefaOperacional[]) {
    if (["APLICACAO","MANEJO","RETIRADA","EXAME","TENTATIVA","AVALIACAO"].includes(tarefas[0]?.tarefaOrigem.tipo??etapa?.tipo??"")) setExecucaoAplicacao(tarefas);
    else props.aoExecutar?.(tarefas, atualizar);
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
  const linhas = tarefas ? { ...tarefas, itens: tarefas.itens.map(t => ({ ...t, identificacao: individual ? etapa?.nome ?? "Etapa" : `${t.animal.brinco}${t.animal.nome ? ` · ${t.animal.nome}` : ""}`, href: `/pecuaria/rebanho/animais/${encodeURIComponent(t.animal.id)}?participacaoId=${encodeURIComponent(t.participacaoId)}${props.programacaoId ? `&programacaoId=${encodeURIComponent(props.programacaoId)}` : ""}${props.propriedadeId != null ? `&sitio=${props.propriedadeId}` : ""}&retorno=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}#${cabecalho?.tipo === "SANITARIO" ? "sanidade" : "reproducao"}`, resultado: resultadoTarefa(t), pendencia: pendenciaTarefa(t), situacao: rotulos[t.situacao] ?? t.situacao, realizada: t.realizadaEm ? data(t.realizadaEm, t.precisaoRealizacao ?? "DIA") : "—", excecaoPrevisao: t.previsaoIndividual ? data(t.previstaPara, t.precisaoTemporal) : undefined })) } : null;
  return <div className="protocolos-superficie protocolo-conteudo grid gap-5">{cabecalho && <header><h2 className="text-xl font-semibold">{cabecalho.nome}</h2><p className="text-sm text-ink-3">{cabecalho.protocolo.nome} · v{cabecalho.protocolo.versao}{individual ? ` · ${cabecalho.animal?.brinco ?? "Animal"}` : " · Programação coletiva"}</p></header>}
    {!cabecalho && !erro && <p role="status">Carregando protocolo…</p>}
    {momentos&&(momentos.total>1||momentos.itens.some(m=>m.id!=="SEM_MOMENTO"))&&<section className="grid gap-3" aria-label="Momentos do protocolo" data-protocolo-momentos><h3 className="font-semibold">Momento do protocolo</h3><div className="flex flex-wrap gap-2"><Button secondary={!!momentoId} aria-pressed={!momentoId} onClick={()=>{setMomentoId("");setPaginaEtapas(1);setEtapaId("");setSelecionadas({});setAvisoSelecao("Seleção limpa ao mudar de momento.");}}>Todas as ações</Button>{momentos.itens.map(m=><Button key={m.id} secondary={momentoId!==m.id} aria-pressed={momentoId===m.id} onClick={()=>{setMomentoId(m.id);setPaginaEtapas(1);setEtapaId("");setSelecionadas({});setAvisoSelecao("Seleção limpa ao mudar de momento.");}}>{m.nome}</Button>)}</div>{momentos.total>10&&<Paginacao paginaAtual={momentos.pagina} totalPaginas={Math.ceil(momentos.total/10)} totalItens={momentos.total} itensPorPagina={10} onPaginaChange={setPaginaMomentos} rotulo="momentos" idSelect="protocolo-momentos"/>}</section>}
    {avisoSelecao&&<p role="status" className="text-sm">{avisoSelecao}</p>}
    {props.podeLancar&&etapaId&&<Button secondary disabled={ocupado} onClick={()=>{void selecionarPendentes();}}>Selecionar pendentes elegíveis</Button>}
    <EtapasProtocolo individual={individual} referencia={`Hoje: ${getHoje().toLocaleDateString("pt-BR")}${cabecalho ? ` · início de referência ${data(cabecalho.inicioReferencia, cabecalho.precisaoTemporal)}` : ""}`} etapas={etapas ? { ...etapas, itens: etapas.itens.map(e => ({ id: e.id, nome: e.nome, referencia: `${e.unidadeIntervalo === "HORAS" ? "Hora" : "Dia"} ${e.diaRelativo}`, previsao: data(e.previstaPara, e.precisaoTemporal), resumo: `${e.contagens.atendidos} atendidos · ${e.contagens.pendentes} pendentes` })) } : null} etapaId={etapaId} aoSelecionarEtapa={id => { setEtapaId(id); setPagina(1); setExpandida(null); setEditor(null); setSelecionadas({}); setAvisoSelecao("Seleção limpa ao mudar de ação."); }} aoPaginarEtapas={setPaginaEtapas} tarefas={linhas} aoPaginar={setPagina} busca={busca} aoBuscar={v => { setBusca(v); setPagina(1); }} pendentes={pendentes} aoFiltrarPendentes={v => { setPendentes(v); setAcompanhamentos(false); setPagina(1); }} acompanhamentos={acompanhamentos} aoFiltrarAcompanhamentos={() => { setAcompanhamentos(true); setPendentes(false); setPagina(1); }} acompanhamentosEtapa={etapa?.contagens.acompanhamentosPendentes} totalEtapa={etapa?.contagens.total} pendentesEtapa={etapa?.contagens.pendentes} erro={erro} aoTentarNovamente={atualizar} acoes={props.acoes}
      acoesLinha={t => <>{props.podeLancar && (props.aoExecutar || ["APLICACAO","MANEJO","RETIRADA","EXAME","TENTATIVA","AVALIACAO"].includes(t.tarefaOrigem.tipo ?? etapa?.tipo ?? "")) && (t.acoes.atender || t.acoes.reavaliar) && <><label className="flex items-center gap-2"><input type="checkbox" aria-label={`Selecionar ${t.animal.brinco}`} checked={!!selecionadas[t.id]} disabled={!selecionadas[t.id]&&Object.keys(selecionadas).length>=100} onChange={e => setSelecionadas(v => { const n = { ...v }; if (e.target.checked) n[t.id] = t; else delete n[t.id]; return n; })} />Selecionar</label><Button secondary onClick={() => executar([t])}>{t.acoes.reavaliar ? "Reavaliar acompanhamento" : etapa?.tipo === "APLICACAO" ? "Aplicar produto" : "Atender"}</Button></>}{(t.vinculoAtual || registroLegadoSemFato(t)) && <Button secondary aria-expanded={expandida === t.id} onClick={() => { setEditor(null); setExpandida(expandida === t.id ? null : t.id); }}>Ver atendimento</Button>}{t.ultimoEvento && <Button secondary aria-expanded={expandida === t.id} onClick={() => { setEditor(null); setExpandida(expandida === t.id ? null : t.id); }}>Ver motivo</Button>}{props.podeLancar && <>{t.acoes.justificar && <Button secondary onClick={() => editar(t, "NAO_ATENDIDO")}>Justificar</Button>}{t.acoes.adiar && <Button secondary onClick={() => editar(t, "ADIAMENTO")}>Adiar</Button>}{t.acoes.regularizar && props.regularizacao?.(t, atualizar)}</>}</>}
      expandida={expandida} detalhesLinha={t => <div className="grid gap-3">{editor?.tarefa.id === t.id ? <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void salvar(); }}>{editor.tipo === "ADIAMENTO" && <CampoDataIatf rotulo="Nova previsão" valor={prevista} onChange={v => { setPrevista(v); chave.current = crypto.randomUUID(); }} />}<label>Justificativa<textarea autoFocus required minLength={5} maxLength={1000} className={classeInput} value={motivo} onChange={e => { setMotivo(e.target.value); chave.current = crypto.randomUUID(); }} /></label><p className="text-sm">A alteração vale somente para esta etapa e este animal. O histórico anterior permanece.</p><div className="flex gap-2"><Button type="submit" disabled={ocupado}>Salvar</Button><Button secondary disabled={ocupado} onClick={() => setEditor(null)}>Cancelar</Button></div></form> : <>{registroLegadoSemFato(t)&&<section className="grid gap-2 text-sm"><h4 className="font-semibold">Registro legado sem fato individual vinculado</h4><p>A realização histórica permanece identificada, sem criação retroativa de manejo, aplicação ou consumo.</p>{t.tarefaOrigem.realizadoSnapshot?.dados && <>{typeof t.tarefaOrigem.realizadoSnapshot.dados.responsavel === "string" && <p>Responsável registrado: {t.tarefaOrigem.realizadoSnapshot.dados.responsavel}</p>}{typeof t.tarefaOrigem.realizadoSnapshot.dados.observacao === "string" && <p>Observação registrada: {t.tarefaOrigem.realizadoSnapshot.dados.observacao}</p>}</>}</section>}{t.vinculoAtual?.tipo==="MANEJO"?<DetalheManejoProtocolar id={t.vinculoAtual.id} propriedadeId={t.propriedadeId} tarefa={t} reprodutivo={cabecalho?.tipo==="REPRODUTIVO"} podeLancar={props.podeLancar} podeEditarValores={cabecalho?.podeEditarValores} onSalvo={atualizar}/>:t.vinculoAtual && <div><p>Atendimento de origem: {t.vinculoAtual.origem}</p><LinkInterno aparencia="botao-secundario" area="pecuaria" href={t.vinculoAtual.tipo === "TENTATIVA" ? `/pecuaria/reproducao?animalId=${encodeURIComponent(t.animal.id)}&fatoId=${encodeURIComponent(t.vinculoAtual.id)}&sitio=${t.propriedadeId}&retorno=${encodeURIComponent(window.location.pathname + window.location.search)}` : `/pecuaria/sanidade?animalId=${encodeURIComponent(t.animal.id)}&detalheTipo=${t.vinculoAtual.tipo === "APLICACAO" ? "aplicacao" : "exame"}&detalheId=${encodeURIComponent(t.vinculoAtual.id)}&propriedadeId=${t.propriedadeId}&retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Abrir fato de origem</LinkInterno></div>}{t.ultimoEvento && <><p>{t.ultimoEvento.motivo}</p><p className="text-sm text-ink-3">Registrado em {data(t.ultimoEvento.ocorridaEm, "HORA")}</p>{props.podeLancar && t.acoes.retificar && <Button secondary onClick={() => editar(t, "RETIFICACAO_JUSTIFICATIVA")}>Editar justificativa</Button>}</>}{["EXAME","AVALIACAO"].includes(t.tarefaOrigem.tipo)&&<ExamesTarefaProtocolo key={`${t.id}:${revisao}`} tarefa={t} podeLancar={props.podeLancar} onSalvo={atualizar}/>}<HistoricoTarefa id={t.id} propriedadeId={t.propriedadeId} /><Button secondary onClick={() => { setExpandida(null); requestAnimationFrame(() => document.getElementById(`protocolo-tarefa-${t.id}`)?.querySelector<HTMLButtonElement>("button")?.focus()); }}>Fechar detalhe</Button></>}</div>}
      atendimento={Object.keys(selecionadas).length > 0 && <div className="p-4"><p className="text-sm">{Object.keys(selecionadas).filter(id=>!tarefas?.itens.some(t=>t.id===id)).length} selecionadas fora desta página.</p><Button disabled={Object.keys(selecionadas).length > 100} onClick={() => executar(Object.values(selecionadas))}>Atender selecionadas ({Object.keys(selecionadas).length})</Button></div>} />
    {execucaoAplicacao&&(()=>{const Editor=["MANEJO","RETIRADA"].includes(execucaoAplicacao[0].tarefaOrigem.tipo)?EditorExecucaoManejo:["EXAME","TENTATIVA","AVALIACAO"].includes(execucaoAplicacao[0].tarefaOrigem.tipo)?EditorExecucaoClinica:EditorExecucaoProtocolo;return <Editor key={execucaoAplicacao.map(t=>t.id).join(":")} tarefas={execucaoAplicacao} reprodutivo={cabecalho?.tipo === "REPRODUTIVO"} podeEditarValores={cabecalho?.podeEditarValores} onFechar={()=>setExecucaoAplicacao(null)} onSalvo={()=>{setExecucaoAplicacao(null);atualizar();props.aoSalvar?.();}}/>;})()}
    {props.gestao}
    <ProcedimentosProtocolo contexto={contexto} propriedadeId={props.propriedadeId} revisao={revisao + (props.revisao ?? 0)} />
    {erro && !etapas && <ErrorBox erro={erro} />}
  </div>;
}

function resultadoTarefa(t: TarefaOperacional): string | undefined {
  if (registroLegadoSemFato(t)) return "Registro legado sem fato individual vinculado";
  const resultado = t.resultadoProcedimento;
  if (!resultado) return undefined;
  if (resultado.realizacao === "COLETA_REGISTRADA") return "Coleta registrada";
  if (resultado.realizacao === "NAO_REALIZADO") return "Registro legado de exame não realizado";
  const conclusao = resultado.resultados.find(r => r.campo === "CONCLUSAO_GESTACIONAL")?.valor;
  return typeof conclusao === "string" ? ({ POSITIVO: "Gestação confirmada", NEGATIVO: "Gestação não confirmada", INCONCLUSIVO: "Exame inconclusivo" } as Record<string,string>)[conclusao] ?? "Exame realizado" : "Exame realizado";
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
