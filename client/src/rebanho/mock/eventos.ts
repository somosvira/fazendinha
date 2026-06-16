import type { EventoTimeline } from "../types";

export const eventos: EventoTimeline[] = [
  { id: "e1", animalId: "1234", data: "2026-05-28", dominio: "reproducao", titulo: "Diagnóstico de gestação — POSITIVO", detalhe: "~30 dias de gestação · sêmen Girolando \"Lance 884\" · parto previsto 22/02/2027" },
  { id: "e2", animalId: "1234", data: "2026-05-12", dominio: "sanidade", titulo: "Controle leiteiro — CCS 512 mil", detalhe: "Terceira alta consecutiva · gordura 3,8% · proteína 3,2%", alerta: true },
  { id: "e3", animalId: "1234", data: "2026-04-28", dominio: "reproducao", titulo: "Inseminação artificial (IATF)", detalhe: "Protocolo IATF 11 dias · reprodutor \"Lance 884\" · 1ª tentativa" },
  { id: "e4", animalId: "1234", data: "2026-04-14", dominio: "sanidade", titulo: "Mastite clínica — quarto posterior direito", detalhe: "Tratamento intramamário · carência do leite 96h (até 18/04) · lote produto MAST-2231" },
  { id: "e5", animalId: "1234", data: "2026-03-20", dominio: "nutricao", titulo: "Realocada → lote \"Alta Produção\"", detalhe: "Dieta lactação alta · 18% PB · 1,68 Mcal/kg" },
  { id: "e6", animalId: "1234", data: "2026-01-22", dominio: "reproducao", titulo: "Parto — cria ♀ #1442 viva", detalhe: "Parto normal · escore de colostro Brix 24% (ótimo) · sem retenção de placenta", marcador: "início da 3ª lactação" },
  { id: "e7", animalId: "1234", data: "2025-12-18", dominio: "nutricao", titulo: "Secagem da 2ª lactação", detalhe: "Motivo: fim de ciclo · 305 dias · produção total 8.420 L" },
];
