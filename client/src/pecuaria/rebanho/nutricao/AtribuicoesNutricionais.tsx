import { useEffect, useState } from "react";
import { Button, ErrorBox, hoje, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { MultiSelect } from "../../../components/MultiSelect";
import { listarLotes } from "../api";
import type { Lote } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import { anularVigencia, atribuirDieta, corrigirVigencia, listarDietas, listarVigencias, previaAnulacaoVigencia, previaCorrecaoVigencia, type Dieta, type PaginaVigencias, type PreviaVigencia, type Vigencia } from "./api";

type Edicao = { tipo: "nova" } | { tipo: "correcao" | "anulacao"; vigencia: Vigencia };
export function AtribuicoesNutricionais({ loteId, propriedadeId, podeLancar }: { loteId?: string; propriedadeId?: number; podeLancar: boolean }) {
  const [pagina, setPagina] = useState<PaginaVigencias | null>(null);
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [dietas, setDietas] = useState<Dieta[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loteIds, setLoteIds] = useState<string[]>([]);
  const [estados, setEstados] = useState<string[]>([]);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [loteEscolhido, setLoteEscolhido] = useState(loteId ?? "");
  const [dietaId, setDietaId] = useState("");
  const [desde, setDesde] = useState(hoje());
  const [motivo, setMotivo] = useState("");
  const [previa, setPrevia] = useState<PreviaVigencia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let vivo = true; setCarregando(true); setErro(null);
    const filtros = { ...(loteIds.length ? { loteIds: loteIds.join(",") } : {}), ...(estados.length ? { status: estados.join(",") } : {}) };
    Promise.all([Object.keys(filtros).length ? listarVigencias(loteId, numeroPagina, filtros) : listarVigencias(loteId, numeroPagina), listarDietas(), loteId ? Promise.resolve([]) : listarLotes()]).then(([vs, ds, ls]) => { if (vivo) { setPagina(vs); setDietas(ds); setLotes(ls); } }).catch((e: unknown) => { if (vivo) setErro(`${salvo ? "Atribuição salva. A consulta não atualizou. " : ""}${e instanceof Error ? e.message : String(e)}`); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [loteId, numeroPagina, loteIds, estados, revisao]);
  const publicadas = dietas.filter((d) => d.publicadaEm && d.ativo !== false);
  function abrir(valor: Edicao) {
    setEdicao(valor); setErro(null); setPrevia(null); setMotivo("");
    setLoteEscolhido(valor.tipo === "nova" ? loteId ?? "" : valor.vigencia.lote?.id ?? loteId ?? "");
    setDietaId(valor.tipo === "nova" ? "" : valor.vigencia.dieta.id);
    setDesde(valor.tipo === "nova" ? hoje() : valor.vigencia.desde.slice(0, 10));
  }
  const sitio = edicao?.tipo !== "nova" && edicao ? edicao.vigencia.propriedadeId ?? edicao.vigencia.lote?.propriedadeId ?? propriedadeId : lotes.find((l) => l.id === loteEscolhido)?.propriedadeId ?? propriedadeId;
  async function salvar() {
    if (!edicao || ocupado || sitio == null) return;
    if (!dietaId || !desde) { setErro("Selecione uma dieta publicada e a data de início."); return; }
    setOcupado(true); setErro(null);
    try {
      if (edicao.tipo === "nova") {
        await atribuirDieta({ loteId: loteEscolhido, propriedadeId: sitio, dietaId, desde });
      } else {
        const body = { propriedadeId: sitio, desde, dietaId, motivo: motivo.trim() };
        if (!previa) { setPrevia(edicao.tipo === "anulacao" ? await previaAnulacaoVigencia(edicao.vigencia.id, { propriedadeId: sitio, motivo: motivo.trim() }) : await previaCorrecaoVigencia(edicao.vigencia.id, body)); return; }
        if (previa.bloqueada) return;
        if (edicao.tipo === "anulacao") await anularVigencia(edicao.vigencia.id, { propriedadeId: sitio, motivo: motivo.trim(), revisao: previa.revisao });
        else await corrigirVigencia(edicao.vigencia.id, { ...body, revisao: previa.revisao });
      }
      setEdicao(null); setSalvo(edicao.tipo === "anulacao" ? "Atribuição anulada. Confira os intervalos sem dieta." : "Atribuição salva."); setRevisao((v) => v + 1);
    } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); setPrevia(null); } finally { setOcupado(false); }
  }
  const titulo = edicao?.tipo === "nova" ? "Atribuir dieta ao lote" : edicao?.tipo === "anulacao" ? "Anular atribuição" : "Corrigir atribuição";
  return <Panel className="mt-5 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="h2">Histórico de dietas</h2>{podeLancar && <Button onClick={() => abrir({ tipo: "nova" })}>Atribuir dieta ao lote</Button>}</div>
    {loteId && !carregando && <p className="mt-3 text-sm text-ink-3">Dieta vigente: {pagina?.vigente ? `${pagina.vigente.dieta.nome} · versão ${pagina.vigente.dieta.versao}` : "nenhuma"}.{pagina?.programada && <> Programada: {pagina.programada.dieta.nome} · versão {pagina.programada.dieta.versao}, a partir de {formatarDataBR(pagina.programada.desde)}.</>}</p>}
    {salvo && <p role="status" className="mt-3">{salvo}</p>}
    <ErrorBox erro={erro} />{erro && !edicao && <Button secondary onClick={() => setRevisao((v) => v + 1)}>Tentar novamente</Button>}
    <div className="my-4 grid gap-3 sm:grid-cols-2">{!loteId && <MultiSelect label="Lotes" value={loteIds} onValueChange={(v) => { setLoteIds(v); setNumeroPagina(1); }} options={lotes.map((l) => ({ value: l.id, label: `${l.nome} · ${l.propriedade.nome}` }))} />}<MultiSelect label="Situação" value={estados} onValueChange={(v) => { setEstados(v); setNumeroPagina(1); }} options={[{ value: "VALIDO", label: "Válida" }, { value: "ANULADO", label: "Anulada" }]} /></div>
    {carregando ? <p role="status">Carregando nutrição…</p> : <><TabelaFinanceira rotulo="Atribuições de dietas" itens={pagina?.itens ?? []} chaveDe={(v) => v.id} colunas={[
      { chave: "lote", titulo: "Lote", principal: true, celula: (v) => v.lote ? <a className="underline" href={`/pecuaria/rebanho/lotes/${v.lote.id}`}>{v.lote.nome}</a> : "Lote consultado" },
      { chave: "dieta", titulo: "Dieta", celula: (v) => `${v.dieta.nome} · v${v.dieta.versao}` },
      { chave: "inicio", titulo: "Desde", celula: (v) => formatarDataBR(v.desde) },
      { chave: "fim", titulo: "Até", celula: (v) => v.ate ? `${formatarDataBR(v.ate)} (troca de dieta)` : "Sem fim programado" },
      { chave: "situacao", titulo: "Situação", celula: (v) => v.status === "ANULADO" ? <span className="rounded bg-surface px-2 py-1">Anulada</span> : v.desde.slice(0, 10) > hoje() ? "Programada" : v.ate && v.ate.slice(0, 10) <= hoje() ? "Encerrada" : "Vigente" },
      { chave: "acoes", titulo: "Ações", acoes: true, celula: (v) => podeLancar && v.status !== "ANULADO" && <div className="flex flex-wrap gap-2"><Button secondary onClick={() => abrir({ tipo: "correcao", vigencia: v })}>Corrigir vigência</Button><Button secondary onClick={() => abrir({ tipo: "anulacao", vigencia: v })}>Anular com motivo</Button></div> },
    ]} />{!pagina?.itens.length && <p className="mt-3">Nenhuma dieta atribuída. Atribua uma dieta publicada a um lote.</p>}{pagina && pagina.total > pagina.limite && <div className="mt-4 flex flex-wrap items-center gap-3"><Button secondary disabled={numeroPagina === 1} onClick={() => setNumeroPagina((p) => p - 1)}>Dietas anteriores</Button><span>Página {numeroPagina} · {pagina.total} vigências</span><Button secondary disabled={numeroPagina * pagina.limite >= pagina.total} onClick={() => setNumeroPagina((p) => p + 1)}>Mais dietas</Button></div>}</>}
    {edicao && <PainelCadastro aberto titulo={titulo} onFechar={() => { if (!ocupado) setEdicao(null); }} rodape={<><Button secondary disabled={ocupado} onClick={() => setEdicao(null)}>Cancelar</Button><Button type="submit" form="form-atribuicao" disabled={ocupado || sitio == null || !!previa?.bloqueada}>{edicao.tipo === "nova" ? "Aplicar ao lote" : previa ? "Confirmar com motivo" : "Conferir alteração"}</Button></>}><form id="form-atribuicao" className="grid gap-4" onChange={() => setPrevia(null)} onSubmit={(e) => { e.preventDefault(); void salvar(); }}><ErrorBox erro={erro} />{edicao.tipo === "nova" && !loteId && <CampoFormulario id="atribuicao-lote" rotulo="Lote" obrigatorio>{(p) => <select {...p} required className={classeInput} value={loteEscolhido} onChange={(e) => setLoteEscolhido(e.target.value)}><option value="">Selecione um lote</option>{lotes.filter((l) => l.ativo).map((l) => <option key={l.id} value={l.id}>{l.nome} · {l.propriedade.nome}</option>)}</select>}</CampoFormulario>}{edicao.tipo !== "anulacao" && <><CampoFormulario id="atribuicao-dieta" rotulo="Versão publicada" obrigatorio>{(p) => <select {...p} required className={classeInput} value={dietaId} onChange={(e) => setDietaId(e.target.value)}><option value="">Selecione</option>{publicadas.map((d) => <option key={d.id} value={d.id}>{d.nome} · v{d.versao}</option>)}{edicao.tipo === "correcao" && !publicadas.some((d) => d.id === edicao.vigencia.dieta.id) && <option value={edicao.vigencia.dieta.id}>{edicao.vigencia.dieta.nome} · v{edicao.vigencia.dieta.versao} (histórica)</option>}</select>}</CampoFormulario><CampoFormulario id="atribuicao-desde" rotulo="Início da vigência" obrigatorio>{(p) => <DatePicker {...p} required value={desde} onChange={(v) => { setDesde(v); setPrevia(null); }} />}</CampoFormulario></>}{edicao.tipo !== "nova" && <><p>{edicao.vigencia.dieta.nome} · v{edicao.vigencia.dieta.versao}</p><CampoFormulario id="atribuicao-motivo" rotulo="Motivo" obrigatorio>{(p) => <textarea {...p} required minLength={5} maxLength={500} className={classeInput} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}</CampoFormulario></>}{previa && <section className="grid gap-3 rounded-lg border border-border p-3"><h3 className="h3">Confira a alteração</h3><p>Antes: {edicao.tipo !== "nova" && `${edicao.vigencia.dieta.nome} · v${edicao.vigencia.dieta.versao}`} · desde {formatarDataBR(previa.original.desde)}.</p><p>Depois: {edicao.tipo === "anulacao" ? "Atribuição anulada; o intervalo ficará sem dieta. A dieta anterior não será reaberta." : `${publicadas.find((d) => d.id === dietaId)?.nome ?? "Dieta histórica"} · desde ${formatarDataBR(desde)}`}</p>{previa.anterior && <p>Vigência anterior contígua: {previa.anterior.dieta?.nome ?? "Dieta anterior"}. Confira o novo limite antes de confirmar.</p>}{previa.fechamentosAfetados.length > 0 && <><p className="text-sm">Há consumos confirmados no intervalo alterado. Estorne os consumos indicados e confira novamente.</p>{previa.fechamentosAfetados.map((f) => <a key={f.id} className="underline" href={`/pecuaria/rebanho/nutricao?aba=consumos&fechamentoId=${f.id}`}>{formatarDataBR(f.inicio)} – {formatarDataBR(f.fim)}</a>)}</>}{previa.bloqueada && <p role="alert">Alteração bloqueada pelos consumos confirmados.</p>}</section>}</form></PainelCadastro>}
  </Panel>;
}
