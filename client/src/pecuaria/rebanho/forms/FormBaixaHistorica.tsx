import { useEffect, useMemo, useRef, useState } from "react";
import { regularizarBaixaHistorica, revisarClassificacaoBaixa, RebanhoApiError } from "../api";
import type { AnimalFicha, CatalogoMotivoBaixa, RevisarClassificacaoBaixaInput } from "../types";
import { CLASSES_POR_TIPO, formatarDataBR, rotuloClasseMotivo, rotuloTipoBaixa } from "../lib/rotulos";
import { Button, ErrorBox, hoje, Modal } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput } from "../../../financeiro/PainelCadastro";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { DatePicker } from "../../../components/DatePicker";
import { consultarCarencia, type CarenciaAnimal } from "../sanidade/api";
import { resumoCarencia } from "../sanidade/CarenciasSanitarias";

type Baixa = AnimalFicha["historicoBaixas"][number];
type TipoConhecido = RevisarClassificacaoBaixaInput["tipo"];
const TIPOS: TipoConhecido[] = ["VENDA", "ABATE", "MORTE", "DOACAO", "EXTRAVIO"];

/** Regularização e revisão compartilham conferência, mantendo a identidade da
 * origem e a chave da revisão quando uma resposta se perde na rede. */
export function FormBaixaHistorica({ animal, baixa, motivos, onSalvo, onFechar }: {
  animal: Pick<AnimalFicha, "id" | "brinco" | "nome">;
  baixa?: Baixa;
  motivos: CatalogoMotivoBaixa[];
  onSalvo: () => void | Promise<void>;
  onFechar: () => void;
}) {
  const revisando = !!baixa;
  const [data, setData] = useState(baixa?.data ?? "");
  const [bancoOrigem, setBancoOrigem] = useState("");
  const [chaveOrigem, setChaveOrigem] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [tipo, setTipo] = useState<TipoConhecido>("VENDA");
  const [motivoId, setMotivoId] = useState("");
  const [ciente, setCiente] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [carencias, setCarencias] = useState<CarenciaAnimal | null>(null);
  const [erroConsulta, setErroConsulta] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const envioRevisao = useRef<{ assinatura: string; chave: string } | null>(null);
  const titulo = revisando ? "Revisar classificação da baixa" : "Regularizar baixa histórica";
  const requerConferencia = !revisando || tipo === "VENDA" || tipo === "ABATE";
  const referencia = new Date(`${data}T00:00:00-03:00`).getTime();
  const restricoes = !!carencias && (carencias.revisaoLeitePendente || [carencias.leite, carencias.carne].some(p => p.estado === "NAO_INFORMADO" || p.estado === "CONHECIDO" && !p.prazoZero && new Date(p.ate).getTime() > referencia));
  const grupos = useMemo(() => CLASSES_POR_TIPO[tipo].map(classe => ({ classe, motivos: motivos.filter(m => m.classe === classe) })).filter(g => g.motivos.length), [tipo, motivos]);

  useEffect(() => {
    let vivo = true;
    setCarencias(null); setErroConsulta(null); setCiente(false); setJustificativa("");
    if (!data || !requerConferencia) return;
    consultarCarencia(animal.id, data).then(resultado => { if (vivo) setCarencias(resultado); }).catch((falha: unknown) => { if (vivo) setErroConsulta(falha instanceof Error ? falha.message : String(falha)); });
    return () => { vivo = false; };
  }, [animal.id, data, tentativa, requerConferencia]);
  useEffect(() => { const campo = Object.keys(erros)[0]; if (campo) { const elemento = document.getElementById(`historica-${campo}`); elemento?.focus(); elemento?.scrollIntoView?.({ block: "center" }); } }, [erros]);
  const conferir = () => {
    const falhas: Record<string, string> = {};
    if (!data) falhas.data = "Informe a data comprovada da saída.";
    if (!revisando && !bancoOrigem.trim()) falhas.bancoOrigem = "Informe a fonte de origem.";
    if (!revisando && !chaveOrigem.trim()) falhas.chaveOrigem = "Informe o identificador na origem.";
    if (evidencia.trim().length < 5) falhas.evidencia = "Descreva a evidência com ao menos cinco caracteres.";
    if (motivo.trim().length < 5) falhas.motivo = "Informe uma justificativa com ao menos cinco caracteres.";
    if (requerConferencia && restricoes && !ciente) falhas.cienciaSanitaria = "Confirme a ciência das restrições sanitárias.";
    if (requerConferencia && restricoes && justificativa.trim().length < 5) falhas.justificativaSanitaria = "Justifique a confirmação diante das restrições.";
    setErros(falhas); setErro(null);
    if (Object.keys(falhas).length) return;
    if (requerConferencia && (!carencias || erroConsulta)) { setErro("Confira as carências históricas antes de continuar."); return; }
    setConferindo(true);
  };
  const confirmar = async () => {
    if (emCurso.current) return;
    emCurso.current = true; setSalvando(true); setErro(null); setErros({});
    const dados = { evidencia: evidencia.trim(), motivo: motivo.trim(), ...(requerConferencia && restricoes ? { cienciaSanitaria: ciente, justificativaSanitaria: justificativa.trim() } : {}) };
    try {
      if (baixa) {
        const classificacao = { ...dados, tipo, motivoId: motivoId || null };
        const assinatura = JSON.stringify(classificacao);
        if (envioRevisao.current?.assinatura !== assinatura) envioRevisao.current = { assinatura, chave: crypto.randomUUID() };
        await revisarClassificacaoBaixa(animal.id, baixa.id, { ...classificacao, chave: envioRevisao.current.chave });
      } else {
        await regularizarBaixaHistorica(animal.id, { ...dados, data, bancoOrigem: bancoOrigem.trim(), chaveOrigem: chaveOrigem.trim() });
      }
      await onSalvo();
    } catch (falha) {
      const mensagem = falha instanceof Error ? falha.message : String(falha);
      if (falha instanceof RebanhoApiError && falha.campo && ["data", "bancoOrigem", "chaveOrigem", "evidencia", "motivo", "motivoId", "tipo", "cienciaSanitaria", "justificativaSanitaria"].includes(falha.campo)) {
        setConferindo(false); setErros({ [falha.campo]: mensagem });
      } else setErro(mensagem);
    } finally { emCurso.current = false; setSalvando(false); }
  };
  const campoTexto = (campo: string, rotulo: string, valor: string, mudar: (valor: string) => void, limite: number, longo = false) => <CampoFormulario id={`historica-${campo}`} rotulo={rotulo} obrigatorio erro={erros[campo]}>{p => longo
    ? <textarea {...p} required maxLength={limite} value={valor} onChange={e => mudar(e.target.value)} className={classeInput} rows={3} />
    : <input {...p} required maxLength={limite} value={valor} onChange={e => mudar(e.target.value)} className={classeInput} />}</CampoFormulario>;

  return <Modal titulo={titulo} eyebrow={`Animal ${animal.brinco}${animal.nome ? ` — ${animal.nome}` : ""}`} onClose={() => { if (!salvando) onFechar(); }} width="max-w-3xl">
    <div className="space-y-5 p-6">
      <ErrorBox erro={erro} />
      <p className="rounded-lg bg-surface-2 p-4 text-sm text-ink-2">{revisando ? "A revisão esclarece o tipo da saída já registrada. A data e a identidade da baixa serão preservadas." : "A saída está comprovada. A origem não informa se houve venda, abate ou outra forma de baixa."}</p>
      {baixa && <section aria-label="Registro original" className="space-y-2 border-b border-border pb-4 text-sm"><h3 className="font-semibold">Registro original</h3><p>{formatarDataBR(baixa.data)} — {rotuloTipoBaixa(baixa.tipo)}</p>{baixa.regularizacaoHistorica && <><p>{baixa.regularizacaoHistorica.bancoOrigem} — {baixa.regularizacaoHistorica.chaveOrigem}</p><p className="break-words">{baixa.regularizacaoHistorica.evidencia}</p><p className="break-words">{baixa.regularizacaoHistorica.motivo}</p></>}</section>}
      {conferindo ? <section aria-label="Conferência da baixa" className="space-y-4 text-sm">
        <h3 tabIndex={-1} ref={elemento => elemento?.focus()} className="font-semibold">Confira antes de confirmar</h3>
        <dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-ink-3">Data da saída</dt><dd>{formatarDataBR(data)}</dd></div><div><dt className="text-ink-3">Tipo da baixa</dt><dd>{rotuloTipoBaixa(revisando ? tipo : "NAO_DETERMINADO")}</dd></div>{!revisando && <div className="sm:col-span-2"><dt className="text-ink-3">Origem</dt><dd className="break-words">{bancoOrigem} — {chaveOrigem}</dd></div>}<div className="sm:col-span-2"><dt className="text-ink-3">Evidência</dt><dd className="whitespace-pre-wrap break-words">{evidencia}</dd></div><div className="sm:col-span-2"><dt className="text-ink-3">Justificativa</dt><dd className="whitespace-pre-wrap break-words">{motivo}</dd></div></dl>
        <h3 className="font-semibold">Efeito da confirmação</h3>
        {revisando ? <p>A classificação muda na mesma baixa, com autoria e histórico. Não gera uma segunda saída nem receita.</p> : <ul className="list-disc space-y-1 pl-5"><li>O animal deixa a população ativa na data da baixa.</li><li>A baixa conserva autoria e a evidência de origem.</li><li>Não há receita nem registro presumido de morte.</li></ul>}
      </section> : <>
        <div className="grid gap-4 sm:grid-cols-2">
          {!revisando ? <><CampoFormulario id="historica-data" rotulo="Data comprovada da saída" obrigatorio erro={erros.data}>{p => <DatePicker {...p} required max={hoje()} value={data} onChange={setData} className="mt-1.5" />}</CampoFormulario><div className="text-sm"><p className="min-h-6 font-medium">Tipo da baixa</p><p className="mt-1.5 py-2.5">Tipo não determinado na origem</p></div>{campoTexto("bancoOrigem", "Fonte de origem", bancoOrigem, setBancoOrigem, 120)}{campoTexto("chaveOrigem", "Identificador na origem", chaveOrigem, setChaveOrigem, 200)}</>
          : <><CampoFormulario id="historica-tipo" rotulo="Nova classificação" obrigatorio erro={erros.tipo}>{p => <SelectCampo {...p} value={tipo} onValueChange={v => { setTipo(v as TipoConhecido); setMotivoId(""); setCiente(false); setJustificativa(""); }} className={classeInput}>{TIPOS.map(t => <option key={t} value={t}>{rotuloTipoBaixa(t)}</option>)}</SelectCampo>}</CampoFormulario>{grupos.length > 0 && <CampoFormulario id="historica-motivoId" rotulo="Motivo do catálogo" erro={erros.motivoId}>{p => <SelectCampo {...p} value={motivoId} onValueChange={setMotivoId} className={classeInput}><option value="">Sem motivo específico</option>{grupos.map(g => <optgroup key={g.classe} label={rotuloClasseMotivo(g.classe)}>{g.motivos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</optgroup>)}</SelectCampo>}</CampoFormulario>}</>}
        </div>
        {campoTexto("evidencia", revisando ? "Evidência da classificação" : "Evidência de origem", evidencia, setEvidencia, 1000, true)}
        {campoTexto("motivo", revisando ? "Motivo da revisão" : "Justificativa da regularização", motivo, setMotivo, 500, true)}
        {requerConferencia && data && <section aria-label="Carências históricas" className="space-y-3 border-t border-border pt-4 text-sm"><h3 className="font-semibold">Carências na data da saída</h3>{erroConsulta ? <><p role="alert">{erroConsulta}</p><Button secondary onClick={() => setTentativa(t => t + 1)}>Tentar novamente</Button></> : !carencias ? <p role="status">Consultando carências…</p> : <>{(["leite", "carne"] as const).map(destino => <p key={destino}>{destino === "leite" ? "Leite" : "Abate/carne"}: {destino === "leite" && carencias.revisaoLeitePendente ? "Aplicabilidade pendente — revisar" : resumoCarencia(carencias[destino], referencia)}</p>)}{restricoes && <><ConfirmacaoCiencia id="historica-cienciaSanitaria" obrigatorio checked={ciente} onChange={setCiente} erro={erros.cienciaSanitaria}>Estou ciente das restrições sanitárias apresentadas.</ConfirmacaoCiencia>{campoTexto("justificativaSanitaria", "Justificativa diante das restrições", justificativa, setJustificativa, 500, true)}</>}</>}<p className="text-xs text-ink-3">As carências serão revalidadas na confirmação. Ciência e justificativa ficam na auditoria.</p></section>}
      </>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button secondary disabled={salvando} onClick={() => { if (conferindo) { setConferindo(false); setErro(null); } else onFechar(); }}>{conferindo ? "Voltar à edição" : "Cancelar"}</Button>
        <Button disabled={salvando} onClick={() => { if (conferindo) void confirmar(); else conferir(); }}>{salvando ? "Salvando…" : conferindo ? revisando ? "Confirmar classificação" : "Confirmar regularização" : revisando ? "Conferir classificação" : "Conferir baixa"}</Button>
      </div>
    </div>
  </Modal>;
}
