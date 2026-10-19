import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, CabecalhoTabela, dataBR, Empty, ErrorBox, PageHeader, PaginaFinanceira, Panel, Pill } from "../../../financeiro/financeiro-ui";
import { getHojeISO as hoje } from "../../../lib/hoje";
import { usePropriedades } from "../../../api/propriedades";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { navegarPara, parseRotaVisita, urlEtapaVisita, type EtapaVisita, type ModoVisita } from "../../../router";
import { reqV4 } from "./api";
import { getUsuario } from "../../../lib/auth";
import { executarComGuardaNavegacao, registrarGuardaNavegacao } from "../../../navegacaoGuardada";
import { criarVisita, listarVisitas, obterVisita, type AtividadeVisita, type Visita, type VisitaResumo } from "./visitas-api";
import { FolhaVisita } from "./FolhaVisita";
import { nomeAtividadeVisita, lotesAtividadeVisita, origemAtividadeVisita } from "./apresentacao-visita";
import { EtapasVisita } from "./EtapasVisita";
import { PlannerVisita } from "./PlannerVisita";
import { Transcricao } from "./TranscricaoVisita";
import { chaveGrupo, type GrupoPlannerInput } from "./planner-api";
import { EntradaVisita } from "./EntradaVisita";

const caminhoLista = "/pecuaria/visitas";
export function Visitas({ podeLancar }: { podeLancar: boolean }) {
  const [rota, setRota] = useState(() => parseRotaVisita(window.location.pathname, window.location.search) ?? { tipo: "lista" as const });
  const [lista, setLista] = useState<VisitaResumo[]>([]), [visita, setVisita] = useState<Visita | null>(null);
  const [erro, setErro] = useState<string | null>(null), [carregando, setCarregando] = useState(false), [ocupado, setOcupado] = useState(false);
  const ocupadoRef = useRef(false);
  const [data, setData] = useState(hoje()), [nome, setNome] = useState(""), [responsavel, setResponsavel] = useState(""), [propriedadeId, setPropriedadeId] = useState<number | "">(getPropriedadeAtiva() ?? "");
  const [impressao, setImpressao] = useState<{ atividades: AtividadeVisita[]; nome?: string; data?: string } | null>(null);
  const criacaoRef = useRef<{ conteudo: string; chave: string } | null>(null);
  const { data: propriedades = [] } = usePropriedades({ incluirInativos: true });
  const guardarSaida = useRef<null | (() => Promise<boolean>)>(null);
  const cancelarGuardaGlobal = useRef<null | (() => void)>(null);
  const ignorarProximoPop = useRef(false);
  const geracaoCarga = useRef(0);
  const rotaAtual = useRef(rota);
  rotaAtual.current = rota;
  const atividadeAtiva = useMemo(() => {
    if (!visita?.atividades.length) return null;
    return visita.atividades.find(a => a.id === (rota.tipo === "visita" ? rota.atividade : null)) ?? visita.atividades[0];
  }, [visita, rota]);
  const irEtapa = useCallback((etapa: EtapaVisita, opcoes: { grupo?: string; atividade?: string; modo?: ModoVisita } = {}) => {
    void executarComGuardaNavegacao(() => {
      if (rota.tipo !== "visita") return;
      ignorarProximoPop.current = true;
      navegarPara(urlEtapaVisita(rota.id, etapa, opcoes, window.location.search));
      setRota(parseRotaVisita(window.location.pathname, window.location.search) ?? rota);
    });
  }, [rota]);
  const carregar = useCallback(async () => {
    const atual = ++geracaoCarga.current;
    setCarregando(true); setErro(null);
    try {
      if (rota.tipo === "visita") {
        const carregada = await obterVisita(rota.id); if (atual !== geracaoCarga.current) return; setVisita(carregada); setLista([]);
        if (!rota.etapa || (rota.etapa === "atendimento" && !carregada.atividades.length && carregada.status !== "ENCERRADA")) {
          const etapa: EtapaVisita = carregada.atividades.length || carregada.status === "ENCERRADA" ? "atendimento" : "entrada";
          const query = new URLSearchParams(window.location.search); query.set("etapa", etapa);
          if (etapa === "atendimento" && carregada.atividades[0]) query.set("atividade", carregada.atividades[0].id);
          window.history.replaceState(window.history.state, "", `${window.location.pathname}?${query}`);
          setRota(parseRotaVisita(window.location.pathname, window.location.search)!);
        }
      } else if (rota.tipo === "lista") {
        const visitas = await listarVisitas(); if (atual !== geracaoCarga.current) return; setLista(visitas); setVisita(null);
      } else { setLista([]); setVisita(null); }
    } catch (e) { if (atual === geracaoCarga.current) setErro(e instanceof Error ? e.message : String(e)); }
    finally { if (atual === geracaoCarga.current) setCarregando(false); }
  }, [rota]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { if (impressao) requestAnimationFrame(() => window.print()); }, [impressao]);

  const executar = async (acao: () => Promise<void>) => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true); setErro(null);
    try { await acao(); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { ocupadoRef.current = false; setOcupado(false); }
  };
  const modo: ModoVisita = rota.tipo === "visita" && (rota.modo === "livre" || rota.etapa === "selecao" || rota.etapa === "atividade" || (rota.etapa === "revisao" && rota.grupo && (/^[a-f0-9-]{36}$/.test(rota.grupo) || (rota.grupo.startsWith("{") || rota.grupo.startsWith("livre-"))))) ? "livre" : "agenda";
  const revisaoPreparada = rota.tipo === "visita" && (rota.etapa === "revisao" || rota.etapa === "atividade") && visita?.atividades.some(a => a.contexto?.grupoPlanner && chaveGrupo(a.contexto.grupoPlanner as GrupoPlannerInput) === rota.grupo);
  const mostraEntrada = visita && visita.status !== "ENCERRADA" && rota.tipo === "visita" && rota.etapa === "entrada";
  const mostraPlanner = visita && visita.status !== "ENCERRADA" && rota.tipo === "visita" && ["planejamento", "selecao", "revisao", "atividade"].includes(rota.etapa ?? "");
  const mostraAtendimento = visita && rota.tipo === "visita" && rota.etapa === "atendimento" && visita.atividades.length > 0;
  const sitioVisita = propriedades.find(p=>p.id===visita?.propriedadeId)?.nome;
  const rotuloSitio = sitioVisita ? (/^sítio\b/i.test(sitioVisita) ? sitioVisita : `Sítio ${sitioVisita}`) : "Sítio da visita";
  const propDaVisita = () => {
    const p = visita?.propriedadeId ?? (typeof propriedadeId === "number" ? propriedadeId : getPropriedadeAtiva());
    if (!p) throw new Error("Selecione o sítio da visita.");
    return p;
  };
  async function imprimir() {
    await executar(async () => {
      if (!visita) return;
      const registro = await reqV4<{ snapshot: { atividades: AtividadeVisita[]; nome?: string; data?: string } }>(`/visitas/${visita.id}/impressoes`, { propriedadeId: propDaVisita() });
      setImpressao(registro.snapshot);
    });
  }
  const voltarOrigem = () => {
    const origem = atividadeAtiva ? origemAtividadeVisita(atividadeAtiva) : null;
    if (origem === "livre" && visita && atividadeAtiva?.contexto?.grupoPlanner) {
      const grupo = atividadeAtiva.contexto.grupoPlanner as GrupoPlannerInput;
      if (grupo.origem === "SELECAO") irEtapa("selecao",{modo:"livre"});
      else irEtapa("revisao",{modo:"livre",grupo:chaveGrupo(grupo)});
      return;
    }
    irEtapa(origem === "livre" ? "selecao" : origem === "agenda" ? "planejamento" : "entrada", {modo:origem ?? undefined});
  };
  const voltarLista = () => { navegarPara(caminhoLista); };
  const registrarGuardaSaida = useCallback((fn: (() => Promise<boolean>) | null) => {
    guardarSaida.current = fn;
    cancelarGuardaGlobal.current?.(); cancelarGuardaGlobal.current = null;
    if (fn) cancelarGuardaGlobal.current = registrarGuardaNavegacao(fn);
  }, []);
  useEffect(() => () => { cancelarGuardaGlobal.current?.(); guardarSaida.current = null; }, []);
  useEffect(() => {
    const pop = () => {
      const seguinte = parseRotaVisita(window.location.pathname, window.location.search) ?? { tipo: "lista" as const };
      if (ignorarProximoPop.current) { ignorarProximoPop.current = false; setRota(seguinte); return; }
      const anterior = rotaAtual.current;
      const trocouAtividade = anterior.tipo === "visita" && seguinte.tipo === "visita" && anterior.etapa === "atendimento" && seguinte.etapa === "atendimento" && anterior.atividade !== seguinte.atividade;
      const saiuDoAtendimento = anterior.tipo === "visita" && anterior.etapa === "atendimento" && (seguinte.tipo !== "visita" || seguinte.id !== anterior.id || seguinte.etapa !== "atendimento");
      if ((trocouAtividade || saiuDoAtendimento) && guardarSaida.current) {
        const voltar = anterior.tipo === "visita" ? urlEtapaVisita(anterior.id, "atendimento", { atividade: anterior.atividade ?? atividadeAtiva?.id }, window.location.search) : caminhoLista;
        const resultado = executarComGuardaNavegacao(() => setRota(seguinte));
        if (resultado && typeof resultado.then === "function") void resultado.then(ok => {
          if (!ok) { window.history.replaceState(window.history.state, "", voltar); setRota(anterior); }
        }).catch(() => { window.history.replaceState(window.history.state, "", voltar); setRota(anterior); });
        return;
      }
      setRota(seguinte);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [atividadeAtiva]);

  return <PaginaFinanceira><div className={`print:hidden${mostraAtendimento ? " visita-fluxo visita-atendimento" : ""}`}>
    {rota.tipo === "lista" ? <>
      <PageHeader eyebrow="Pecuária" titulo="Visitas veterinárias" descricao="Prepare listas, imprima e registre os atendimentos mantendo o contexto da visita." acao={podeLancar && <Button onClick={() => { criacaoRef.current=null; setData(hoje()); setNome(""); setResponsavel(""); setPropriedadeId(getPropriedadeAtiva() ?? ""); navegarPara(`${caminhoLista}/nova`); setRota({ tipo: "nova" }); }}>Nova visita</Button>}/>
      <ErrorBox erro={erro}/>{carregando && <p role="status">Carregando visitas…</p>}
      <Panel><CabecalhoTabela titulo="Visitas"/><div className="divide-y divide-border">{!carregando && !erro && lista.map(v => <button className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-surface-2" key={v.id} onClick={() => { navegarPara(`/pecuaria/visitas/${encodeURIComponent(v.id)}`); setRota(parseRotaVisita(window.location.pathname,window.location.search)!); }}>
        <span className="min-w-0 space-y-2"><strong className="block break-words font-semibold">{v.nome}</strong><span className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-3"><span><span className="block text-xs">Data da visita</span><time dateTime={v.data.slice(0,10)}>{dataBR(v.data)}</time></span><span><span className="block text-xs">Sítio</span>{propriedades.find(p=>p.id===v.propriedadeId)?.nome ?? "Não informado"}</span>{v.responsavel && <span><span className="block text-xs">Responsável</span>{v.responsavel}</span>}</span></span>
        <span className="shrink-0 self-start"><Pill tone={v.status === "ABERTA" ? "amber" : "neutral"}>{v.status === "ABERTA" ? "Aberta" : v.status === "ENCERRADA" ? "Encerrada" : v.status}</Pill></span>
      </button>)}{!carregando && !erro && !lista.length && <Empty><strong className="block font-semibold text-foreground">{getPropriedadeAtiva() ? "Nenhuma visita neste sítio." : "Nenhuma visita nos sítios disponíveis."}</strong><p className="mt-2">{podeLancar ? "Use Nova visita para organizar os animais e preparar o atendimento." : "As visitas preparadas para os sítios aos quais você tem acesso aparecerão aqui."}</p></Empty>}</div></Panel>
    </> : rota.tipo === "nova" ? <>
      <ErrorBox erro={erro}/><EntradaVisita ocupado={ocupado} podeLancar={podeLancar} onVoltar={voltarLista} onContinuar={modo=>void executar(async()=>{
        const dados={propriedadeId:propDaVisita(),data,nome,responsavel:responsavel||undefined};
        const conteudo=JSON.stringify(dados);if(criacaoRef.current?.conteudo!==conteudo)criacaoRef.current={conteudo,chave:crypto.randomUUID()};
        const v=await criarVisita({...dados,chave:criacaoRef.current!.chave});
        navegarPara(urlEtapaVisita(v.id,modo==="agenda"?"planejamento":"selecao",{modo}));setRota(parseRotaVisita(window.location.pathname,window.location.search)!);
      })} contexto={<>
        <label>Nome da visita<input required minLength={2} maxLength={120} value={nome} onChange={e=>setNome(e.target.value)}/></label>
        <label>Data da visita<input type="date" required value={data} onChange={e=>setData(e.target.value)}/></label>
        <label>Sítio<select required value={propriedadeId} onChange={e=>setPropriedadeId(e.target.value?Number(e.target.value):"")}><option value="">Selecione</option>{propriedades.filter(p=>p.ativo||p.id===propriedadeId).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        <label>Responsável (opcional)<input maxLength={160} value={responsavel} onChange={e=>setResponsavel(e.target.value)}/></label>
      </>}/>
    </> : <>
      {!mostraEntrada && !mostraPlanner && !mostraAtendimento && <PageHeader eyebrow="Pecuária · Visitas" titulo={visita?.nome ?? "Visita veterinária"} descricao={visita ? `${visita.data.slice(0,10).split("-").reverse().join("/")} · ${propriedades.find(p=>p.id===visita.propriedadeId)?.nome ?? "Sítio"} · ${visita.status}` : "Carregando visita…"} acao={<div className="flex flex-wrap gap-2"><Button secondary onClick={voltarLista}>Voltar às visitas</Button>{visita && podeLancar && visita.status !== "ENCERRADA" && rota.etapa === "atendimento" && <Button secondary onClick={()=>irEtapa("planejamento")}>Planejar visita</Button>}{visita && podeLancar && visita.status !== "ENCERRADA" && <Button secondary onClick={()=>irEtapa("entrada")}>Adicionar grupo</Button>}{visita && podeLancar && <Button secondary disabled={ocupado} onClick={()=>void imprimir()}>Gerar lista para impressão</Button>}{visita && podeLancar && visita.status !== "ENCERRADA" && <Button secondary disabled={ocupado} onClick={()=>void executarComGuardaNavegacao(()=>{void executar(async()=>{await reqV4(`/visitas/${visita.id}/encerramento`,{propriedadeId:propDaVisita()});await carregar();});})}>Encerrar visita</Button>}</div>}/>}
      <ErrorBox erro={erro}/>{carregando && <p role="status">Carregando visita…</p>}

      {mostraEntrada && visita && <EntradaVisita key={`entrada:${visita.id}`} existente ocupado={ocupado} podeLancar={podeLancar} onContinuar={modo=>irEtapa(modo==="agenda"?"planejamento":"selecao",{modo})} onVoltar={()=>visita.atividades.length?irEtapa("atendimento",{atividade:atividadeAtiva?.id}):voltarLista()} contexto={<>
        <label>Nome da visita<input readOnly value={visita.nome}/></label><label>Data da visita<input type="date" readOnly value={visita.data.slice(0,10)}/></label><label>Sítio<input readOnly value={rotuloSitio}/></label><label>Responsável (opcional)<input readOnly value={visita.responsavel??"Não informado"}/></label>
      </>}/>}
      {mostraPlanner && visita && rota.tipo === "visita" && <PlannerVisita key={`${getUsuario()?.id ?? "sessao"}:${visita.propriedadeId}:${visita.id}:${modo}:${revisaoPreparada ? `preparado:${rota.grupo}` : "rascunho"}`} visita={visita} podeLancar={podeLancar} propriedadeNome={propriedades.find(p=>p.id===visita.propriedadeId)?.nome} modo={modo} etapa={rota.etapa??"planejamento"} grupo={rota.grupo} onEtapa={irEtapa} onMudou={carregar}/>}
      {visita && rota.etapa === "atendimento" && <>
        <div className="visita-breadcrumb"><a href="/pecuaria/visitas" onClick={e=>{e.preventDefault();voltarLista();}}>Visitas veterinárias</a><span>/</span><span>Visita de {visita.data.slice(0,10).split("-").reverse().join("/")}</span></div>
        <header className="visita-cabecalho"><div><div className="visita-eyebrow">Visita veterinária · {rotuloSitio}{visita.status === "ENCERRADA" ? " · Encerrada" : ""}</div><h1>Atendimento da visita</h1><p>Registre o resultado de cada animal. As referências da lista continuam visíveis durante o atendimento.</p></div><div className="visita-acoes">{visita.status !== "ENCERRADA" && <><button className="visita-botao" onClick={voltarOrigem}>Rever grupo</button><button className="visita-botao" onClick={()=>irEtapa("entrada")}>Adicionar grupo</button></>}{podeLancar && <button className="visita-botao" disabled={ocupado} onClick={()=>void imprimir()}>Imprimir ficha de campo</button>}</div></header>
        <EtapasVisita modo={atividadeAtiva ? origemAtividadeVisita(atividadeAtiva)??undefined : undefined} etapa="atendimento" podeRevisar={false} podeAtender onNavegar={e=>e === "atendimento" ? irEtapa(e,{atividade:atividadeAtiva?.id}) : voltarOrigem()} bloqueado={visita.status === "ENCERRADA"}/>
        {atividadeAtiva && <p className="visita-dica">Origem do grupo: {origemAtividadeVisita(atividadeAtiva) === "agenda" ? "Agenda do dia" : origemAtividadeVisita(atividadeAtiva) === "livre" ? "Seleção livre" : "Não informada"}</p>}
        <div className="visita-atividades" aria-label="Atividades da visita">{visita.atividades.map(a=><button key={a.id} type="button" aria-pressed={a.id===atividadeAtiva?.id} onClick={()=>irEtapa("atendimento",{atividade:a.id})}><span>{nomeAtividadeVisita(a)}</span><small>{lotesAtividadeVisita(a)} · {a.participantes.length} animais · {a.participantes.filter(p=>p.status === "CONFIRMADO").length} confirmados</small></button>)}{!visita.atividades.length && <p className="visita-dica">Nenhuma atividade preparada.</p>}</div>
        {atividadeAtiva && <Transcricao key={atividadeAtiva.id} visita={visita} atividade={atividadeAtiva} podeLancar={podeLancar && visita.status !== "ENCERRADA"} podeRegularizar={podeLancar} onMudou={carregar} registrarGuardaSaida={registrarGuardaSaida} onPlanejar={()=>irEtapa("entrada")}/>}
      </>}
      {visita && (mostraPlanner || mostraAtendimento) && <details className="mt-6 text-sm text-ink-3"><summary className="cursor-pointer">Opções da visita</summary><div className="mt-3 flex flex-wrap gap-3">{podeLancar && <>{!mostraPlanner && visita.status !== "ENCERRADA" && <Button secondary onClick={()=>irEtapa("entrada")}>Adicionar grupo</Button>}<Button secondary disabled={ocupado} onClick={()=>void imprimir()}>Gerar lista para impressão</Button>{visita.status !== "ENCERRADA" && <Button secondary disabled={ocupado} onClick={()=>void executarComGuardaNavegacao(()=>{void executar(async()=>{await reqV4(`/visitas/${visita.id}/encerramento`,{propriedadeId:propDaVisita()});await carregar();});})}>Encerrar visita</Button>}</>}{visita.impressoes.map(i=><Button secondary key={i.id} onClick={()=>setImpressao({...i.snapshot,atividades:i.snapshot.atividades??[]})}>Reimprimir lista {i.criadoEm?.slice(0,10)??i.id.slice(0,8)}</Button>)}</div></details>}
      {visita && rota.etapa !== "atendimento" && visita.status === "ENCERRADA" && <Panel><CabecalhoTabela titulo="Visita encerrada" descricao="A lista permanece disponível para consulta e impressão."/><div className="p-4">{visita.atividades.map(a=><Button key={a.id} secondary onClick={()=>void irEtapa("atendimento",{atividade:a.id})}>{a.nome}</Button>)}</div></Panel>}
      {visita && !mostraPlanner && !mostraAtendimento && <Panel className="mt-5"><CabecalhoTabela titulo="Listas de impressão preservadas"/><div className="p-4 flex flex-wrap gap-2">{visita.impressoes.map(i=><Button secondary key={i.id} onClick={()=>setImpressao({...i.snapshot,atividades:i.snapshot.atividades??[]})}>Reimprimir lista {i.criadoEm?.slice(0,10)??i.id.slice(0,8)}</Button>)}{!visita.impressoes.length&&<p className="text-sm text-ink-3">Nenhuma lista gerada.</p>}</div></Panel>}
    </>}
  </div>{impressao && <FolhaVisita snapshot={impressao}/>}</PaginaFinanceira>;
}
