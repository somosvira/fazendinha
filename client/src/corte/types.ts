/* Tipos do módulo Corte (gado de corte).
 *
 * IMPORTANTE — a unidade primária aqui é o LOTE, não a cabeça individual.
 * Na pecuária de corte real, manejo (vacina, vermífugo, mudança de pasto,
 * venda) acontece por lote — 40 garrotes andam juntos como "Recria A" sem
 * ID individual. Cabeças individuais existem só para matrizes e touros
 * (cadastrados para fins reprodutivos / genealogia). Isso é diferente do
 * Rebanho leiteiro, onde cada vaca importa (controle, mastite, prenhez).
 *
 * Referencial técnico — Embrapa Gado de Corte (Campo Grande/MS), Manual de
 * Boas Práticas de Vacinação (Embrapa), Calendário sanitário cronograma 11
 * (Embrapa), Cepea/B3 (preço da arroba). Indicadores: Indicadores de
 * desempenho na pecuária de corte (Infoteca-e Embrapa).
 */

export type CategoriaLote =
  | "VACA_MATRIZ"     // matrizes em produção
  | "TOURO"
  | "BEZERRO_MAMA"    // ao pé da vaca, até desmama (~7 meses)
  | "BEZERRA_MAMA"
  | "BEZERRO_DESMAMA" // 7-12 meses, recém-desmamado, em recria inicial
  | "BEZERRA_DESMAMA"
  | "GAROTE"          // recria 12-18 meses (machos castrados)
  | "NOVILHA"         // fêmea 12-24 meses, candidata a matriz
  | "NOVILHO"         // 18-26 meses, terminação
  | "BOI_GORDO"       // pronto pra abate (≥ 16 @ carcaça)
  | "VACA_DESCARTE";  // matriz pra venda

export type FaseCiclo = "CRIA" | "RECRIA" | "TERMINACAO" | "REPRODUCAO";

export type RacaCorte =
  | "Nelore" | "Angus" | "Brangus" | "F1 Angus×Nelore" | "F1 Hereford×Nelore"
  | "Senepol" | "Tabapuã" | "Caracu" | "Cruza Industrial";

export type EstadoLote = "ATIVO" | "VENDIDO" | "EXTINTO";

export type Dominio = "pesagem" | "sanidade" | "nutricao" | "comercial";

// Lote = unidade primária de manejo do gado de corte.
export interface Lote {
  id: string;
  codigo: string;           // "REC-A", "TER-01", "CRIA-2"
  nome: string;
  categoria: CategoriaLote;
  fase: FaseCiclo;
  raca: RacaCorte;
  numCabecas: number;
  numCabecasEntrada: number;  // para mortalidade acumulada
  dataFormacao: string;       // YYYY-MM-DD — quando o lote foi formado
  origem?: string;            // "Nascimento próprio" | "Compra Boa Esperança" | "Recria desmama 2025"
  piqueteAtual?: string | null; // referência ao código do piquete
  estado: EstadoLote;
  observacao?: string | null;
  resumo?: ResumoLote | null;
}

// Read-model pré-computado por lote — espelha ResumoTalhao / ResumoAnimal.
export interface ResumoLote {
  loteId: string;
  pesoMedio?: number;          // kg/cabeça atual (última pesagem)
  pesoMedioEntrada?: number;   // kg/cabeça na formação
  gmd?: number;                // kg/dia — ganho médio diário (últimos 60-90d)
  gmdAcumulado?: number;       // kg/dia desde a entrada
  ultimaPesagem?: string;      // ISO
  diasSemPesar?: number;
  ua?: number;                 // unidades animal (1 UA = 450 kg)
  // Sanidade
  proximaVacina?: string;      // "Aftosa nov/26"
  proximoVermifugo?: string;
  ultimoManejo?: string;
  // Comercial
  pesoAlvoVenda?: number;      // peso de abate alvo (kg)
  diasParaAlvo?: number;       // estimativa pelo GMD
  arrobasEstimadas?: number;   // @ carcaça / cabeça atual (rendimento 52%)
  mortalidadeAcumulada?: number; // %
  // Diagnóstico textual
  proximaAcao?: string;
  proximaAcaoEm?: string;
  atualizadoEm?: string;
}

// Piquete = divisão física do pasto.
// Cada lote ocupa um piquete por vez; um piquete pode ser ocupado
// sequencialmente por vários lotes (rotação).
export type Capim =
  | "Brachiaria brizantha cv. Marandu"
  | "Brachiaria brizantha cv. Piatã"
  | "Brachiaria decumbens"
  | "Panicum maximum cv. Mombaça"
  | "Panicum maximum cv. Tanzânia"
  | "Cynodon (Tifton 85)"
  | "Pasto nativo / consorciado";

export interface Piquete {
  id: string;
  codigo: string;            // "PQ-01"
  nome: string;
  capim: Capim;
  areaHa: number;
  lotacaoMaxUA: number;      // capacidade técnica (UA total)
  cercaTipo?: string;        // "fixa", "elétrica", "trama"
  ultimaReforma?: string;    // ISO
  estado: "DISPONIVEL" | "OCUPADO" | "DESCANSO" | "REFORMA";
  loteAtualId?: string | null;
  dataUltimaOcupacao?: string;
  diasDescanso?: number;
  observacao?: string;
}

// Pesagem do lote — feita ao mover de pasto, ao confinar, antes da venda.
// O peso médio é o KPI central da pecuária de corte; GMD = inclinação dele.
export interface Pesagem {
  id: string;
  loteId: string;
  data: string;             // YYYY-MM-DD
  pesoMedio: number;        // kg/cabeça
  numCabecas: number;       // pode ter mudado desde a entrada
  pesoTotal: number;        // kg total
  metodo: "BALANCA_INDIVIDUAL" | "BALANCA_LOTE" | "FITA_TORACICA" | "VISUAL_ESTIMADO";
  responsavel?: string;
  observacao?: string;
  gmdDesdeUltima?: number;  // calculado
}

export type TipoSanitario =
  | "VACINA_AFTOSA" | "VACINA_BRUCELOSE_B19" | "VACINA_CLOSTRIDIOSE"
  | "VACINA_RAIVA" | "VACINA_CARBUNCULO" | "VACINA_LEPTOSPIROSE" | "VACINA_IBR_BVD"
  | "VERMIFUGACAO_5811" | "VERMIFUGACAO_ESTRATEGICA"
  | "CONTROLE_CARRAPATO" | "CONTROLE_MOSCA" | "CONTROLE_BERNE"
  | "MARCACAO" | "DESCORNA" | "CASTRACAO" | "BRINCO_ELETRONICO";

export interface ManejoSanitario {
  id: string;
  loteId: string;
  data: string;
  tipo: TipoSanitario;
  produto?: string;
  doseMl?: number;
  numCabecas: number;
  responsavel?: string;
  carenciaDias?: number;     // próxima data permitida pra venda
  proximaDose?: string;      // ISO da próxima aplicação esperada
  observacao?: string;
}

export type TipoSuplemento =
  | "MINERAL"                // mineralização proteinada
  | "PROTEICO_SECA"           // suplementação seca (proteico)
  | "ENERGETICO_AGUAS"        // suplementação águas (energia)
  | "RACAO_CONFINAMENTO"      // confinamento alto-grão
  | "SAL_BRANCO";

export interface Suplementacao {
  id: string;
  loteId: string;
  dataInicio: string;
  dataFim?: string;
  tipo: TipoSuplemento;
  produto: string;
  consumoCabecaDiaG: number; // g/cab/dia
  custoKg?: number;
  observacao?: string;
}

export type TipoComercial = "VENDA_ABATE" | "VENDA_REPRODUCAO" | "DESCARTE" | "COMPRA" | "TRANSFERENCIA_ATIVIDADE";

export interface OperacaoComercial {
  id: string;
  loteId?: string;            // pode ser parcial (só algumas cabeças)
  data: string;
  tipo: TipoComercial;
  numCabecas: number;
  pesoMedio: number;          // kg/cabeça
  pesoTotal: number;
  arrobas?: number;           // total de @ (peso × 0,52 × 30 = aprox)
  precoArroba?: number;
  receitaTotal?: number;
  comprador?: string;         // frigorífico, leiloeira
  observacao?: string;
}

// Timeline editorial — mesma forma do rebanho/plantio para reusar componentes.
export interface EventoTimeline {
  id: string;
  loteId: string;
  data: string;
  dominio: Dominio;
  titulo: string;
  detalhe?: string;
  alerta?: boolean;
  marcador?: string;
  responsavel?: string;
  impacto?: string;
  proximoPasso?: string;
}

export interface IaInsight {
  id: string;
  escopo: "fazenda" | "lote";
  dominio: Dominio;
  loteId?: string;
  texto: string;
  acoes: { label: string; primaria?: boolean }[];
}

export const CATEGORIA_LABEL: Record<CategoriaLote, string> = {
  VACA_MATRIZ: "Vacas matrizes",
  TOURO: "Touros",
  BEZERRO_MAMA: "Bezerros (mama)",
  BEZERRA_MAMA: "Bezerras (mama)",
  BEZERRO_DESMAMA: "Bezerros desmamados",
  BEZERRA_DESMAMA: "Bezerras desmamadas",
  GAROTE: "Garrotes",
  NOVILHA: "Novilhas",
  NOVILHO: "Novilhos",
  BOI_GORDO: "Bois gordos",
  VACA_DESCARTE: "Vacas descarte",
};

export const FASE_LABEL: Record<FaseCiclo, string> = {
  CRIA: "Cria",
  RECRIA: "Recria",
  TERMINACAO: "Terminação",
  REPRODUCAO: "Reprodução",
};

// Rendimento de carcaça típico Nelore engorda pasto: 52% (terminação) e
// 54-55% (confinamento alto-grão). Mantemos 52% como default para passar
// de kg vivo → @ carcaça: arrobas = (kg × 0,52) / 15.
export const RENDIMENTO_CARCACA = 0.52;
export const KG_POR_ARROBA = 15;
export function pesoToArrobas(kgVivo: number, rendimento = RENDIMENTO_CARCACA): number {
  return (kgVivo * rendimento) / KG_POR_ARROBA;
}
