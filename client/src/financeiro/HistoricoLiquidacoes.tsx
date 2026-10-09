import { Button as ShadcnButton } from "@/components/ui/button";
import { useRef, useState } from "react";
import { estornarTransacao, type Compromisso } from "./novo-api";
import { DialogFinanceiro as Modal } from "./DialogFinanceiro";
import { Textarea } from "@/components/ui/textarea";
import { brl, Button, dataBR, ErrorBox, StatusPill } from "./financeiro-ui";
import { navegarPara } from "../router";

/** Nome de conta clicável que abre o extrato já posicionado no movimento correspondente. */
export function LinkConta({ contaId, movimentoId, nome }: { contaId: string; movimentoId: string; nome: string }) {
  const href = `/financeiro/contas/${contaId}#movimento-${movimentoId}`;
  return <ShadcnButton asChild variant="link" className="h-auto whitespace-normal p-0 font-semibold text-green-800 underline underline-offset-4"><a href={href} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navegarPara(href); } }}>{nome}</a></ShadcnButton>;
}

/**
 * Detalhe de uma parcela: valor/pago/restante e o histórico de liquidações
 * (com link de conta/movimento e estorno). Usado no modal de "Detalhe da
 * parcela" em Operações — reutilizável por Compromissos (#274) sem duplicar.
 */
export function HistoricoLiquidacoes({ compromisso, podeLancar, onEstornado }: { compromisso: Compromisso; podeLancar: boolean; onEstornado: () => Promise<void> }) {
  const [estornando, setEstornando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const processandoRef = useRef(false);
  const confirmar = async () => {
    if (!estornando || motivo.trim().length < 5 || processandoRef.current) return;
    processandoRef.current = true; setProcessando(true);
    try { setErro(null); await estornarTransacao(estornando, motivo.trim()); setEstornando(null); setMotivo(""); await onEstornado(); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { processandoRef.current = false; setProcessando(false); }
  };
  return <><div className="grid gap-3 rounded-lg bg-surface-2 p-4 text-sm sm:grid-cols-3"><div><span className="block text-xs text-ink-3">Valor da parcela</span><strong>{brl(compromisso.valorOriginal)}</strong></div><div><span className="block text-xs text-ink-3">Pago</span><strong>{brl(compromisso.valorLiquidado)}</strong></div><div><span className="block text-xs text-ink-3">{compromisso.status === "CANCELADO" ? "Cancelado" : "Restante"}</span><strong>{brl(compromisso.saldoExigivel)}</strong>{compromisso.status === "CANCELADO" && <span className="mt-1 block text-xs text-ink-3">Sem valor a pagar ou receber.</span>}</div></div>
    <div className="mt-4 space-y-3">{compromisso.liquidacoes?.length ? compromisso.liquidacoes.map((liquidacao) => <div key={liquidacao.id} className="rounded-lg border border-border p-4 text-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{brl(liquidacao.valor)}</strong><span className="ml-2 text-ink-3">{dataBR(liquidacao.transacao.data)} · {liquidacao.transacao.formaPagamento?.replaceAll("_", " ") ?? "Sem forma informada"}</span></div><StatusPill status={liquidacao.transacao.status} /></div><div className="mt-3 space-y-1 text-ink-2">{liquidacao.transacao.movimentos.map((movimento) => <div key={movimento.id}>{movimento.direcao === "ENTRADA" ? "Entrada" : "Saída"} em {movimento.conta.nome} · {brl(movimento.valor)}</div>)}</div><div className="mt-4 flex flex-wrap gap-2">{liquidacao.transacao.movimentos[0] && <Button secondary onClick={() => navegarPara(`/financeiro/contas/${liquidacao.transacao.movimentos[0].contaId}#movimento-${liquidacao.transacao.movimentos[0].id}`)}>Ver movimentação</Button>}{liquidacao.transacao.status === "CONFIRMADA" && podeLancar && <Button danger onClick={() => setEstornando(liquidacao.transacao.id)}>Estornar {compromisso.tipo === "PAGAR" ? "pagamento" : "recebimento"}</Button>}</div></div>) : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-ink-3">Esta parcela ainda não tem pagamento ou recebimento registrado.</p>}</div>
    {estornando && <Modal titulo="Estornar liquidação" eyebrow="Ação reversível" onClose={() => { if (!processando) setEstornando(null); }} className="sm:max-w-lg"><div className="p-6"><p className="text-sm text-ink-3">O estorno cria o movimento inverso na conta e preserva o histórico da liquidação.</p><ErrorBox erro={erro} /><label className="mt-4 block text-sm font-medium">Motivo do estorno *<Textarea aria-label="Motivo do estorno" disabled={processando} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1.5 min-h-24 w-full rounded-lg border border-border bg-white p-3 font-normal" /></label><div className="mt-5 flex justify-end gap-2"><Button secondary disabled={processando} onClick={() => setEstornando(null)}>Cancelar</Button><Button danger disabled={processando || motivo.trim().length < 5} onClick={() => { void confirmar(); }}>{processando ? "Estornando…" : "Confirmar estorno"}</Button></div></div></Modal>}
  </>;
}
