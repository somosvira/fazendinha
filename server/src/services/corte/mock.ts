/* Mocks server-side do módulo Corte.
 *
 * Mantém a forma final dos DTOs entregues por /api/corte/*. Quando o Prisma
 * for plugado, essas funções viram `prisma.loteCorte.findMany({ include: { resumo } })`,
 * mas o JSON na rede não muda. Sem retrabalho no client.
 */

export interface Lote {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  fase: string;
  raca: string;
  numCabecas: number;
  numCabecasEntrada: number;
  dataFormacao: string;
  origem?: string;
  piqueteAtual?: string | null;
  estado: string;
  observacao?: string | null;
  resumo?: ResumoLote | null;
}

export interface ResumoLote {
  loteId: string;
  pesoMedio?: number;
  pesoMedioEntrada?: number;
  gmd?: number;
  gmdAcumulado?: number;
  ultimaPesagem?: string;
  diasSemPesar?: number;
  ua?: number;
  proximaVacina?: string;
  proximoVermifugo?: string;
  ultimoManejo?: string;
  pesoAlvoVenda?: number;
  diasParaAlvo?: number;
  arrobasEstimadas?: number;
  mortalidadeAcumulada?: number;
  proximaAcao?: string;
  proximaAcaoEm?: string;
}

export interface Piquete {
  id: string;
  codigo: string;
  nome: string;
  capim: string;
  areaHa: number;
  lotacaoMaxUA: number;
  cercaTipo?: string;
  ultimaReforma?: string;
  estado: string;
  loteAtualId?: string | null;
  dataUltimaOcupacao?: string;
  diasDescanso?: number;
  observacao?: string;
}

export interface EventoTimeline {
  id: string; loteId: string; data: string;
  dominio: "pesagem" | "sanidade" | "nutricao" | "comercial";
  titulo: string; detalhe?: string; alerta?: boolean;
  marcador?: string; responsavel?: string; impacto?: string; proximoPasso?: string;
}

export const lotes: Lote[] = [
  { id: "L-001", codigo: "MAT-01", nome: "Matrizes pluriparas", categoria: "VACA_MATRIZ", fase: "REPRODUCAO", raca: "Nelore", numCabecas: 48, numCabecasEntrada: 50, dataFormacao: "2023-08-10", origem: "Rebanho próprio · pluriparas IATF 2023", piqueteAtual: "PQ-04", estado: "ATIVO" },
  { id: "L-002", codigo: "MAT-02", nome: "Novilhas paridas", categoria: "VACA_MATRIZ", fase: "REPRODUCAO", raca: "Nelore", numCabecas: 16, numCabecasEntrada: 16, dataFormacao: "2025-09-15", piqueteAtual: "PQ-03", estado: "ATIVO" },
  { id: "L-003", codigo: "TOU-01", nome: "Touros", categoria: "TOURO", fase: "REPRODUCAO", raca: "Nelore", numCabecas: 3, numCabecasEntrada: 3, dataFormacao: "2022-05-12", piqueteAtual: "PQ-07", estado: "ATIVO" },
  { id: "L-004", codigo: "BMM-01", nome: "Bezerros pé de vaca", categoria: "BEZERRO_MAMA", fase: "CRIA", raca: "Nelore", numCabecas: 31, numCabecasEntrada: 33, dataFormacao: "2025-11-20", piqueteAtual: "PQ-04", estado: "ATIVO" },
  { id: "L-005", codigo: "BMM-02", nome: "Bezerras pé de vaca", categoria: "BEZERRA_MAMA", fase: "CRIA", raca: "Nelore", numCabecas: 26, numCabecasEntrada: 27, dataFormacao: "2025-11-20", piqueteAtual: "PQ-04", estado: "ATIVO" },
  { id: "L-006", codigo: "RDM-01", nome: "Recria machos 2025", categoria: "BEZERRO_DESMAMA", fase: "RECRIA", raca: "Nelore", numCabecas: 28, numCabecasEntrada: 29, dataFormacao: "2025-07-08", piqueteAtual: "PQ-02", estado: "ATIVO" },
  { id: "L-007", codigo: "RDF-01", nome: "Recria fêmeas 2025", categoria: "BEZERRA_DESMAMA", fase: "RECRIA", raca: "Nelore", numCabecas: 24, numCabecasEntrada: 24, dataFormacao: "2025-07-08", piqueteAtual: "PQ-05", estado: "ATIVO" },
  { id: "L-008", codigo: "GAR-01", nome: "Garrotes 18m", categoria: "GAROTE", fase: "RECRIA", raca: "Nelore", numCabecas: 18, numCabecasEntrada: 20, dataFormacao: "2024-12-12", piqueteAtual: "PQ-06", estado: "ATIVO" },
  { id: "L-009", codigo: "NLH-01", nome: "Novilhas 20m", categoria: "NOVILHA", fase: "RECRIA", raca: "Nelore", numCabecas: 17, numCabecasEntrada: 19, dataFormacao: "2024-10-20", piqueteAtual: "PQ-03", estado: "ATIVO" },
  { id: "L-010", codigo: "TER-01", nome: "Terminação Angus×Nelore", categoria: "NOVILHO", fase: "TERMINACAO", raca: "F1 Angus×Nelore", numCabecas: 22, numCabecasEntrada: 22, dataFormacao: "2025-09-02", piqueteAtual: "PQ-01", estado: "ATIVO" },
  { id: "L-011", codigo: "TER-02", nome: "Terminação Nelore prontos", categoria: "BOI_GORDO", fase: "TERMINACAO", raca: "Nelore", numCabecas: 14, numCabecasEntrada: 16, dataFormacao: "2024-06-15", piqueteAtual: "PQ-01", estado: "ATIVO" },
  { id: "L-012", codigo: "DES-01", nome: "Vacas descarte 2026", categoria: "VACA_DESCARTE", fase: "TERMINACAO", raca: "Nelore", numCabecas: 6, numCabecasEntrada: 6, dataFormacao: "2026-05-20", piqueteAtual: "PQ-08", estado: "ATIVO" },
];

export const resumos: ResumoLote[] = [
  { loteId: "L-001", pesoMedio: 432, gmd: -0.08, ultimaPesagem: "2026-05-14", diasSemPesar: 45, proximaVacina: "Aftosa nov/2026 (etapa 2)", ultimoManejo: "2026-05-22 · vermifugação 5-8-11", mortalidadeAcumulada: 4.0, proximaAcao: "DG transretal", proximaAcaoEm: "2026-07-15" },
  { loteId: "L-002", pesoMedio: 378, gmd: -0.05, ultimaPesagem: "2026-05-14", diasSemPesar: 45, proximaVacina: "Aftosa nov/2026", proximaAcao: "DG transretal", proximaAcaoEm: "2026-07-15" },
  { loteId: "L-003", pesoMedio: 812, gmd: 0.0, ultimaPesagem: "2026-04-02", diasSemPesar: 87, proximaVacina: "Aftosa nov/2026 + IBR-BVD pré-monta" },
  { loteId: "L-004", pesoMedio: 142, gmd: 0.62, gmdAcumulado: 0.62, ultimaPesagem: "2026-06-15", diasSemPesar: 13, proximaVacina: "Clostridiose 1ª dose vencendo", proximaAcao: "Desmama prevista", proximaAcaoEm: "2026-07-20" },
  { loteId: "L-005", pesoMedio: 132, gmd: 0.58, gmdAcumulado: 0.58, ultimaPesagem: "2026-06-15", diasSemPesar: 13, proximaVacina: "Brucelose B19 — janela 3-8 meses se fechando", proximaAcao: "Vacinar B19 antes da desmama", proximaAcaoEm: "2026-07-10" },
  { loteId: "L-006", pesoMedio: 268, pesoMedioEntrada: 178, gmd: 0.38, gmdAcumulado: 0.26, ultimaPesagem: "2026-06-02", diasSemPesar: 26, proximoVermifugo: "Vermifugação 5-8-11 (etapa ago)", proximaAcao: "Trocar mineralização águas → proteico seca", proximaAcaoEm: "2026-07-05", mortalidadeAcumulada: 3.4 },
  { loteId: "L-007", pesoMedio: 252, pesoMedioEntrada: 168, gmd: 0.35, gmdAcumulado: 0.26, ultimaPesagem: "2026-06-02", diasSemPesar: 26, proximaAcao: "Trocar para proteico seca", proximaAcaoEm: "2026-07-05" },
  { loteId: "L-008", pesoMedio: 342, pesoMedioEntrada: 240, gmd: 0.55, gmdAcumulado: 0.51, ultimaPesagem: "2026-05-20", diasSemPesar: 39, proximaAcao: "Avaliar entrada em confinamento out/2026", proximaAcaoEm: "2026-09-15", mortalidadeAcumulada: 10.0 },
  { loteId: "L-009", pesoMedio: 306, pesoMedioEntrada: 215, gmd: 0.48, gmdAcumulado: 0.46, ultimaPesagem: "2026-05-20", diasSemPesar: 39, proximaVacina: "Brucelose reforço + Leptospirose", proximaAcao: "Pesagem pré-IATF (alvo 320 kg)", proximaAcaoEm: "2026-09-25", mortalidadeAcumulada: 10.5 },
  { loteId: "L-010", pesoMedio: 446, pesoMedioEntrada: 318, gmd: 1.42, gmdAcumulado: 1.32, ultimaPesagem: "2026-06-20", diasSemPesar: 8, pesoAlvoVenda: 510, diasParaAlvo: 45, arrobasEstimadas: 15.5, proximaAcao: "Pesagem semanal — janela venda set-out", proximaAcaoEm: "2026-07-04", mortalidadeAcumulada: 0 },
  { loteId: "L-011", pesoMedio: 502, pesoMedioEntrada: 340, gmd: 0.42, gmdAcumulado: 0.22, ultimaPesagem: "2026-06-20", diasSemPesar: 8, pesoAlvoVenda: 500, diasParaAlvo: 0, arrobasEstimadas: 17.4, proximaAcao: "PRONTO — fechar venda", proximaAcaoEm: "2026-07-15", mortalidadeAcumulada: 12.5 },
  { loteId: "L-012", pesoMedio: 458, pesoMedioEntrada: 432, gmd: 0.85, ultimaPesagem: "2026-06-22", diasSemPesar: 6, pesoAlvoVenda: 480, diasParaAlvo: 26, proximaAcao: "Negociar venda direto", proximaAcaoEm: "2026-07-20" },
];

export const piquetes: Piquete[] = [
  { id: "P-01", codigo: "PQ-01", nome: "Brizantão alto", capim: "Brachiaria brizantha cv. Marandu", areaHa: 18.0, lotacaoMaxUA: 28, estado: "OCUPADO", loteAtualId: "L-010", dataUltimaOcupacao: "2026-05-10" },
  { id: "P-02", codigo: "PQ-02", nome: "Cana-do-meio", capim: "Panicum maximum cv. Mombaça", areaHa: 14.5, lotacaoMaxUA: 26, estado: "OCUPADO", loteAtualId: "L-006", dataUltimaOcupacao: "2026-04-18" },
  { id: "P-03", codigo: "PQ-03", nome: "Capim Alto", capim: "Panicum maximum cv. Tanzânia", areaHa: 12.0, lotacaoMaxUA: 20, estado: "OCUPADO", loteAtualId: "L-009", dataUltimaOcupacao: "2026-05-22" },
  { id: "P-04", codigo: "PQ-04", nome: "Mata Grande", capim: "Brachiaria brizantha cv. Marandu", areaHa: 22.0, lotacaoMaxUA: 35, estado: "OCUPADO", loteAtualId: "L-001", dataUltimaOcupacao: "2025-09-30" },
  { id: "P-05", codigo: "PQ-05", nome: "Riacho", capim: "Brachiaria brizantha cv. Piatã", areaHa: 9.5, lotacaoMaxUA: 16, estado: "OCUPADO", loteAtualId: "L-007", dataUltimaOcupacao: "2026-04-18" },
  { id: "P-06", codigo: "PQ-06", nome: "Vargem", capim: "Brachiaria brizantha cv. Marandu", areaHa: 8.0, lotacaoMaxUA: 15, estado: "OCUPADO", loteAtualId: "L-008", dataUltimaOcupacao: "2026-05-08" },
  { id: "P-07", codigo: "PQ-07", nome: "Curral dos Touros", capim: "Pasto nativo / consorciado", areaHa: 4.0, lotacaoMaxUA: 8, estado: "OCUPADO", loteAtualId: "L-003", dataUltimaOcupacao: "2024-11-12" },
  { id: "P-08", codigo: "PQ-08", nome: "Curral de Apartação", capim: "Cynodon (Tifton 85)", areaHa: 3.0, lotacaoMaxUA: 8, estado: "OCUPADO", loteAtualId: "L-012", dataUltimaOcupacao: "2026-05-20" },
  { id: "P-09", codigo: "PQ-09", nome: "Beira de Mata", capim: "Brachiaria decumbens", areaHa: 11.0, lotacaoMaxUA: 18, estado: "DESCANSO", loteAtualId: null, dataUltimaOcupacao: "2026-04-30", diasDescanso: 59 },
  { id: "P-10", codigo: "PQ-10", nome: "Pedras (reforma)", capim: "Brachiaria decumbens", areaHa: 7.5, lotacaoMaxUA: 12, estado: "REFORMA", loteAtualId: null },
];

export const eventos: EventoTimeline[] = [
  { id: "e-001", loteId: "L-001", data: "2025-11-08", dominio: "sanidade", titulo: "Vacinação aftosa · etapa nov/2025", detalhe: "48 cabeças · vacina trivalente", responsavel: "Wagner", impacto: "R$ 192" },
  { id: "e-002", loteId: "L-001", data: "2025-11-20", dominio: "sanidade", titulo: "IATF 2025 — D0", detalhe: "50 vacas, Ovsynch", marcador: "abertura estação reprodutiva" },
  { id: "e-005", loteId: "L-001", data: "2026-05-14", dominio: "pesagem", titulo: "Pesagem do lote", detalhe: "Peso médio 432 kg/cabeça" },
  { id: "e-013", loteId: "L-004", data: "2026-06-15", dominio: "pesagem", titulo: "Pesagem pré-desmama", detalhe: "Peso médio 142 kg · GMD 0,62 kg/dia", proximoPasso: "Desmama prevista 20/jul" },
  { id: "e-024", loteId: "L-006", data: "2026-06-02", dominio: "pesagem", titulo: "Pesagem recria", detalhe: "Peso médio 268 kg · GMD 0,38 kg/dia", alerta: true },
  { id: "e-033", loteId: "L-010", data: "2026-06-20", dominio: "pesagem", titulo: "Pesagem confinamento 90d", detalhe: "446 kg · GMD 1,42 kg/dia · conversão 7,1 kg/kg ganho", impacto: "≈ 341 @ total" },
  { id: "e-043", loteId: "L-011", data: "2026-06-20", dominio: "pesagem", titulo: "Pesagem pré-venda", detalhe: "14 cabeças · 502 kg · 17,4 @ carcaça", impacto: "≈ R$ 81.600 a R$ 339/@", proximoPasso: "Fechar venda direta" },
];

export function anexarResumo(l: Lote): Lote {
  return { ...l, resumo: resumos.find((r) => r.loteId === l.id) ?? null };
}
