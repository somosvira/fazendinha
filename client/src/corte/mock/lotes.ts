import type { Lote, ResumoLote } from "../types";

/* Mock realista — Fazenda Rio Novo · módulo Corte.
 *
 * Cenário: a fazenda hoje é leite+café, mas mantém ~180 cabeças de gado de
 * corte em pastagens marginais (áreas que não comportam Holandês/Girolando).
 * Sistema é cria-recria-terminação fechado, base Nelore com cruzas F1 Angus
 * para terminação. Pasto Marandu/Mombaça/Brizantão.
 *
 * Categorias e quantidades calibradas pelos indicadores Embrapa Gado de
 * Corte (taxa de desmama ~85%, lotação ~1,4 UA/ha, peso desmama 175 kg,
 * abate aos 24-26 meses com 500 kg). */

export const lotes: Lote[] = [
  // CRIA ────────────────────────────────────────────────────────────
  {
    id: "L-001", codigo: "MAT-01", nome: "Matrizes pluriparas",
    categoria: "VACA_MATRIZ", fase: "REPRODUCAO", raca: "Nelore",
    numCabecas: 48, numCabecasEntrada: 50, dataFormacao: "2023-08-10",
    origem: "Rebanho próprio · pluriparas IATF 2023",
    piqueteAtual: "PQ-04", estado: "ATIVO",
    observacao: "Vacas com 3-7 partos. Estação de monta nov-jan via IATF, repasse com touro Capivara.",
  },
  {
    id: "L-002", codigo: "MAT-02", nome: "Novilhas paridas",
    categoria: "VACA_MATRIZ", fase: "REPRODUCAO", raca: "Nelore",
    numCabecas: 16, numCabecasEntrada: 16, dataFormacao: "2025-09-15",
    origem: "Primíparas selecionadas safra 2024",
    piqueteAtual: "PQ-03", estado: "ATIVO",
  },
  {
    id: "L-003", codigo: "TOU-01", nome: "Touros",
    categoria: "TOURO", fase: "REPRODUCAO", raca: "Nelore",
    numCabecas: 3, numCabecasEntrada: 3, dataFormacao: "2022-05-12",
    origem: "Touros provados — Capivara (PO), Rajado (PO), Jacaré (cruzamento)",
    piqueteAtual: "PQ-07", estado: "ATIVO",
    observacao: "Capivara e Rajado são Nelore PO; Jacaré é F1 Angus×Nelore para terminação.",
  },
  {
    id: "L-004", codigo: "BMM-01", nome: "Bezerros pé de vaca",
    categoria: "BEZERRO_MAMA", fase: "CRIA", raca: "Nelore",
    numCabecas: 31, numCabecasEntrada: 33, dataFormacao: "2025-11-20",
    origem: "Nascimentos out/nov-2025",
    piqueteAtual: "PQ-04", estado: "ATIVO",
    observacao: "Andam com as matrizes pluriparas até desmama prevista jul/2026.",
  },
  {
    id: "L-005", codigo: "BMM-02", nome: "Bezerras pé de vaca",
    categoria: "BEZERRA_MAMA", fase: "CRIA", raca: "Nelore",
    numCabecas: 26, numCabecasEntrada: 27, dataFormacao: "2025-11-20",
    origem: "Nascimentos out/nov-2025",
    piqueteAtual: "PQ-04", estado: "ATIVO",
  },

  // RECRIA ──────────────────────────────────────────────────────────
  {
    id: "L-006", codigo: "RDM-01", nome: "Recria machos 2025",
    categoria: "BEZERRO_DESMAMA", fase: "RECRIA", raca: "Nelore",
    numCabecas: 28, numCabecasEntrada: 29, dataFormacao: "2025-07-08",
    origem: "Desmama jul/2025 (paridos 2024)",
    piqueteAtual: "PQ-02", estado: "ATIVO",
    observacao: "Desmamados aos 7 meses com 178 kg médio. Receberam mineralização proteinada águas e proteico seca.",
  },
  {
    id: "L-007", codigo: "RDF-01", nome: "Recria fêmeas 2025",
    categoria: "BEZERRA_DESMAMA", fase: "RECRIA", raca: "Nelore",
    numCabecas: 24, numCabecasEntrada: 24, dataFormacao: "2025-07-08",
    origem: "Desmama jul/2025 — fêmeas pré-selecionadas para reposição",
    piqueteAtual: "PQ-05", estado: "ATIVO",
    observacao: "Reposição interna do plantel matrizes. Critério: peso, conformação, ascendência paterna.",
  },
  {
    id: "L-008", codigo: "GAR-01", nome: "Garrotes 18m",
    categoria: "GAROTE", fase: "RECRIA", raca: "Nelore",
    numCabecas: 18, numCabecasEntrada: 20, dataFormacao: "2024-12-12",
    origem: "Castração dez/2024 — turma desmama jul/2024",
    piqueteAtual: "PQ-06", estado: "ATIVO",
    observacao: "Castrados com 13 meses. Saíram da recria leve para semi-confinada.",
  },
  {
    id: "L-009", codigo: "NLH-01", nome: "Novilhas 20m",
    categoria: "NOVILHA", fase: "RECRIA", raca: "Nelore",
    numCabecas: 17, numCabecasEntrada: 19, dataFormacao: "2024-10-20",
    origem: "Reposição 2024 — pré-IATF nov/2026",
    piqueteAtual: "PQ-03", estado: "ATIVO",
    observacao: "Alvo: 320 kg para IATF em nov/2026 (peso mínimo para 1ª monta segundo Embrapa).",
  },

  // TERMINAÇÃO ──────────────────────────────────────────────────────
  {
    id: "L-010", codigo: "TER-01", nome: "Terminação Angus×Nelore",
    categoria: "NOVILHO", fase: "TERMINACAO", raca: "F1 Angus×Nelore",
    numCabecas: 22, numCabecasEntrada: 22, dataFormacao: "2025-09-02",
    origem: "Produto cruzamento touro Jacaré × matrizes 2023",
    piqueteAtual: "PQ-01", estado: "ATIVO",
    observacao: "Engorda intensiva pasto + proteico águas + confinamento alto-grão últimos 90d. Alvo: 17 @ carcaça em out/2026.",
  },
  {
    id: "L-011", codigo: "TER-02", nome: "Terminação Nelore prontos",
    categoria: "BOI_GORDO", fase: "TERMINACAO", raca: "Nelore",
    numCabecas: 14, numCabecasEntrada: 16, dataFormacao: "2024-06-15",
    origem: "Garrotes 2023 → engorda 2024-2026",
    piqueteAtual: "PQ-01", estado: "ATIVO",
    observacao: "PRONTOS para abate. Peso médio 502 kg, ≈ 17,4 @. Aguardando janela B3 — agosto/setembro 2026.",
  },

  // DESCARTE ────────────────────────────────────────────────────────
  {
    id: "L-012", codigo: "DES-01", nome: "Vacas descarte 2026",
    categoria: "VACA_DESCARTE", fase: "TERMINACAO", raca: "Nelore",
    numCabecas: 6, numCabecasEntrada: 6, dataFormacao: "2026-05-20",
    origem: "Falha repetida no DG 2024 + 2025 / problema podal",
    piqueteAtual: "PQ-08", estado: "ATIVO",
    observacao: "Engorda rápida pra descarte. Vendidas como vaca gorda (ágio menor que boi mas saída rápida).",
  },

  // VENDIDO (histórico recente) ────────────────────────────────────
  {
    id: "L-013", codigo: "TER-V-2025", nome: "Boiada vendida out/2025",
    categoria: "BOI_GORDO", fase: "TERMINACAO", raca: "Nelore",
    numCabecas: 0, numCabecasEntrada: 26, dataFormacao: "2024-06-10",
    origem: "Recria 2023 → terminação 2025",
    piqueteAtual: null, estado: "VENDIDO",
    observacao: "Vendida em 28/out/2025 ao Frigorífico Marfrig (Bataguassu) — 26 cabeças a R$ 308/@ média.",
  },
];

/* Resumos derivados — cada lote tem um "diagnóstico atual" análogo ao
 * ResumoAnimal/ResumoTalhao. Os números refletem o estado típico em
 * 28/jun/2026: fim do período seco se aproximando, pasto perdendo
 * qualidade, suplementação proteica obrigatória para recria/terminação. */

export const resumos: ResumoLote[] = [
  // Matrizes pluríparas — em manutenção, GMD negativo no seca é OK
  { loteId: "L-001",
    pesoMedio: 432, pesoMedioEntrada: 445, gmd: -0.08, gmdAcumulado: 0.02,
    ultimaPesagem: "2026-05-14", diasSemPesar: 45,
    ua: (432 * 48) / 450,
    proximaVacina: "Aftosa nov/2026 (etapa 2)",
    ultimoManejo: "2026-05-22 · vermifugação 5-8-11 (etapa maio)",
    mortalidadeAcumulada: 4.0,
    proximaAcao: "DG transretal — verificar prenhez IATF nov/25",
    proximaAcaoEm: "2026-07-15",
  },
  // Novilhas paridas
  { loteId: "L-002",
    pesoMedio: 378, pesoMedioEntrada: 385, gmd: -0.05,
    ultimaPesagem: "2026-05-14", diasSemPesar: 45,
    ua: (378 * 16) / 450,
    proximaVacina: "Aftosa nov/2026",
    proximaAcao: "DG transretal pós-IATF (cobertura nov/25)",
    proximaAcaoEm: "2026-07-15",
  },
  // Touros — peso estável
  { loteId: "L-003",
    pesoMedio: 812, pesoMedioEntrada: 820, gmd: 0.0,
    ultimaPesagem: "2026-04-02", diasSemPesar: 87,
    ua: (812 * 3) / 450,
    proximaVacina: "Aftosa nov/2026 + IBR-BVD pré-monta",
    proximaAcao: "Andrológico pré-estação monta",
    proximaAcaoEm: "2026-09-20",
  },
  // Bezerros mama — crescendo bem
  { loteId: "L-004",
    pesoMedio: 142, gmd: 0.62, gmdAcumulado: 0.62,
    ultimaPesagem: "2026-06-15", diasSemPesar: 13,
    proximaVacina: "Clostridiose 1ª dose vencendo",
    proximaAcao: "Desmama prevista — pesar e separar",
    proximaAcaoEm: "2026-07-20",
  },
  // Bezerras mama
  { loteId: "L-005",
    pesoMedio: 132, gmd: 0.58, gmdAcumulado: 0.58,
    ultimaPesagem: "2026-06-15", diasSemPesar: 13,
    proximaVacina: "Brucelose B19 — janela 3-8 meses se fechando",
    proximaAcao: "Vacinar B19 antes da desmama",
    proximaAcaoEm: "2026-07-10",
  },
  // Recria machos — pode entrar suplementação proteica seca
  { loteId: "L-006",
    pesoMedio: 268, pesoMedioEntrada: 178, gmd: 0.38, gmdAcumulado: 0.26,
    ultimaPesagem: "2026-06-02", diasSemPesar: 26,
    ua: (268 * 28) / 450,
    proximaVacina: "Aftosa nov/2026",
    proximoVermifugo: "Vermifugação 5-8-11 (etapa ago)",
    proximaAcao: "Trocar mineralização águas → proteico seca",
    proximaAcaoEm: "2026-07-05",
    mortalidadeAcumulada: 3.4,
  },
  // Recria fêmeas
  { loteId: "L-007",
    pesoMedio: 252, pesoMedioEntrada: 168, gmd: 0.35, gmdAcumulado: 0.26,
    ultimaPesagem: "2026-06-02", diasSemPesar: 26,
    ua: (252 * 24) / 450,
    proximaVacina: "Aftosa nov/2026",
    proximaAcao: "Trocar para proteico seca",
    proximaAcaoEm: "2026-07-05",
  },
  // Garrotes 18m
  { loteId: "L-008",
    pesoMedio: 342, pesoMedioEntrada: 240, gmd: 0.55, gmdAcumulado: 0.51,
    ultimaPesagem: "2026-05-20", diasSemPesar: 39,
    ua: (342 * 18) / 450,
    proximaVacina: "Aftosa nov/2026",
    proximaAcao: "Avaliar entrada em confinamento out/2026",
    proximaAcaoEm: "2026-09-15",
    mortalidadeAcumulada: 10.0,  // 2 mortes em 20 (1 timpanismo + 1 acidente)
  },
  // Novilhas pré-IATF
  { loteId: "L-009",
    pesoMedio: 306, pesoMedioEntrada: 215, gmd: 0.48, gmdAcumulado: 0.46,
    ultimaPesagem: "2026-05-20", diasSemPesar: 39,
    ua: (306 * 17) / 450,
    proximaVacina: "Brucelose reforço + Leptospirose",
    proximaAcao: "Pesagem pré-IATF (alvo 320 kg) em set/2026",
    proximaAcaoEm: "2026-09-25",
    mortalidadeAcumulada: 10.5,
  },
  // Terminação Angus×Nelore — em alto-grão
  { loteId: "L-010",
    pesoMedio: 446, pesoMedioEntrada: 318, gmd: 1.42, gmdAcumulado: 1.32,
    ultimaPesagem: "2026-06-20", diasSemPesar: 8,
    ua: (446 * 22) / 450,
    pesoAlvoVenda: 510,
    diasParaAlvo: Math.round((510 - 446) / 1.42),  // ~45 dias
    arrobasEstimadas: (446 * 0.52) / 15,           // ~15,5 @
    proximaAcao: "Pesagem semanal — janela venda set-out/2026",
    proximaAcaoEm: "2026-07-04",
    mortalidadeAcumulada: 0,
  },
  // Boi gordo PRONTO
  { loteId: "L-011",
    pesoMedio: 502, pesoMedioEntrada: 340, gmd: 0.42, gmdAcumulado: 0.22,
    ultimaPesagem: "2026-06-20", diasSemPesar: 8,
    ua: (502 * 14) / 450,
    pesoAlvoVenda: 500,
    diasParaAlvo: 0,
    arrobasEstimadas: (502 * 0.52) / 15,           // ~17,4 @
    proximaAcao: "PRONTO — fechar venda — janela B3 contango setembro favorável",
    proximaAcaoEm: "2026-07-15",
    mortalidadeAcumulada: 12.5,  // perda alta nessa boiada (estresse calor 2025)
  },
  // Vacas descarte
  { loteId: "L-012",
    pesoMedio: 458, pesoMedioEntrada: 432, gmd: 0.85,
    ultimaPesagem: "2026-06-22", diasSemPesar: 6,
    ua: (458 * 6) / 450,
    pesoAlvoVenda: 480,
    diasParaAlvo: 26,
    arrobasEstimadas: (458 * 0.5) / 15,  // vaca gorda rendimento ~50%
    proximaAcao: "Negociar venda direto — vaca gorda",
    proximaAcaoEm: "2026-07-20",
    mortalidadeAcumulada: 0,
  },
];
