import "../protocolos/protocolos.css";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { OperacaoProtocolo } from "../protocolos/OperacaoProtocolo";
import { SecaoRecolhivel } from "../components/SecaoRecolhivel";
import { RegularizacaoTarefa, rotuloSituacaoTarefa } from "./RegularizacaoTarefa";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { Button, CabecalhoTabela, Empty, ErrorBox, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
import { reqSanidade } from "./api";
import { FormRodada } from "./FormRodada";
import { consultaRodadas, consultarRodada, listarParticipantesRodada, listarRodadas, removerParticipante, type PaginaSanitaria, type ParticipanteRodada, type RodadaSanitaria, type TarefaRodada } from "./rodadas-api";
import { dataSanitaria, nomeAnimalSanitario } from "./rotulos";
const paginaUrl = (chave: string) => Math.max(1, Number(new URLSearchParams(window.location.search).get(chave)) || 1);

export function AgendaRodadas({ filtrosUI, filtros, podeLancar, rodadaId, onAbrir, onExecutar, onAcao, recarregarToken }: { filtrosUI?: ReactNode; filtros: Record<string, string | number | undefined>; podeLancar: boolean; rodadaId: string; onAbrir: (id: string) => void; onExecutar: (tarefas: TarefaRodada[]) => void; onAcao: (acao: "adiar" | "dispensar" | "cancelar" | "consultar", tarefa: TarefaRodada) => void; recarregarToken: number }) {
  const [pagina, setPagina] = useState<PaginaSanitaria<RodadaSanitaria> | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  const [salvo, setSalvo] = useState(false);
  const consulta = consultaRodadas(filtros);
  const temFiltros = ["animalId", "buscaAnimal", "loteId", "de", "ate", "situacao"].some(chave => filtros[chave] !== undefined && filtros[chave] !== "");
  useEffect(() => { let vivo = true; setCarregando(true); setErro(null); listarRodadas(Object.fromEntries(new URLSearchParams(consulta))).then((v) => { if (vivo) setPagina(v); }).catch((e: unknown) => { if (vivo) setErro(`${salvo ? "Ciclo salvo. A consulta não atualizou. " : ""}${e instanceof Error ? e.message : String(e)}`); }).finally(() => { if (vivo) setCarregando(false); }); return () => { vivo = false; }; }, [consulta, revisao, recarregarToken]);
  return <section className="protocolos-pagina protocolos-superficie min-w-0">
    <CabecalhoTabela titulo="Ciclos de protocolos" acao={podeLancar ? <Button onClick={() => setCriando(true)}>Novo ciclo</Button> : undefined} />
    {filtrosUI}
    {salvo && <p role="status">Ciclo salvo.</p>}
    {erro && <><ErrorBox erro={erro} /><Button secondary onClick={() => setRevisao((v) => v + 1)}>Tentar novamente</Button></>}
    {carregando ? <p role="status" className="p-4">Carregando ciclos…</p> : !erro && <><div className="sanidade-ciclos">
      <div className="sanidade-ciclo-linha sanidade-ciclo-cabecalho text-sm text-ink-3" aria-hidden="true"><span>Ciclo</span><span>Protocolo</span><span>Início</span><span>Participantes</span><span>Ação</span></div>
      {(pagina?.itens ?? []).map((r) => <Fragment key={r.id}>
        <div className={`sanidade-ciclo-linha cursor-pointer ${rodadaId === r.id ? "sanidade-ciclo-ativo" : ""}`} onClick={e => { if (!(e.target as HTMLElement).closest("a,button,input,select,textarea")) onAbrir(rodadaId === r.id ? "" : r.id); }}>
          <a className="text-left underline" href={`${window.location.pathname}?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(window.location.search)), aba: "agenda", visaoAgenda: "rodadas", rodadaId: r.id })}`} aria-expanded={rodadaId === r.id} aria-controls={`ciclo-${r.id}`} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onAbrir(rodadaId === r.id ? "" : r.id); } }}>{rodadaId === r.id ? "⌄" : "›"} {r.nome}</a>
          <span>{r.protocolo.nome} · v{r.protocolo.versao}</span><span>{dataSanitaria(r.inicioReferencia)}</span><span>{r.participantes ?? "—"} animais</span>
          <span aria-hidden="true">{rodadaId === r.id ? "⌄" : "›"}</span>
        </div>
        {rodadaId === r.id && <div id={`ciclo-${r.id}`} className="sanidade-ciclo-ativo"><DetalheRodada id={rodadaId} filtros={filtros} podeLancar={podeLancar} onFechar={() => onAbrir("")} onExecutar={onExecutar} onAcao={onAcao} recarregarToken={recarregarToken} onMudou={() => setRevisao((v) => v + 1)} /></div>}
      </Fragment>)}
    </div>{pagina && pagina.total > 0 && <Paginacao paginaAtual={pagina.pagina} totalPaginas={Math.max(1, Math.ceil(pagina.total / pagina.porPagina))} totalItens={pagina.total} itensPorPagina={pagina.porPagina} onPaginaChange={(p) => { const url = new URL(window.location.href); url.searchParams.set("pagina", String(p)); window.history.pushState(null, "", url); window.dispatchEvent(new PopStateEvent("popstate")); }} rotulo="ciclos" idSelect="pagina-rodadas" />}{!pagina?.itens?.length && <Empty>{temFiltros ? "Nenhum ciclo corresponde aos filtros. Ajuste os critérios acima para consultar outros ciclos." : <>Nenhum ciclo encontrado.{podeLancar && " Use Novo ciclo para planejar o cuidado dos animais."}</>}</Empty>}</>}
    {criando && <FormRodada onFechar={() => setCriando(false)} onSalvo={(id) => { setCriando(false); setSalvo(true); setRevisao((v) => v + 1); onAbrir(id); }} />}
    {rodadaId && !pagina?.itens.some((r) => r.id === rodadaId) && <DetalheRodada id={rodadaId} filtros={filtros} podeLancar={podeLancar} onFechar={() => onAbrir("")} onExecutar={onExecutar} onAcao={onAcao} recarregarToken={recarregarToken} onMudou={() => setRevisao((v) => v + 1)} />}
  </section>;
}

function DetalheRodada({ id, filtros, podeLancar, onFechar, onExecutar, onMudou, onAcao, recarregarToken }: { id: string; filtros: Record<string, string | number | undefined>; podeLancar: boolean; onFechar: () => void; onExecutar: (tarefas: TarefaRodada[]) => void; onMudou: () => void; onAcao: (acao: "adiar" | "dispensar" | "cancelar" | "consultar", tarefa: TarefaRodada) => void; recarregarToken: number }) {
  const [rodada, setRodada] = useState<RodadaSanitaria | null>(null);
  const [participantes, setParticipantes] = useState<PaginaSanitaria<ParticipanteRodada> | null>(null);
  const [paginaParticipantes, setPaginaParticipantes] = useState(() => paginaUrl("paginaParticipantes"));
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
  const temFiltros = ["animalId", "buscaAnimal", "loteId", "de", "ate", "situacao"].some(chave => filtros[chave] !== undefined && filtros[chave] !== "");
  useEffect(() => { let vivo = true; setRodada(null); setCarregando(true); setErro(null); const f = Object.fromEntries(new URLSearchParams(consulta)); Promise.all([consultarRodada(id), listarParticipantesRodada(id, { ...f, pagina: paginaParticipantes, porPagina: 10 })]).then(([r, p]) => { if (vivo) { setRodada(r); setParticipantes(p); } }).catch((e: unknown) => { if (vivo) setErro(`${alteracaoSalva ? "Alteração salva. Não conseguimos atualizar a consulta. " : ""}${e instanceof Error ? e.message : String(e)}`); }).finally(() => { if (vivo) setCarregando(false); }); return () => { vivo = false; }; }, [id, consulta, revisao, paginaParticipantes, recarregarToken]);
  function atualizar(confirmada = false) { if (confirmada) setAlteracaoSalva(true); setRevisao((v) => v + 1); onMudou(); }
  async function renomear() { if (!rodada || ocupado) return; setOcupado(true); setErro(null); try { await reqSanidade(`/rodadas/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ propriedadeId: rodada.propriedadeId, chave: chave.current, nome: novoNome.trim() }) }); setRenomeando(false); atualizar(true); } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); } }
  async function remover() { if (!rodada || !removendo || ocupado) return; setOcupado(true); setErro(null); try { await removerParticipante(id, removendo.id, { propriedadeId: removendo.propriedadeContextoId ?? removendo.propriedadeAtualId ?? rodada.propriedadeId, chave: chave.current, motivo: motivo.trim() }); setRemovendo(null); atualizar(true); } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); } }
  async function abrirAssociacao(pagina = 1) { if (!rodada) return; setAssociando(true); setPaginaLegadas(pagina); setLegadas(null); setErro(null); try { setLegadas(await reqSanidade<PaginaSanitaria<ParticipanteRodada>>(`/execucoes-sem-rodada${consultaRodadas({ propriedadeId: rodada.propriedadeId, protocoloId: rodada.protocoloId, pagina, porPagina: 10 })}`)); } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } }
  async function associar() { if (!rodada || ocupado) return; setOcupado(true); setErro(null); try { await reqSanidade(`/rodadas/${encodeURIComponent(id)}/associacao`, { method: "POST", body: JSON.stringify({ propriedadeId: rodada.propriedadeId, chave: chave.current, execucaoIds: associadas }) }); setAssociando(false); setAssociadas([]); atualizar(true); } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); } }
  const sitioConsultado = Number(filtros.propriedadeId) || Number(new URLSearchParams(window.location.search).get("sitio")) || getPropriedadeAtiva() || undefined;
  const podeGerirRodada = podeLancar && sitioConsultado != null && rodada?.propriedadeId === sitioConsultado;
  if (adicionando && rodada) return <FormRodada rodada={rodada} onFechar={() => setAdicionando(false)} onSalvo={() => { setAdicionando(false); atualizar(true); }} />;
  return <section className="sanidade-ciclo-detalhe" aria-label={rodada?.nome ?? "Ciclo de protocolo"}>
    <div className="mb-4 flex justify-end"><Button secondary onClick={onFechar} disabled={ocupado}>Fechar</Button></div>
    <ErrorBox erro={erro} />{alteracaoSalva && <p role="status">Alteração salva.</p>}{erro && <Button secondary onClick={() => atualizar()}>Atualizar consulta</Button>}
    {carregando ? <p>Carregando ciclo…</p> : rodada && <div className="grid gap-5">
      <OperacaoProtocolo acoes={podeGerirRodada && <div className="flex flex-wrap gap-2"><Button secondary onClick={() => setAdicionando(true)}>Adicionar participantes</Button><Button secondary onClick={() => { chave.current = crypto.randomUUID(); setNovoNome(rodada.nome); setRenomeando(true); }}>Renomear ciclo</Button><Button secondary onClick={() => { chave.current = crypto.randomUUID(); void abrirAssociacao(); }}>Associar execuções existentes</Button></div>} programacaoId={id} propriedadeId={sitioConsultado} podeLancar={podeLancar} revisao={revisao + recarregarToken} aoExecutar={(tarefas) => onExecutar(tarefas.map(t => t.tarefaOrigem))} regularizacao={(t, atualizarOperacao) => <RegularizacaoTarefa tarefa={t.tarefaOrigem} podeLancar={podeLancar} onMudou={async () => { atualizarOperacao(); onMudou(); }} />} gestao={<>
      <SecaoRecolhivel titulo="Gestão das participações" abertaInicial={false}>
      <section><h3 className="font-semibold">Participações e histórico</h3><TabelaFinanceira rotulo="Participantes do ciclo" itens={participantes?.itens ?? []} chaveDe={(p) => p.id} colunas={[
        { chave: "animal", titulo: "Animal", principal: true, celula: (p) => <a className="underline" href={`/pecuaria/rebanho/animais/${encodeURIComponent(p.animalId)}`}>{nomeAnimalSanitario(p.animal)}</a> },
        { chave: "inicio", titulo: "Início próprio", celula: (p) => dataSanitaria(p.inicio) },
        { chave: "estado", titulo: "Participação", celula: (p) => p.canceladaEm ? `Removida · ${p.motivoCancelamento ?? "motivo não registrado"}` : "Em andamento" },
        { chave: "acao", titulo: "Ações", acoes: true, celula: (p) => podeGerirRodada && !p.canceladaEm ? <Button secondary onClick={() => { setRemovendo(p); setMotivo(""); chave.current = crypto.randomUUID(); }}>Remover com motivo</Button> : null },
      ]} />{participantes && participantes.total > 0 && <Paginacao paginaAtual={participantes.pagina} totalPaginas={Math.max(1, Math.ceil(participantes.total / participantes.porPagina))} totalItens={participantes.total} itensPorPagina={participantes.porPagina} onPaginaChange={setPaginaParticipantes} rotulo="participantes" idSelect="pagina-participantes" />}</section>
      </SecaoRecolhivel>
      </>} />
      {removendo && <form className="grid gap-3 border border-border p-3" onSubmit={(e) => { e.preventDefault(); void remover(); }}><p>Remover {removendo.animal.brinco} preserva os fatos realizados e encerra apenas tarefas pendentes.</p><label>Motivo da remoção<textarea required minLength={5} maxLength={500} className={classeInput} value={motivo} onChange={(e) => { setMotivo(e.target.value); chave.current = crypto.randomUUID(); }} /></label><Button type="submit" disabled={ocupado}>Confirmar remoção</Button><Button secondary onClick={() => setRemovendo(null)}>Voltar</Button></form>}
      {associando && <section className="grid gap-3"><h3 className="font-semibold">Associar execuções existentes</h3><p>Somente execuções sem ciclo da mesma versão e sítio são elegíveis. Datas e fatos existentes serão preservados.</p>{!legadas ? <p>Consultando execuções…</p> : legadas.itens.map((p) => <label key={p.id}><input type="checkbox" checked={associadas.includes(p.id)} onChange={(e) => { chave.current = crypto.randomUUID(); setAssociadas((v) => e.target.checked ? [...v, p.id] : v.filter((id) => id !== p.id)); }} /> {nomeAnimalSanitario(p.animal)} · {dataSanitaria(p.inicio)}</label>)}{legadas && legadas.total > legadas.porPagina && <Paginacao paginaAtual={paginaLegadas} totalPaginas={Math.max(1, Math.ceil(legadas.total / legadas.porPagina))} totalItens={legadas.total} itensPorPagina={legadas.porPagina} onPaginaChange={(p) => void abrirAssociacao(p)} rotulo="execuções sem ciclo" idSelect="pagina-sem-rodada" />}<Button disabled={ocupado || !associadas.length || associadas.length > 100} onClick={() => void associar()}>Confirmar associação</Button><Button secondary onClick={() => setAssociando(false)}>Voltar</Button></section>}
    </div>}
    {renomeando && <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void renomear(); }}><label>Novo nome do ciclo<input required maxLength={120} className={classeInput} value={novoNome} onChange={(e) => { chave.current = crypto.randomUUID(); setNovoNome(e.target.value); }} /></label><Button type="submit" disabled={ocupado}>Salvar nome</Button><Button secondary onClick={() => setRenomeando(false)}>Voltar</Button></form>}
  </section>;
}
