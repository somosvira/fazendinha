import { Fragment } from "react";
import { ArchiveX } from "lucide-react";
import { Button, Pill } from "../../../financeiro/financeiro-ui";
import { CardFicha } from "../ui";
import { formatarDataBR, rotuloClasseMotivo, rotuloTipoBaixa } from "../lib/rotulos";
import type { AnimalFicha } from "../types";

export function HistoricoBaixas({ historicoBaixas, onRevisar }: {
  historicoBaixas: AnimalFicha["historicoBaixas"];
  onRevisar?: (baixa: AnimalFicha["historicoBaixas"][number]) => void;
}) {
  if (!historicoBaixas.length) return null;

  return <CardFicha icon={ArchiveX} titulo="Baixas" className="lg:col-span-2">
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm consulta-tabela">
        <thead className="text-xs text-ink-3"><tr>
          <th className="py-1.5 pr-3 font-semibold">Data</th>
          <th className="py-1.5 pr-3 font-semibold">Tipo</th>
          <th className="py-1.5 pr-3 font-semibold">Motivo</th>
          <th className="py-1.5 pr-3 font-semibold">Observação</th>
          <th className="py-1.5 pr-3 font-semibold">Situação</th>
          <th className="py-1.5 pr-3 font-semibold">Registrado por</th>
        </tr></thead>
        <tbody className="divide-y divide-border">
          {historicoBaixas.map((baixa) => <Fragment key={baixa.id}><tr>
            <td className="py-2 pr-3">{formatarDataBR(baixa.data)}</td>
            <td className="py-2 pr-3">{rotuloTipoBaixa(baixa.tipo)}</td>
            <td className="py-2 pr-3">{baixa.motivo ? `${baixa.motivo.nome} (${rotuloClasseMotivo(baixa.motivo.classe).toLowerCase()})` : "—"}</td>
            <td className="py-2 pr-3 break-words">{baixa.observacao ?? "—"}</td>
            <td className="py-2 pr-3">{baixa.estornadaEm
              ? <span className="break-words text-ink-3">Estornada em {formatarDataBR(baixa.estornadaEm)}{baixa.estornoMotivo ? ` — ${baixa.estornoMotivo}` : ""}</span>
              : <Pill tone="green">Valendo</Pill>}</td>
            <td className="py-2 pr-3">{baixa.criadoPor ?? "Sistema"}</td>
          </tr>
          {baixa.regularizacaoHistorica && <tr><td colSpan={6} className="pb-4 pt-2">
            <section aria-label={`Proveniência da baixa de ${formatarDataBR(baixa.data)}`} className="space-y-3 rounded-lg bg-surface-2 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Regularização histórica</h3><p className="mt-1 break-words text-ink-2">{baixa.regularizacaoHistorica.bancoOrigem} — {baixa.regularizacaoHistorica.chaveOrigem}</p></div>{onRevisar && baixa.tipo === "NAO_DETERMINADO" && !baixa.estornadaEm && !baixa.regularizacaoHistorica.revisao && <Button secondary onClick={() => onRevisar(baixa)}>Revisar classificação</Button>}</div>
              <dl className="space-y-2"><div><dt className="text-ink-3">Evidência de origem</dt><dd className="whitespace-pre-wrap break-words">{baixa.regularizacaoHistorica.evidencia}</dd></div><div><dt className="text-ink-3">Justificativa da regularização</dt><dd className="whitespace-pre-wrap break-words">{baixa.regularizacaoHistorica.motivo}</dd></div></dl>
              <p className="text-xs text-ink-3">Registrada por {baixa.criadoPor ?? `Usuário ${baixa.regularizacaoHistorica.usuarioId}`} em {formatarDataBR(baixa.regularizacaoHistorica.registradaEm)}</p>
              {baixa.regularizacaoHistorica.revisao && <div className="space-y-2 border-t border-border pt-3"><h4 className="font-semibold">Classificação revisada: {rotuloTipoBaixa(baixa.regularizacaoHistorica.revisao.dados.tipo)}</h4><p className="whitespace-pre-wrap break-words">{baixa.regularizacaoHistorica.revisao.dados.evidencia}</p><p className="whitespace-pre-wrap break-words">{baixa.regularizacaoHistorica.revisao.dados.motivo}</p><p className="text-xs text-ink-3">Usuário {baixa.regularizacaoHistorica.revisao.usuarioId} em {formatarDataBR(baixa.regularizacaoHistorica.revisao.registradaEm)}</p></div>}
            </section>
          </td></tr>}
          </Fragment>)}
        </tbody>
      </table>
    </div>
  </CardFicha>;
}
