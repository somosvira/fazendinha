import { useEffect, useState } from "react";
import { Button, ErrorBox, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { MultiSelect } from "../../../components/MultiSelect";
import { fmtMoneyExact } from "../../../components/charts";
import { listarLotes } from "../api";
import type { Lote } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import { ConferenciaPeriodos } from "./ConferenciaPeriodos";
import { ontemConsumo } from "./datasConsumo";
import { consultarResumoMensal, estornarConsumo, listarCentrosNutricionais, listarFechamentos, type CentroNutricional, type Fechamento, type Pagina, type ResumoMensal } from "./api";

export function ConsumosNutricionais({ loteId, propriedadeId, podeLancar, loteInicial = "" }: { loteId?: string; propriedadeId?: number; podeLancar: boolean; loteInicial?: string }) {
  const [vista, setVista] = useState<"historico" | "mensal">("historico");
  const [pagina, setPagina] = useState<Pagina<Fechamento> | null>(null);
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [centros, setCentros] = useState<CentroNutricional[]>([]);
  const [loteIds, setLoteIds] = useState<string[]>(loteInicial ? [loteInicial] : []);
  const [estados, setEstados] = useState<string[]>([]);
  const [mes, setMes] = useState(() => ontemConsumo().slice(0, 7));
  const [resumo, setResumo] = useState<ResumoMensal | null>(null);
  const [novo, setNovo] = useState(false);
  const [loteEscolhido, setLoteEscolhido] = useState(loteId ?? "");
  const [diario, setDiario] = useState(true);
  const [estorno, setEstorno] = useState<Fechamento | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [erroPainel, setErroPainel] = useState<string | null>(null);
  const [salvo, setSalvo] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [revisaoCatalogos, setRevisaoCatalogos] = useState(0);
  const [erroCatalogos, setErroCatalogos] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true; setErroCatalogos(null);
    Promise.all([loteId ? Promise.resolve([]) : listarLotes(), podeLancar ? listarCentrosNutricionais() : Promise.resolve([])]).then(([ls, cs]) => { if (vivo) { setLotes(ls); setCentros(cs.filter((c) => c.ativo)); } }).catch((e: unknown) => { if (vivo) setErroCatalogos(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [loteId, podeLancar, revisaoCatalogos]);
  useEffect(() => {
    let vivo = true; setCarregando(true); setErro(null);
    const ids = loteId ? [loteId] : loteIds;
    const filtros = { ...(loteIds.length && !loteId ? { loteIds: loteIds.join(",") } : {}), ...(estados.length ? { status: estados.join(",") } : {}) };
    const consulta = vista === "mensal" ? consultarResumoMensal(mes, ids).then((r) => { if (vivo) setResumo(r); }) : (Object.keys(filtros).length ? listarFechamentos(loteId, numeroPagina, filtros) : listarFechamentos(loteId, numeroPagina)).then((p) => { if (vivo) setPagina(p); });
    consulta.catch((e: unknown) => { if (vivo) setErro(`${salvo ? "Operação salva. A consulta não atualizou. " : ""}${e instanceof Error ? e.message : String(e)}`); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [vista, loteId, loteIds, estados, mes, numeroPagina, revisao]);

  const sitio = loteId ? propriedadeId : lotes.find((l) => l.id === loteEscolhido)?.propriedadeId;
  async function aposConsumo() {
    setNovo(false); setSalvo("Consumo confirmado. O histórico e a consolidação foram atualizados."); setRevisao((v) => v + 1);
  }
  async function confirmarEstorno() {
    if (!estorno || ocupado) return;
    setOcupado(true); setErroPainel(null);
    try {
      await estornarConsumo(estorno.id, { propriedadeId: estorno.propriedadeId, motivo: motivo.trim() });
      setEstorno(null); setSalvo("Consumo estornado. As baixas de estoque foram revertidas; o histórico foi preservado."); setRevisao((v) => v + 1);
    } catch (e: unknown) { setErroPainel(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  return <Panel className="mt-5 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="h2">Consumos</h2>{podeLancar && <Button disabled={!!erroCatalogos} onClick={() => { setNovo(true); setDiario(true); setLoteEscolhido(loteId ?? ""); }}>Conferir novo consumo</Button>}</div>
    <p className="mt-2 text-sm text-ink-3">Confira as quantidades antes da baixa de estoque. A consolidação mensal apenas soma consumos confirmados, sem nova baixa.</p>
    <div className="my-4 flex flex-wrap gap-2"><Button secondary={vista !== "historico"} onClick={() => setVista("historico")}>Histórico de consumos</Button><Button secondary={vista !== "mensal"} onClick={() => setVista("mensal")}>Consolidação mensal</Button></div>
    {salvo && <p role="status" className="my-3">{salvo}</p>}
    <ErrorBox erro={erroCatalogos} />{erroCatalogos && <Button secondary onClick={() => setRevisaoCatalogos((v) => v + 1)}>Recarregar opções</Button>}
    <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao((v) => v + 1)}>Tentar novamente</Button>}
    <div className="my-4 grid gap-3 sm:grid-cols-2">{!loteId && <MultiSelect label="Lotes" value={loteIds} onValueChange={(v) => { setLoteIds(v); setNumeroPagina(1); }} options={lotes.map((l) => ({ value: l.id, label: `${l.nome} · ${l.propriedade.nome}` }))} />}{vista === "historico" ? <MultiSelect label="Situação" value={estados} onValueChange={(v) => { setEstados(v); setNumeroPagina(1); }} options={[{ value: "CONFIRMADO", label: "Confirmado" }, { value: "ESTORNADO", label: "Estornado" }]} /> : <label>Mês da consolidação<input aria-label="Mês da consolidação" type="month" className={classeInput} value={mes} onChange={(e) => { if (e.target.value) setMes(e.target.value); }} /></label>}</div>
    {carregando ? <p role="status">Carregando consumos…</p> : erro ? null : vista === "mensal" ? resumo && <section className="grid gap-3">
      <h3 className="h3">Consumos confirmados · {mes.slice(5, 7)}/{mes.slice(0, 4)}</h3><p>{resumo.fechamentos} fechamento(s) · {resumo.animalDias} animal-dias</p>
      {resumo.verValores && <p>Custo conhecido: {resumo.custoConhecido == null ? "não apurado" : fmtMoneyExact(Number(resumo.custoConhecido))} · cobertura {resumo.coberturaCustoCompleta ? "completa" : "incompleta"}.</p>}
      <TabelaFinanceira rotulo="Consolidação mensal de consumo" itens={resumo.itens} chaveDe={(i) => i.produtoId + i.unidade} colunas={[{ chave: "produto", titulo: "Produto", principal: true, celula: (i) => i.nome }, { chave: "quantidade", titulo: "Quantidade confirmada", celula: (i) => `${i.quantidadeConfirmada} ${i.unidade}` }]} />{!resumo.itens.length && <p>Nenhum consumo confirmado neste mês.</p>}
    </section> : <>
      <TabelaFinanceira rotulo="Histórico de consumos" itens={pagina?.itens ?? []} chaveDe={(f) => f.id} colunas={[
        { chave: "lote", titulo: "Lote", principal: true, celula: (f) => <a className="underline" href={`/pecuaria/rebanho/lotes/${f.lote.id}`}>{f.lote.nome}</a> },
        { chave: "periodo", titulo: "Período", celula: (f) => `${formatarDataBR(f.inicio)} – ${formatarDataBR(f.fim)}` },
        { chave: "dieta", titulo: "Dieta", celula: (f) => `${f.vigencia.dieta.nome} · v${f.vigencia.dieta.versao}` },
        { chave: "animais", titulo: "Animal-dias", celula: (f) => f.animalDias },
        { chave: "situacao", titulo: "Situação", celula: (f) => f.status === "ESTORNADO" ? "Estornado" : "Confirmado" },
        { chave: "custo", titulo: "Custo conhecido", celula: (f) => !f.verValores ? "—" : f.custoConhecido == null ? "Não apurado" : `${fmtMoneyExact(Number(f.custoConhecido))}${f.coberturaCustoCompleta ? "" : " (incompleto)"}` },
        { chave: "acoes", titulo: "Ações", acoes: true, celula: (f) => <div className="flex flex-wrap gap-2"><a className="underline" href={`/pecuaria/rebanho/nutricao?aba=consumos&loteId=${f.lote.id}&fechamentoId=${f.id}`}>Ver detalhes e participantes</a>{podeLancar && f.status === "CONFIRMADO" && <Button secondary onClick={() => { setEstorno(f); setMotivo(""); setErroPainel(null); }}>Conferir estorno</Button>}</div> },
      ]} />{!pagina?.itens.length && <p className="mt-3">Nenhum consumo encontrado.</p>}
      {pagina && pagina.total > pagina.limite && <div className="mt-4 flex flex-wrap items-center gap-3"><Button secondary disabled={numeroPagina === 1} onClick={() => setNumeroPagina((v) => v - 1)}>Consumos anteriores</Button><span>Página {numeroPagina} · {pagina.total} consumos</span><Button secondary disabled={numeroPagina * pagina.limite >= pagina.total} onClick={() => setNumeroPagina((v) => v + 1)}>Mais consumos</Button></div>}
    </>}
    {novo && <PainelCadastro aberto titulo="Conferir consumo" largura="sm:max-w-3xl" onFechar={() => { if (!conferindo) setNovo(false); }} rodape={<Button secondary disabled={conferindo} onClick={() => setNovo(false)}>Fechar</Button>}>
      {!loteId && <CampoFormulario id="consumo-lote" rotulo="Lote" obrigatorio>{(p) => <select {...p} disabled={conferindo} className={classeInput} value={loteEscolhido} onChange={(e) => setLoteEscolhido(e.target.value)}><option value="">Selecione um lote</option>{lotes.filter((l) => l.ativo).map((l) => <option key={l.id} value={l.id}>{l.nome} · {l.propriedade.nome}</option>)}</select>}</CampoFormulario>}
      <label className="mt-4 block">Conferência<select aria-label="Conferência" disabled={conferindo} className={classeInput} value={diario ? "diario" : "periodo"} onChange={(e) => setDiario(e.target.value === "diario")}><option value="diario">Diária</option><option value="periodo">Por período</option></select></label>
      <p className="mt-3 text-sm">A prévia considera permanência dos animais e mudanças de dieta. Confira os ingredientes, quantidades e lotes de estoque antes de confirmar.</p>
      {sitio != null && loteEscolhido && <ConferenciaPeriodos key={`${loteEscolhido}:${diario}`} loteId={loteEscolhido} propriedadeId={sitio} centros={centros} diario={diario} onSalvo={aposConsumo} onOcupado={setConferindo} />}
    </PainelCadastro>}
    {estorno && <PainelCadastro aberto titulo="Conferir estorno do consumo" onFechar={() => { if (!ocupado) setEstorno(null); }} rodape={<><Button secondary disabled={ocupado} onClick={() => setEstorno(null)}>Cancelar</Button><Button type="submit" form="form-estorno-consumo" disabled={ocupado}>Confirmar estorno com motivo</Button></>}><form id="form-estorno-consumo" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void confirmarEstorno(); }}>
      <ErrorBox erro={erroPainel} /><p>{estorno.lote.nome} · {formatarDataBR(estorno.inicio)} – {formatarDataBR(estorno.fim)}</p><p>O histórico será preservado. As quantidades abaixo com baixa retornarão às mesmas partidas de estoque. Não será criada nova despesa.</p>
      {estorno.itens.map((i) => <div key={i.produtoId} className="rounded-lg border border-border p-3"><strong>{i.produto.nome} · {i.quantidadeConfirmada} {i.unidade}</strong><p>{i.movimentoEstoque ? "Devolver ao estoque" : "Sem baixa original: nenhuma devolução"}</p>{i.movimentoEstoque?.alocacaoPartidaEstoques.map((a, indice) => <p key={indice}>Partida {a.partida.codigo}: {a.quantidade} {i.unidade}</p>)}</div>)}
      <CampoFormulario id="estorno-consumo-motivo" rotulo="Motivo do estorno" obrigatorio>{(p) => <textarea {...p} required minLength={5} maxLength={500} disabled={ocupado} className={classeInput} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}</CampoFormulario>
    </form></PainelCadastro>}
  </Panel>;
}
