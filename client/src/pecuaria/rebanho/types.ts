// Tipos que espelham os DTOs de server/src/services/pecuaria/rebanho/{mappers,schemas,animais,lotes,racas,motivos,painel}.ts.
// Não inventar campos aqui sem conferir o contrato do backend primeiro.

export type Sexo = "F" | "M";
export type Categoria = "BEZERRA" | "NOVILHA" | "VACA" | "BEZERRO" | "GARROTE" | "TOURO";
export type Aptidao = "LEITE" | "CORTE";
export type PapelReprodutivo = "NENHUM" | "RECEPTORA" | "DOADORA";
export type Origem = "NASCIDO" | "COMPRADO";
export type Situacao = "ATIVO" | "SAIU";
export type TipoSaida = "VENDA" | "ABATE" | "MORTE" | "DOACAO" | "CADASTRO_INDEVIDO" | "OUTRO";
export type TipoPesagem = "NASCIMENTO" | "ENTRADA" | "DESMAMA" | "ROTINA" | "SAIDA";
export type OrigemPesagem = "MANUAL" | "BALANCA";

export type PropriedadeRef = { id: number; nome: string };
export type LoteRef = { id: string; nome: string };

export type AnimalResumo = {
  id: string;
  brinco: string;
  nome: string | null;
  sexo: Sexo;
  categoria: Categoria;
  idadeMeses: number;
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
};

export type HistoricoDestino = {
  id: string;
  aptidao: Aptidao;
  papelReprodutivo: PapelReprodutivo;
  desde: string;
  ate: string | null;
};

export type HistoricoPesagem = { id: string; data: string; pesoKg: number; tipo: string; origem: string };

export type SaidaAnimalResumo = {
  id: string;
  data: string;
  tipo: string;
  motivo: string | null;
  observacao: string | null;
  estornadaEm: string | null;
  estornoMotivo: string | null;
};

/** Ficha completa do animal — é o que a API devolve em toda escrita sobre um
 *  animal (cadastrar, editar, movimentar, mudar destino, desfazer, saída,
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
  saida: SaidaAnimalResumo | null;
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

export type SaidaInput = {
  data: string;
  tipo: TipoSaida;
  motivoId?: string | null;
  observacao?: string | null;
};

export type EstornoSaidaInput = { motivo: string };

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
  categoria?: Categoria;
  aptidao?: Aptidao;
  papelReprodutivo?: PapelReprodutivo;
  situacao?: Situacao | "TODOS";
  busca?: string;
  page?: number;
  pageSize?: number;
};

/** Contagens do painel calculadas no servidor sobre todo o conjunto filtrado (não só a página). */
export type PainelServidor = {
  totalAtivos: number;
  porCategoria: Array<{ categoria: Categoria; total: number }>;
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
};

export type Lote = {
  id: string;
  nome: string;
  propriedadeId: number;
  propriedade: PropriedadeRef;
  ativo: boolean;
  observacao: string | null;
  animaisAtivos: number;
};
export type CriarLoteInput = { nome: string; propriedadeId: number; observacao?: string | null };
export type EditarLoteInput = Partial<{ nome: string; ativo: boolean; observacao: string | null }>;

export type Raca = { id: string; nome: string; sigla: string; base: boolean; ativo: boolean };
export type CriarRacaInput = { nome: string; sigla: string; base?: boolean };
export type EditarRacaInput = Partial<{ nome: string; sigla: string; base: boolean; ativo: boolean }>;

export type MotivoSaida = { id: string; nome: string; tipo: TipoSaida; ativo: boolean };
export type CriarMotivoSaidaInput = { nome: string; tipo: TipoSaida };
export type EditarMotivoSaidaInput = Partial<{ nome: string; tipo: TipoSaida; ativo: boolean }>;

export type Propriedade = { id: number; nome: string; apelido: string | null };

/** GET /pecuaria/rebanho/catalogos — listas leves (só ativos) para preencher
 *  selects; não confundir com as listagens de cadastro (Raca/MotivoSaida/Lote
 *  acima), que trazem `ativo` e servem à tela de Cadastros. */
export type CatalogoRaca = { id: string; nome: string; sigla: string; base: boolean };
export type CatalogoMotivoSaida = { id: string; nome: string; tipo: TipoSaida };
export type CatalogoLote = { id: string; nome: string; propriedadeId: number };
export type Catalogos = {
  racas: CatalogoRaca[];
  motivosSaida: CatalogoMotivoSaida[];
  propriedades: Propriedade[];
  lotes: CatalogoLote[];
};

/** GET /pecuaria/rebanho/painel — números da Visão geral. */
export type EventoPainel = { tipo: "CADASTRO" | "SAIDA" | "ESTORNO"; animalId: string; brinco: string; data: string };
export type PainelGeral = {
  ativos: number;
  porCategoria: Array<{ categoria: Categoria; qtd: number }>;
  porSitio: Array<{ propriedadeId: number | null; nome: string; qtd: number }>;
  receptorasPct: number;
  saidas30d: number;
  ultimosEventos: EventoPainel[];
};

