/* Tipos do módulo Plantio (café arábica).
 * Espelha a forma do módulo Rebanho — leitura/escrita do produtor é a mesma:
 * "talhão" = unidade individual (como "animal"), "lavoura" = agrupador (como "lote").
 *
 * Referencial técnico — Embrapa Café, Manual do Café (Emater-MG), Coleção SENAR
 * 189/191, Conab (custos), Cepea (preços). Fenologia/MIP/poda seguem a literatura
 * de cafeicultura do Sul de Minas. */

export type EstadoTalhao = "ATIVO" | "RECEPADO" | "FORMACAO" | "BAIXADO";

// Cultivares mais usadas na cafeicultura do Sul de Minas (Embrapa/Procafé).
export type VariedadeCafe =
  | "Catuaí Amarelo IAC 62" | "Catuaí Amarelo IAC 144"
  | "Catuaí Vermelho IAC 99" | "Catuaí Vermelho IAC 144"
  | "Mundo Novo IAC 379-19" | "Mundo Novo IAC 502-9"
  | "Topázio MG-1190" | "Acauã" | "Acauã Novo"
  | "Bourbon Amarelo" | "Icatu" | "Arara" | "Asa Branca"
  | "Catuaí Vermelho IAC 81" | "Paraíso MG H 419-1";

export type FaseFenologica =
  | "REPOUSO"             // jul/ago — gemas dormentes, senescência
  | "INDUCAO_FLORAL"      // ago — diferenciação das gemas
  | "FLORADA"             // set/out — chuva dispara antese
  | "CHUMBINHO"           // 0-50 dias após florada — frutos do tamanho de chumbo
  | "EXPANSAO"            // nov/dez — frutos crescem em tamanho
  | "GRANACAO"            // jan/mar — formação do grão (endosperma)
  | "MATURACAO_VERDE"     // abr
  | "MATURACAO_CEREJA"    // mai/jun — ponto ótimo de colheita
  | "COLHEITA"            // mai/ago no Sul de Minas
  | "POS_COLHEITA";       // jun/jul — esqueletamento, calagem, recuperação

export type Dominio = "fenologia" | "fitossanidade" | "nutricao" | "colheita";

// Espelho do AnimalCockpit: leitura editorial por talhão.
export interface Talhao {
  id: string;
  codigo: string;          // ex.: "CAF-12" — identificador visível
  nome: string;            // ex.: "Cafundó alto"
  variedade: VariedadeCafe;
  espacamento: string;     // ex.: "3,80 × 0,60 m"
  plantasHa: number;       // densidade — derivada do espaçamento mas guardada
  areaHa: number;          // hectares do talhão
  anoPlantio: number;
  altitude: number;        // metros — define janela fenológica
  exposicao?: "norte" | "sul" | "leste" | "oeste" | null;
  declive?: number | null; // % de declividade
  irrigado: boolean;
  estado: EstadoTalhao;
  lavoura: string;         // gleba/zona — ex.: "Cafundó"
  ultimaRecepa?: string | null;  // YYYY-MM-DD
  dataPlantio: string;     // YYYY-MM-DD
  observacao?: string | null;
  resumo?: ResumoTalhao | null;
}

// Read-model pré-computado por talhão (espelho do ResumoAnimal).
export interface ResumoTalhao {
  talhaoId: string;
  fase: FaseFenologica;
  diasNaFase?: number;
  proximaOperacao?: string;     // ex.: "3ª parcela de N — 25/jul"
  proximaOperacaoEm?: string;   // YYYY-MM-DD
  produtividadeEsperada?: number; // sc beneficiada / ha (safra atual)
  produtividadeUltima?: number;   // sc/ha — safra anterior
  bienalidade?: "POSITIVA" | "NEGATIVA"; // alta ou baixa
  enchimentoFruto?: number;       // %  — 0..100 (rastreio durante granação)
  maturacaoCereja?: number;       // % cereja — 0..100 (na colheita)
  maturacaoVerde?: number;        // %  — verde + verde-cana
  maturacaoBoia?: number;         // %  — passa/seco/boia
  // Fitossanidade — incidência das 4 principais (Embrapa/MIP).
  ferrugem?: number;              // %  — folhas com pústulas
  bichoMineiro?: number;          // %  — folhas minadas
  broca?: number;                 // %  — frutos brocados
  cercosporiose?: number;         // %  — folhas com mancha
  tendFerrugem?: "subindo" | "estavel" | "caindo";
  ultimaInspecaoData?: string;    // YYYY-MM-DD
  // Solo / nutrição.
  ultimaAnaliseSolo?: string;     // YYYY-MM-DD
  pH?: number;                    // CaCl₂
  v?: number;                     // saturação por bases (%)
  mo?: number;                    // matéria orgânica (g/dm³)
  fosforo?: number;               // P (mg/dm³)
  potassio?: number;              // K (mg/dm³ ou cmolc — guardamos em mg/dm³)
  ultimaAnaliseFoliar?: string;   // YYYY-MM-DD
  nFoliar?: number;               // % N
  kFoliar?: number;               // % K
  atualizadoEm?: string;          // ISO
}

// Eventos da timeline — mesma estrutura editorial do EventoTimeline do rebanho.
export interface EventoTimeline {
  id: string;
  talhaoId: string;
  data: string;       // ISO
  dominio: Dominio;
  titulo: string;
  detalhe?: string;
  alerta?: boolean;
  marcador?: string;   // ex.: "abertura da florada" — separador editorial
  responsavel?: string;
  impacto?: string;    // ex.: "+R$ 8.400 estimado" ou "redução de 12% na incidência"
  proximoPasso?: string;
}

export interface IaInsight {
  id: string;
  escopo: "lavoura" | "talhao";
  dominio: Dominio;
  talhaoId?: string;
  texto: string;
  acoes: { label: string; primaria?: boolean }[];
}

// Tipos para a tela Nutrição (espelho de Dieta + Grupo)
export interface PlanoAdubacao {
  id: number;
  nome: string;             // ex.: "Plano produção 60 sc/ha"
  descricao?: string;
  nKgHa?: number;           // N total (kg/ha/safra)
  p2o5KgHa?: number;        // P₂O₅ (kg/ha/safra)
  k2oKgHa?: number;         // K₂O  (kg/ha/safra)
  parcelas?: number;        // ex.: 4 parcelas
  ativo: boolean;
}

export interface Lavoura {
  id: number;
  nome: string;             // ex.: "Cafundó"
  variedade?: VariedadeCafe;
  numTalhoes: number;
  areaHa: number;
  produtividadeMedia?: number; // sc/ha (safra atual estimada)
  planoAdubacaoNome?: string | null;
}

// Tipos para Colheita (espelho de ControleLeiteiro/ProducaoLote)
export interface PassadaColheita {
  id: string;
  talhaoId: string;
  data: string;             // YYYY-MM-DD
  numero: number;           // 1ª, 2ª passada
  metodo: "DERRIÇA_PANO" | "DERRIÇA_MECANIZADA" | "SELETIVA" | "VARRIÇÃO";
  litrosCereja: number;     // medida bruta no campo
  rendimento: number;       // L cereja por saca beneficiada (típico 480–520)
  sacasBeneficiadas: number;
  perdaPiso?: number;       // litros perdidos no chão
  pctCereja?: number;       // % cereja na hora da derriça
  pctVerde?: number;
  pctBoiaPassa?: number;
  responsavel?: string;
  observacao?: string;
}

// Insumos do estoque (Plantio) — fertilizantes, defensivos, herbicidas, calcários.
export type TipoInsumoPlantio =
  | "FERTILIZANTE"     // formulados NPK, ureia, MAP, KCl
  | "DEFENSIVO"        // fungicidas, inseticidas, acaricidas
  | "HERBICIDA"
  | "CORRETIVO"        // calcário, gesso, fosfato natural
  | "BIOLOGICO"        // Beauveria, Bacillus, micorrizas
  | "FOLIAR"           // micronutrientes via foliar
  | "MUDA"
  | "OUTRO";

// Operações (eventos não-fenológicos): adubação, aplicação fito, poda, capina.
export type TipoOperacao =
  | "ADUBACAO_SOLO" | "ADUBACAO_FOLIAR"
  | "CALAGEM" | "GESSAGEM"
  | "APLICACAO_FUNGICIDA" | "APLICACAO_INSETICIDA"
  | "APLICACAO_HERBICIDA" | "ROCAGEM_MECANICA" | "CAPINA_MANUAL"
  | "PODA_RECEPA" | "PODA_DECOTE" | "PODA_ESQUELETAMENTO" | "PODA_DESPONTE"
  | "DESBROTA"
  | "IRRIGACAO"
  | "REPLANTIO"
  | "AMOSTRAGEM_SOLO" | "AMOSTRAGEM_FOLIAR" | "MONITORAMENTO_MIP";

// ── Planejamento da safra (Fatia P3 — camada operacional Ideagri) ──────────
// Resumo pré-computado da safra (read-model do backend) — alimenta a KPI-strip.
export interface ResumoSafra {
  tarefasTotal: number;
  tarefasConcluidas: number;
  custoPrevTotal: number;
  custoRealTotal: number;
  horasMaquina: number;
  horasHomem: number;
  custoOperacional: number;
}

// Safra = janela de operação (espelho de uma "campanha"); agrupa tarefas e
// apontamentos. `centroCustoNome` liga ao financeiro (Atividade Café).
export interface SafraDTO {
  id: number;
  nome: string;             // ex.: "Safra 2025/26"
  dataInicio: string;       // YYYY-MM-DD
  dataFim: string;          // YYYY-MM-DD
  fechada: boolean;
  centroCustoNome: string | null;
  resumo: ResumoSafra;
}

// Tarefa planejada × realizada — o coração da tela. Campos `*Prev` são o
// planejado; `*Real` ficam null até o produtor dar "Realizar".
export interface TarefaPlanejada {
  id: number;
  safraId: number;
  talhaoId: number | null;
  talhaoCodigo: string | null;
  lavouraId: number | null;
  lavouraNome: string | null;
  tipo: string;             // TipoOperacao
  descricao: string;
  responsavel: string | null;
  produto: string | null;
  unidade: string | null;
  qtdHaPrev: number | null;
  qtdTotalPrev: number | null;
  dataPrevista: string | null;   // YYYY-MM-DD
  custoPrev: number | null;
  qtdHaReal: number | null;
  qtdTotalReal: number | null;
  dataRealizada: string | null;  // YYYY-MM-DD
  custoReal: number | null;
  status: string;           // PLANEJADA | EM_ANDAMENTO | CONCLUIDA | CANCELADA
}

// Apontamento de hora-máquina / hora-homem (medição de uso de recurso).
export interface Apontamento {
  id: number;
  safraId: number | null;
  talhaoId: number | null;
  talhaoCodigo: string | null;
  data: string;             // YYYY-MM-DD
  tipo: "MAQUINA" | "HOMEM";
  recurso: string;          // ex.: "Trator MF 4275" ou "Diarista"
  operador: string | null;
  implemento: string | null;
  horas: number;
  valorHora: number | null;
  valorTotal: number | null;
  observacao: string | null;
}

// Pragas e doenças (Embrapa Café — diagnose e manejo).
export type PragaDoenca =
  | "FERRUGEM"             // Hemileia vastatrix
  | "CERCOSPORIOSE"        // Cercospora coffeicola
  | "BICHO_MINEIRO"        // Leucoptera coffeella
  | "BROCA_DO_CAFE"        // Hypothenemus hampei
  | "ACARO_VERMELHO"
  | "NEMATOIDES"           // Meloidogyne / Pratylenchus
  | "ANTRACNOSE"
  | "MANCHA_AUREOLADA"
  | "FUMAGINA"
  | "BICHO_BUCHA"
  | "MAL_FILAMENTOSO"
  | "ROSELINIA"
  | "COCHONILHAS"
  | "OUTRA";
