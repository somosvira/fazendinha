// Tipos que espelham os DTOs de server/src/services/pecuaria/rebanho/{mappers,schemas,animais,lotes,racas,motivos,painel}.ts.
// Não inventar campos aqui sem conferir o contrato do backend primeiro.

export type Sexo = "F" | "M";
/** Referência leve a uma categoria configurável (CategoriaAnimal) — id + nome. */
export type CategoriaRef = { id: string; nome: string };
export type CategoriaOrigem = "AUTOMATICA" | "MANUAL" | "SEM_CATEGORIA";
export type Aptidao = "LEITE" | "CORTE";
export type PapelReprodutivo = "NENHUM" | "RECEPTORA" | "DOADORA";
export type Origem = "NASCIDO" | "COMPRADO";
export type Situacao = "ATIVO" | "BAIXADO";
export type TipoBaixa = "VENDA" | "ABATE" | "MORTE" | "DOACAO" | "EXTRAVIO" | "CADASTRO_INDEVIDO";
export type ClasseMotivoBaixa = "DESCARTE_VOLUNTARIO" | "DESCARTE_INVOLUNTARIO" | "MORTE";
export type PeriodoGmd = 30 | 90 | 180 | 365 | "entrada";
export type TipoPesagem = "NASCIMENTO" | "ENTRADA" | "DESMAMA" | "ROTINA" | "SAIDA";
export type OrigemPesagem = "MANUAL" | "BALANCA";

export type PropriedadeRef = { id: number; nome: string };
export type LoteRef = { id: string; nome: string };

export type AnimalResumo = {
  id: string;
  brinco: string;
  nome: string | null;
  sexo: Sexo;
  /** categoria que vale hoje: manual aberta, se houver, senão a calculada pelas regras */
  categoria: CategoriaRef | null;
  categoriaOrigem: CategoriaOrigem;
  /** o que as regras dariam — difere de `categoria` quando há troca manual */
  categoriaCalculada: CategoriaRef | null;
  idadeMeses: number;
  /** true quando idade/categoria foram calculadas na data da baixa (animal baixado) em vez de hoje */
  idadeNaBaixa: boolean;
  dataNascimento: string;
  dataEntrada: string;
  origem: Origem;
  propriedade: PropriedadeRef | null;
  lote: LoteRef | null;
  aptidao: Aptidao | null;
  papelReprodutivo: PapelReprodutivo | null;
  composicaoRotulo: string;
  ultimoPeso: { kg: number; data: string } | null;
  situacao: Situacao;
  gmdRecente: number | null;
  noLocalDesde: string | null;
  baixa: { data: string; tipo: TipoBaixa } | null;
};

export type FracaoRaca = { sigla: string; fracao64: number };
/** Item da composição na ficha: traz o id e a situação da raça (inativa continua editável). */
export type ItemComposicaoFicha = FracaoRaca & { racaId: string; nome: string; racaAtiva: boolean };

export type HistoricoLocalizacao = {
  id: string;
  propriedade: PropriedadeRef | null;
  lote: LoteRef | null;
  desde: string;
  ate: string | null;
  motivo: string | null;
  /** movimentação (lote -> lote) que abriu esta linha; null quando a linha veio de cadastro/saída. */
  movimentacaoId: string | null;
};

export type HistoricoDestino = {
  id: string;
  aptidao: Aptidao;
  papelReprodutivo: PapelReprodutivo;
  desde: string;
  ate: string | null;
};

export type HistoricoPesagem = { id: string; data: string; pesoKg: number; tipo: string; origem: string; observacao: string | null };

/** Item de `historicoCategoriasManuais` na ficha — mais recente primeiro. */
export type HistoricoCategoriaManual = { id: string; categoria: CategoriaRef; desde: string; ate: string | null; motivo: string; motivoEncerramento: string | null };

export type BaixaAnimalResumo = {
  id: string;
  data: string;
  tipo: TipoBaixa;
  motivo: { nome: string; classe: ClasseMotivoBaixa } | null;
  observacao: string | null;
  estornadaEm: string | null;
  estornoMotivo: string | null;
};

/** Ficha completa do animal — é o que a API devolve em toda escrita sobre um
 *  animal (cadastrar, editar, movimentar, mudar destino, desfazer, baixa,
 *  estorno), não só em GET /animais/:id. */
export type AnimalFicha = AnimalResumo & {
  brincoEletronico: string | null;
  sisbov: string | null;
  nascimentoEstimado: boolean;
  partosAntesDaEntrada: number;
  observacao: string | null;
  composicao: ItemComposicaoFicha[];
  historicoLocalizacoes: HistoricoLocalizacao[];
  historicoDestinos: HistoricoDestino[];
  historicoPesagens: HistoricoPesagem[];
  /** trocas manuais de categoria, mais recente primeiro */
  historicoCategoriasManuais: HistoricoCategoriaManual[];
  baixa: BaixaAnimalResumo | null;
  peso: {
    ultimo: { kg: number; data: string } | null;
    gmdRecente: number | null;
    gmdDesdeEntrada: number | null;
    gmdPeriodo: { dias: number | null; valor: number | null; pesagens: number };
  };
  historicoBaixas: Array<{
    id: string;
    data: string;
    tipo: TipoBaixa;
    motivo: { nome: string; classe: ClasseMotivoBaixa } | null;
    observacao: string | null;
    estornadaEm: string | null;
    estornoMotivo: string | null;
    criadoPor: string | null;
  }>;
};

export type ComposicaoItemInput = { racaId: string; fracao64: number };
export type ItemComposicao = { racaId: string; sigla: string; nome: string; fracao64: number };

export type CadastrarAnimalInput = {
  brinco: string;
  nome?: string | null;
  brincoEletronico?: string | null;
  sisbov?: string | null;
  sexo: Sexo;
  dataNascimento: string;
  nascimentoEstimado?: boolean;
  origem: Origem;
  dataEntrada: string;
  partosAntesDaEntrada?: number;
  observacao?: string | null;
  propriedadeId: number;
  loteId?: string | null;
  aptidao: Aptidao;
  papelReprodutivo?: PapelReprodutivo;
  composicao?: ComposicaoItemInput[];
  pesoEntradaKg?: number | null;
};

/** PATCH /animais/:id — além dos dados fixos, aceita os campos de nascimento/
 *  entrada validados contra o histórico já existente (ver datas.calc.ts). */
export type EditarAnimalInput = Partial<{
  brinco: string;
  nome: string | null;
  brincoEletronico: string | null;
  sisbov: string | null;
  sexo: Sexo;
  dataNascimento: string;
  nascimentoEstimado: boolean;
  origem: Origem;
  dataEntrada: string;
  partosAntesDaEntrada: number;
  observacao: string | null;
}>;

export type SubstituirComposicaoInput = { itens: ComposicaoItemInput[] };

export type MovimentarInput = {
  animalIds: string[];
  propriedadeId: number;
  loteId?: string | null;
  data: string;
  motivo?: string | null;
};

export type MudarDestinoInput = {
  aptidao: Aptidao;
  papelReprodutivo?: PapelReprodutivo;
  data: string;
};

export type BaixaInput = {
  data: string;
  tipo: TipoBaixa;
  motivoId?: string | null;
  observacao?: string | null;
};

export type EstornoBaixaInput = { motivo: string };

export type PesagemInput = {
  data: string;
  pesoKg: number;
  tipo: TipoPesagem;
  origem?: OrigemPesagem;
  observacao?: string | null;
};

export type EditarPesagemInput = Partial<{
  data: string;
  pesoKg: number;
  tipo: TipoPesagem;
  origem: OrigemPesagem;
  observacao: string | null;
}>;

/** DTO devolvido por POST /animais/:id/pesagens e PATCH /pesagens/:id — o
 *  registro não traz `observacao` (a rota de registro não a devolve). */
export type Pesagem = {
  id: string;
  animalId: string;
  data: string;
  pesoKg: number;
  tipo: TipoPesagem;
  origem: OrigemPesagem;
  observacao?: string | null;
};

export type ListarFiltros = {
  propriedadeId?: number;
  loteId?: string;
  /** exclui da lista os animais cuja localização aberta está neste lote (ex.: "Trazer animais") */
  excluirLoteId?: string;
  categoriaId?: string;
  aptidao?: Aptidao;
  papelReprodutivo?: PapelReprodutivo;
  situacao?: Situacao | "TODOS";
  busca?: string;
  sexo?: "F" | "M";
  origem?: Origem;
  racaId?: string;
  idadeMinMeses?: number;
  idadeMaxMeses?: number;
  categoriaOrigem?: "MANUAL";
  semCategoria?: boolean;
  tipoBaixa?: TipoBaixa;
  baixaDe?: string;
  baixaAte?: string;
  ordenar?: "brinco" | "nascimento" | "entrada";
  direcao?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

/** Contagens do painel calculadas no servidor sobre todo o conjunto filtrado (não só a página). */
export type PainelServidor = {
  totalAtivos: number;
  /** `categoria` nulo = animais sem categoria (nenhuma regra casou); vem na ordem da configuração */
  porCategoria: Array<{ categoria: CategoriaRef | null; total: number }>;
  porSitio: Array<{ propriedadeId: number | null; nome: string; total: number }>;
  femeasAtivas: number;
  receptorasAtivas: number;
};

export type ListarResultado = { itens: AnimalResumo[]; total: number; painel: PainelServidor };

/** Entrada de GET /animais/:id/auditoria. */
export type EntradaAuditoria = {
  em: string;
  acao: string;
  entidade: string;
  usuarioNome: string | null;
  resumo: string;
  entidadeId: string;
  alteracoes: Array<{ campo: string; rotulo: string; antes: string | null; depois: string | null }>;
};

export type EntidadeCadastro = "Lote" | "Raca" | "MotivoBaixa" | "CategoriaAnimal";

export type Lote = {
  id: string;
  nome: string;
  propriedadeId: number;
  propriedade: PropriedadeRef;
  ativo: boolean;
  observacao: string | null;
  animaisAtivos: number;
};

export type ResumoLote = {
  ativos: number;
  porSexo: { F: number; M: number };
  porCategoria: Array<{ categoriaId: string | null; categoria: string; qtd: number }>;
  idadeMediaMeses: number | null;
  peso: { medioKg: number | null; minKg: number | null; maxKg: number | null; semPeso: number };
  gmd: { medio: number | null; comGmd: number; periodoDias: number | null };
};
export type CriarLoteInput = { nome: string; propriedadeId: number; observacao?: string | null };
export type EditarLoteInput = Partial<{ nome: string; ativo: boolean; observacao: string | null }>;

/** GET /lotes/:id/movimentacoes e GET /movimentacoes — histórico de movimentações entre
 *  lotes/sítios. Na vista de um lote (`/lotes/:id/movimentacoes`), `direcao` vem preenchida
 *  (entrou/saiu daquele lote); na lista geral sem filtro de lote, vem `null`. */
export type MovimentacaoResumo = {
  id: string;
  data: string;
  direcao: "ENTRADA" | "SAIDA" | null;
  /** animais desta movimentação que entraram no (ou saíram do) lote filtrado — igual a
   *  `quantidadeTotal` quando não há um lote no filtro */
  quantidade: number;
  /** total de animais da movimentação (pode incluir animais de outros lotes) */
  quantidadeTotal: number;
  /** lotes/sítios de onde os animais vieram (vazio se a origem não existe mais) */
  origens: string[];
  destino: { propriedade: PropriedadeRef; lote: LoteRef | null };
  motivo: string | null;
  criadoPor: string | null;
  criadoEm: string;
  desfeitaEm: string | null;
  desfeitaMotivo: string | null;
  podeDesfazer: boolean;
};
/** Nome usado antes de existir a listagem geral — mantido como alias para não reescrever
 *  quem já consumia o histórico de um lote específico. */
export type MovimentacaoDoLote = MovimentacaoResumo;
export type ListarMovimentacoesResultado = { itens: MovimentacaoResumo[]; total: number };

export type FiltrosMovimentacoes = {
  loteId?: string;
  propriedadeId?: number;
  dataDe?: string;
  dataAte?: string;
  animalId?: string;
  /** default true no servidor */
  incluirDesfeitas?: boolean;
  page?: number;
  pageSize?: number;
};

/** GET /movimentacoes/:id — animal mantido mesmo quando a movimentação foi desfeita. */
export type AnimalDaMovimentacao = {
  animalId: string;
  brinco: string;
  nome: string | null;
  categoria: CategoriaRef | null;
  /** lote/sítio de onde este animal veio, formatado (null se a origem não existe mais) */
  origem: string | null;
  /** NO_DESTINO: a linha aberta pela movimentação ainda é a atual · SAIU_DO_DESTINO: moveu de
   *  novo ou saiu do rebanho · DESFEITO: esta movimentação foi desfeita */
  situacao: "NO_DESTINO" | "SAIU_DO_DESTINO" | "DESFEITO";
  desfeitoEm: string | null;
};

export type MovimentacaoDetalhe = MovimentacaoResumo & { animais: AnimalDaMovimentacao[] };

export type Raca = { id: string; nome: string; sigla: string; base: boolean; ativo: boolean; animaisAtivos: number };
export type CriarRacaInput = { nome: string; sigla: string; base?: boolean };
export type EditarRacaInput = Partial<{ nome: string; sigla: string; base: boolean; ativo: boolean }>;

export type MotivoBaixa = { id: string; nome: string; classe: ClasseMotivoBaixa; ativo: boolean; baixasValendo: number };
export type CriarMotivoBaixaInput = { nome: string; classe: ClasseMotivoBaixa };
export type EditarMotivoBaixaInput = Partial<{ nome: string; classe: ClasseMotivoBaixa; ativo: boolean }>;

export type Propriedade = { id: number; nome: string; apelido: string | null };

/** GET /pecuaria/rebanho/catalogos — listas leves (só ativos) para preencher
 *  selects; não confundir com as listagens de cadastro (Raca/MotivoBaixa/Lote
 *  acima), que trazem `ativo` e servem à tela de Cadastros. */
export type CatalogoRaca = { id: string; nome: string; sigla: string; base: boolean };
export type CatalogoMotivoBaixa = { id: string; nome: string; classe: ClasseMotivoBaixa };
export type CatalogoLote = { id: string; nome: string; propriedadeId: number };
export type Catalogos = {
  racas: CatalogoRaca[];
  motivosBaixa: CatalogoMotivoBaixa[];
  propriedades: Propriedade[];
  lotes: CatalogoLote[];
};

/** GET /pecuaria/rebanho/painel — números da Visão geral. */
export type EventoPainel = { tipo: "CADASTRO" | "BAIXA" | "ESTORNO"; animalId: string; brinco: string; data: string };
export type PainelGeral = {
  ativos: number;
  /** `categoriaId` nulo = "Sem categoria" */
  porCategoria: Array<{ categoriaId: string | null; categoria: string; qtd: number }>;
  porSitio: Array<{ propriedadeId: number | null; nome: string; qtd: number }>;
  receptorasPct: number;
  baixas30d: number;
  ultimosEventos: EventoPainel[];
  baixasPorTipo: Array<{ tipo: TipoBaixa; qtd: number }>;
  baixasPorClasse: Array<{ classe: ClasseMotivoBaixa | "SEM_MOTIVO"; qtd: number }>;
  periodoDias: number;
};

// ---------- categorias configuráveis (Cadastros > Categorias) ----------

export type CriterioPartos = "QUALQUER" | "SEM" | "COM";

/** GET /categorias — regra de cálculo + metadados de cadastro. */
export type CategoriaDTO = {
  id: string;
  nome: string;
  sexo: Sexo;
  /** false = só atribuída manualmente (sem regra) */
  automatica: boolean;
  ativo: boolean;
  ordem: number;
  idadeMinMeses: number | null;
  /** exclusivo: idade < idadeMaxMeses */
  idadeMaxMeses: number | null;
  partos: CriterioPartos;
  ideagriId: number | null;
  /** veio dos padrões de fábrica (IDEAGRI) */
  padrao: boolean;
  /** texto curto PT-BR, ex. "12 meses ou mais · sem parto", "só manual" */
  regra: string;
  animaisAtivos: number;
  manuaisAbertas: number;
};
export type ListarCategoriasResultado = { itens: CategoriaDTO[]; semCategoria: number };

export type CriarCategoriaInput = {
  nome: string;
  sexo: Sexo;
  automatica?: boolean;
  idadeMinMeses?: number | null;
  idadeMaxMeses?: number | null;
  partos?: CriterioPartos;
  ordem?: number;
};
export type EditarCategoriaInput = Partial<{
  nome: string;
  sexo: Sexo;
  automatica: boolean;
  idadeMinMeses: number | null;
  idadeMaxMeses: number | null;
  partos: CriterioPartos;
  ordem: number;
  ativo: boolean;
}>;

/** Uma regra na simulação: a lista inteira como ficaria (id ausente = categoria nova). */
export type RegraCategoriaProposta = {
  id?: string;
  nome: string;
  sexo: Sexo;
  automatica: boolean;
  ativo: boolean;
  ordem: number;
  idadeMinMeses?: number | null;
  idadeMaxMeses?: number | null;
  partos: CriterioPartos;
};

export type ResultadoSimulacaoCategorias = {
  afetados: number;
  mudancas: Array<{ de: CategoriaRef | null; para: CategoriaRef | null; total: number }>;
  semCategoria: number;
};

export type DefinirCategoriaManualInput = { categoriaId: string; data: string; motivo: string };
export type RemoverCategoriaManualInput = { motivo: string };

