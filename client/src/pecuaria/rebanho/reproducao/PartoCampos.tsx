import { AjudaCampo } from "../../../components/Dica";
import { Button } from "../../../components/ui/button";
import { DatePicker } from "../../../components/DatePicker";
import { Input } from "../../../components/ui/input";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { dataHoraISO } from "./CampoDataIatf";
import { useEffect, useState } from "react";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { reqV4, type CriaInput } from "./api";
import type { HistoricoPesagem, Lote } from "../types";

export type DadosParto = {
  desfecho: "NASCIMENTO" | "ABORTO";
  hora: string; horarioEstimado: boolean;
  induzido: string; dificuldade: string; assistenciaDescricao: string;
  responsavel: string; observacao: string; retencaoPlacenta: string;
  escoreAtivo: boolean; escoreData: string; escoreValor: string; escalaMin: string; escalaMax: string; escalaDescricao: string;
  retencaoAcao: string; doencaId: string; ocorrenciaId: string; retencaoData: string;
  pesoAcao: string; pesagemId: string; pesoKg: string; pesoData: string;
};
export const dadosPartoVazios = (): DadosParto => ({ desfecho: "NASCIMENTO", hora: "", horarioEstimado: false, induzido: "", dificuldade: "", assistenciaDescricao: "", responsavel: "", observacao: "", retencaoPlacenta: "", escoreAtivo: false, escoreData: "", escoreValor: "", escalaMin: "", escalaMax: "", escalaDescricao: "", retencaoAcao: "", doencaId: "", ocorrenciaId: "", retencaoData: "", pesoAcao: "", pesagemId: "", pesoKg: "", pesoData: "" });
export const triEstado = (valor: string) => valor === "" ? null : valor === "SIM";
export function camposPartoPayload(v: DadosParto, data: string) {
  return {
    desfecho: v.desfecho, induzido: triEstado(v.induzido), dificuldade: triEstado(v.dificuldade),
    assistenciaDescricao: v.assistenciaDescricao || null, responsavel: v.responsavel || null,
    observacao: v.observacao || null, retencaoPlacenta: triEstado(v.retencaoPlacenta),
    ocorridoEm: v.hora ? dataHoraISO(`${data}T${v.hora}`) : null,
    horarioEstimado: !!v.hora && v.horarioEstimado,
    ...(v.escoreAtivo ? { escoreMatriz: { acao: "REGISTRAR" as const, data: v.escoreData, valor: Number(v.escoreValor), escalaMin: Number(v.escalaMin), escalaMax: Number(v.escalaMax), escalaDescricao: v.escalaDescricao || null } } : {}),
    ...(v.retencaoPlacenta === "SIM" && v.retencaoAcao === "CRIAR" ? { ocorrenciaRetencao: { acao: "CRIAR" as const, doencaId: v.doencaId, inicio: v.retencaoData } } : v.retencaoPlacenta === "SIM" && v.retencaoAcao === "VINCULAR" ? { ocorrenciaRetencao: { acao: "VINCULAR" as const, ocorrenciaId: v.ocorrenciaId } } : {}),
    ...(v.pesoAcao === "REGISTRAR" ? { pesoMatriz: { acao: "REGISTRAR" as const, data: v.pesoData, pesoKg: Number(v.pesoKg) } } : v.pesoAcao === "VINCULAR" ? { pesoMatriz: { acao: "VINCULAR" as const, pesagemId: v.pesagemId } } : {}),
  };
}
export function CamposTriEstado({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange: (v: string) => void }) {
  return <label className="grid gap-1 text-sm">{rotulo}<SelectCampo className={classeInput} value={valor} onValueChange={novoValor => onChange(novoValor)}><option value="">Não informado</option><option value="SIM">Sim</option><option value="NAO">Não</option></SelectCampo></label>;
}
export function PostParto({ valor, onChange, animalId, propriedadeId }: { valor: DadosParto; onChange: (v: DadosParto) => void; animalId: string; propriedadeId?: number }) {
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
  return <section className="grid gap-4" aria-label="Complementos pós-parto"><h3 className="text-sm font-semibold">Complementos pós-parto <AjudaCampo rotulo="Ajuda sobre complementos pós-parto" texto="Preencha somente o que foi observado. Os complementos podem ser registrados depois."/></h3>

    <CamposTriEstado rotulo="Retenção de placenta" valor={valor.retencaoPlacenta} onChange={v => mudar("retencaoPlacenta", v)} />
    {valor.retencaoPlacenta === "SIM" && <><label className="grid gap-1 text-sm">Ocorrência sanitária de retenção<SelectCampo className={classeInput} value={valor.retencaoAcao} onValueChange={novoValor => onChange({ ...valor, retencaoAcao: novoValor, doencaId: "", ocorrenciaId: "" })}><option value="">Somente informar retenção</option><option value="CRIAR">Criar ocorrência sanitária</option><option value="VINCULAR">Vincular ocorrência existente</option></SelectCampo></label><ErrorBox erro={erroRp} />{valor.retencaoAcao === "CRIAR" && <><label className="grid gap-1 text-sm">Doença da ocorrência<SelectCampo className={classeInput} value={valor.doencaId} onValueChange={novoValor => mudar("doencaId", novoValor)}><option value="">Selecione a doença de retenção</option>{doencas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}</SelectCampo></label><label className="grid gap-1 text-sm">Início real da ocorrência<DatePicker className={classeInput}  value={valor.retencaoData} onChange={valor => mudar("retencaoData", valor)} /></label></>}{valor.retencaoAcao === "VINCULAR" && <label className="grid gap-1 text-sm">Ocorrência existente<SelectCampo className={classeInput} value={valor.ocorrenciaId} onValueChange={novoValor => mudar("ocorrenciaId", novoValor)}><option value="">Selecione a ocorrência de retenção</option>{ocorrencias.map(o => <option key={o.id} value={o.id}>{o.inicio.slice(0, 10)} · {o.doenca.nome}</option>)}</SelectCampo></label>}</>}
    <label className="grid gap-1 text-sm">Peso da matriz<SelectCampo className={classeInput} value={valor.pesoAcao} onValueChange={novoValor => onChange({ ...valor, pesoAcao: novoValor, pesagemId: "" })}><option value="">Não informar agora</option><option value="REGISTRAR">Registrar pesagem</option><option value="VINCULAR">Reutilizar pesagem existente</option></SelectCampo></label>
    {valor.pesoAcao === "REGISTRAR" && <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Data real da pesagem<DatePicker className={classeInput}  value={valor.pesoData} onChange={valor => mudar("pesoData", valor)} /></label><label className="grid gap-1 text-sm">Peso da matriz (kg)<Input className={classeInput} type="number" min="0.001" max="99999" step="any" value={valor.pesoKg} onChange={e => mudar("pesoKg", e.target.value)} /></label></div>}
    {valor.pesoAcao === "VINCULAR" && <><ErrorBox erro={erro} /><label className="grid gap-1 text-sm">Pesagem existente<SelectCampo className={classeInput} disabled={carregando} value={valor.pesagemId} onValueChange={novoValor => mudar("pesagemId", novoValor)}><option value="">{carregando ? "Carregando pesagens…" : "Selecione a pesagem"}</option>{pesagens.map(p => <option key={p.id} value={p.id}>{p.data.slice(0, 10)} · {p.pesoKg} kg</option>)}</SelectCampo></label>{!carregando && !erro && !pesagens.length && <p className="text-sm">Nenhuma pesagem disponível para esta matriz.</p>}</>}
    <label className="text-sm"><input type="checkbox" checked={valor.escoreAtivo} onChange={e => onChange({ ...valor, escoreAtivo: e.target.checked })} /> Registrar escore corporal da matriz</label>
    {valor.escoreAtivo && <fieldset className="grid gap-3 rounded-lg border border-border p-3"><legend>Escore com escala informada <AjudaCampo rotulo="Ajuda sobre escala de escore corporal" texto="Informe a escala usada na avaliação. O sistema não adota uma escala clínica padrão."/></legend>{([["escoreData", "Data real da avaliação", "date"], ["escoreValor", "Valor do escore", "number"], ["escalaMin", "Mínimo da escala", "number"], ["escalaMax", "Máximo da escala", "number"], ["escalaDescricao", "Descrição da escala (opcional)", "text"]] as const).map(([k, r, t]) => <label key={k} className="grid gap-1 text-sm">{r}{t === "date" ? <DatePicker value={valor[k]} onChange={novaData => mudar(k, novaData)} /> : <Input className={classeInput} type={t} step={t === "number" ? "any" : undefined} maxLength={300} value={valor[k]} onChange={e => mudar(k, e.target.value)} />}</label>)}</fieldset>}
  </section>;
}
export function PartoCampos({ valor, onChange, crias, setCrias, lotes, lactacao, setLactacao, animalId, propriedadeId }: { valor: DadosParto; onChange: (v: DadosParto) => void; crias: CriaInput[]; setCrias: (v: CriaInput[]) => void; lotes: Lote[]; lactacao: boolean; setLactacao: (v: boolean) => void; animalId: string; propriedadeId?: number }) {
  const [aba, setAba] = useState("parto");
  function mudar(campo: keyof DadosParto, v: string) { onChange({ ...valor, [campo]: v }); }
  function cria(i: number, v: Partial<CriaInput>) { setCrias(crias.map((c, j) => j === i ? { ...c, ...v } : c)); }
  return <>
    <div className="flex gap-2 border-b border-border pb-2" aria-label="Etapas do registro">{[["parto", "Parto e crias"], ["pos", "Pós-parto"]].map(([id, nome]) => <Button key={id} type="button" variant={aba !== id ? "outline" : "default"} aria-pressed={aba === id} onClick={() => setAba(id)}>{nome}</Button>)}</div>
    <section hidden={aba !== "parto"} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Desfecho<SelectCampo className={classeInput} value={valor.desfecho} onValueChange={novoValor => onChange({ ...valor, desfecho: novoValor as DadosParto["desfecho"] })}><option value="NASCIMENTO">Nascimento</option><option value="ABORTO">Aborto</option></SelectCampo></label><label className="grid gap-1 text-sm">Hora (opcional)<Input className={classeInput} type="time" value={valor.hora} onChange={e => onChange({ ...valor, hora: e.target.value, horarioEstimado: e.target.value ? valor.horarioEstimado : false })} /></label></div>
      <label className="text-sm"><input type="checkbox" disabled={!valor.hora} checked={valor.horarioEstimado} onChange={e => onChange({ ...valor, horarioEstimado: e.target.checked })} /> Horário estimado</label>
      <div className="grid gap-3 sm:grid-cols-2"><CamposTriEstado rotulo="Parto induzido" valor={valor.induzido} onChange={v => mudar("induzido", v)} /><CamposTriEstado rotulo="Dificuldade no parto" valor={valor.dificuldade} onChange={v => mudar("dificuldade", v)} /></div>
      <label className="grid gap-1 text-sm">Assistência (opcional)<textarea className={classeInput} maxLength={1000} value={valor.assistenciaDescricao} onChange={e => mudar("assistenciaDescricao", e.target.value)} /></label>
      <label className="grid gap-1 text-sm">Responsável pelo parto (opcional)<Input className={classeInput} maxLength={160} value={valor.responsavel} onChange={e => mudar("responsavel", e.target.value)} /><span className="text-xs text-ink-3">Pessoa que realizou o manejo; a autoria do registro é conservada separadamente.</span></label>
      {valor.desfecho === "ABORTO" ? <p className="text-sm">O aborto encerra a gestação e reinicia o ciclo de tentativas. A lactação só será iniciada se marcada abaixo.</p> : <><h3 className="font-semibold">Crias</h3><p className="text-sm text-ink-3">Sem brinco definitivo, a cria viva recebe identificação provisória.</p>{crias.map((c, i) => <fieldset key={i} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2"><legend>Cria {i + 1}</legend><label className="grid gap-1 text-sm">Sexo da cria<SelectCampo className={classeInput} value={c.sexo} onValueChange={novoValor => cria(i, { sexo: novoValor as CriaInput["sexo"] })}><option value="F">Fêmea</option><option value="M">Macho</option></SelectCampo></label><label className="grid gap-1 text-sm">Condição da cria<SelectCampo className={classeInput} value={c.viva ? "VIVA" : "NATIMORTA"} onValueChange={novoValor => cria(i, { viva: novoValor === "VIVA" })}><option value="VIVA">Viva</option><option value="NATIMORTA">Natimorta</option></SelectCampo></label><label className="grid gap-1 text-sm">Brinco (pode ficar pendente)<Input className={classeInput} maxLength={39} value={c.brinco ?? ""} onChange={e => cria(i, { brinco: e.target.value || undefined })} /></label><label className="grid gap-1 text-sm">Peso ao nascer (kg)<Input className={classeInput} type="number" min="0.001" max="99999" step="any" value={c.pesoKg ?? ""} onChange={e => cria(i, { pesoKg: e.target.value ? Number(e.target.value) : undefined })} /></label><label className="grid gap-1 text-sm">Finalidade<SelectCampo className={classeInput} value={c.aptidao} onValueChange={novoValor => cria(i, { aptidao: novoValor as CriaInput["aptidao"] })}><option value="LEITE">Leite</option><option value="CORTE">Corte</option><option value="REPRODUCAO">Reprodução</option></SelectCampo></label><label className="grid gap-1 text-sm">Lote da cria<SelectCampo className={classeInput} value={c.loteId ?? ""} onValueChange={novoValor => cria(i, { loteId: novoValor || undefined })}><option value="">Sem lote informado</option>{lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</SelectCampo></label><Button variant="outline" type="button" onClick={() => setCrias(crias.filter((_, j) => j !== i))}>Remover cria {i + 1}</Button></fieldset>)}<Button variant="outline" type="button" disabled={crias.length >= 10} onClick={() => setCrias([...crias, { viva: true, sexo: "F", aptidao: "LEITE" }])}>+ Adicionar cria</Button></>}
      <label className="text-sm"><input type="checkbox" checked={lactacao} onChange={e => setLactacao(e.target.checked)} /> Registrar início de lactação</label>
      {valor.desfecho==="ABORTO"?<label className="grid gap-1 text-sm">Explicação do aborto (obrigatória)<textarea className={classeInput} required minLength={5} maxLength={1000} value={valor.observacao} onChange={e=>mudar("observacao",e.target.value)}/><span>Descreva a observação e o contexto; a causa clínica pode ser desconhecida.</span></label>:<details><summary className="cursor-pointer text-sm">Observações do parto (opcional)</summary><label className="grid gap-1 text-sm mt-2">Observação<textarea className={classeInput} maxLength={1000} value={valor.observacao} onChange={e => mudar("observacao", e.target.value)} /></label></details>}
    </section>
    <div hidden={aba !== "pos"}><PostParto valor={valor} onChange={onChange} animalId={animalId} propriedadeId={propriedadeId} /></div>
  </>;
}

export function validarDadosParto(v: DadosParto, anterior?: Pick<DadosParto, "desfecho" | "observacao">): string | null {
  const exigeExplicacao = !anterior || anterior.desfecho !== "ABORTO" || v.observacao !== anterior.observacao;
  if (v.desfecho === "ABORTO" && exigeExplicacao && v.observacao.trim().length < 5) return "Informe a explicação do aborto com pelo menos 5 caracteres.";
  if (v.escoreAtivo && (!v.escoreData || v.escoreValor === "" || v.escalaMin === "" || v.escalaMax === "" || !(Number(v.escalaMin) < Number(v.escalaMax)) || Number(v.escoreValor) < Number(v.escalaMin) || Number(v.escoreValor) > Number(v.escalaMax))) return "Informe a data, o escore e os limites válidos da escala na aba Pós-parto.";
  if (v.retencaoPlacenta === "SIM" && v.retencaoAcao === "CRIAR" && (!v.doencaId || !v.retencaoData)) return "Informe a doença e a data real da ocorrência na aba Pós-parto.";
  if (v.retencaoPlacenta === "SIM" && v.retencaoAcao === "VINCULAR" && !v.ocorrenciaId) return "Selecione a ocorrência de retenção na aba Pós-parto.";
  if (v.pesoAcao === "REGISTRAR" && (!v.pesoData || !(Number(v.pesoKg) > 0))) return "Informe a data real e o peso da matriz na aba Pós-parto.";
  if (v.pesoAcao === "VINCULAR" && !v.pesagemId) return "Selecione uma pesagem existente na aba Pós-parto.";
  return null;
}
