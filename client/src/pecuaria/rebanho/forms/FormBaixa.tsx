// Modal "Dar baixa" — POST /pecuaria/rebanho/animais/:id/baixa. Ação
// irreversível (mas estornável) com caixa de impacto, no padrão do
// cancelamento de OperacaoFinanceiraDetalhe.tsx — por isso é um Modal, não
// o ModalMotivo genérico (aqui há mais campos que só o motivo).

import { useMemo, useRef, useState } from "react";
import { darBaixaAnimal, RebanhoApiError } from "../api";
import type { AnimalFicha, CatalogoMotivoBaixa, TipoBaixa } from "../types";
import { CLASSES_POR_TIPO, rotuloClasseMotivo, rotuloTipoBaixa } from "../lib/rotulos";
import { Button, ErrorBox, hoje, Modal } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";

const TIPOS_BAIXA: TipoBaixa[] = ["VENDA", "ABATE", "MORTE", "DOACAO", "EXTRAVIO"];

export function FormBaixa({ animal, motivos, onSalvo, onFechar }: {
  animal: AnimalFicha;
  motivos: CatalogoMotivoBaixa[];
  onSalvo: (atualizado: AnimalFicha) => Promise<void> | void;
  onFechar: () => void;
}) {
  const [data, setData] = useState(hoje());
  const [tipo, setTipo] = useState<TipoBaixa>("VENDA");
  const [motivoId, setMotivoId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [erroData, setErroData] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  /** grupos de motivos (um `<optgroup>` por classe aceita pelo tipo) na ordem de CLASSES_POR_TIPO;
   *  classe sem motivo cadastrado não aparece. Tipo sem classe alguma (Extravio) → sem grupos. */
  const grupos = useMemo(
    () => CLASSES_POR_TIPO[tipo]
      .map((classe) => ({ classe, motivos: motivos.filter((motivo) => motivo.classe === classe) }))
      .filter((grupo) => grupo.motivos.length > 0),
    [tipo, motivos],
  );

  const mudarTipo = (novoTipo: TipoBaixa) => { setTipo(novoTipo); setMotivoId(""); };

  const confirmar = async () => {
    if (emCurso.current) return;
    emCurso.current = true; setSalvando(true); setErroGeral(null); setErroData(null);
    try {
      const atualizado = await darBaixaAnimal(animal.id, { data, tipo, motivoId: motivoId || null, observacao: observacao.trim() || null });
      await onSalvo(atualizado);
    } catch (falha) {
      if (falha instanceof RebanhoApiError && falha.campo === "data") setErroData(falha.message);
      else setErroGeral(falha instanceof RebanhoApiError ? falha.message : falha instanceof Error ? falha.message : String(falha));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  return <Modal titulo="Dar baixa" eyebrow={`Animal ${animal.brinco}`} onClose={() => { if (!salvando) onFechar(); }} width="max-w-2xl">
    <div className="p-6">
      <ErrorBox erro={erroGeral} />
      <div className="mt-2 space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-950">
        <p>• O animal {animal.brinco} deixará de ser contado como ativo no rebanho.</p>
        <p>• A baixa pode ser estornada depois, reabrindo o animal.</p>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Data da baixa *<DatePicker required aria-label="Data da baixa" max={hoje()} value={data} onChange={setData} aria-invalid={erroData ? true : undefined} aria-describedby={erroData ? "baixa-data-erro" : undefined} className="mt-1.5" />{erroData && <p id="baixa-data-erro" role="alert" className="mt-1 text-xs font-normal text-red-700">{erroData}</p>}</label>
        <label className="text-sm font-medium">Tipo *<select required value={tipo} onChange={(e) => mudarTipo(e.target.value as TipoBaixa)} className={classeInput}>{TIPOS_BAIXA.map((t) => <option key={t} value={t}>{rotuloTipoBaixa(t)}</option>)}</select></label>
        {grupos.length > 0 && <label className="text-sm font-medium sm:col-span-2">Motivo do catálogo<select value={motivoId} onChange={(e) => setMotivoId(e.target.value)} className={classeInput}>
          <option value="">Sem motivo específico</option>
          {grupos.map((grupo) => <optgroup key={grupo.classe} label={rotuloClasseMotivo(grupo.classe)}>{grupo.motivos.map((motivo) => <option key={motivo.id} value={motivo.id}>{motivo.nome}</option>)}</optgroup>)}
        </select></label>}
        <label className="text-sm font-medium sm:col-span-2">Observação<textarea maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={classeInput} /></label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button secondary disabled={salvando} onClick={onFechar}>Manter animal ativo</Button>
        <Button danger disabled={salvando} onClick={() => { void confirmar(); }}>{salvando ? "Salvando…" : "Confirmar baixa"}</Button>
      </div>
    </div>
  </Modal>;
}
