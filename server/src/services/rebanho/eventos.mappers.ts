import { ACHADOS_ALERTA } from "./eventos.schemas.js";
import { ehAborto, labelAuxilioParto, labelTipoParto } from "./parto.dict.js";

export interface EventoTimelineDTO { id: string; animalId: string; data: string; dominio: "reproducao"; titulo: string; detalhe?: string; alerta?: boolean; marcador?: string; }
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

export function toTimeline(e: any): EventoTimelineDTO {
  const base = { id: String(e.id), animalId: String(e.animalId), data: iso(e.data), dominio: "reproducao" as const };
  switch (e.tipo) {
    case "CIO":
      return { ...base, titulo: "Cio detectado", detalhe: e.observacao ?? undefined };
    case "INSEMINACAO":
      return { ...base, titulo: "Inseminação artificial", detalhe: [e.reprodutor && `reprodutor ${e.reprodutor}`, e.protocolo].filter(Boolean).join(" · ") || undefined };
    case "COBERTURA":
      return { ...base, titulo: "Cobertura (monta natural)", detalhe: [e.reprodutor && `touro ${e.reprodutor}`].filter(Boolean).join(" · ") || undefined };
    case "TRANSFERENCIA_EMBRIAO":
      return { ...base, titulo: "Transferência de embrião", detalhe: [(e.doadoraNome || e.doadoraNumero) && `doadora ${e.doadoraNome || e.doadoraNumero}`, e.reprodutor && `sêmen ${e.reprodutor}`, e.protocolo].filter(Boolean).join(" · ") || undefined, marcador: "receptora" };
    case "DIAGNOSTICO":
      return { ...base, titulo: `Diagnóstico de gestação — ${String(e.resultado).toUpperCase()}`, detalhe: e.dtPartoPrevista ? `parto previsto ${iso(e.dtPartoPrevista)}` : undefined, alerta: e.resultado === "negativo" };
    case "PARTO": {
      const tipoLabel = labelTipoParto(e.tipoParto);
      const auxLabel = labelAuxilioParto(e.auxilioParto);
      const n = e.numCrias ?? (((e.criasVivas ?? 0) + (e.criasNatimortas ?? 0)) || 1);
      const split = (e.criasVivas != null || e.criasNatimortas != null)
        ? `${e.criasVivas ?? 0} viva(s)${e.criasNatimortas ? ` · ${e.criasNatimortas} natimorto(s)` : ""}`
        : `${n} cria(s)${e.sexoCria ? ` ${e.sexoCria}` : ""}`;
      const titulo = ehAborto(e.tipoParto) ? "Aborto" : `Parto — ${split}`;
      const detalhe = [tipoLabel, auxLabel, e.observacao].filter(Boolean).join(" · ") || undefined;
      return { ...base, titulo, detalhe, alerta: ehAborto(e.tipoParto) || (e.criasNatimortas ?? 0) > 0, marcador: ehAborto(e.tipoParto) ? "gestação interrompida" : "início da lactação" };
    }
    case "SECAGEM":
      return { ...base, titulo: "Secagem", detalhe: e.motivoSecagem ?? undefined };
    case "EXAME_GINECOLOGICO": {
      const achado = e.resultado ? String(e.resultado).replace(/_/g, " ").toLowerCase() : "sem achado";
      return { ...base, titulo: `Exame ginecológico — ${achado}`, detalhe: [e.protocolo, e.observacao].filter(Boolean).join(" · ") || undefined, alerta: ACHADOS_ALERTA.has(String(e.resultado)) };
    }
    case "DESMAME": {
      // peso ao desmame gravado em `resultado` (string numérica); observacao é texto livre.
      const peso = e.resultado ? `${e.resultado} kg` : null;
      return { ...base, titulo: "Desmame", detalhe: [peso, e.observacao].filter(Boolean).join(" · ") || undefined, marcador: "desmamado" };
    }
    default:
      return { ...base, titulo: "Evento" };
  }
}
