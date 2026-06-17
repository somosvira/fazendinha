import type { IaInsight } from "../types";

export const insights: IaInsight[] = [
  { id: "i-rep", escopo: "rebanho", dominio: "reproducao", texto: "A taxa de concepção caiu de <b>42% → 31%</b> nos últimos 3 lotes de IATF — concentrada no reprodutor <b>\"Lance 884\"</b>. Pode ser partida de sêmen ou manejo.", acoes: [{ label: "Investigar com a IA", primaria: true }] },
  { id: "i-1234", escopo: "animal", dominio: "sanidade", animalId: "1234", texto: "CCS subiu em 3 controles seguidos (<b>245 → 389 → 512 mil cél/mL</b>) e houve mastite clínica em abril. Risco de <b>mastite subclínica persistente</b> — candidata a cultura no próximo controle.", acoes: [{ label: "Ver 7 vacas com padrão parecido", primaria: true }, { label: "Agendar cultura" }] },
];
