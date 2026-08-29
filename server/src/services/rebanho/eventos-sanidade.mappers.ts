import { tituloEventoSanitario, detalheEventoSanitario, alertaEventoSanitario } from "@rionovo/shared";

export interface EventoTimelineDTO { id: string; animalId: string; data: string; dominio: "sanidade"; titulo: string; detalhe?: string; alerta?: boolean; editavel: true; dadosEdicao: Record<string, unknown>; }
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);
export function toTimeline(e: any): EventoTimelineDTO {
  const gordura = e.gordura != null ? Number(e.gordura) : undefined;
  const proteina = e.proteina != null ? Number(e.proteina) : undefined;
  return {
    id: String(e.id), animalId: String(e.animalId), data: iso(e.data), dominio: "sanidade" as const,
    editavel: true as const,
    titulo: tituloEventoSanitario(e),
    detalhe: detalheEventoSanitario({ ...e, gordura, proteina }),
    alerta: alertaEventoSanitario(e),
    dadosEdicao: {
      tipo: e.tipo, data: iso(e.data), observacao: e.observacao ?? "", doenca: e.doenca ?? "",
      dtFim: e.dtFim ? iso(e.dtFim) : "", diasTratamento: e.diasTratamento ?? "",
      produto: e.produto ?? "", dose: e.dose ?? "", carencia: e.carencia ?? "",
      loteProduto: e.loteProduto ?? "", produtoId: e.produtoId ?? "",
      quantidadeUsada: e.quantidadeUsada != null ? Number(e.quantidadeUsada) : "",
      ccs: e.ccs ?? "", gordura: gordura ?? "",
      proteina: proteina ?? "", quarto: e.quarto ?? "",
      severidade: e.severidade ?? "", resultadoCultivo: e.resultadoCultivo ?? "",
    },
  };
}
