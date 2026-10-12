import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFinanceiro } from "./DialogFinanceiro";
import { brl, dataBR, Pill, StatusPill } from "./financeiro-ui";
import { tituloCompromisso } from "./lib/compromissos";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";
import type { Compromisso } from "./novo-api";

export function CompromissoDetalheDialog({ compromisso: selecionado, onClose, onLiquidar }: { compromisso: Compromisso; onClose: () => void; onLiquidar?: (compromisso: Compromisso) => void }) {
  return <DialogFinanceiro icon={CalendarDays} tom="pendente" titulo="Detalhes do compromisso" eyebrow="Agenda financeira" onClose={onClose} rodape={onLiquidar && ["PENDENTE", "PARCIAL"].includes(selecionado.status) ? <div className="flex justify-end"><Button onClick={() => { onClose(); onLiquidar(selecionado); }}>{selecionado.tipo === "PAGAR" ? "Registrar pagamento" : "Registrar recebimento"}</Button></div> : undefined}>
      <div className="space-y-5 p-5">
        <div className="fin-compromisso-resumo rounded-lg bg-muted p-4"><h3 className="h3 break-words">{tituloCompromisso(selecionado)}</h3><p className="mt-1 text-sm text-ink-3">{selecionado.parceiro?.nome ?? "Sem parceiro"}</p><div className="mt-4 flex flex-wrap items-end justify-between gap-4"><div><div className="text-sm text-ink-3">{selecionado.tipo === "PAGAR" ? "Saldo a pagar" : "Saldo a receber"}</div><strong className="fin-valor mt-1 block text-3xl tabular-nums">{brl(selecionado.saldoPendente)}</strong></div><div><div className="text-sm text-ink-3">Vencimento</div><strong className="mt-1 block tabular-nums">{dataBR(selecionado.dataVencimento)}</strong></div></div><div className="mt-3 flex flex-wrap gap-2"><StatusPill status={selecionado.status} />{selecionado.vencido && <Pill tone="red">Vencido</Pill>}</div></div>
        <dl className="grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-ink-3">Valor original</dt><dd className="mt-1 font-semibold tabular-nums">{brl(selecionado.valorOriginal)}</dd></div><div><dt className="text-ink-3">Operação</dt><dd className="mt-1"><LinkOperacaoFinanceira id={selecionado.operacao.id} numero={selecionado.operacao.numero} /></dd></div></dl>

      </div>
    </DialogFinanceiro>;
}
