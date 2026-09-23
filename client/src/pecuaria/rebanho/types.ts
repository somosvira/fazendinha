// Tipos que espelham os DTOs de server/src/services/pecuaria/rebanho/{mappers,schemas}.ts.
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

export type AnimalFicha = AnimalResumo & {
  brincoEletronico: string | null;
  sisbov: string | null;
  nascimentoEstimado: boolean;
  partosAntesDaEntrada: number;
  observacao: string | null;
  composicao: FracaoRaca[];
  historicoLocalizacoes: Array<{
    id: string;
    propriedade: PropriedadeRef | null;
    lote: LoteRef | null;
    desde: string;
    ate: string | null;
    motivo: string | null;
  }>;
  historicoDestinos: Array<{
    id: string;
    aptidao: Aptidao;
    papelReprodutivo: PapelReprodutivo;
    desde: string;
    ate: string | null;
  }>;
  historicoPesagens: Array<{ id: string; data: string; pesoKg: number; tipo: string; origem: string }>;
  saida: {
    id: string;
    data: string;
    tipo: string;
    motivo: string | null;
    observacao: string | null;
    estornadaEm: string | null;
    estornoMotivo: string | null;
  } | null;
};

export type ComposicaoItemInput = { racaId: string; fracao64: number };

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

export type EditarAnimalInput = Partial<{
  brinco: string;
  nome: string | null;
  brincoEletronico: string | null;
  sisbov: string | null;
  nascimentoEstimado: boolean;
  observacao: string | null;
}>;

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

export type Lote = { id: string; nome: string; propriedadeId: number; ativo: boolean; observacao: string | null };
export type CriarLoteInput = { nome: string; propriedadeId: number; observacao?: string | null };
export type EditarLoteInput = Partial<{ nome: string; ativo: boolean; observacao: string | null }>;

export type Raca = { id: string; nome: string; sigla: string; base: boolean };
export type MotivoSaida = { id: string; nome: string; tipo: string };
export type Propriedade = { id: number; nome: string; apelido: string | null };
export type Catalogos = { racas: Raca[]; motivosSaida: MotivoSaida[]; propriedades: Propriedade[] };

export const CODIGOS_ERRO_AMIGAVEIS: Record<string, string> = {
  BRINCO_DUPLICADO: "Já existe um animal ativo com esse brinco neste sítio.",
  BRINCO_ELETRONICO_DUPLICADO: "Já existe um animal com esse brinco eletrônico.",
  SISBOV_DUPLICADO: "Já existe um animal com esse SISBOV.",
  JA_SAIU: "Este animal já teve saída registrada.",
  JA_REVERTIDO: "Esta saída já foi estornada.",
  NAO_ENCONTRADO: "Registro não encontrado.",
  VALIDACAO: "Confira os dados informados.",
};
