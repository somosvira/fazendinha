import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import type { ConfirmacaoImpacto } from "../sanidade/impactos-api";
import { AjudaDestinoBezerreiro, useSugestaoBezerreiro } from "../bezerreiro/useSugestaoBezerreiro";
import { Button } from "../../../components/ui/button";
import { DatePicker } from "../../../components/DatePicker";
import { Input } from "../../../components/ui/input";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { dataHoraISO } from "./CampoDataIatf";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { reqV4, type CriaInput } from "./api";
import type { HistoricoPesagem, Lote } from "../types";

export type DadosParto = {
  desfecho: "NASCIMENTO" | "ABORTO";
  hora: string; horarioEstimado: boolean;
  induzido: string; dificuldade: string; assistenciaDescricao: string;
  responsavel: string; observacao: string; retencaoPlacenta: string; grauRetencaoPlacenta: string;
  escoreAtivo: boolean; escoreData: string; escoreValor: string; escalaMin: string; escalaMax: string; escalaDescricao: string;
  retencaoAcao: string; doencaId: string; ocorrenciaId: string; retencaoData: string;
  pesoAcao: string; pesagemId: string; pesoKg: string; pesoData: string;
};
export const dadosPartoVazios = (): DadosParto => ({ desfecho: "NASCIMENTO", hora: "", horarioEstimado: false, induzido: "", dificuldade: "", assistenciaDescricao: "", responsavel: "", observacao: "", retencaoPlacenta: "", grauRetencaoPlacenta: "", escoreAtivo: false, escoreData: "", escoreValor: "", escalaMin: "", escalaMax: "", escalaDescricao: "", retencaoAcao: "", doencaId: "", ocorrenciaId: "", retencaoData: "", pesoAcao: "", pesagemId: "", pesoKg: "", pesoData: "" });
export const triEstado = (valor: string) => valor === "" ? null : valor === "SIM";
export function camposPartoPayload(v: DadosParto, data: string, impacto?: ConfirmacaoImpacto) {
  return {
    desfecho: v.desfecho, induzido: triEstado(v.induzido), dificuldade: triEstado(v.dificuldade),
    assistenciaDescricao: v.assistenciaDescricao || null, responsavel: v.responsavel || null,
    observacao: v.observacao || null, retencaoPlacenta: triEstado(v.retencaoPlacenta), grauRetencaoPlacenta: v.retencaoPlacenta === "SIM" && v.grauRetencaoPlacenta ? Number(v.grauRetencaoPlacenta) : null,
    ocorridoEm: v.hora ? dataHoraISO(`${data}T${v.hora}`) : null,
    horarioEstimado: !!v.hora && v.horarioEstimado,
    ...(v.escoreAtivo ? { escoreMatriz: { acao: "REGISTRAR" as const, valor: Number(v.escoreValor.replace(",", ".")) } } : {}),
    ...(v.retencaoPlacenta === "SIM" && v.retencaoAcao === "CRIAR" ? { ocorrenciaRetencao: { acao: "CRIAR" as const, doencaId: v.doencaId, inicio: v.retencaoData, ...(impacto ? { impacto } : {}) } } : v.retencaoPlacenta === "SIM" && v.retencaoAcao === "VINCULAR" ? { ocorrenciaRetencao: { acao: "VINCULAR" as const, ocorrenciaId: v.ocorrenciaId } } : {}),
    ...(v.pesoAcao === "REGISTRAR" ? { pesoMatriz: { acao: "REGISTRAR" as const, data: v.pesoData, pesoKg: Number(v.pesoKg) } } : v.pesoAcao === "VINCULAR" ? { pesoMatriz: { acao: "VINCULAR" as const, pesagemId: v.pesagemId } } : {}),
  };
}
function Segmentado({ rotulo, valor, opcoes, onChange, obrigatorio = false, destacarRotulo = false }: {
  rotulo: string;
  valor: string;
  opcoes: Array<[string, string]>;
  onChange: (v: string) => void;
  obrigatorio?: boolean;
  destacarRotulo?: boolean;
}) {
  const nome = useId();
  return (
    <fieldset className="grid min-w-0 text-sm">
      <legend className={destacarRotulo ? "font-semibold" : "font-medium"}>{rotulo}{obrigatorio && <span aria-hidden="true"> *</span>}</legend>
      <div className="flex min-h-[var(--campo-altura)] w-full overflow-hidden rounded-[var(--radius-btn)] border border-border">
        {opcoes.map(([v, texto]) => (
          <label key={v} className="relative flex min-w-0 flex-auto cursor-pointer items-center justify-center border-r border-border px-2 py-1.5 text-center last:border-r-0 has-[:checked]:bg-[var(--primary)] has-[:checked]:text-[var(--primary-foreground)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-ink">
            <input className="sr-only" type="radio" name={nome} value={v} checked={valor === v} onChange={() => onChange(v)} />
            {texto}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function CamposTriEstado({ rotulo, valor, onChange, segmentado = false, destacarRotulo = false }: { rotulo: string; valor: string; onChange: (v: string) => void; segmentado?: boolean; destacarRotulo?: boolean }) {
  if (segmentado) return <Segmentado rotulo={rotulo} valor={valor} onChange={onChange} destacarRotulo={destacarRotulo} opcoes={[["", "Não informado"], ["NAO", "Não"], ["SIM", "Sim"]]} />;
  return <label className="grid gap-1 text-sm">{rotulo}<SelectCampo className={classeInput} value={valor} onValueChange={novoValor => onChange(novoValor)}><option value="">Não informado</option><option value="SIM">Sim</option><option value="NAO">Não</option></SelectCampo></label>;
}
export function PostParto({ valor, onChange, animalId, propriedadeId, escoreRef, erroEscore = false, revisaoEscore = false, escalaLegada = false, mostrarEscore = true, modeloRegistro = false }: { modeloRegistro?: boolean; mostrarEscore?: boolean; escalaLegada?: boolean; revisaoEscore?: boolean; valor: DadosParto; onChange: (v: DadosParto) => void; animalId: string; propriedadeId?: number; escoreRef?: React.Ref<HTMLInputElement>; erroEscore?: boolean }) {
  const [doencas, setDoencas] = useState<Array<{ id: string; nome: string }>>([]);
  const [ocorrencias, setOcorrencias] = useState<Array<{ id: string; inicio: string; doenca: { nome: string } }>>([]);
  const [erroRp, setErroRp] = useState<string | null>(null);
  useEffect(() => {
    setDoencas([]); setOcorrencias([]); setErroRp(null);
    if (valor.retencaoPlacenta !== "SIM" || !valor.retencaoAcao || !animalId) return;
    let ativo = true;
    const consulta = valor.retencaoAcao === "CRIAR" ? reqV4<Array<{ id: string; nome: string }>>("/sanidade/doencas", undefined, "GET", propriedadeId).then(v => { if (ativo) setDoencas(v); }) : reqV4<Array<{ id: string; inicio: string; doenca: { nome: string } }>>(`/sanidade/ocorrencias?animalId=${encodeURIComponent(animalId)}`, undefined, "GET", propriedadeId).then(v => { if (ativo) setOcorrencias(v); });
    consulta.catch(e => { if (ativo) setErroRp(e.message); }); return () => { ativo = false; };
  }, [valor.retencaoPlacenta, valor.retencaoAcao, animalId, propriedadeId]);
  const [pesagens, setPesagens] = useState<HistoricoPesagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    setPesagens([]); setErro(null);
    if (valor.pesoAcao !== "VINCULAR" || !animalId) { setCarregando(false); return; }
    let ativo = true; setCarregando(true);
    reqV4<{ historicoPesagens: HistoricoPesagem[] }>(`/animais/${encodeURIComponent(animalId)}`, undefined, "GET", propriedadeId).then(f => { if (ativo) setPesagens(f.historicoPesagens); }).catch(e => { if (ativo) setErro(e.message); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [animalId, valor.pesoAcao, propriedadeId]);
  function mudar(campo: keyof DadosParto, v: string) { onChange({ ...valor, [campo]: v }); }
  function mudarPeso(pesoAcao: string) {
    onChange({ ...valor, pesoAcao, pesagemId: "" });
  }

  return <section className="grid gap-4" aria-label="Complementos pós-parto">
    {!modeloRegistro && <h3 className="text-sm font-semibold">Complementos pós-parto</h3>}
    <div className="parto-pos-bloco grid min-w-0 gap-4">
      <CamposTriEstado
        segmentado={modeloRegistro}
        destacarRotulo
        rotulo="Retenção de placenta"
        valor={valor.retencaoPlacenta}
        onChange={v => onChange({ ...valor, retencaoPlacenta: v, grauRetencaoPlacenta: v === "SIM" ? valor.grauRetencaoPlacenta : "" })}
      />
      {valor.retencaoPlacenta === "SIM" && <>
        <div className={modeloRegistro ? "grid items-start gap-3 sm:grid-cols-2" : "grid gap-4"}>
          {modeloRegistro ? (
            <div className="flex min-w-0 items-end gap-2 [&>fieldset]:flex-1">
              <Segmentado rotulo="Grau de retenção" valor={valor.grauRetencaoPlacenta} onChange={v => mudar("grauRetencaoPlacenta", v)} opcoes={[["1", "1"], ["2", "2"], ["3", "3"]]} />
              <Button type="button" variant="outline" size="icon" className="h-[var(--campo-altura)] w-[var(--campo-altura)] shrink-0" aria-label="Limpar grau de retenção" onClick={() => mudar("grauRetencaoPlacenta", "")}><X size={16} aria-hidden /></Button>
            </div>
          ) : (
            <div className="grid gap-2">
              <label>Grau de retenção (opcional)<SelectCampo value={valor.grauRetencaoPlacenta} onValueChange={v => mudar("grauRetencaoPlacenta", v)}><option value="">Não informado</option>{[1, 2, 3].map(g => <option key={g} value={g}>{g}</option>)}</SelectCampo></label>
              <p className="text-sm text-muted-foreground">O grau é descritivo; não determina tratamento ou aptidão.</p>
            </div>
          )}
          <label className="grid min-w-0 content-start gap-1 text-sm font-medium">
            Ocorrência sanitária de retenção
            <SelectCampo className={classeInput} value={valor.retencaoAcao} onValueChange={novoValor => onChange({ ...valor, retencaoAcao: novoValor, doencaId: "", ocorrenciaId: "" })}>
              <option value="">Somente informar retenção</option>
              <option value="CRIAR">Criar ocorrência sanitária</option>
              <option value="VINCULAR">Vincular ocorrência existente</option>
            </SelectCampo>
          </label>
        </div>
        <ErrorBox erro={erroRp} />
        {valor.retencaoAcao === "CRIAR" && <>
          <p className="text-sm text-ink-3">Antes de registrar, serão conferidos os impactos configurados nos protocolos da matriz. A ocorrência e os efeitos confirmam juntos.</p>
          <label className="grid gap-1 text-sm">
            <span>Doença da ocorrência <span aria-hidden="true">*</span></span>
            <SelectCampo id="doenca-rp-parto" aria-required="true" className={classeInput} value={valor.doencaId} onValueChange={novoValor => mudar("doencaId", novoValor)}>
              <option value="">Selecione a doença de retenção</option>
              {doencas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </SelectCampo>
          </label>
          <label className="grid gap-1 text-sm">
            <span>Início real da ocorrência <span aria-hidden="true">*</span></span>
            <DatePicker id="data-rp-parto" aria-required="true" className={modeloRegistro ? undefined : classeInput} value={valor.retencaoData} onChange={v => mudar("retencaoData", v)} />
          </label>
        </>}
        {valor.retencaoAcao === "VINCULAR" && (
          <label className="grid gap-1 text-sm">
            <span>Ocorrência existente <span aria-hidden="true">*</span></span>
            <SelectCampo id="ocorrencia-rp-parto" aria-required="true" className={classeInput} value={valor.ocorrenciaId} onValueChange={novoValor => mudar("ocorrenciaId", novoValor)}>
              <option value="">Selecione a ocorrência de retenção</option>
              {ocorrencias.map(o => <option key={o.id} value={o.id}>{o.inicio.slice(0, 10)} · {o.doenca.nome}</option>)}
            </SelectCampo>
          </label>
        )}
      </>}
    </div>
    <div className="parto-pos-bloco grid min-w-0 gap-4">
      {modeloRegistro ? (
        <Segmentado
          destacarRotulo
          rotulo="Peso da matriz"
          valor={valor.pesoAcao}
          onChange={mudarPeso}
          opcoes={[["", "Não informar"], ["REGISTRAR", "Registrar pesagem"], ["VINCULAR", "Usar existente"]]}
        />
      ) : (
        <label className="grid gap-1 text-sm">
          Peso da matriz
          <SelectCampo className={classeInput} value={valor.pesoAcao} onValueChange={mudarPeso}>
            <option value="">Não informar agora</option>
            <option value="REGISTRAR">Registrar pesagem</option>
            <option value="VINCULAR">Reutilizar pesagem existente</option>
          </SelectCampo>
        </label>
      )}
      {valor.pesoAcao === "REGISTRAR" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1 text-sm">
            <span>Data real da pesagem <span aria-hidden="true">*</span></span>
            <DatePicker id="data-peso-parto" aria-required="true" className={modeloRegistro ? undefined : classeInput} value={valor.pesoData} onChange={v => mudar("pesoData", v)} />
          </label>
          <label className="grid min-w-0 gap-1 text-sm">
            <span>Peso da matriz (kg) <span aria-hidden="true">*</span></span>
            <Input id="peso-matriz-parto" aria-required="true" className={classeInput} type="number" min="0.001" max="99999" step="any" value={valor.pesoKg} onChange={e => mudar("pesoKg", e.target.value)} />
          </label>
        </div>
      )}
      {valor.pesoAcao === "VINCULAR" && <>
        <ErrorBox erro={erro} />
        <label className="grid gap-1 text-sm">
          <span>Pesagem existente <span aria-hidden="true">*</span></span>
          <SelectCampo id="pesagem-parto" aria-required="true" className={classeInput} disabled={carregando} value={valor.pesagemId} onValueChange={novoValor => mudar("pesagemId", novoValor)}>
            <option value="">{carregando ? "Carregando pesagens…" : "Selecione a pesagem"}</option>
            {pesagens.map(p => <option key={p.id} value={p.id}>{p.data.slice(0, 10)} · {p.pesoKg} kg</option>)}
          </SelectCampo>
        </label>
        {!carregando && !erro && !pesagens.length && <p className="text-sm">Nenhuma pesagem disponível para esta matriz.</p>}
      </>}
    </div>
    {mostrarEscore && (
      <div className={modeloRegistro ? "parto-pos-bloco grid gap-3 sm:grid-cols-2" : "grid grid-cols-2 items-center gap-3"}>
        <ConfirmacaoCiencia
          className={modeloRegistro ? "self-center font-semibold [&>label]:items-center" : "self-center [&>label]:items-center"}
          id="registrar-ecc-matriz"
          checked={valor.escoreAtivo}
          onChange={ativo => onChange({ ...valor, escoreAtivo: ativo })}
        >
          Registrar ECC da matriz
        </ConfirmacaoCiencia>
        {valor.escoreAtivo && (
          <div className="grid min-w-0 gap-1">
            <label className="grid gap-1 text-sm" htmlFor="valor-ecc-parto">
              <span>Valor do escore <span aria-hidden="true">*</span></span>
              <Input id="valor-ecc-parto" ref={escoreRef} aria-required="true" aria-invalid={erroEscore || undefined} aria-describedby={erroEscore ? "erro-ecc-parto" : undefined} inputMode="decimal" className={classeInput} value={valor.escoreValor} onChange={e => mudar("escoreValor", e.target.value)} />
            </label>
            {erroEscore && <span id="erro-ecc-parto" className="text-sm text-destructive">Informe um valor numérico.</span>}
          </div>
        )}
      </div>
    )}
    {revisaoEscore && valor.escoreAtivo && <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Data real da avaliação *<DatePicker required value={valor.escoreData} onChange={v => mudar("escoreData", v)} /></label>{escalaLegada && <>{([ ["escalaMin", "Mínimo da escala"], ["escalaMax", "Máximo da escala"], ["escalaDescricao", "Descrição da escala"] ] as const).map(([campo, rotulo]) => <label key={campo} className="grid gap-1 text-sm">{rotulo}{campo !== "escalaDescricao" && " *"}<Input aria-required={campo !== "escalaDescricao"} className={classeInput} value={valor[campo]} onChange={e => mudar(campo, e.target.value)} /></label>)}</>}</div>}
  </section>;
}
export function PartoCampos({ valor, onChange, crias, setCrias, lotes, lactacao, setLactacao, animalId, propriedadeId, lotesCarregando = false, onDestinoPendente, revelarExplicacao = 0, revelarEscore = 0, revelarPos = 0, revelarDestino = 0 }: { revelarPos?: number; revelarDestino?: number; revelarEscore?: number; revelarExplicacao?: number; lotesCarregando?: boolean; onDestinoPendente?: (pendente: boolean) => void; valor: DadosParto; onChange: (v: DadosParto) => void; crias: CriaInput[]; setCrias: (v: CriaInput[]) => void; lotes: Lote[]; lactacao: boolean; setLactacao: (v: boolean) => void; animalId: string; propriedadeId?: number }) {
  const [aba, setAba] = useState("parto");
  const explicacaoRef = useRef<HTMLTextAreaElement>(null);
  const escoreRef = useRef<HTMLInputElement>(null);
  const partoRef = useRef<HTMLElement>(null);
  const posRef = useRef<HTMLDivElement>(null);
  const focoInvalido = useRef(false);
  const focoPendente = useRef<{ campo: HTMLElement; validar?: boolean } | null>(null);
  useLayoutEffect(() => {
    const pendente = focoPendente.current;
    if (!pendente) return;
    focoPendente.current = null;
    focoInvalido.current = false;
    pendente.campo.focus();
    if (pendente.validar) (pendente.campo as HTMLInputElement).reportValidity();
  }, [aba, revelarPos]);
  function focarSecao(secao: "parto" | "pos", campo: HTMLElement | null | undefined, validar = false) {
    if (!campo) return;
    if (aba === secao) { campo.focus(); if (validar) (campo as HTMLInputElement).reportValidity(); }
    else { focoPendente.current = { campo, validar }; setAba(secao); }
  }
  function revelarInvalido(secao: "parto" | "pos", evento: React.FormEvent<HTMLElement>) {
    if (focoInvalido.current) { if (aba !== secao) evento.preventDefault(); return; }
    focoInvalido.current = true;
    requestAnimationFrame(() => { focoInvalido.current = false; });
    if (aba !== secao) { evento.preventDefault(); focarSecao(secao, evento.target as HTMLElement, true); }
  }
  useEffect(() => {
    if (!revelarPos) return;
    const alvo = valor.retencaoPlacenta === "SIM" && valor.retencaoAcao === "CRIAR" && (!valor.doencaId || !valor.retencaoData)
      ? (!valor.doencaId ? "doenca-rp-parto" : "data-rp-parto")
      : valor.retencaoPlacenta === "SIM" && valor.retencaoAcao === "VINCULAR" && !valor.ocorrenciaId ? "ocorrencia-rp-parto"
      : valor.pesoAcao === "REGISTRAR" && (!valor.pesoData || !(Number(valor.pesoKg) > 0)) ? (!valor.pesoData ? "data-peso-parto" : "peso-matriz-parto")
      : "pesagem-parto";
    const campo = document.getElementById(alvo);
    focarSecao("pos", campo);
  }, [revelarPos]);
  useEffect(() => { if (revelarDestino) focarSecao("parto", partoRef.current?.querySelector<HTMLElement>('[data-destino-pendente="true"]')); }, [revelarDestino]);
  useEffect(() => { if (revelarEscore) focarSecao("pos", escoreRef.current); }, [revelarEscore]);
  useEffect(() => { if (revelarExplicacao) focarSecao("parto", explicacaoRef.current); }, [revelarExplicacao]);
  const escolhasManuais = useRef(new Set<number>());
  const automaticos = useRef(new Map<number, string>());
  const sitioAnterior = useRef(propriedadeId);
  const sugestaoBezerreiro = useSugestaoBezerreiro(propriedadeId, valor.desfecho === "NASCIMENTO", lotes.filter(l => l.ativo && l.propriedadeId === propriedadeId));
  const destino = sugestaoBezerreiro.perfis.length === 1 ? sugestaoBezerreiro.perfis[0].loteId : undefined;
  useEffect(() => {
    if (sitioAnterior.current !== propriedadeId) {
      sitioAnterior.current = propriedadeId;
      const novas = crias.map((c, i) => automaticos.current.get(i) === c.loteId ? {...c, loteId: undefined} : c);
      automaticos.current.clear(); escolhasManuais.current.clear();
      if (novas.some((c, i) => c !== crias[i])) {setCrias(novas); return;}
    }
    if (lotesCarregando || !destino || !lotes.some(l => l.id === destino)) return;
    const novas = crias.map((c, i) => {
      if (!c.viva || c.loteId || escolhasManuais.current.has(i)) return c;
      automaticos.current.set(i, destino); return {...c, loteId: destino};
    });
    if (novas.some((c, i) => c !== crias[i])) setCrias(novas);
  }, [destino, lotes, crias, setCrias, propriedadeId, lotesCarregando]);
  const destinoPendente = valor.desfecho === "NASCIMENTO" && crias.some((c, i) => c.viva && !c.loteId && !escolhasManuais.current.has(i) && (lotesCarregando || sugestaoBezerreiro.carregando || sugestaoBezerreiro.perfis.length > 1));
  useEffect(() => {onDestinoPendente?.(destinoPendente);}, [destinoPendente, onDestinoPendente]);
  function mudar(campo: keyof DadosParto, v: string) { onChange({ ...valor, [campo]: v }); }
  function cria(i: number, v: Partial<CriaInput>) { setCrias(crias.map((c, j) => j === i ? { ...c, ...v } : c)); }
  return <>
    <div className="grid gap-4">
    <div className="overflow-hidden rounded-lg border border-border">
      <button type="button" aria-label="Parto e crias" aria-describedby={aba !== "parto" ? "resumo-parto" : undefined} aria-expanded={aba === "parto"} aria-controls="painel-parto" onClick={() => setAba(aba === "parto" ? "" : "parto")} className={`flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${aba === "parto" ? "bg-[color-mix(in_srgb,var(--primary)_14%,var(--card))]" : "bg-surface-2"}`}><span className="font-semibold">Parto e crias</span>{aba !== "parto" && <span id="resumo-parto" className="ml-auto text-sm">{valor.desfecho === "ABORTO" ? "Aborto" : `Nascimento · ${crias.length} ${crias.length === 1 ? "cria" : "crias"}`}</span>}<ChevronDown size={18} aria-hidden className={`${aba === "parto" ? "ml-auto rotate-180" : ""} shrink-0`} /></button>
    <section id="painel-parto" ref={partoRef} hidden={aba !== "parto"} onInvalidCapture={e => revelarInvalido("parto", e)} className="grid gap-4 p-4">
      <div className="grid items-start gap-3 sm:grid-cols-2"><Segmentado rotulo="Desfecho" obrigatorio valor={valor.desfecho} onChange={v => onChange({ ...valor, desfecho: v as DadosParto["desfecho"] })} opcoes={[["NASCIMENTO", "Nascimento"], ["ABORTO", "Aborto"]]} /><div className="flex flex-wrap items-end gap-3"><label className="grid min-w-0 flex-1 gap-1 text-sm">Hora<Input className={classeInput} type="time" value={valor.hora} onChange={e => onChange({ ...valor, hora: e.target.value, horarioEstimado: e.target.value ? valor.horarioEstimado : false })} /></label><label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" disabled={!valor.hora} checked={valor.horarioEstimado} onChange={e => onChange({ ...valor, horarioEstimado: e.target.checked })} /> Horário estimado</label></div></div>
      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"><CamposTriEstado segmentado rotulo="Parto induzido" valor={valor.induzido} onChange={v => mudar("induzido", v)} /><CamposTriEstado segmentado rotulo="Dificuldade no parto" valor={valor.dificuldade} onChange={v => mudar("dificuldade", v)} /></div>
      <div className="grid items-start gap-3 border-t border-border pt-4 sm:grid-cols-2"><label className="grid gap-1 text-sm">Assistência<textarea className={classeInput} maxLength={1000} value={valor.assistenciaDescricao} onChange={e => mudar("assistenciaDescricao", e.target.value)} /></label>
      <label className="grid gap-1 text-sm">Responsável pelo parto<Input className={classeInput} maxLength={160} value={valor.responsavel} onChange={e => mudar("responsavel", e.target.value)} /></label></div>
      {valor.desfecho === "ABORTO" ? null : <><h3 className="font-semibold">Crias</h3>{crias.map((c, i) => <fieldset key={i} data-cria className="grid items-start gap-3 border-t border-border pt-4 sm:grid-cols-2"><legend className="sr-only">Cria {i + 1}</legend><div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-1 sm:col-span-2"><span className="font-semibold">Cria {i + 1}</span><Button variant="ghost" size="sm" aria-label={`Remover cria ${i + 1}`} type="button" onClick={() => { escolhasManuais.current = new Set([...escolhasManuais.current].filter(j => j !== i).map(j => j > i ? j - 1 : j)); automaticos.current = new Map([...automaticos.current].filter(([j]) => j !== i).map(([j, id]) => [j > i ? j - 1 : j, id])); setCrias(crias.filter((_, j) => j !== i)); requestAnimationFrame(() => { const grupos = partoRef.current?.querySelectorAll<HTMLElement>('[data-cria]'); (grupos?.[i]?.querySelector<HTMLElement>('input,button') ?? partoRef.current?.querySelector<HTMLElement>('[data-adicionar-cria]'))?.focus(); }); }}>Remover</Button></div><Segmentado rotulo="Sexo da cria" obrigatorio valor={c.sexo} onChange={v => cria(i, { sexo: v as CriaInput["sexo"] })} opcoes={[["F", "Fêmea"], ["M", "Macho"]]} /><Segmentado rotulo="Condição da cria" obrigatorio valor={c.viva ? "VIVA" : "NATIMORTA"} onChange={v => cria(i, { viva: v === "VIVA" })} opcoes={[["VIVA", "Viva"], ["NATIMORTA", "Natimorta"]]} /><label className="grid content-start gap-1 text-sm">Brinco<Input aria-label="Brinco" aria-describedby={`ajuda-brinco-${i}`} className={classeInput} maxLength={39} value={c.brinco ?? ""} onChange={e => cria(i, { brinco: e.target.value || undefined })} /><span id={`ajuda-brinco-${i}`} className="text-xs text-ink-3">Sem brinco, a cria viva recebe identificação provisória.</span></label><label className="grid content-start gap-1 text-sm">Peso ao nascer (kg)<Input className={classeInput} type="number" min="0.001" max="99999" step="any" value={c.pesoKg ?? ""} onChange={e => cria(i, { pesoKg: e.target.value ? Number(e.target.value) : undefined })} /></label><label className="grid gap-1 text-sm"><span>Finalidade <span aria-hidden="true">*</span></span><SelectCampo aria-required="true" className={classeInput} value={c.aptidao} onValueChange={novoValor => cria(i, { aptidao: novoValor as CriaInput["aptidao"] })}><option value="LEITE">Leite</option><option value="CORTE">Corte</option><option value="REPRODUCAO">Reprodução</option></SelectCampo></label><label className="grid gap-1 text-sm">Lote da cria<SelectCampo data-destino-pendente={(lotesCarregando || sugestaoBezerreiro.carregando || sugestaoBezerreiro.perfis.length > 1) && c.viva && !c.loteId && !escolhasManuais.current.has(i) ? "true" : undefined} className={classeInput} value={(lotesCarregando || sugestaoBezerreiro.carregando || sugestaoBezerreiro.perfis.length > 1) && c.viva && !c.loteId && !escolhasManuais.current.has(i) ? "__escolher__" : c.loteId ?? "__sem_lote__"} onValueChange={novoValor => { if (!novoValor) return; escolhasManuais.current.add(i); automaticos.current.delete(i); cria(i, { loteId: novoValor === "__sem_lote__" ? undefined : novoValor }); }}>{(lotesCarregando || sugestaoBezerreiro.carregando || sugestaoBezerreiro.perfis.length > 1) && c.viva && !c.loteId && !escolhasManuais.current.has(i) && <option value="__escolher__" disabled>Escolha o lote de destino</option>}<option value="__sem_lote__">Sem lote informado</option>{lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</SelectCampo></label>{c.viva && lotesCarregando && <p role="status" className="text-sm text-ink-3 sm:col-span-2">Carregando lotes do sítio…</p>}{c.viva && <AjudaDestinoBezerreiro sugestao={sugestaoBezerreiro} loteId={c.loteId} elegivel/>}</fieldset>)}<Button data-adicionar-cria variant="outline" type="button" disabled={crias.length >= 10} onClick={() => setCrias([...crias, { viva: true, sexo: "F", aptidao: "LEITE" }])}>+ Adicionar cria</Button></>}
      {valor.desfecho==="ABORTO"?<label className="grid gap-1 text-sm"><span>Explicação do aborto <span aria-hidden="true">*</span></span><textarea ref={explicacaoRef} aria-describedby="explicacao-aborto-ajuda" className={classeInput} required minLength={5} maxLength={1000} value={valor.observacao} onChange={e=>mudar("observacao",e.target.value)}/><span id="explicacao-aborto-ajuda">Descreva a observação e o contexto; a causa clínica pode ser desconhecida.</span></label>:<label className="grid gap-1 text-sm">Observações do parto<textarea className={classeInput} maxLength={1000} value={valor.observacao} onChange={e => mudar("observacao", e.target.value)} /></label>}
      <ConfirmacaoCiencia id="registrar-lactacao-parto" checked={lactacao} onChange={setLactacao}>Registrar início de lactação</ConfirmacaoCiencia>
    </section></div>
    <div className="overflow-hidden rounded-lg border border-border"><button type="button" aria-label="Pós-parto" aria-describedby={aba !== "pos" ? "resumo-pos-parto" : undefined} aria-expanded={aba === "pos"} aria-controls="painel-pos-parto" onClick={() => setAba(aba === "pos" ? "" : "pos")} className={`flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${aba === "pos" ? "bg-[color-mix(in_srgb,var(--primary)_14%,var(--card))]" : "bg-surface-2"}`}><span className="font-semibold">Pós-parto</span>{aba !== "pos" && <span id="resumo-pos-parto" className="ml-auto text-sm">{[valor.retencaoPlacenta === "SIM" ? "Retenção informada" : valor.retencaoPlacenta === "NAO" ? "Sem retenção" : null, valor.pesoAcao === "REGISTRAR" ? "Registrar pesagem" : valor.pesoAcao === "VINCULAR" ? "Vincular pesagem" : null, valor.escoreAtivo ? "Registrar ECC" : null].filter(Boolean).join(" · ") || "Sem informações"}</span>}<ChevronDown size={18} aria-hidden className={`${aba === "pos" ? "ml-auto rotate-180" : ""} shrink-0`} /></button><div id="painel-pos-parto" ref={posRef} hidden={aba !== "pos"} onInvalidCapture={e => revelarInvalido("pos", e)} className="p-4"><PostParto modeloRegistro valor={valor} onChange={onChange} animalId={animalId} propriedadeId={propriedadeId} escoreRef={escoreRef} erroEscore={revelarEscore > 0 && valor.escoreAtivo && !escoreNumericoValido(valor.escoreValor)} /></div></div>
    </div>
  </>;
}

export const escoreNumericoValido = (valor: string) => !!valor.trim() && /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(valor.trim()) && Number.isFinite(Number(valor.replace(",", ".")));
export function validarDadosParto(v: DadosParto, anterior?: Pick<DadosParto, "desfecho" | "observacao">): string | null {
  const exigeExplicacao = !anterior || anterior.desfecho !== "ABORTO" || v.observacao !== anterior.observacao;
  if (v.desfecho === "ABORTO" && exigeExplicacao && v.observacao.trim().length < 5) return "Informe a explicação do aborto com pelo menos 5 caracteres.";
  if (v.escoreAtivo && !escoreNumericoValido(v.escoreValor)) return "Informe um valor numérico para o escore na aba Pós-parto.";
  if (v.retencaoPlacenta === "SIM" && v.retencaoAcao === "CRIAR" && (!v.doencaId || !v.retencaoData)) return "Informe a doença e a data real da ocorrência na aba Pós-parto.";
  if (v.retencaoPlacenta === "SIM" && v.retencaoAcao === "VINCULAR" && !v.ocorrenciaId) return "Selecione a ocorrência de retenção na aba Pós-parto.";
  if (v.pesoAcao === "REGISTRAR" && (!v.pesoData || !(Number(v.pesoKg) > 0))) return "Informe a data real e o peso da matriz na aba Pós-parto.";
  if (v.pesoAcao === "VINCULAR" && !v.pesagemId) return "Selecione uma pesagem existente na aba Pós-parto.";
  return null;
}
