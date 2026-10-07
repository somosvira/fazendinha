import { useEffect, useRef, useState } from "react";
import { DatePicker } from "../../../components/DatePicker";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { SeletorAnimais } from "../components/SeletorAnimais";
import type { AnimalResumo } from "../types";
import { reqSanidade } from "./api";
import { criarRodada, preverRodada, preverParticipantes, adicionarParticipantes, type ItemEntradaRodada, type PreviaRodada, type RodadaSanitaria } from "./rodadas-api";
import { buscarFichaAnimal, obterCatalogos } from "../api";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { SanidadeApiError } from "./api";
import { dataSanitaria, nomeAnimalSanitario, unidadeSanitaria } from "./rotulos";

type Protocolo = { id: string; nome: string; versao: number; ativo: boolean; publicadoEm: string | null };

function prepararItem(item: ItemEntradaRodada) {
  const justificativaInicio = item.justificativaInicio?.trim();
  const justificativaSobreposicao = item.justificativaSobreposicao?.trim();
  return {
    animalId: item.animalId,
    ...(item.inicio ? { inicio: item.inicio } : {}),
    ...(justificativaInicio ? { justificativaInicio } : {}),
    ...(item.confirmarSobreposicao ? { confirmarSobreposicao: true } : {}),
    ...(justificativaSobreposicao ? { justificativaSobreposicao } : {}),
  };
}

export function FormRodada({ rodada, animalInicial, animaisIniciais, onFechar, onSalvo }: { rodada?: RodadaSanitaria; animalInicial?: string; animaisIniciais?: AnimalResumo[]; onFechar: () => void; onSalvo: (id: string) => void }) {
  const [nome, setNome] = useState(rodada?.nome ?? "");
  const [sitioId, setSitioId] = useState<number | null>(rodada?.propriedadeId ?? getPropriedadeAtiva());
  const [sitios, setSitios] = useState<Array<{ id: number; nome: string }>>([]);
  const [campoErro, setCampoErro] = useState("");
  const formulario = useRef<HTMLFormElement>(null);
  const [protocoloId, setProtocoloId] = useState(rodada?.protocoloId ?? "");
  const [inicio, setInicio] = useState(rodada?.inicioReferencia.slice(0, 10) ?? hoje());
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [animais, setAnimais] = useState<AnimalResumo[]>(animaisIniciais ?? []);
  const [itens, setItens] = useState<Record<string, ItemEntradaRodada>>(Object.fromEntries((animaisIniciais ?? []).map((a) => [a.id, { animalId: a.id }])));
  const [selecionando, setSelecionando] = useState(false);
  const [previa, setPrevia] = useState<PreviaRodada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const chave = useRef(crypto.randomUUID());
  const trava = useRef(false);
  const revisao = useRef(0);
  useEffect(() => { let vivo = true; obterCatalogos().then((v) => { if (vivo) setSitios(v.propriedades); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, []);
  useEffect(() => { const el = formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]'); el?.focus(); el?.scrollIntoView?.({ block: "center" }); }, [campoErro, erro]);
  useEffect(() => { let vivo = true; if (animalInicial) buscarFichaAnimal(animalInicial).then((a) => { if (vivo) { setAnimais([a]); setItens({ [a.id]: { animalId: a.id } }); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [animalInicial]);
  useEffect(() => { let vivo = true; reqSanidade<Protocolo[]>("/protocolos").then((v) => { if (vivo) setProtocolos(v.filter((p) => p.ativo && p.publicadoEm)); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, []);
  function editar() { revisao.current++; chave.current = crypto.randomUUID(); setPrevia(null); setErro(null); setCampoErro(""); }
  function alterarItem(id: string, patch: Partial<ItemEntradaRodada>) { editar(); setItens((v) => ({ ...v, [id]: { ...v[id], animalId: id, ...patch } })); }
  async function enviar(confirmar: boolean) {
    if (trava.current) return;
    const propriedadeId = rodada?.propriedadeId ?? sitioId;
    if (!propriedadeId) { setErro("Selecione o sítio do ciclo na data de início."); setCampoErro("propriedadeId"); return; }
    if (!animais.length || animais.length > 100) { setErro("Selecione entre 1 e 100 animais."); return; }
    const entradas = animais.map((a) => prepararItem({ ...itens[a.id], animalId: a.id }));
    if (entradas.some((i) => i.inicio && i.inicio !== inicio && (i.justificativaInicio?.trim().length ?? 0) < 5)) { setErro("Explique a data diferente de cada animal com pelo menos 5 caracteres."); return; }
    if (entradas.some((i) => i.confirmarSobreposicao && (i.justificativaSobreposicao?.trim().length ?? 0) < 5)) { setErro("Explique cada sobreposição confirmada com pelo menos 5 caracteres."); return; }
    trava.current = true; setOcupado(true); setErro(null);
    const atual = revisao.current;
    const body = { chave: chave.current, propriedadeId, nome: nome.trim(), protocoloId, inicioReferencia: inicio, itens: entradas };
    try {
      if (!confirmar) { const v = rodada ? await preverParticipantes(rodada.id, { chave: chave.current, propriedadeId, itens: entradas.map((i) => ({ ...i, inicio: i.inicio ?? inicio })) }) : await preverRodada(body); if (atual === revisao.current) setPrevia(v); }
      else if (rodada) { await adicionarParticipantes(rodada.id, { chave: chave.current, propriedadeId, itens: entradas.map((i) => ({ ...i, inicio: i.inicio ?? inicio })) }); onSalvo(rodada.id); }
      else { const v = await criarRodada(body); onSalvo(v.id); }
    } catch (e: unknown) { if (atual === revisao.current) { setErro(e instanceof Error ? e.message : String(e)); setCampoErro(e instanceof SanidadeApiError ? e.campo ?? "" : ""); } }
    finally { trava.current = false; setOcupado(false); }
  }
  if (selecionando) return <SeletorAnimais onCancelar={() => setSelecionando(false)} onConfirmar={(v) => { editar(); setAnimais(v); setItens(Object.fromEntries(v.map((a) => [a.id, itens[a.id] ?? { animalId: a.id }]))); setSelecionando(false); }} />;
  return <PainelCadastro aberto titulo={rodada ? "Adicionar participantes" : "Iniciar ciclo de protocolo"} onFechar={() => { if (!ocupado) onFechar(); }} rodape={<><ErrorBox erro={erro} /><Button secondary disabled={ocupado} onClick={onFechar}>Cancelar</Button><Button type="submit" form="form-rodada" disabled={ocupado || !animais.length}>{ocupado ? "Aguarde…" : previa ? "Confirmar ciclo" : "Conferir calendário"}</Button></>}>
    <form ref={formulario} id="form-rodada" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void enviar(!!previa); }}>
      <ErrorBox erro={erro} />
      <fieldset disabled={ocupado} className="grid gap-4">
        <CampoFormulario id="rodada-inicio" rotulo="Início de referência" erro={campoErro === "inicioReferencia" ? erro ?? undefined : undefined} obrigatorio>{(p) => <DatePicker {...p} required disabled={!!rodada} value={inicio} onChange={(v) => { editar(); setInicio(v); setItens((p) => Object.fromEntries(Object.entries(p).map(([id, i]) => [id, { ...i, confirmarSobreposicao: false, justificativaSobreposicao: "" }]))); }} />}</CampoFormulario>
        <CampoFormulario id="rodada-sitio" rotulo="Sítio na data de início" erro={campoErro === "propriedadeId" ? erro ?? undefined : undefined} obrigatorio>{(p) => <select {...p} required disabled={!!rodada} className={classeInput} value={sitioId ?? ""} onChange={(e) => { editar(); setSitioId(e.target.value ? Number(e.target.value) : null); setItens((v) => Object.fromEntries(Object.entries(v).map(([id, i]) => [id, { ...i, confirmarSobreposicao: false, justificativaSobreposicao: "" }]))); }}><option value="">Selecione</option>{rodada && !sitios.some((s) => s.id === rodada.propriedadeId) && <option value={rodada.propriedadeId}>Sítio do ciclo</option>}{sitios.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>}</CampoFormulario>
        <CampoFormulario id="rodada-nome" rotulo="Nome do ciclo" erro={campoErro === "nome" ? erro ?? undefined : undefined} obrigatorio>{(p) => <input {...p} required maxLength={120} disabled={!!rodada} className={classeInput} value={nome} onChange={(e) => { editar(); setNome(e.target.value); }} />}</CampoFormulario>
        <label>Protocolo publicado<select aria-invalid={campoErro === "protocoloId" || undefined} required disabled={!!rodada} className={classeInput} value={protocoloId} onChange={(e) => { editar(); setProtocoloId(e.target.value); setItens((v) => Object.fromEntries(Object.entries(v).map(([id, i]) => [id, { ...i, confirmarSobreposicao: false, justificativaSobreposicao: "" }]))); }}><option value="">Selecione</option>{rodada && !protocolos.some((p) => p.id === rodada.protocoloId) && <option value={rodada.protocoloId}>{rodada.protocolo.nome} · v{rodada.protocolo.versao}</option>}{protocolos.map((p) => <option key={p.id} value={p.id}>{p.nome} · v{p.versao}</option>)}</select></label>

        <Button secondary onClick={() => setSelecionando(true)}>Selecionar animais ({animais.length})</Button>
        {animais.map((a, indice) => <section key={a.id} className="grid gap-3 rounded-lg border border-border p-3"><strong>{nomeAnimalSanitario(a)}</strong>{campoErro.startsWith(`itens.${indice}.`) && <p role="alert" className="text-sm text-red-700">{erro}</p>}<label>Início de {a.brinco}<DatePicker aria-invalid={campoErro === `itens.${indice}.inicio` || undefined} value={itens[a.id]?.inicio ?? inicio} onChange={(v) => alterarItem(a.id, { inicio: v, confirmarSobreposicao: false, justificativaSobreposicao: "" })} /></label>{itens[a.id]?.inicio && itens[a.id].inicio !== inicio && <label>Motivo da data diferente<textarea required minLength={5} maxLength={500} className={classeInput} value={itens[a.id]?.justificativaInicio ?? ""} onChange={(e) => alterarItem(a.id, { justificativaInicio: e.target.value })} /></label>}<details><summary className="cursor-pointer text-sm">Sobreposição ou reentrada</summary><p className="text-sm">O histórico da participação anterior permanece. Reentrada cria outra participação; tarefas pendentes exigem confirmação e motivo.</p><ConfirmacaoCiencia id={`sobreposicao-${a.id}`} checked={itens[a.id]?.confirmarSobreposicao ?? false} onChange={(v) => alterarItem(a.id, { confirmarSobreposicao: v })}>Confirmo sobreposição de {a.brinco}</ConfirmacaoCiencia>{itens[a.id]?.confirmarSobreposicao && <label>Motivo da sobreposição<textarea required minLength={5} maxLength={500} className={classeInput} value={itens[a.id]?.justificativaSobreposicao ?? ""} onChange={(e) => alterarItem(a.id, { justificativaSobreposicao: e.target.value })} /></label>}</details></section>)}
      </fieldset>
      {previa && <section className="grid gap-3" aria-label="Calendário previsto"><h3 className="font-semibold">Calendário previsto por animal</h3>{previa.avisos?.map((a, i) => <p key={i} role="alert">{a}</p>)}{previa.itens.map((i) => <div key={i.animalId}><strong>{animais.find((a) => a.id === i.animalId)?.brinco ?? i.animalId}</strong>{i.avisos?.map((a, n) => <p key={n} role="alert">{a}</p>)}<ol className="list-inside list-decimal">{i.tarefas.map((t) => <li key={t.etapaId}>{dataSanitaria(t.previstaPara)} · {t.parametros.tipo === "APLICACAO" ? "Aplicação" : "Exame"} · {t.parametros.dose ? `${t.parametros.produtoNomeSnapshot ?? "Produto planejado"} · ${t.parametros.dose} ${unidadeSanitaria(t.parametros.unidade ?? "")}` : t.parametros.tipoExameNomeSnapshot}</li>)}</ol></div>)}<p className="text-sm text-ink-3">Este planejamento não consome estoque. Confira datas e animais antes de confirmar.</p></section>}
    </form>
  </PainelCadastro>;
}
