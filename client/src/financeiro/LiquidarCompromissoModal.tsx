import { useState } from "react";
import { liquidarCompromisso, type Compromisso, type Conta } from "./novo-api";
import { brl, Button, hoje, Modal } from "./financeiro-ui";
import { tituloCompromisso } from "./lib/compromissos";
import { SelectBusca } from "../components/SelectBusca";

export function LiquidarCompromissoModal({ compromisso, contas, onClose, onLiquidado, onErro }: {
  compromisso: Compromisso;
  contas: Conta[];
  onClose: () => void;
  onLiquidado: () => void | Promise<void>;
  onErro: (mensagem: string) => void;
}) {
  const [contaId, setContaId] = useState("");
  const [valor, setValor] = useState(String(Number(compromisso.saldoPendente)));
  const [processando, setProcessando] = useState(false);
  const valorNumerico = Number(valor);
  const valorValido = valorNumerico > 0 && valorNumerico <= Number(compromisso.saldoPendente);

  const confirmar = async () => {
    if (!contaId || !valorValido || processando) return;
    setProcessando(true);
    try {
      await liquidarCompromisso(compromisso.id, {
        contaId: Number(contaId),
        valor: valorNumerico,
        data: hoje(),
        formaPagamento: "PIX",
      });
      await onLiquidado();
      onClose();
    } catch (e) {
      onErro(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessando(false);
    }
  };

  return <Modal titulo={`Registrar ${compromisso.tipo === "PAGAR" ? "pagamento" : "recebimento"}`} eyebrow="Confirmação financeira" onClose={onClose}>
    <div className="p-5">
      <div className="rounded-lg bg-surface-2 p-4">
        <strong className="break-words">{tituloCompromisso(compromisso)}</strong>
        <div className="mt-1 break-words text-sm text-ink-3">{compromisso.parceiro?.nome ?? "Sem parceiro"} · pendente {brl(compromisso.saldoPendente)}</div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Conta
          <SelectBusca aria-label="Conta" value={contaId} onValueChange={setContaId} options={contas.filter((conta) => conta.ativo).map((conta) => ({ value: String(conta.id), label: `${conta.nome} · ${brl(conta.saldoAtual)}` }))} buscaPlaceholder="Buscar conta…" vazioTexto="Nenhuma conta ativa encontrada." />
        </label>
        <label className="text-sm font-medium">Valor
          <input type="number" min="0.01" max={Number(compromisso.saldoPendente)} step="0.01" className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" value={valor} onChange={(e) => setValor(e.target.value)} />
        </label>
      </div>
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Ao confirmar, o saldo da conta será alterado e o compromisso ficará parcial ou liquidado. O registro poderá ser revertido posteriormente com histórico.</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button secondary disabled={processando} onClick={onClose}>Cancelar</Button>
        <Button disabled={!contaId || !valorValido || processando} onClick={() => { void confirmar(); }}>{processando ? "Registrando…" : "Confirmar liquidação"}</Button>
      </div>
    </div>
  </Modal>;
}
