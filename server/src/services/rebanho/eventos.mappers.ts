import { ACHADOS_ALERTA } from "./eventos.schemas.js";

export interface EventoTimelineDTO { id: string; animalId: string; data: string; dominio: "reproducao"; titulo: string; detalhe?: string; alerta?: boolean; marcador?: string; }
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

export function toTimeline(e: any): EventoTimelineDTO {
  const base = { id: String(e.id), animalId: String(e.animalId), data: iso(e.data), dominio: "reproducao" as const };
  switch (e.tipo) {
    case "CIO":
      return { ...base, titulo: "Cio detectado", detalhe: e.observacao ?? undefined };
    case "INSEMINACAO":
      return { ...base, titulo: "Inseminação artificial", detalhe: [e.reprodutor && `reprodutor ${e.reprodutor}`, e.protocolo].filter(Boolean).join(" · ") || undefined };
    case "TRANSFERENCIA_EMBRIAO":
      return { ...base, titulo: "Transferência de embrião", detalhe: [e.doadoraId != null && `doadora #${e.doadoraId}`, e.reprodutor && `sêmen ${e.reprodutor}`, e.protocolo].filter(Boolean).join(" · ") || undefined, marcador: "receptora" };
    case "DIAGNOSTICO":
      return { ...base, titulo: `Diagnóstico de gestação — ${String(e.resultado).toUpperCase()}`, detalhe: e.dtPartoPrevista ? `parto previsto ${iso(e.dtPartoPrevista)}` : undefined, alerta: e.resultado === "negativo" };
    case "PARTO":
      return { ...base, titulo: `Parto — ${e.numCrias ?? 1} cria(s)${e.sexoCria ? ` ${e.sexoCria}` : ""}`, detalhe: e.tipoParto ?? undefined, marcador: "início da lactação" };
    case "SECAGEM":
      return { ...base, titulo: "Secagem", detalhe: e.motivoSecagem ?? undefined };
    case "EXAME_GINECOLOGICO": {
      const achado = e.resultado ? String(e.resultado).replace(/_/g, " ").toLowerCase() : "sem achado";
      return { ...base, titulo: `Exame ginecológico — ${achado}`, detalhe: [e.protocolo, e.observacao].filter(Boolean).join(" · ") || undefined, alerta: ACHADOS_ALERTA.has(String(e.resultado)) };
    }
    default:
      return { ...base, titulo: "Evento" };
  }
}
