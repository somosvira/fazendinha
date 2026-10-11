import { ArrowDownLeft, ArrowUpRight, Info, LoaderCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DialogFinanceiro as Modal } from "./DialogFinanceiro";
import { useRef, useState } from "react";
import { NotaFiscalAnexo } from "./NotaFiscalAnexo";
import { anexarDocumentoOperacao, liquidarCompromisso, type Compromisso, type Conta } from "./novo-api";
import { brl, dataBR, ErrorBox, hoje } from "./financeiro-ui";
import { FORMAS_PAGAMENTO } from "./lib/parceiros";
import { tituloCompromisso } from "./lib/compromissos";

export function LiquidarCompromissoModal({ compromisso, contas, onClose, onLiquidado, onErro }: {
  compromisso: Compromisso;
  contas: Conta[];
  onClose: () => void;
  onLiquidado: () => void | Promise<void>;
  onErro: (mensagem: string) => void;
}) {
  const [nota, setNota] = useState<File | null>(null);
  const [notaSalva, setNotaSalva] = useState(false);
  const [enviandoNota, setEnviandoNota] = useState(false);
  const notaEnviada = useRef(false);
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
      if (compromisso.tipo === "PAGAR" && nota && !notaEnviada.current) {
        setEnviandoNota(true);
        await anexarDocumentoOperacao(compromisso.operacao.id, { arquivo: nota, tipo: "NOTA_FISCAL" });
        notaEnviada.current = true;
        setNotaSalva(true);
        setEnviandoNota(false);
      }
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
      setEnviandoNota(false);
      setProcessando(false);
      emCurso.current = false;
    }
  };

  return <Modal icon={compromisso.tipo === "PAGAR" ? ArrowUpRight : ArrowDownLeft} tom={compromisso.tipo === "PAGAR" ? "saida" : "entrada"} titulo={`Registrar ${compromisso.tipo === "PAGAR" ? "pagamento" : "recebimento"}`} eyebrow="Confirmação financeira" onClose={fechar} rodape={<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" disabled={processando} onClick={fechar}>Cancelar</Button>
        <Button disabled={!contaId || !valorValido || !data || data > hoje() || processando} aria-busy={processando || undefined} onClick={() => { void confirmar(); }}>{processando && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}{processando ? (enviandoNota ? "Enviando nota…" : "Registrando…") : "Confirmar liquidação"}</Button>
      </div>}>
    <div className="p-5">
      <ErrorBox erro={erro} />
      <div className="fin-compromisso-resumo rounded-lg bg-muted p-4">
        <strong className="break-words">{tituloCompromisso(compromisso)}</strong>
        <div className="mt-1 break-words text-sm text-ink-3">{compromisso.parceiro?.nome ?? "Sem parceiro"}</div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4"><div><div className="text-sm text-ink-3">{compromisso.tipo === "PAGAR" ? "Saldo a pagar" : "Saldo a receber"}</div><strong className="fin-valor mt-1 block text-3xl tabular-nums">{brl(compromisso.saldoPendente)}</strong></div><div><div className="text-sm text-ink-3">Vencimento</div><strong className="mt-1 block tabular-nums">{dataBR(compromisso.dataVencimento)}</strong></div></div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm font-medium">Conta
          <Select disabled={processando} value={contaId} onValueChange={setContaId}><SelectTrigger className="mt-1.5 w-full" aria-label="Conta"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent className="z-[1300]">{contas.filter(conta => conta.ativo).map(conta => <SelectItem key={conta.id} value={conta.id}>{conta.nome} · {brl(conta.saldoAtual)}</SelectItem>)}</SelectContent></Select>
        </label>
        <label className="text-sm font-medium">Valor
          <Input disabled={processando} type="number" min="0.01" max={Number(compromisso.saldoPendente)} step="0.01" className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" value={valor} onChange={(e) => setValor(e.target.value)} />
        </label>
        <label className="text-sm font-medium">Data da liquidação<Input disabled={processando} required type="date" max={hoje()} value={data} onChange={e => setData(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" /></label>
        <label className="sm:col-span-2 text-sm font-medium">Forma de liquidação<Select disabled={processando} value={formaPagamento} onValueChange={setFormaPagamento}><SelectTrigger className="mt-1.5 w-full" aria-label="Forma de liquidação"><SelectValue /></SelectTrigger><SelectContent className="z-[1300]">{Object.entries(FORMAS_PAGAMENTO).map(([chave, nome]) => <SelectItem key={chave} value={chave}>{nome}</SelectItem>)}</SelectContent></Select></label>
      </div>
      {compromisso.tipo === "PAGAR" && <NotaFiscalAnexo arquivo={nota} salvo={notaSalva} disabled={processando} onArquivo={setNota} />}
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-[var(--fin-pendente)]/25 bg-[var(--fin-warning-bg)] p-4 text-xs leading-5 text-[var(--fin-pendente)]"><Info aria-hidden="true" size={18} strokeWidth={1.8} className="mt-0.5 shrink-0" /><p>Ao confirmar, o saldo da conta será alterado e o compromisso ficará parcial ou liquidado. O registro poderá ser revertido posteriormente com histórico.</p></div>

    </div>
  </Modal>;
}
