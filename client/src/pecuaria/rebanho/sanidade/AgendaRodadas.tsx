import { type ReactNode, useEffect, useRef, useState } from "react";
import { MoreHorizontal, CalendarDays } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button, CabecalhoTabela, ErrorBox, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { reqSanidade } from "./api";
import { FormRodada } from "./FormRodada";
import { consultaRodadas, consultarRodada, listarEtapasRodada, listarParticipantesRodada, listarRodadas, listarTarefasEtapa, removerParticipante, type EtapaRodada, type PaginaSanitaria, type ParticipanteRodada, type RodadaSanitaria, type TarefaRodada } from "./rodadas-api";
import { dataSanitaria, nomeAnimalSanitario, unidadeSanitaria } from "./rotulos";
import { ContagensEtapa, EstadoSanitario, rotuloTarefaSanitaria } from "./IndicadoresSanitarios";
import { SkeletonSanitario } from "./SkeletonSanitario";
const paginaUrl = (chave: string) => Math.max(1, Number(new URLSearchParams(window.location.search).get(chave)) || 1);

export function AgendaRodadas({ filtrosUI, filtros, podeLancar, rodadaId, onAbrir, onExecutar, onAcao, recarregarToken }: { filtrosUI?: ReactNode; filtros: Record<string, string | number | undefined>; podeLancar: boolean; rodadaId: string; onAbrir: (id: string) => void; onExecutar: (tarefas: TarefaRodada[]) => void; onAcao: (acao: "adiar" | "dispensar" | "cancelar" | "consultar", tarefa: TarefaRodada) => void; recarregarToken: number }) {
  const [pagina, setPagina] = useState<PaginaSanitaria<RodadaSanitaria> | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  const [salvo, setSalvo] = useState(false);
  const consulta = consultaRodadas(filtros);
  useEffect(() => { if (rodadaId) return; let vivo = true; setCarregando(true); setErro(null); listarRodadas(Object.fromEntries(new URLSearchParams(consulta))).then((v) => { if (vivo) setPagina(v); }).catch((e: unknown) => { if (vivo) setErro(`${salvo ? "Ciclo salvo. A consulta não atualizou. " : ""}${e instanceof Error ? e.message : String(e)}`); }).finally(() => { if (vivo) setCarregando(false); }); return () => { vivo = false; }; }, [consulta, revisao, recarregarToken, rodadaId]);
  if (rodadaId) return <DetalheRodada key={rodadaId} id={rodadaId} filtros={filtros} podeLancar={podeLancar} onFechar={() => onAbrir("")} onExecutar={onExecutar} onAcao={onAcao} recarregarToken={recarregarToken} onMudou={() => setRevisao((v) => v + 1)} />;
  return <section className="min-w-0">
    <CabecalhoTabela titulo="Ciclos de protocolos" acao={podeLancar ? <Button onClick={() => setCriando(true)}>Novo ciclo</Button> : undefined} />
    {filtrosUI}
    {salvo && <p role="status">Ciclo salvo.</p>}
    {erro && <><ErrorBox erro={erro} /><Button secondary onClick={() => setRevisao((v) => v + 1)}>Tentar novamente</Button></>}
    {carregando ? <SkeletonSanitario estrutura="ciclos" label="Carregando ciclos de protocolos…" /> : <><div className="sanidade-ciclos">
      <div className="sanidade-ciclo-linha sanidade-ciclo-cabecalho text-sm text-ink-3" aria-hidden="true"><span>Ciclo</span><span>Protocolo</span><span>Início</span><span>Participantes</span><span>Ação</span></div>
      {(pagina?.itens ?? []).map((r) => <div key={r.id}>
        <div className={`sanidade-ciclo-linha ${rodadaId === r.id ? "sanidade-ciclo-ativo" : ""}`}>
          <button type="button" className="text-left" onClick={() => onAbrir(r.id)}>{r.nome}</button>
          <span>{r.protocolo.nome} · v{r.protocolo.versao}</span><span>{dataSanitaria(r.inicioReferencia)}</span><span>{r.participantes ?? "—"} animais</span>
          <button type="button" className="sanidade-link underline text-left" onClick={() => onAbrir(r.id)}>Abrir ciclo</button>
        </div>
      </div>)}
    </div>{pagina && pagina.total > 0 && <Paginacao paginaAtual={pagina.pagina} totalPaginas={Math.max(1, Math.ceil(pagina.total / pagina.porPagina))} totalItens={pagina.total} itensPorPagina={pagina.porPagina} onPaginaChange={(p) => { const url = new URL(window.location.href); url.searchParams.set("pagina", String(p)); window.history.pushState(null, "", url); window.dispatchEvent(new PopStateEvent("popstate")); }} rotulo="ciclos" idSelect="pagina-rodadas" />}{!pagina?.itens?.length && <p>Nenhum ciclo encontrado. Inicie um ciclo para planejar o cuidado dos animais.</p>}</>}
    {criando && <FormRodada onFechar={() => setCriando(false)} onSalvo={(id) => { setCriando(false); setSalvo(true); setRevisao((v) => v + 1); onAbrir(id); }} />}
  </section>;
}

function DetalheRodada({ id, filtros, podeLancar, onFechar, onExecutar, onMudou, onAcao, recarregarToken }: { id: string; filtros: Record<string, string | number | undefined>; podeLancar: boolean; onFechar: () => void; onExecutar: (tarefas: TarefaRodada[]) => void; onMudou: () => void; onAcao: (acao: "adiar" | "dispensar" | "cancelar" | "consultar", tarefa: TarefaRodada) => void; recarregarToken: number }) {
  const [rodada, setRodada] = useState<RodadaSanitaria | null>(null);
  const [etapas, setEtapas] = useState<PaginaSanitaria<EtapaRodada> | null>(null);
  const [paginaEtapas, setPaginaEtapas] = useState(() => paginaUrl("paginaEtapas"));
  const [participantes, setParticipantes] = useState<PaginaSanitaria<ParticipanteRodada> | null>(null);
  const [paginaParticipantes, setPaginaParticipantes] = useState(() => paginaUrl("paginaParticipantes"));
  const [etapaId, setEtapaId] = useState(() => new URLSearchParams(window.location.search).get("etapaId") ?? "");
  const [tarefas, setTarefas] = useState<PaginaSanitaria<TarefaRodada> | null>(null);
  const [paginaTarefas, setPaginaTarefas] = useState(() => paginaUrl("paginaTarefas"));
  const [abaCiclo, setAbaCiclo] = useState(() => new URLSearchParams(window.location.search).get("abaCiclo") === "participantes" ? "participantes" : "tarefas");
  const [selecionadas, setSelecionadas] = useState<Record<string, TarefaRodada>>({});
  const [adicionando, setAdicionando] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [alteracaoSalva, setAlteracaoSalva] = useState(false);
  const [removendo, setRemovendo] = useState<ParticipanteRodada | null>(null);
  const [motivo, setMotivo] = useState("");
  const [legadas, setLegadas] = useState<PaginaSanitaria<ParticipanteRodada> | null>(null);
  const [associadas, setAssociadas] = useState<string[]>([]);
  const [associando, setAssociando] = useState(false);
  const [paginaLegadas, setPaginaLegadas] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const chave = useRef(crypto.randomUUID());
  const consulta = consultaRodadas(filtros);
  useEffect(() => { const p = new URLSearchParams(window.location.search); for (const [k, v] of Object.entries({ etapaId, paginaEtapas: String(paginaEtapas), paginaParticipantes: String(paginaParticipantes), paginaTarefas: String(paginaTarefas) })) { if (v && v !== "1") p.set(k, v); else p.delete(k); } window.history.replaceState(null, "", `${window.location.pathname}?${p}`); }, [etapaId, paginaEtapas, paginaParticipantes, paginaTarefas]);
  useEffect(() => { const restaurar = () => { const p = new URLSearchParams(window.location.search); setEtapaId(p.get("etapaId") ?? ""); setPaginaEtapas(paginaUrl("paginaEtapas")); setPaginaParticipantes(paginaUrl("paginaParticipantes")); setPaginaTarefas(paginaUrl("paginaTarefas")); }; window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar); }, []);
  useEffect(() => { let vivo = true; setRodada(null); setSelecionadas({}); setCarregando(true); setErro(null); const f = Object.fromEntries(new URLSearchParams(consulta)); Promise.all([consultarRodada(id), listarEtapasRodada(id, { ...f, pagina: paginaEtapas, porPagina: 20 }), listarParticipantesRodada(id, { ...f, pagina: paginaParticipantes, porPagina: 20 })]).then(([r, e, p]) => { if (vivo) { setRodada(r); setEtapas(e); setParticipantes(p); } }).catch((e: unknown) => { if (vivo) setErro(`${alteracaoSalva ? "Alteração salva. Não conseguimos atualizar a consulta. " : ""}${e instanceof Error ? e.message : String(e)}`); }).finally(() => { if (vivo) setCarregando(false); }); return () => { vivo = false; }; }, [id, consulta, revisao, paginaParticipantes, paginaEtapas, recarregarToken]);
  useEffect(() => { let vivo = true; setTarefas(null); if (etapaId) listarTarefasEtapa(id, etapaId, { ...Object.fromEntries(new URLSearchParams(consulta)), pagina: paginaTarefas, porPagina: 50 }).then((v) => { if (vivo) setTarefas(v); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [id, etapaId, consulta, paginaTarefas, revisao, recarregarToken]);
  function atualizar(confirmada = false) { if (confirmada) setAlteracaoSalva(true); setRevisao((v) => v + 1); onMudou(); }
  useEffect(() => { if (!etapaId && etapas?.itens.length) setEtapaId(etapas.itens.find((e) => (e.contagensFiltradas ?? e.contagens).atrasadas > 0)?.id ?? etapas.itens[0].id); }, [etapas, etapaId]);
  useEffect(() => { const restaurarAba = () => setAbaCiclo(new URLSearchParams(window.location.search).get("abaCiclo") === "participantes" ? "participantes" : "tarefas"); window.addEventListener("popstate", restaurarAba); return () => window.removeEventListener("popstate", restaurarAba); }, []);
  useEffect(() => { setSelecionadas({}); }, [id, etapaId, consulta, recarregarToken]);
  async function renomear() { if (!rodada || ocupado) return; setOcupado(true); setErro(null); try { await reqSanidade(`/rodadas/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ propriedadeId: rodada.propriedadeId, chave: chave.current, nome: novoNome.trim() }) }); setRenomeando(false); atualizar(true); } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); } }
  async function remover() { if (!rodada || !removendo || ocupado) return; setOcupado(true); setErro(null); try { await removerParticipante(id, removendo.id, { propriedadeId: removendo.propriedadeContextoId ?? removendo.propriedadeAtualId ?? rodada.propriedadeId, chave: chave.current, motivo: motivo.trim() }); setRemovendo(null); atualizar(true); } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); } }
  async function abrirAssociacao(pagina = 1) { if (!rodada) return; setAssociando(true); setPaginaLegadas(pagina); setLegadas(null); setErro(null); try { setLegadas(await reqSanidade<PaginaSanitaria<ParticipanteRodada>>(`/execucoes-sem-rodada${consultaRodadas({ propriedadeId: rodada.propriedadeId, protocoloId: rodada.protocoloId, pagina, porPagina: 20 })}`)); } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } }
  async function associar() { if (!rodada || ocupado) return; setOcupado(true); setErro(null); try { await reqSanidade(`/rodadas/${encodeURIComponent(id)}/associacao`, { method: "POST", body: JSON.stringify({ propriedadeId: rodada.propriedadeId, chave: chave.current, execucaoIds: associadas }) }); setAssociando(false); setAssociadas([]); atualizar(true); } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); } }
  if (adicionando && rodada) return <FormRodada rodada={rodada} onFechar={() => setAdicionando(false)} onSalvo={() => { setAdicionando(false); atualizar(true); }} />;
  const etapaAtual = etapas?.itens.find((etapa) => etapa.id === etapaId);
  const nomeEtapa = (etapa: EtapaRodada) => `Dia ${etapa.diaRelativo} · ${etapa.tipo === "APLICACAO" ? "Aplicação" : "Exame"}`;
  const animalFiltrado = participantes?.itens.find((p) => p.animalId === filtros.animalId)?.animal;
  function trocarAba(aba: string) { setAbaCiclo(aba); const url = new URL(window.location.href); if (aba === "tarefas") url.searchParams.delete("abaCiclo"); else url.searchParams.set("abaCiclo", aba); window.history.replaceState(null, "", url); }
  function limparAnimal() { const url = new URL(window.location.href); url.searchParams.delete("animalId"); for (const chave of ["paginaTarefas", "paginaParticipantes", "paginaEtapas"]) url.searchParams.delete(chave); window.history.pushState(null, "", url); window.dispatchEvent(new PopStateEvent("popstate")); }
  const contagensDiferentes = (etapas?.itens ?? []).some(e => e.contagensFiltradas && (["total", "pendentes", "realizadas", "dispensadas", "atrasadas", "canceladas"] as const).some(chave => (e.contagens[chave] ?? 0) !== (e.contagensFiltradas![chave] ?? 0)));
  return <section className="sanidade-ciclo-detalhe sanidade-ciclo-compacto" style={{ border: 0, background: "transparent", margin: 0, padding: "1rem" }} aria-label={rodada?.nome ?? "Ciclo de protocolo"}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h1 className="h2">{rodada?.nome ?? "Ciclo de protocolo"}</h1><Button secondary onClick={onFechar} disabled={ocupado}>Voltar para ciclos</Button></div>
    <ErrorBox erro={erro} />{alteracaoSalva && <p role="status">Alteração salva.</p>}{erro && <Button secondary onClick={() => atualizar()}>Atualizar consulta</Button>}
    {carregando ? <SkeletonSanitario estrutura="detalhe" label="Carregando ciclo de protocolo…" /> : rodada && <div className="grid gap-4">
      <div className="sanidade-ciclo-contexto"><p>{rodada.protocolo.nome} · v{rodada.protocolo.versao}</p><span className="inline-flex items-center gap-2 text-sm text-ink-3"><CalendarDays size={16} aria-hidden />Início {dataSanitaria(rodada.inicioReferencia)}</span>{podeLancar && <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">Gerenciar ciclo<MoreHorizontal size={16} aria-hidden /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setAdicionando(true)}>Adicionar participantes</DropdownMenuItem><DropdownMenuItem onSelect={() => { chave.current = crypto.randomUUID(); setNovoNome(rodada.nome); setRenomeando(true); }}>Renomear ciclo</DropdownMenuItem><DropdownMenuItem onSelect={() => { chave.current = crypto.randomUUID(); void abrirAssociacao(); }}>Associar execuções existentes</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</div>
      {filtros.animalId && <div className="flex flex-wrap items-center gap-2 text-sm"><span>Animal: <strong>{animalFiltrado ? nomeAnimalSanitario(animalFiltrado) : "Filtro individual ativo"}</strong></span><Button secondary onClick={limparAnimal}>Limpar filtro de animal</Button></div>}
      <Tabs value={abaCiclo} onValueChange={trocarAba} className="sanidade-ciclo-abas">
        <TabsList aria-label="Seções do ciclo"><TabsTrigger value="tarefas">Etapas e tarefas</TabsTrigger><TabsTrigger value="participantes">Participantes e histórico</TabsTrigger></TabsList>
        <TabsContent value="tarefas" className="grid gap-4">
          <section className="sanidade-ciclo-etapas" aria-label="Etapas do ciclo"><h3 className="font-semibold">Etapas do ciclo</h3>
            <div className="sanidade-etapas-compactas">{(etapas?.itens ?? []).map((e) => <button key={e.id} type="button" aria-pressed={etapaId === e.id} className="sanidade-etapa-escolha" onClick={() => { setEtapaId(e.id); setPaginaTarefas(1); }}><span className="font-semibold">{nomeEtapa(e)}</span><ContagensEtapa compacto contagens={e.contagensFiltradas ?? e.contagens} /></button>)}</div>
            {!etapas?.itens.length && <p className="text-sm text-ink-3">Nenhuma etapa encontrada neste contexto.</p>}
            {contagensDiferentes && <details className="sanidade-ciclo-comparacao"><summary>Comparar com {getPropriedadeAtiva() == null ? "todo o ciclo" : "o sítio consultado"}</summary><p className="text-xs text-ink-3">O contexto atual seleciona parte das tarefas. A comparação abaixo preserva os totais autorizados.</p><TabelaFinanceira rotulo="Comparação das etapas" itens={etapas?.itens ?? []} chaveDe={(e) => e.id} colunas={[
              { chave: "etapa", titulo: "Etapa", principal: true, celula: nomeEtapa },
              { chave: "todas", titulo: getPropriedadeAtiva() == null ? "Ciclo inteiro" : "No sítio consultado", celula: (e) => <ContagensEtapa compacto contagens={e.contagens} /> },
              { chave: "filtradas", titulo: "Contexto atual", celula: (e) => <ContagensEtapa compacto contagens={e.contagensFiltradas ?? e.contagens} /> },
            ]} /></details>}
            {etapas && etapas.total > etapas.porPagina && <Paginacao paginaAtual={etapas.pagina} totalPaginas={Math.max(1, Math.ceil(etapas.total / etapas.porPagina))} totalItens={etapas.total} itensPorPagina={etapas.porPagina} onPaginaChange={setPaginaEtapas} rotulo="etapas" idSelect="pagina-etapas" />}
          </section>
          {etapaId ? <section className="sanidade-ciclo-tarefas grid gap-3"><h3 className="font-semibold">Tarefas · {etapaAtual ? nomeEtapa(etapaAtual) : "Etapa selecionada"}</h3>{!tarefas ? <SkeletonSanitario label="Carregando tarefas da etapa…" /> : <><TabelaFinanceira rotulo="Tarefas da etapa" itens={tarefas.itens} chaveDe={(t) => t.id} colunas={[
            { chave: "animal", titulo: "Animal", principal: true, celula: (t) => <div className="flex items-start gap-2">{podeLancar && t.situacao === "PENDENTE" && <Checkbox className="mt-1 shrink-0" aria-label={`Selecionar tarefa de ${t.execucao.animal?.brinco ?? t.execucao.animalId}`} checked={!!selecionadas[t.id]} onCheckedChange={(marcada) => { setSelecionadas((v) => { const novo = { ...v }; if (marcada === true) novo[t.id] = t; else delete novo[t.id]; return novo; }); }} />}<span>{t.execucao.animal ? nomeAnimalSanitario(t.execucao.animal) : t.execucao.animalId}</span></div> },
            { chave: "previsao", titulo: "Previsão / situação", celula: (t) => <div className="grid gap-1"><span>{dataSanitaria(t.previstaPara)}</span><EstadoSanitario tom={t.situacao === "REALIZADA" ? "verde" : t.situacao === "PENDENTE" ? "atencao" : "neutro"}>{rotuloTarefaSanitaria(t.situacao, t.previstaPara, new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }))}</EstadoSanitario></div> },
            { chave: "planejado", titulo: "Planejado", celula: (t) => <div className="grid gap-1"><span>{t.parametros.tipo === "APLICACAO" ? t.parametros.produtoNomeSnapshot ?? "Produto planejado" : t.parametros.tipoExameNomeSnapshot ?? "Exame planejado"}</span>{t.parametros.tipo === "APLICACAO" && <span className="text-xs text-ink-3">{t.parametros.dose ?? "—"} {unidadeSanitaria(t.parametros.unidade ?? "")}</span>}</div> },
            { chave: "local", titulo: "Local", celula: (t) => <div className="grid gap-1 text-sm"><span>Previsto: {t.propriedadePrevista?.nome ?? "Não localizado"}</span>{t.propriedadeAtual?.id !== t.propriedadePrevista?.id && <span className="text-xs text-ink-3">Atual: {t.propriedadeAtual?.nome ?? "Não localizado"}</span>}</div> },
            { chave: "realizacao", titulo: "Realização", celula: (t) => { const a = t.aplicacoes?.find((f) => f.status === "VALIDO"); const e = t.exames?.find((f) => f.status === "VALIDO"); return a || e ? <div className="grid gap-1"><span>{dataSanitaria(a?.data ?? e?.data)}</span><span className="text-xs text-ink-3">{a ? `${a.nomeProdutoAplicado} · ${a.dose} ${unidadeSanitaria(a.unidadeDose ?? "")}` : e?.formatoSnapshot?.nome ?? "Exame realizado"}</span></div> : <span className="text-ink-3">{t.situacao === "PENDENTE" ? "A realizar" : "Sem fato realizado"}</span>; } },
            { chave: "acao", titulo: "Ações", acoes: true, larguraMinima: 220, celula: (t) => <div className="flex flex-wrap items-center gap-2">{podeLancar && t.situacao === "PENDENTE" && <Button onClick={() => onExecutar([t])}>Executar tarefa</Button>}<DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border hover:bg-surface-2" aria-label={`Mais ações de ${t.execucao.animal?.brinco ?? t.execucao.animalId}`}><MoreHorizontal size={18} aria-hidden /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onAcao("consultar", t)}>Consultar participação</DropdownMenuItem>{podeLancar && t.situacao === "PENDENTE" && <><DropdownMenuItem onSelect={() => onAcao("adiar", t)}>Adiar</DropdownMenuItem><DropdownMenuItem onSelect={() => onAcao("dispensar", t)}>Dispensar</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-red-800" onSelect={() => onAcao("cancelar", t)}>Cancelar execução</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu></div> },
          ]} />{tarefas.total > tarefas.porPagina && <Paginacao paginaAtual={tarefas.pagina} totalPaginas={Math.max(1, Math.ceil(tarefas.total / tarefas.porPagina))} totalItens={tarefas.total} itensPorPagina={tarefas.porPagina} onPaginaChange={setPaginaTarefas} rotulo="tarefas" idSelect="pagina-tarefas" />}</>}{podeLancar && Object.keys(selecionadas).length > 0 && <Button disabled={Object.keys(selecionadas).length > 100} onClick={() => onExecutar(Object.values(selecionadas))}>Executar selecionadas ({Object.keys(selecionadas).length})</Button>}</section> : <p className="text-sm text-ink-3">Selecione uma etapa para consultar suas tarefas.</p>}
        </TabsContent>
        <TabsContent value="participantes"><section><h3 className="mb-3 font-semibold">Participações e histórico</h3><TabelaFinanceira rotulo="Participantes do ciclo" itens={participantes?.itens ?? []} chaveDe={(p) => p.id} colunas={[
          { chave: "animal", titulo: "Animal", principal: true, celula: (p) => <a className="underline" href={`/pecuaria/rebanho/animais/${encodeURIComponent(p.animalId)}`}>{nomeAnimalSanitario(p.animal)}</a> },
          { chave: "inicio", titulo: "Início da participação", celula: (p) => dataSanitaria(p.inicio) },
          { chave: "estado", titulo: "Participação", celula: (p) => p.canceladaEm ? `Removida · ${p.motivoCancelamento ?? "motivo não registrado"}` : "Em andamento" },
          { chave: "acao", titulo: "Ações", acoes: true, celula: (p) => podeLancar && !p.canceladaEm ? <Button secondary onClick={() => { setRemovendo(p); setMotivo(""); chave.current = crypto.randomUUID(); }}>Remover com motivo</Button> : null },
        ]} />{participantes && participantes.total > participantes.porPagina && <Paginacao paginaAtual={participantes.pagina} totalPaginas={Math.max(1, Math.ceil(participantes.total / participantes.porPagina))} totalItens={participantes.total} itensPorPagina={participantes.porPagina} onPaginaChange={setPaginaParticipantes} rotulo="participantes" idSelect="pagina-participantes" />}</section></TabsContent>
      </Tabs>
      {removendo && <form className="grid gap-3 border border-border p-3" onSubmit={(e) => { e.preventDefault(); void remover(); }}><p>Remover {removendo.animal.brinco} preserva os fatos realizados e encerra apenas tarefas pendentes.</p><label>Motivo da remoção<textarea required minLength={5} maxLength={500} className={classeInput} value={motivo} onChange={(e) => { setMotivo(e.target.value); chave.current = crypto.randomUUID(); }} /></label><Button type="submit" disabled={ocupado}>Confirmar remoção</Button><Button secondary onClick={() => setRemovendo(null)}>Voltar</Button></form>}
      {associando && <section className="grid gap-3"><h3 className="font-semibold">Associar execuções existentes</h3><p>Somente execuções sem ciclo da mesma versão e sítio são elegíveis. Datas e fatos existentes serão preservados.</p>{!legadas ? <p>Consultando execuções…</p> : legadas.itens.map((p) => <label key={p.id}><Checkbox aria-label={`Associar participação de ${p.animal.brinco}`} checked={associadas.includes(p.id)} onCheckedChange={(marcada) => { chave.current = crypto.randomUUID(); setAssociadas((v) => marcada === true ? [...v, p.id] : v.filter((id) => id !== p.id)); }} /> {nomeAnimalSanitario(p.animal)} · {dataSanitaria(p.inicio)}</label>)}{legadas && legadas.total > legadas.porPagina && <Paginacao paginaAtual={paginaLegadas} totalPaginas={Math.max(1, Math.ceil(legadas.total / legadas.porPagina))} totalItens={legadas.total} itensPorPagina={legadas.porPagina} onPaginaChange={(p) => void abrirAssociacao(p)} rotulo="execuções sem ciclo" idSelect="pagina-sem-rodada" />}<Button disabled={ocupado || !associadas.length || associadas.length > 100} onClick={() => void associar()}>Confirmar associação</Button><Button secondary onClick={() => setAssociando(false)}>Voltar</Button></section>}
    </div>}
    {renomeando && <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void renomear(); }}><label>Novo nome do ciclo<input required maxLength={120} className={classeInput} value={novoNome} onChange={(e) => { chave.current = crypto.randomUUID(); setNovoNome(e.target.value); }} /></label><Button type="submit" disabled={ocupado}>Salvar nome</Button><Button secondary onClick={() => setRenomeando(false)}>Voltar</Button></form>}
  </section>;
}
