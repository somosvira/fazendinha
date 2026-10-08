import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFinanceiro } from "./DialogFinanceiro";
import { brl, dataBR, STATUS } from "./financeiro-ui";
import { tituloCompromisso } from "./lib/compromissos";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";
import type { Compromisso } from "./novo-api";

export function CompromissoDetalheDialog({ compromisso: selecionado, onClose, onLiquidar }: { compromisso: Compromisso; onClose: () => void; onLiquidar?: (compromisso: Compromisso) => void }) {
  return <DialogFinanceiro tom="pendente" titulo="Detalhes do compromisso" eyebrow="Agenda financeira" onClose={onClose}>
      <div className="space-y-5 p-5">
        <div><h3 className="break-words font-serif text-xl">{tituloCompromisso(selecionado)}</h3><p className="mt-2 text-sm text-ink-3">{selecionado.parceiro?.nome ?? "Sem parceiro"}</p></div>
        <div className="flex flex-wrap gap-2"><Badge variant="outline">{STATUS[selecionado.status] ?? selecionado.status}</Badge>{selecionado.vencido && <Badge variant="outline" className="border-destructive/20 text-destructive">Vencido</Badge>}</div>
        <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-ink-3">Vencimento</dt><dd className="mt-1 font-semibold">{dataBR(selecionado.dataVencimento)}</dd></div><div><dt className="text-ink-3">{selecionado.tipo === "PAGAR" ? "A pagar" : "A receber"}</dt><dd className="mt-1 font-semibold">{brl(selecionado.saldoPendente)}</dd></div><div><dt className="text-ink-3">Valor original</dt><dd className="mt-1">{brl(selecionado.valorOriginal)}</dd></div><div><dt className="text-ink-3">Operação</dt><dd className="mt-1"><LinkOperacaoFinanceira id={selecionado.operacao.id} numero={selecionado.operacao.numero} /></dd></div></dl>
        {onLiquidar && ["PENDENTE", "PARCIAL"].includes(selecionado.status) && <div className="flex justify-end"><Button onClick={() => { onClose(); onLiquidar(selecionado); }}>{selecionado.tipo === "PAGAR" ? "Registrar pagamento" : "Registrar recebimento"}</Button></div>}
      </div>
    </DialogFinanceiro>;
}
