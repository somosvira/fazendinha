// Seção "Baixas" da ficha do animal: histórico completo (inclusive as estornadas), não só a
// baixa em vigor. As ações de Dar baixa/Estornar continuam no cabeçalho da ficha
// (DetalheAnimal.tsx) — este componente só mostra a lista.

import { ArchiveX } from "lucide-react";
import { Pill } from "../../../financeiro/financeiro-ui";
import { CardFicha } from "../ui";
import { formatarDataBR, rotuloClasseMotivo, rotuloTipoBaixa } from "../lib/rotulos";
import type { AnimalFicha } from "../types";

export function HistoricoBaixas({ historicoBaixas }: { historicoBaixas: AnimalFicha["historicoBaixas"] }) {
  if (!historicoBaixas.length) return null;

  return <CardFicha icon={ArchiveX} titulo="Baixas" className="lg:col-span-2">
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-ink-3"><tr>
          <th className="py-1.5 pr-3 font-semibold">Data</th>
          <th className="py-1.5 pr-3 font-semibold">Tipo</th>
          <th className="py-1.5 pr-3 font-semibold">Motivo</th>
          <th className="py-1.5 pr-3 font-semibold">Observação</th>
          <th className="py-1.5 pr-3 font-semibold">Situação</th>
          <th className="py-1.5 pr-3 font-semibold">Registrado por</th>
        </tr></thead>
        <tbody className="divide-y divide-border">
          {historicoBaixas.map((baixa) => <tr key={baixa.id}>
            <td className="py-2 pr-3">{formatarDataBR(baixa.data)}</td>
            <td className="py-2 pr-3">{rotuloTipoBaixa(baixa.tipo)}</td>
            <td className="py-2 pr-3">{baixa.motivo ? `${baixa.motivo.nome} (${rotuloClasseMotivo(baixa.motivo.classe).toLowerCase()})` : "—"}</td>
            <td className="py-2 pr-3 break-words">{baixa.observacao ?? "—"}</td>
            <td className="py-2 pr-3">{baixa.estornadaEm
              ? <span className="break-words text-ink-3">Estornada em {formatarDataBR(baixa.estornadaEm)}{baixa.estornoMotivo ? ` — ${baixa.estornoMotivo}` : ""}</span>
              : <Pill tone="green">Valendo</Pill>}</td>
            <td className="py-2 pr-3">{baixa.criadoPor ?? "Sistema"}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </CardFicha>;
}
