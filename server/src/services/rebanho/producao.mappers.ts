export interface EventoTimelineDTO { id: string; animalId: string; data: string; dominio: "producao"; titulo: string; detalhe?: string; alerta?: boolean; marcador?: string; }
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

export function toTimelineControle(c: any): EventoTimelineDTO {
  const ordenhas = [c.peso1, c.peso2, c.peso3]
    .map((p, i) => (p != null ? `ordenha ${i + 1}: ${Number(p)} L` : null))
    .filter(Boolean)
    .join(" · ");
  return {
    id: String(c.id),
    animalId: String(c.animalId),
    data: iso(c.data),
    dominio: "producao",
    titulo: `Controle leiteiro — ${Number(c.pesoTotal)} L/dia`,
    detalhe: ordenhas || undefined,
    alerta: false,
    marcador: undefined,
  };
}
