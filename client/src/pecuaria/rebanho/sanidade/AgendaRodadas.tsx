import { Fragment, useEffect, useRef, useState } from "react";
import { Button, ErrorBox, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { reqSanidade } from "./api";
import { FormRodada } from "./FormRodada";
import { consultaRodadas, consultarRodada, listarEtapasRodada, listarParticipantesRodada, listarRodadas, listarTarefasEtapa, removerParticipante, type EtapaRodada, type PaginaSanitaria, type ParticipanteRodada, type RodadaSanitaria, type TarefaRodada } from "./rodadas-api";
import { dataSanitaria, nomeAnimalSanitario, unidadeSanitaria } from "./rotulos";
const paginaUrl = (chave: string) => Math.max(1, Number(new URLSearchParams(window.location.search).get(chave)) || 1);

export function AgendaRodadas({ filtros, podeLancar, rodadaId, onAbrir, onExecutar, onAcao, recarregarToken }: { filtros: Record<string, string | number | undefined>; podeLancar: boolean; rodadaId: string; onAbrir: (id: string) => void; onExecutar: (tarefas: TarefaRodada[]) => void; onAcao: (acao: "adiar" | "dispensar" | "cancelar" | "consultar", tarefa: TarefaRodada) => void; recarregarToken: number }) {
  const [pagina, setPagina] = useState<PaginaSanitaria<RodadaSanitaria> | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  const [salvo, setSalvo] = useState(false);
  const consulta = consultaRodadas(filtros);
  useEffect(() => { let vivo = true; setCarregando(true); setErro(null); listarRodadas(Object.fromEntries(new URLSearchParams(consulta))).then((v) => { if (vivo) setPagina(v); }).catch((e: unknown) => { if (vivo) setErro(`${salvo ? "Ciclo salvo. A consulta não atualizou. " : ""}${e instanceof Error ? e.message : String(e)}`); }).finally(() => { if (vivo) setCarregando(false); }); return () => { vivo = false; }; }, [consulta, revisao, recarregarToken]);
  return <section className="grid gap-4">
    {podeLancar && <div className="flex justify-end"><Button onClick={() => setCriando(true)}>Novo ciclo</Button></div>}
    {salvo && <p role="status">Ciclo salvo.</p>}
    {erro && <><ErrorBox erro={erro} /><Button secondary onClick={() => setRevisao((v) => v + 1)}>Tentar novamente</Button></>}
    {carregando ? <p>Carregando ciclos…</p> : <><div className="sanidade-ciclos">
      <h2 className="h2 p-4">Ciclos de protocolos</h2>
      <div className="sanidade-ciclo-linha sanidade-ciclo-cabecalho text-sm text-ink-3" aria-hidden="true"><span>Ciclo</span><span>Protocolo</span><span>Início</span><span>Participantes</span><span>Ação</span></div>
      {(pagina?.itens ?? []).map((r) => <Fragment key={r.id}>
        <div className={`sanidade-ciclo-linha ${rodadaId === r.id ? "sanidade-ciclo-ativo" : ""}`}>
          <button type="button" className="text-left" aria-expanded={rodadaId === r.id} aria-controls={`ciclo-${r.id}`} onClick={() => onAbrir(rodadaId === r.id ? "" : r.id)}>{rodadaId === r.id ? "⌄" : "›"} {r.nome}</button>
          <span>{r.protocolo.nome} · v{r.protocolo.versao}</span><span>{dataSanitaria(r.inicioReferencia)}</span><span>{r.participantes ?? "—"} animais</span>
          <button type="button" className="sanidade-link underline text-left" onClick={() => onAbrir(rodadaId === r.id ? "" : r.id)}>{rodadaId === r.id ? "Fechar ciclo" : "Abrir ciclo"}</button>
        </div>
        {rodadaId === r.id && <div id={`ciclo-${r.id}`} className="sanidade-ciclo-ativo"><DetalheRodada id={rodadaId} filtros={filtros} podeLancar={podeLancar} onFechar={() => onAbrir("")} onExecutar={onExecutar} onAcao={onAcao} recarregarToken={recarregarToken} onMudou={() => setRevisao((v) => v + 1)} /></div>}
      </Fragment>)}
    </div>{pagina && pagina.total > 0 && <Paginacao paginaAtual={pagina.pagina} totalPaginas={Math.max(1, Math.ceil(pagina.total / pagina.porPagina))} totalItens={pagina.total} itensPorPagina={pagina.porPagina} onPaginaChange={(p) => { const url = new URL(window.location.href); url.searchParams.set("pagina", String(p)); window.history.pushState(null, "", url); window.dispatchEvent(new PopStateEvent("popstate")); }} rotulo="ciclos" idSelect="pagina-rodadas" />}{!pagina?.itens?.length && <p>Nenhum ciclo encontrado. Inicie um ciclo para planejar o cuidado dos animais.</p>}</>}
    {criando && <FormRodada onFechar={() => setCriando(false)} onSalvo={(id) => { setCriando(false); setSalvo(true); setRevisao((v) => v + 1); onAbrir(id); }} />}
    {rodadaId && !pagina?.itens.some((r) => r.id === rodadaId) && <DetalheRodada id={rodadaId} filtros={filtros} podeLancar={podeLancar} onFechar={() => onAbrir("")} onExecutar={onExecutar} onAcao={onAcao} recarregarToken={recarregarToken} onMudou={() => setRevisao((v) => v + 1)} />}
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
  useEffect(() => { setSelecionadas({}); }, [id, etapaId, consulta, recarregarToken]);
  async function renomear() { if (!rodada || ocupado) return; setOcupado(true); setErro(null); try { await reqSanidade(`/rodadas/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ propriedadeId: rodada.propriedadeId, chave: chave.current, nome: novoNome.trim() }) }); setRenomeando(false); atualizar(true); } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); } }
  async function remover() { if (!rodada || !removendo || ocupado) return; setOcupado(true); setErro(null); try { await removerParticipante(id, removendo.id, { propriedadeId: removendo.propriedadeContextoId ?? removendo.propriedadeAtualId ?? rodada.propriedadeId, chave: chave.current, motivo: motivo.trim() }); setRemovendo(null); atualizar(true); } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); } }
  async function abrirAssociacao(pagina = 1) { if (!rodada) return; setAssociando(true); setPaginaLegadas(pagina); setLegadas(null); setErro(null); try { setLegadas(await reqSanidade<PaginaSanitaria<ParticipanteRodada>>(`/execucoes-sem-rodada${consultaRodadas({ propriedadeId: rodada.propriedadeId, protocoloId: rodada.protocoloId, pagina, porPagina: 20 })}`)); } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } }
  async function associar() { if (!rodada || ocupado) return; setOcupado(true); setErro(null); try { await reqSanidade(`/rodadas/${encodeURIComponent(id)}/associacao`, { method: "POST", body: JSON.stringify({ propriedadeId: rodada.propriedadeId, chave: chave.current, execucaoIds: associadas }) }); setAssociando(false); setAssociadas([]); atualizar(true); } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); } }
  if (adicionando && rodada) return <FormRodada rodada={rodada} onFechar={() => setAdicionando(false)} onSalvo={() => { setAdicionando(false); atualizar(true); }} />;
  return <section className="sanidade-ciclo-detalhe" aria-label={rodada?.nome ?? "Ciclo de protocolo"}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="h3">Etapas e tarefas do ciclo</h3><Button secondary onClick={onFechar} disabled={ocupado}>Fechar</Button></div>
    <ErrorBox erro={erro} />{alteracaoSalva && <p role="status">Alteração salva.</p>}{erro && <Button secondary onClick={() => atualizar()}>Atualizar consulta</Button>}
    {carregando ? <p>Carregando ciclo…</p> : rodada && <div className="grid gap-5"><p>{rodada.protocolo.nome} · v{rodada.protocolo.versao} · início de referência {dataSanitaria(rodada.inicioReferencia)}</p>{podeLancar && <div className="flex flex-wrap gap-2"><Button secondary onClick={() => setAdicionando(true)}>Adicionar participantes</Button><Button secondary onClick={() => { chave.current = crypto.randomUUID(); setNovoNome(rodada.nome); setRenomeando(true); }}>Renomear ciclo</Button><Button secondary onClick={() => { chave.current = crypto.randomUUID(); void abrirAssociacao(); }}>Associar execuções existentes</Button></div>}
      <section><h3 className="font-semibold">Etapas do ciclo</h3><p className="text-sm text-ink-3">Contagens do ciclo inteiro e do filtro atual são apresentadas separadamente.</p><TabelaFinanceira rotulo="Etapas do ciclo" itens={etapas?.itens ?? []} chaveDe={(e) => e.id} onAbrir={(e) => { setEtapaId(e.id); setPaginaTarefas(1); }} colunas={[
        { chave: "etapa", titulo: "Etapa", principal: true, celula: (e) => `${e.ordem} · dia ${e.diaRelativo} · ${e.tipo === "APLICACAO" ? "Aplicação" : "Exame"}` },
        { chave: "todas", titulo: getPropriedadeAtiva() == null ? "Ciclo inteiro" : "No sítio consultado", celula: (e) => `${e.contagens.total} previstas · ${e.contagens.pendentes} pendentes · ${e.contagens.realizadas} realizadas · ${e.contagens.dispensadas} dispensadas · ${e.contagens.atrasadas} atrasadas · ${e.contagens.canceladas ?? 0} canceladas` },
        { chave: "filtradas", titulo: "Filtro atual", celula: (e) => e.contagensFiltradas ? `${e.contagensFiltradas.total} previstas · ${e.contagensFiltradas.pendentes} pendentes · ${e.contagensFiltradas.realizadas} realizadas · ${e.contagensFiltradas.dispensadas} dispensadas · ${e.contagensFiltradas.atrasadas} atrasadas · ${e.contagensFiltradas.canceladas ?? 0} canceladas` : "—" },
        { chave: "acao", titulo: "Ações", acoes: true, celula: (e) => <Button secondary onClick={() => { setEtapaId(e.id); setPaginaTarefas(1); }}>Abrir tarefas da etapa</Button> },
      ]} />{etapas && etapas.total > etapas.porPagina && <Paginacao paginaAtual={etapas.pagina} totalPaginas={Math.max(1, Math.ceil(etapas.total / etapas.porPagina))} totalItens={etapas.total} itensPorPagina={etapas.porPagina} onPaginaChange={setPaginaEtapas} rotulo="etapas" idSelect="pagina-etapas" />}</section>
      {etapaId && <section className="grid gap-3"><h3 className="font-semibold">Tarefas da etapa</h3>{!tarefas ? <p>Carregando tarefas…</p> : <><TabelaFinanceira rotulo="Tarefas da etapa" itens={tarefas.itens} chaveDe={(t) => t.id} colunas={[
        { chave: "selecionar", titulo: "Selecionar", acoes: true, celula: (t) => podeLancar && t.situacao === "PENDENTE" ? <input type="checkbox" aria-label={`Selecionar tarefa de ${t.execucao.animal?.brinco ?? t.execucao.animalId}`} checked={!!selecionadas[t.id]} onChange={(e) => { setSelecionadas((v) => { const novo = { ...v }; if (e.target.checked) novo[t.id] = t; else delete novo[t.id]; return novo; }); }} /> : null },
        { chave: "animal", titulo: "Animal", principal: true, celula: (t) => t.execucao.animal ? nomeAnimalSanitario(t.execucao.animal) : t.execucao.animalId },
        { chave: "data", titulo: "Prevista", celula: (t) => dataSanitaria(t.previstaPara) },
        { chave: "sitioPrevisto", titulo: "Sítio na data prevista", celula: (t) => t.propriedadePrevista?.nome ?? "Não localizado" },
        { chave: "realizada", titulo: "Realizada em", celula: (t) => dataSanitaria(t.aplicacoes?.find((a) => a.status === "VALIDO")?.data ?? t.exames?.find((a) => a.status === "VALIDO")?.data ?? null) },
        { chave: "realizado", titulo: "Produto / exame realizado", celula: (t) => t.aplicacoes?.find((a) => a.status === "VALIDO")?.nomeProdutoAplicado ?? t.exames?.find((a) => a.status === "VALIDO")?.formatoSnapshot?.nome ?? "—" },
        { chave: "doseRealizada", titulo: "Quantidade realizada", celula: (t) => { const a = t.aplicacoes?.find((a) => a.status === "VALIDO"); return a ? `${a.dose} ${unidadeSanitaria(a.unidadeDose ?? "")}` : "—"; } },
        { chave: "sitioAtual", titulo: "Sítio atual", celula: (t) => t.propriedadeAtual?.nome ?? "Não localizado" },
        { chave: "parametros", titulo: "Produto / exame", celula: (t) => t.parametros.tipo === "APLICACAO" ? t.parametros.produtoNomeSnapshot ?? "Produto planejado" : t.parametros.tipoExameNomeSnapshot ?? "Exame planejado" },
        { chave: "quantidade", titulo: "Quantidade planejada", celula: (t) => t.parametros.tipo === "APLICACAO" ? `${t.parametros.dose ?? "—"} ${unidadeSanitaria(t.parametros.unidade ?? "")}` : "—" },
        { chave: "situacao", titulo: "Situação", celula: (t) => t.situacao === "REALIZADA" ? "Realizada" : t.situacao === "DISPENSADA" ? "Dispensada" : t.situacao === "EXECUCAO_CANCELADA" ? "Execução cancelada" : t.previstaPara.slice(0, 10) < new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) ? "Atrasada" : "Pendente" },
        { chave: "acao", titulo: "Ações", acoes: true, celula: (t) => <div className="flex flex-wrap gap-2"><Button secondary onClick={() => onAcao("consultar", t)}>Consultar participação</Button>{podeLancar && t.situacao === "PENDENTE" && <><Button secondary onClick={() => onExecutar([t])}>Executar tarefa</Button><Button secondary onClick={() => onAcao("adiar", t)}>Adiar</Button><Button secondary onClick={() => onAcao("dispensar", t)}>Dispensar</Button><Button secondary onClick={() => onAcao("cancelar", t)}>Cancelar execução</Button></>}</div> },
      ]} />{tarefas.total > 0 && <Paginacao paginaAtual={tarefas.pagina} totalPaginas={Math.max(1, Math.ceil(tarefas.total / tarefas.porPagina))} totalItens={tarefas.total} itensPorPagina={tarefas.porPagina} onPaginaChange={setPaginaTarefas} rotulo="tarefas" idSelect="pagina-tarefas" />}</>}{podeLancar && Object.keys(selecionadas).length > 0 && <Button disabled={Object.keys(selecionadas).length > 100} onClick={() => onExecutar(Object.values(selecionadas))}>Executar selecionadas ({Object.keys(selecionadas).length})</Button>}</section>}
      <section><h3 className="font-semibold">Participações e histórico</h3><TabelaFinanceira rotulo="Participantes do ciclo" itens={participantes?.itens ?? []} chaveDe={(p) => p.id} colunas={[
        { chave: "animal", titulo: "Animal", principal: true, celula: (p) => <a className="underline" href={`/pecuaria/rebanho/animais/${encodeURIComponent(p.animalId)}`}>{nomeAnimalSanitario(p.animal)}</a> },
        { chave: "inicio", titulo: "Início próprio", celula: (p) => dataSanitaria(p.inicio) },
        { chave: "estado", titulo: "Participação", celula: (p) => p.canceladaEm ? `Removida · ${p.motivoCancelamento ?? "motivo não registrado"}` : "Em andamento" },
        { chave: "acao", titulo: "Ações", acoes: true, celula: (p) => podeLancar && !p.canceladaEm ? <Button secondary onClick={() => { setRemovendo(p); setMotivo(""); chave.current = crypto.randomUUID(); }}>Remover com motivo</Button> : null },
      ]} />{participantes && participantes.total > 0 && <Paginacao paginaAtual={participantes.pagina} totalPaginas={Math.max(1, Math.ceil(participantes.total / participantes.porPagina))} totalItens={participantes.total} itensPorPagina={participantes.porPagina} onPaginaChange={setPaginaParticipantes} rotulo="participantes" idSelect="pagina-participantes" />}</section>
      {removendo && <form className="grid gap-3 border border-border p-3" onSubmit={(e) => { e.preventDefault(); void remover(); }}><p>Remover {removendo.animal.brinco} preserva os fatos realizados e encerra apenas tarefas pendentes.</p><label>Motivo da remoção<textarea required minLength={5} maxLength={500} className={classeInput} value={motivo} onChange={(e) => { setMotivo(e.target.value); chave.current = crypto.randomUUID(); }} /></label><Button type="submit" disabled={ocupado}>Confirmar remoção</Button><Button secondary onClick={() => setRemovendo(null)}>Voltar</Button></form>}
      {associando && <section className="grid gap-3"><h3 className="font-semibold">Associar execuções existentes</h3><p>Somente execuções sem ciclo da mesma versão e sítio são elegíveis. Datas e fatos existentes serão preservados.</p>{!legadas ? <p>Consultando execuções…</p> : legadas.itens.map((p) => <label key={p.id}><input type="checkbox" checked={associadas.includes(p.id)} onChange={(e) => { chave.current = crypto.randomUUID(); setAssociadas((v) => e.target.checked ? [...v, p.id] : v.filter((id) => id !== p.id)); }} /> {nomeAnimalSanitario(p.animal)} · {dataSanitaria(p.inicio)}</label>)}{legadas && legadas.total > legadas.porPagina && <Paginacao paginaAtual={paginaLegadas} totalPaginas={Math.max(1, Math.ceil(legadas.total / legadas.porPagina))} totalItens={legadas.total} itensPorPagina={legadas.porPagina} onPaginaChange={(p) => void abrirAssociacao(p)} rotulo="execuções sem ciclo" idSelect="pagina-sem-rodada" />}<Button disabled={ocupado || !associadas.length || associadas.length > 100} onClick={() => void associar()}>Confirmar associação</Button><Button secondary onClick={() => setAssociando(false)}>Voltar</Button></section>}
    </div>}
    {renomeando && <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void renomear(); }}><label>Novo nome do ciclo<input required maxLength={120} className={classeInput} value={novoNome} onChange={(e) => { chave.current = crypto.randomUUID(); setNovoNome(e.target.value); }} /></label><Button type="submit" disabled={ocupado}>Salvar nome</Button><Button secondary onClick={() => setRenomeando(false)}>Voltar</Button></form>}
  </section>;
}
