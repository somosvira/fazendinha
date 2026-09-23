// Modal "Dar saída" — POST /pecuaria/rebanho/animais/:id/saida. Ação
// irreversível (mas estornável) com caixa de impacto, no padrão do
// cancelamento de OperacaoFinanceiraDetalhe.tsx — por isso é um Modal, não
// o ModalMotivo genérico (aqui há mais campos que só o motivo).

import { useRef, useState } from "react";
import { darSaidaAnimal, RebanhoApiError } from "../api";
import type { AnimalFicha, CatalogoMotivoSaida, TipoSaida } from "../types";
import { rotuloTipoSaida } from "../lib/rotulos";
import { Button, ErrorBox, hoje, Modal } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";

const TIPOS_SAIDA: TipoSaida[] = ["VENDA", "ABATE", "MORTE", "DOACAO", "OUTRO"];

export function FormSaida({ animal, motivos, onSalvo, onFechar }: {
  animal: AnimalFicha;
  motivos: CatalogoMotivoSaida[];
  onSalvo: (atualizado: AnimalFicha) => Promise<void> | void;
  onFechar: () => void;
}) {
  const [data, setData] = useState(hoje());
  const [tipo, setTipo] = useState<TipoSaida>("VENDA");
  const [motivoId, setMotivoId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  const motivosDoTipo = motivos.filter((motivo) => motivo.tipo === tipo);

  const confirmar = async () => {
    if (emCurso.current) return;
    emCurso.current = true; setSalvando(true); setErroGeral(null);
    try {
      const atualizado = await darSaidaAnimal(animal.id, { data, tipo, motivoId: motivoId || null, observacao: observacao.trim() || null });
      await onSalvo(atualizado);
    } catch (falha) {
      setErroGeral(falha instanceof RebanhoApiError ? falha.message : falha instanceof Error ? falha.message : String(falha));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  return <Modal titulo="Dar saída" eyebrow={`Animal ${animal.brinco}`} onClose={() => { if (!salvando) onFechar(); }} width="max-w-2xl">
    <div className="p-6">
      <ErrorBox erro={erroGeral} />
      <div className="mt-2 space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-950">
        <p>• O animal {animal.brinco} deixará de ser contado como ativo no rebanho.</p>
        <p>• A saída pode ser estornada depois, reabrindo o animal.</p>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Data da saída *<input required type="date" max={hoje()} value={data} onChange={(e) => setData(e.target.value)} className={classeInput} /></label>
        <label className="text-sm font-medium">Tipo *<select required value={tipo} onChange={(e) => { setTipo(e.target.value as TipoSaida); setMotivoId(""); }} className={classeInput}>{TIPOS_SAIDA.map((t) => <option key={t} value={t}>{rotuloTipoSaida(t)}</option>)}</select></label>
        <label className="text-sm font-medium sm:col-span-2">Motivo do catálogo<select value={motivoId} onChange={(e) => setMotivoId(e.target.value)} className={classeInput}><option value="">Sem motivo específico</option>{motivosDoTipo.map((motivo) => <option key={motivo.id} value={motivo.id}>{motivo.nome}</option>)}</select></label>
        <label className="text-sm font-medium sm:col-span-2">Observação<textarea maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={classeInput} /></label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button secondary disabled={salvando} onClick={onFechar}>Manter animal ativo</Button>
        <Button danger disabled={salvando} onClick={() => { void confirmar(); }}>{salvando ? "Salvando…" : "Confirmar saída"}</Button>
      </div>
    </div>
  </Modal>;
}
