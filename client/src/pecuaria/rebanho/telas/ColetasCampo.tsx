import { useEffect, useRef, useState } from "react";
import { ClipboardList, Printer } from "lucide-react";
import { Button, ErrorBox, PageHeader, PaginaFinanceira, Panel, hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { MultiSelect } from "../../../components/MultiSelect";
import { listarLotes } from "../api";
import type { Lote } from "../types";
import { Paginacao, rolarParaCampo } from "../ui";
import { FormAplicacaoServico } from "../sanidade/FormAplicacaoServico";
import { reqSanidade, type AplicacaoInput } from "../sanidade/api";
import { autorizarImpressao, ColetaApiError, concluirColeta, listarColetas, obterColeta, prepararColeta, salvarRascunho, type ColetaCampoDTO, type ItemCampo, type RascunhoCampo, type ResumoColeta } from "../coletas/api";

const rotulos = { PESAGEM: "Pesagem corporal", EXAME: "Coleta de exames", APLICACAO: "Aplicação sanitária" };
const estados = { PREPARADA: "Aguardando preenchimento", EM_PREENCHIMENTO: "Em preenchimento", CONCLUIDA: "Concluída" };
const dataBR = (data: string) => data.slice(0, 10).split("-").reverse().join("/");
export function ColetasCampo({ podeLancar, somentePesagens = false }: { podeLancar: boolean; somentePesagens?: boolean }) {
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState<ResumoColeta[]>([]);
  const [total, setTotal] = useState(0);
  const [coleta, setColeta] = useState<ColetaCampoDTO | null>(null);
  const [id, setId] = useState(() => new URLSearchParams(window.location.search).get("coletaId"));
  const [nova, setNova] = useState(() => podeLancar && new URLSearchParams(window.location.search).get("preparar") === "1");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let vivo = true; setErro(null); setCarregando(true); setColeta(null);
    const consulta = id ? obterColeta(id).then((v) => { if (vivo) setColeta(v); }) : listarColetas(pagina, somentePesagens ? "PESAGEM" : undefined).then((v) => { if (vivo) { setLista(v.itens); setTotal(v.total); } });
    consulta.catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [id, pagina, revisao, somentePesagens]);
  useEffect(() => { const voltar = () => setId(new URLSearchParams(window.location.search).get("coletaId")); window.addEventListener("popstate", voltar); return () => window.removeEventListener("popstate", voltar); }, []);
  function limparPreparacao() { const url = new URL(window.location.href); ["preparar", "loteId", "propriedadeId"].forEach((k) => url.searchParams.delete(k)); window.history.replaceState(null, "", url); }
  function abrir(v: string | null) { limparPreparacao(); const url = new URL(window.location.href); if (v) url.searchParams.set("coletaId", v); else url.searchParams.delete("coletaId"); window.history.pushState(null, "", url); setId(v); }
  return <PaginaFinanceira><PageHeader eyebrow="Pecuária" titulo={somentePesagens ? "Pesagens" : "Coletas de campo"} descricao={somentePesagens ? "Prepare pesagens coletivas por lote e consulte as fichas concluídas. Os pesos ficam também no histórico de cada animal." : "Prepare a ficha, anote no campo e preencha na mesma ordem ao voltar."} acao={!id && podeLancar ? <Button onClick={() => setNova(true)}>Preparar ficha</Button> : undefined} />
    <ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao((v) => v + 1)}>Tentar novamente</Button>}
    {carregando ? <p className="mt-6">Carregando fichas…</p> : coleta ? <FichaCampo key={coleta.id} inicial={coleta} podeLancar={podeLancar} onVoltar={() => abrir(null)} /> : !id && <Panel className="mt-6 overflow-hidden"><div className="border-b border-border p-5"><h2 className="h2">Suas fichas de campo</h2><p className="body text-ink-3">Retome uma ficha preparada ou consulte o que já foi concluído.</p></div>{!lista.length ? <div className="p-8"><ClipboardList aria-hidden className="mb-3 text-ink-3" /><p className="body">Nenhuma ficha preparada neste sítio.</p>{podeLancar && <Button className="mt-4" onClick={() => setNova(true)}>Preparar primeira ficha</Button>}</div> : <div className="divide-y divide-border">{lista.map((f) => <button key={f.id} onClick={() => abrir(f.id)} className="flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left hover:bg-surface-2"><span><strong className="body">{f.titulo}</strong><span className="mt-1 block text-sm text-ink-3">{rotulos[f.tipo]} · {dataBR(f.data)} · {f.propriedade?.nome}</span></span><span className="text-sm">{estados[f.status]} →</span></button>)}</div>}<Paginacao paginaAtual={pagina} totalPaginas={Math.max(1, Math.ceil(total / 20))} totalItens={total} itensPorPagina={20} onPaginaChange={setPagina} rotulo="fichas" idSelect="coletas-pagina" /></Panel>}
    <p className="mt-5 text-sm text-ink-3 print:hidden">Aplicações e exames desta página são avulsos. Para cumprir uma tarefa de protocolo, use a Agenda em Sanidade.</p>
    {nova && <PrepararFicha somentePesagens={somentePesagens} onFechar={() => { setNova(false); limparPreparacao(); }} onSalvo={(v) => { setNova(false); abrir(v.id); }} />}
  </PaginaFinanceira>;
}

function PrepararFicha({ onFechar, onSalvo, somentePesagens }: { onFechar: () => void; onSalvo: (v: ColetaCampoDTO) => void; somentePesagens: boolean }) {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [sitio, setSitio] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [tipo, setTipo] = useState<ResumoColeta["tipo"]>("PESAGEM");
  const [data, setData] = useState(hoje());
  const [titulo, setTitulo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const chave = useRef(crypto.randomUUID());
  useEffect(() => { let vivo = true; listarLotes().then((v) => { if (vivo) {
    const ativos = v.filter((l) => l.ativo); setLotes(ativos);
    const query = new URLSearchParams(window.location.search);
    const loteInicial = query.get("preparar") === "1" ? ativos.find((l) => l.id === query.get("loteId") && String(l.propriedadeId) === query.get("propriedadeId")) : undefined;
    if (loteInicial) { setSitio(String(loteInicial.propriedadeId)); setSelecionados([loteInicial.id]); }
    else if (new Set(ativos.map((l) => l.propriedadeId)).size === 1) setSitio(String(ativos[0]?.propriedadeId ?? ""));
  } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); }); return () => { vivo = false; }; }, []);
  async function salvar() {
    if (ocupado) return;
    if (!sitio || !selecionados.length) { setErro("Escolha o sítio e pelo menos um lote."); rolarParaCampo("coleta-lotes"); return; }
    setOcupado(true); setErro(null);
    try { onSalvo(await prepararColeta({ id: chave.current, propriedadeId: Number(sitio), loteIds: selecionados, tipo, data, titulo: titulo.trim() || `${rotulos[tipo]} · ${dataBR(data)}` })); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); rolarParaCampo("coleta-lotes"); }
    finally { setOcupado(false); }
  }
  const sitios = [...new Map(lotes.map((l) => [l.propriedadeId, l.propriedade])).values()];
  return <PainelCadastro aberto titulo="Preparar ficha de campo" onFechar={() => { if (!ocupado) onFechar(); }} rodape={<Button form="preparar-coleta" type="submit" disabled={ocupado || carregando}>{ocupado ? "Preparando…" : "Preparar ficha"}</Button>}><form id="preparar-coleta" className="grid gap-5" onChange={() => { chave.current = crypto.randomUUID(); }} onSubmit={(e) => { e.preventDefault(); void salvar(); }}><ErrorBox erro={erro} />{carregando && <p>Carregando lotes…</p>}<CampoFormulario id="coleta-rotina" rotulo="O que será coletado?">{(p) => <select {...p} value={tipo} disabled={somentePesagens} onChange={(e) => setTipo(e.target.value as ResumoColeta["tipo"])} className={classeInput}>{Object.entries(rotulos).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</select>}</CampoFormulario><CampoFormulario id="coleta-data" rotulo="Data da coleta" obrigatorio>{(p) => <DatePicker {...p} value={data} onChange={setData} required />}</CampoFormulario><CampoFormulario id="coleta-sitio" rotulo="Sítio" obrigatorio>{(p) => <select {...p} required value={sitio} onChange={(e) => { setSitio(e.target.value); setSelecionados([]); }} className={classeInput}><option value="">Selecione</option>{sitios.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>}</CampoFormulario><div id="coleta-lotes" tabIndex={-1}><label className="body">Lotes da coleta</label><MultiSelect label="Lotes" value={selecionados} onValueChange={(ids) => { setSelecionados(ids); chave.current = crypto.randomUUID(); }} contentClassName="z-[1200]" options={lotes.filter((l) => String(l.propriedadeId) === sitio).map((l) => ({ value: l.id, label: `${l.nome} · ${l.animaisAtivos} animais hoje` }))} /></div><CampoFormulario id="coleta-titulo" rotulo="Nome da ficha (opcional)">{(p) => <input {...p} className={classeInput} maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={rotulos[tipo]} />}</CampoFormulario><p className="text-sm text-ink-3">A lista usa a presença dos animais nos lotes na data escolhida. Ao preparar, a seleção e sua ordem ficam salvas.</p></form></PainelCadastro>;
}

function FichaCampo({ inicial, podeLancar, onVoltar }: { inicial: ColetaCampoDTO; podeLancar: boolean; onVoltar: () => void }) {
  const [coleta, setColeta] = useState(inicial);
  const [rascunho, setRascunho] = useState(inicial.rascunho);
  const [erro, setErro] = useState<string | null>(null);
  const [campoErro, setCampoErro] = useState<string>();
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [aplicacaoAberta, setAplicacaoAberta] = useState(false);
  const [previaImpressao, setPreviaImpressao] = useState(false);
  const [tipos, setTipos] = useState<Array<{ id: string; nome: string }>>([]);
  const [alterado, setAlterado] = useState(false);
  const trava = useRef(false);
  const concluida = coleta.status === "CONCLUIDA";
  const animais = coleta.snapshot.animais;
  useEffect(() => { if (coleta.tipo !== "EXAME") return; let vivo = true; reqSanidade<Array<{ id: string; nome: string }>>("/tipos-exame").then((v) => { if (vivo) setTipos(v); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [coleta.tipo]);
  useEffect(() => { const avisar = (e: BeforeUnloadEvent) => { if (alterado) { e.preventDefault(); e.returnValue = ""; } }; window.addEventListener("beforeunload", avisar); return () => window.removeEventListener("beforeunload", avisar); }, [alterado]);
  function mudar(item: Partial<ItemCampo>, animalId: string) { setRascunho((r) => ({ ...r, itens: r.itens.map((i) => i.animalId === animalId ? { ...i, ...item } : i) })); setAlterado(true); setRevisando(false); setMensagem(""); setErro(null); setCampoErro(undefined); }
  function falha(e: unknown) {
    setErro(e instanceof Error ? e.message : String(e));
    const campo = e instanceof ColetaApiError ? e.campo : undefined;
    setCampoErro(campo);
    const linha = campo?.match(/^itens\.(\d+)\./)?.[1];
    const prefixo = campo?.endsWith(".peso") ? "valor" : campo?.endsWith(".motivo") ? "motivo" : "campo";
    rolarParaCampo(campo?.endsWith("tipoExameId") ? "campo-tipo-exame" : linha ? `${prefixo}-${animais[Number(linha)]?.animalId}` : "erro-coleta");
  }
  async function salvar(concluir = false, novo = rascunho) {
    if (trava.current) return; trava.current = true; setOcupado(true); setErro(null); setCampoErro(undefined);
    try { const salva = alterado || novo !== rascunho ? await salvarRascunho(coleta, novo) : coleta; setColeta(salva); setRascunho(salva.rascunho); setAlterado(false); const resultado = concluir ? await concluirColeta(salva) : salva; setColeta(resultado); setMensagem(concluir ? "Ficha concluída. Os lançamentos já estão nas fichas dos animais." : "Rascunho salvo. Você pode continuar depois."); setRevisando(false); }
    catch (e) { falha(e); } finally { trava.current = false; setOcupado(false); }
  }
  function revisar() {
    const pendente = rascunho.itens.findIndex((i) => i.situacao === "PENDENTE");
    if (pendente >= 0) { falha(new ColetaApiError("Indique o que foi realizado em cada animal antes de conferir.", `itens.${pendente}.situacao`)); return; }
    const semMotivo = rascunho.itens.findIndex((i) => i.situacao === "NAO_REALIZADO" && i.motivo.trim().length < 5);
    if (semMotivo >= 0) { falha(new ColetaApiError("Explique por que não foi realizado, com pelo menos 5 caracteres.", `itens.${semMotivo}.motivo`)); return; }
    if (coleta.tipo === "PESAGEM") {
      const invalido = rascunho.itens.findIndex((i) => { const peso = i.peso.replace(",", "."); return i.situacao === "REALIZADO" && (!/^\d+(\.\d{1,2})?$/.test(peso) || Number(peso) <= 0 || Number(peso) > 99999.99); });
      if (invalido >= 0) { falha(new ColetaApiError("Informe um peso maior que zero, com até duas casas decimais.", `itens.${invalido}.peso`)); return; }
    }
    if (coleta.tipo === "EXAME" && !rascunho.tipoExameId && rascunho.itens.some((i) => i.situacao === "REALIZADO")) { falha(new ColetaApiError("Selecione o tipo de exame.", "tipoExameId")); return; }
    setErro(null); setCampoErro(undefined); setRevisando(true);
  }
  async function guardarAplicacoes(entradas: AplicacaoInput[]) {
    const novo = { ...rascunho, itens: rascunho.itens.map((i) => ({ ...i, ...(entradas.find((a) => a.animalId === i.animalId) ? { aplicacao: entradas.find((a) => a.animalId === i.animalId) } : {}) })) };
    const normalizar = (valor: unknown): unknown => Array.isArray(valor) ? valor.map(normalizar) : valor && typeof valor === "object" ? Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, normalizar(v)])) : valor;
    if (!alterado && JSON.stringify(normalizar(coleta.rascunho)) === JSON.stringify(normalizar(novo))) return coleta;
    const salva = await salvarRascunho(coleta, novo); setColeta(salva); setRascunho(salva.rascunho); setAlterado(false);
    return salva;
  }
  async function salvarAplicacoes(entradas: AplicacaoInput[]) {
    const salva = await guardarAplicacoes(entradas);
    const final = await concluirColeta(salva); setColeta(final); setMensagem("Ficha concluída. Aplicações e carências atualizadas.");
  }
  return <div className="mt-6 space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 print:hidden"><Button secondary onClick={() => { if (!alterado || window.confirm("Há alterações sem salvar. Voltar e descartá-las?")) onVoltar(); }}>← Todas as fichas</Button><Button secondary disabled={ocupado} onClick={() => { void autorizarImpressao(coleta.id).then(() => window.print()).catch(falha); }}><Printer size={16} aria-hidden />Imprimir ficha</Button></div><Panel className="p-5"><p className="eyebrow">{estados[coleta.status]} · ficha {coleta.id.slice(0, 8)}</p><h2 className="h2 mt-2">{coleta.titulo}</h2><p className="body text-ink-3">{coleta.snapshot.propriedadeNome} · {dataBR(coleta.data)} · {animais.length} animais</p></Panel>
    <div id="erro-coleta" tabIndex={-1}><ErrorBox erro={erro} /></div>{mensagem && <p role="status" className="rounded-lg border border-border bg-surface-2 p-4 body">{mensagem}</p>}
    {!concluida && <p className="body">Preencha seguindo a ficha impressa. Marque “Não realizado” e explique quando não houve coleta; vazio nunca será considerado zero.</p>}
    {coleta.tipo === "PESAGEM" && !concluida && <Panel className="grid gap-4 p-5 sm:grid-cols-2">
      <CampoFormulario id="campo-tipo-pesagem" rotulo="Tipo da pesagem">{(p) => <select {...p} disabled={!podeLancar || ocupado} className={classeInput} value={rascunho.tipoPesagem} onChange={(e) => { setRascunho((r) => ({ ...r, tipoPesagem: e.target.value as RascunhoCampo["tipoPesagem"] })); setAlterado(true); setRevisando(false); }}><option value="ROTINA">Rotina</option><option value="ENTRADA">Entrada</option><option value="DESMAMA">Desmama</option><option value="SAIDA">Saída</option></select>}</CampoFormulario>
      <CampoFormulario id="campo-origem-pesagem" rotulo="Origem dos valores">{(p) => <select {...p} disabled={!podeLancar || ocupado} className={classeInput} value={rascunho.origemPesagem} onChange={(e) => { setRascunho((r) => ({ ...r, origemPesagem: e.target.value as RascunhoCampo["origemPesagem"] })); setAlterado(true); setRevisando(false); }}><option value="MANUAL">Anotação manual</option><option value="BALANCA">Balança</option></select>}</CampoFormulario>
    </Panel>}
    {coleta.tipo === "EXAME" && !concluida && <Panel className="grid gap-4 p-5 sm:grid-cols-2"><CampoFormulario id="campo-tipo-exame" rotulo="Tipo de exame" obrigatorio>{(p) => <select {...p} required disabled={!podeLancar || ocupado} className={classeInput} value={rascunho.tipoExameId ?? ""} onChange={(e) => { setRascunho((r) => ({ ...r, tipoExameId: e.target.value || undefined })); setAlterado(true); setRevisando(false); }}><option value="">Selecione</option>{tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>}</CampoFormulario><CampoFormulario id="campo-responsavel" rotulo="Responsável (opcional)">{(p) => <input {...p} disabled={!podeLancar || ocupado} className={classeInput} maxLength={160} value={rascunho.responsavel ?? ""} onChange={(e) => { setRascunho((r) => ({ ...r, responsavel: e.target.value })); setAlterado(true); setRevisando(false); }} />}</CampoFormulario><p className="text-sm text-ink-3 sm:col-span-2">Confirme a coleta; os resultados serão preenchidos em Sanidade → Exames.</p></Panel>}
    <Panel className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-surface-2"><tr><th className="p-4">Lote / animal</th><th className="p-4">Realização</th><th className="p-4">{coleta.tipo === "PESAGEM" ? "Peso (kg)" : "Anotação do campo"}</th></tr></thead><tbody>{animais.map((a, indice) => { const item = rascunho.itens.find((i) => i.animalId === a.animalId)!; return <tr key={a.animalId} className="border-t border-border align-top"><td className="p-4"><span className="block text-ink-3">{a.loteNome}</span><a className="text-xl font-semibold underline" href={`/pecuaria/rebanho/animais/${a.animalId}`}>{a.brinco}</a>{a.nome && <span className="block">{a.nome}</span>}</td><td className="min-w-48 p-4"><label className="sr-only" htmlFor={`campo-${a.animalId}`}>Realização de {a.brinco}</label><select id={`campo-${a.animalId}`} disabled={concluida || !podeLancar || ocupado} value={item.situacao} aria-invalid={campoErro?.startsWith(`itens.${indice}.`)} className={classeInput} onChange={(e) => mudar({ situacao: e.target.value as ItemCampo["situacao"] }, a.animalId)}><option value="PENDENTE">A preencher</option><option value="REALIZADO">Realizado</option><option value="NAO_REALIZADO">Não realizado</option></select>{item.situacao === "NAO_REALIZADO" && <><label htmlFor={`motivo-${a.animalId}`} className="mt-2 block">Motivo</label><input id={`motivo-${a.animalId}`} maxLength={500} aria-invalid={campoErro === `itens.${indice}.motivo`} disabled={concluida || ocupado || !podeLancar} className={classeInput} value={item.motivo} onChange={(e) => mudar({ motivo: e.target.value }, a.animalId)} /></>}</td><td className="min-w-48 p-4"><label className="sr-only" htmlFor={`valor-${a.animalId}`}>{coleta.tipo === "PESAGEM" ? `Peso de ${a.brinco} em kg` : `Anotação de ${a.brinco}`}</label><input id={`valor-${a.animalId}`} aria-invalid={campoErro === `itens.${indice}.peso`} aria-describedby={campoErro?.startsWith(`itens.${indice}.`) ? `erro-${a.animalId}` : undefined} maxLength={coleta.tipo === "PESAGEM" ? 20 : 500} disabled={concluida || ocupado || !podeLancar || item.situacao === "NAO_REALIZADO"} className={classeInput} inputMode={coleta.tipo === "PESAGEM" ? "decimal" : "text"} value={coleta.tipo === "PESAGEM" ? item.peso : item.observacao} onChange={(e) => mudar(coleta.tipo === "PESAGEM" ? { peso: e.target.value, situacao: "REALIZADO" } : { observacao: e.target.value }, a.animalId)} />{campoErro?.startsWith(`itens.${indice}.`) && <p id={`erro-${a.animalId}`} className="mt-2 text-sm text-red-700">{erro}</p>}{concluida && coleta.resultados?.some((r) => r.animalId === a.animalId) && <span className="mt-2 block">Lançado no histórico</span>}</td></tr>; })}</tbody></table></div></Panel>
    {!concluida && podeLancar && <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-card p-4 print:hidden"><span className="mr-auto text-sm text-ink-3">{alterado ? "Há alterações sem salvar" : "Rascunho atualizado"}</span><Button secondary disabled={ocupado} onClick={() => { void salvar(); }}>Salvar e continuar depois</Button><Button disabled={ocupado} onClick={revisar}>Conferir lançamentos</Button></div>}
    {revisando && <Panel className="space-y-4 p-5"><h2 className="h2">Confira antes de concluir</h2><p className="body">{rascunho.itens.filter((i) => i.situacao === "REALIZADO").length} realizados · {rascunho.itens.filter((i) => i.situacao === "NAO_REALIZADO").length} não realizados.</p><p className="text-sm">A confirmação revalida todos os animais no sítio e na data da ficha. O conjunto será salvo integralmente.</p><Button disabled={ocupado} onClick={() => { if (coleta.tipo === "APLICACAO" && rascunho.itens.some((i) => i.situacao === "REALIZADO")) setAplicacaoAberta(true); else void salvar(true); }}>{coleta.tipo === "APLICACAO" ? "Conferir dados sanitários" : "Confirmar ficha"}</Button><Button secondary onClick={() => setRevisando(false)}>Voltar ao preenchimento</Button></Panel>}
    {aplicacaoAberta && <FormAplicacaoServico animalId={animais[0].animalId} propriedadeId={coleta.propriedadeId} dataInicial={coleta.data.slice(0, 10)} animais={animais.filter((a) => rascunho.itens.find((i) => i.animalId === a.animalId)?.situacao === "REALIZADO").map((a) => ({ id: a.animalId, brinco: a.brinco, propriedadeId: coleta.propriedadeId }))} rascunhoInicial={rascunho.itens.flatMap((i) => i.situacao === "REALIZADO" && i.aplicacao ? [i.aplicacao] : [])} salvarRascunhoColeta={async (itens) => { await guardarAplicacoes(itens); setMensagem("Dados sanitários salvos como rascunho. Nenhuma aplicação foi lançada."); setRevisando(false); }} confirmarColeta={salvarAplicacoes} onSalvo={() => { setAplicacaoAberta(false); setRevisando(false); }} onFechar={() => setAplicacaoAberta(false)} />}
    <Button secondary aria-expanded={previaImpressao} onClick={() => setPreviaImpressao((v) => !v)}>Conferir modelo de impressão</Button>
    <FichaImpressa coleta={coleta} previa={previaImpressao} />
  </div>;
}

function FichaImpressa({ coleta, previa }: { coleta: ColetaCampoDTO; previa: boolean }) {
  return <><style>{`@media screen{.coleta-impressao[data-previa="false"]{display:none}.coleta-impressao{background:white;color:black;padding:20px;margin-top:20px;overflow-x:auto}.coleta-impressao table{width:100%;border-collapse:collapse}.coleta-impressao td,.coleta-impressao th{border:1px solid black;padding:9px}}@media print{@page{size:A4;margin:12mm}body *{visibility:hidden!important}.coleta-impressao,.coleta-impressao *{visibility:visible!important}.coleta-impressao{display:block!important;position:absolute;left:0;top:0;width:100%;color:black;background:white;font:12pt sans-serif}.coleta-impressao table{width:100%;border-collapse:collapse}.coleta-impressao th,.coleta-impressao td{border:1px solid black;padding:9px}.coleta-impressao tr{break-inside:avoid}.coleta-impressao thead{display:table-header-group}}`}</style><section className="coleta-impressao" data-previa={previa}><h1>{coleta.titulo}</h1><p>{coleta.snapshot.propriedadeNome} · {dataBR(coleta.data)} · ficha {coleta.id}</p><p>Responsável: __________________________________</p><table><thead><tr><th>Lote / animal</th><th>Realização</th><th>{coleta.tipo === "PESAGEM" ? "Peso (kg)" : "Anotação do campo"}</th></tr></thead><tbody>{coleta.snapshot.animais.map((a) => <tr key={a.animalId}><td>{a.loteNome} · <strong>{a.brinco}</strong>{a.nome ? ` · ${a.nome}` : ""}</td><td>□ Realizado<br />□ Não realizado</td><td style={{ minWidth: "70mm" }}>&nbsp;</td></tr>)}</tbody></table><p>Anote o motivo dos não realizados e informe este código ao retornar ao sistema.</p></section></>;
}
