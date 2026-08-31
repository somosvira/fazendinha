import { tituloControleLeiteiro, detalheControleLeiteiro } from "@rionovo/shared";

export interface EventoTimelineDTO { id: string; animalId: string; data: string; dominio: "producao" | "nutricao"; titulo: string; detalhe?: string; alerta?: boolean; marcador?: string; }
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

// Pesagem → timeline (domínio nutrição: peso/crescimento). Mostra GMD quando há.
export function toTimelinePesagem(p: any): EventoTimelineDTO {
  return {
    id: `pesagem-${p.id}`,
    animalId: String(p.animalId),
    data: iso(p.data),
    dominio: "nutricao",
    titulo: `Pesagem — ${Number(p.peso)} kg`,
    detalhe: p.gmd != null ? `GMD ${Number(p.gmd)} kg/dia` : undefined,
    alerta: false,
    marcador: undefined,
  };
}

export function toTimelineControle(c: any): EventoTimelineDTO {
  const peso1 = c.peso1 != null ? Number(c.peso1) : undefined;
  const peso2 = c.peso2 != null ? Number(c.peso2) : undefined;
  const peso3 = c.peso3 != null ? Number(c.peso3) : undefined;
  return {
    id: String(c.id),
    animalId: String(c.animalId),
    data: iso(c.data),
    dominio: "producao",
    titulo: tituloControleLeiteiro(Number(c.pesoTotal)),
    detalhe: detalheControleLeiteiro({ peso1, peso2, peso3 }),
    alerta: false,
    marcador: undefined,
  };
}

const ordinal = (n: number) => `${n}ª`;

// Início de lactação → timeline (domínio produção).
export function toTimelineLactacaoInicio(l: any): EventoTimelineDTO {
  return {
    id: `lactacao-inicio-${l.id}`,
    animalId: String(l.animalId),
    data: iso(l.dtInicio),
    dominio: "producao",
    titulo: `Início da ${ordinal(l.numero)} lactação`,
    detalhe: l.induzida ? "induzida" : undefined,
    alerta: false,
    marcador: undefined,
  };
}

// Secagem → timeline; null quando a lactação ainda está aberta.
export function toTimelineLactacaoSecagem(l: any): EventoTimelineDTO | null {
  if (l.dtFim == null) return null;
  return {
    id: `lactacao-secagem-${l.id}`,
    animalId: String(l.animalId),
    data: iso(l.dtFim),
    dominio: "producao",
    titulo: "Secagem",
    detalhe: l.motivoSecagem ?? undefined,
    alerta: false,
    marcador: undefined,
  };
}
