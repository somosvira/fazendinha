import { useEffect, useRef, useState } from "react";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { DatePicker } from "../../../components/DatePicker";
import { RebanhoApiError } from "../api";
import { formatarDataBR } from "../lib/rotulos";
import { reqV4, type LactacaoReprodutiva } from "./api";
import { PesoSecagemCampos } from "./PesoSecagemCampos";
import { dadosPesoSecagemVazios, pesoSecagemPayload, validarPesoSecagem } from "./peso-secagem";

export function FormEncerrarLactacao({ lactacao, animalRotulo, propriedadeId, onFechar, onSalvo }: { lactacao: LactacaoReprodutiva; animalRotulo: string; propriedadeId?: number; onFechar: () => void; onSalvo: () => void | Promise<void> }) {
  const [data, setData] = useState(hoje()), [motivo, setMotivo] = useState("");
  const [peso, setPeso] = useState(dadosPesoSecagemVazios), [erros, setErros] = useState<Record<string, string>>({}), [erro, setErro] = useState<string | null>(null), [ocupado, setOcupado] = useState(false);
  const emCurso = useRef(false), envio = useRef<{ payload: string; chave: string } | null>(null);
  useEffect(() => { const campo = Object.keys(erros)[0]; document.getElementById(campo === "dataEncerramento" ? "secagem-encerramento" : campo === "motivo" ? "secagem-motivo" : `peso-secagem-${campo}`)?.focus(); }, [erros]);
  async function salvar() {
    if (emCurso.current) return;
    const falhas = validarPesoSecagem(peso, data, propriedadeId);
    if (!data || data < lactacao.inicio.slice(0, 10) || data > hoje()) falhas.dataEncerramento = "Informe uma data válida entre o início da lactação e hoje.";
    if (motivo.trim().length < 5) falhas.motivo = "Informe um motivo com ao menos cinco caracteres.";
    setErros(falhas); setErro(null); if (Object.keys(falhas).length) return;
    if (!propriedadeId) { setErro("Selecione o sítio do encerramento."); return; }
    const corpo = { propriedadeId, data, motivo: motivo.trim(), pesoSecagem: pesoSecagemPayload(peso) };
    const payload = JSON.stringify(corpo); if (envio.current?.payload !== payload) envio.current = { payload, chave: crypto.randomUUID() };
    emCurso.current = true; setOcupado(true);
    try { await reqV4(`/reproducao/lactacoes/${lactacao.id}/encerramento`, { ...corpo, chave: envio.current.chave }, "POST", propriedadeId); await onSalvo(); }
    catch (e) { const mensagem = e instanceof Error ? e.message : String(e); if (e instanceof RebanhoApiError && e.campo) { const campo = e.campo.replace(/^pesoSecagem(?:\.|$)/, ""); const destino = campo === "data" && !e.campo.startsWith("pesoSecagem") ? "dataEncerramento" : campo; if (["dataEncerramento", "motivo", "acao", ...(peso.acao === "REGISTRAR" ? ["data", "pesoKg", "origem", "precisao", "observacao"] : peso.acao === "VINCULAR" ? ["pesagemId"] : [])].includes(destino)) setErros({ [destino]: mensagem }); else setErro(mensagem); } else setErro(mensagem); }
    finally { emCurso.current = false; setOcupado(false); }
  }
  return <PainelCadastro aberto titulo="Encerrar lactação" onFechar={onFechar} bloqueado={ocupado} rodape={<><Button secondary onClick={onFechar} disabled={ocupado}>Cancelar</Button><Button type="submit" form="form-encerrar-lactacao" disabled={ocupado}>{ocupado ? "Salvando…" : "Encerrar lactação"}</Button></>}>
    <form id="form-encerrar-lactacao" noValidate onSubmit={e => { e.preventDefault(); void salvar(); }} className="grid gap-5">
      <ErrorBox erro={erro} /><p className="text-sm">{animalRotulo} · Lactação iniciada em {formatarDataBR(lactacao.inicio)}</p>
      <div className="grid gap-4 sm:grid-cols-2"><CampoFormulario id="secagem-encerramento" rotulo="Data de encerramento" obrigatorio erro={erros.dataEncerramento}>{p => <DatePicker {...p} required min={lactacao.inicio.slice(0, 10)} max={hoje()} value={data} onChange={setData} className="mt-1.5" />}</CampoFormulario><CampoFormulario id="secagem-motivo" rotulo="Motivo do encerramento" obrigatorio erro={erros.motivo}>{p => <textarea {...p} required minLength={5} maxLength={1000} className={classeInput} value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} />}</CampoFormulario></div>
      <div className="border-t border-border pt-4"><h3 className="mb-3 text-sm font-semibold">Peso da matriz <span className="font-normal text-ink-3">· Opcional</span></h3><PesoSecagemCampos animalId={lactacao.animalId} propriedadeId={propriedadeId} dataEncerramento={data} valor={peso} onChange={setPeso} erros={erros} /></div>
      <p className="text-sm text-ink-3">Encerrar lactação é uma ação manual. O encerramento e o eventual peso/vínculo serão confirmados juntos. Registrar uma pesagem isolada não encerra a lactação.</p>
    </form>
  </PainelCadastro>;
}
