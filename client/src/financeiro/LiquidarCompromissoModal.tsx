import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DialogFinanceiro as Modal } from "./DialogFinanceiro";
import { useRef, useState } from "react";
import { liquidarCompromisso, type Compromisso, type Conta } from "./novo-api";
import { brl, ErrorBox, hoje } from "./financeiro-ui";
import { FORMAS_PAGAMENTO } from "./lib/parceiros";
import { tituloCompromisso } from "./lib/compromissos";

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
  const emCurso = useRef(false);
  const [data, setData] = useState(hoje);
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [erro, setErro] = useState<string | null>(null);
  const fechar = () => { if (!emCurso.current) onClose(); };
  const valorNumerico = Number(valor);
  const valorValido = valorNumerico > 0 && valorNumerico <= Number(compromisso.saldoPendente);

  const confirmar = async () => {
    if (!contaId || !valorValido || !data || data > hoje() || emCurso.current) return;
    emCurso.current = true;
    setProcessando(true);
    setErro(null);
    try {
      await liquidarCompromisso(compromisso.id, {
        contaId,
        valor: valorNumerico,
        data,
        formaPagamento,
      });
      onClose();
      try {
        await onLiquidado();
      } catch (e) {
        onErro(e instanceof Error ? e.message : String(e));
      }
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      setErro(mensagem); onErro(mensagem);
    } finally {
      setProcessando(false);
      emCurso.current = false;
    }
  };

  return <Modal titulo={`Registrar ${compromisso.tipo === "PAGAR" ? "pagamento" : "recebimento"}`} eyebrow="Confirmação financeira" onClose={fechar}>
    <div className="p-5">
      <ErrorBox erro={erro} />
      <div className="rounded-lg bg-surface-2 p-4">
        <strong className="break-words">{tituloCompromisso(compromisso)}</strong>
        <div className="mt-1 break-words text-sm text-ink-3">{compromisso.parceiro?.nome ?? "Sem parceiro"} · pendente {brl(compromisso.saldoPendente)}</div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Conta
          <Select disabled={processando} value={contaId} onValueChange={setContaId}><SelectTrigger className="mt-1.5 w-full" aria-label="Conta"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent className="z-[1300]">{contas.filter(conta => conta.ativo).map(conta => <SelectItem key={conta.id} value={conta.id}>{conta.nome} · {brl(conta.saldoAtual)}</SelectItem>)}</SelectContent></Select>
        </label>
        <label className="text-sm font-medium">Valor
          <Input disabled={processando} type="number" min="0.01" max={Number(compromisso.saldoPendente)} step="0.01" className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" value={valor} onChange={(e) => setValor(e.target.value)} />
        </label>
        <label className="text-sm font-medium">Data da liquidação<Input disabled={processando} required type="date" max={hoje()} value={data} onChange={e => setData(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" /></label>
        <label className="text-sm font-medium">Forma de liquidação<Select disabled={processando} value={formaPagamento} onValueChange={setFormaPagamento}><SelectTrigger className="mt-1.5 w-full" aria-label="Forma de liquidação"><SelectValue /></SelectTrigger><SelectContent className="z-[1300]">{Object.entries(FORMAS_PAGAMENTO).map(([chave, nome]) => <SelectItem key={chave} value={chave}>{nome}</SelectItem>)}</SelectContent></Select></label>
      </div>
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Ao confirmar, o saldo da conta será alterado e o compromisso ficará parcial ou liquidado. O registro poderá ser revertido posteriormente com histórico.</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" disabled={processando} onClick={fechar}>Cancelar</Button>
        <Button disabled={!contaId || !valorValido || !data || data > hoje() || processando} onClick={() => { void confirmar(); }}>{processando ? "Registrando…" : "Confirmar liquidação"}</Button>
      </div>
    </div>
  </Modal>;
}
