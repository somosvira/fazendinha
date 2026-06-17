export interface EventoTimelineDTO { id: string; animalId: string; data: string; dominio: "sanidade"; titulo: string; detalhe?: string; alerta?: boolean; }
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);
export function toTimeline(e: any): EventoTimelineDTO {
  const base = { id: String(e.id), animalId: String(e.animalId), data: iso(e.data), dominio: "sanidade" as const };
  switch (e.tipo) {
    case "OCORRENCIA": return { ...base, titulo: `Ocorrência — ${e.doenca}`, detalhe: e.diasTratamento ? `${e.diasTratamento} dias de tratamento` : undefined, alerta: true };
    case "APLICACAO": return { ...base, titulo: `Aplicação — ${e.produto}`, detalhe: [e.dose && `dose ${e.dose}`, e.carencia != null && `carência ${e.carencia}h`, e.loteProduto && `lote ${e.loteProduto}`].filter(Boolean).join(" · ") || undefined };
    case "EXAME": return { ...base, titulo: `Controle leiteiro — CCS ${e.ccs} mil`, detalhe: [e.gordura != null && `gordura ${Number(e.gordura)}%`, e.proteina != null && `proteína ${Number(e.proteina)}%`].filter(Boolean).join(" · ") || undefined, alerta: e.ccs >= 400 };
    case "MASTITE": return { ...base, titulo: `Mastite${e.quarto ? ` — quarto ${e.quarto}` : ""}`, detalhe: [e.severidade, e.resultadoCultivo].filter(Boolean).join(" · ") || undefined, alerta: true };
    case "VACINA": return { ...base, titulo: `Vacinação — ${e.produto}`, detalhe: e.observacao ?? undefined };
    default: return { ...base, titulo: "Evento sanitário" };
  }
}
