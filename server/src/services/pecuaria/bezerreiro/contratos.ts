import type { Prisma } from "@prisma/client";

/** O transporte usa decimais textuais; cálculos e persistência usam Prisma.Decimal. */
export type DecimalBezerreiro = string | number | Prisma.Decimal;
export type DataCivilBezerreiro = string;
export type ComandoBezerreiro = { chave: string; versaoEsperada?: number };
export type AutoriaBezerreiro = { usuarioId: number | null; propriedadeId: number };
export interface OfertaProgramadaEntrada {
  identidadeId: string;
  ordem: number;
  percentual: DecimalBezerreiro;
  horarioPrevisto?: string | null;
}
export interface ConfiguracaoBezerreiroEntrada extends ComandoBezerreiro {
  propriedadeId: number;
  brixReferencia: DecimalBezerreiro;
  percentualPesoColostro: DecimalBezerreiro;
  imunidade?: Prisma.InputJsonValue | null;
}
export interface FaseBezerreiroEntrada extends ComandoBezerreiro {
  propriedadeId: number;
  identidadeId?: string;
  nome: string;
  coleiraId?: string | null;
  litrosDia: DecimalBezerreiro;
  publicada?: boolean;
  criteriosTransicao?: Prisma.InputJsonValue | null;
  ofertas: OfertaProgramadaEntrada[];
}
export interface GrupoOfertaBezerreiroEntrada {
  coleiraId?: string | null;
  quantidadeLitros: DecimalBezerreiro;
  consumoAdicional?: boolean;
  justificativa?: string | null;
  entradaIds?: string[];
}
export interface ConfirmarOfertaBezerreiroEntrada extends ComandoBezerreiro {
  contextoToken: string;
  perfilId: string;
  data: DataCivilBezerreiro;
  ocorridoEm?: string | null;
  horarioEstimado?: boolean;
  ofertaProgramadaId?: string | null;
  responsavel?: string | null;
  observacao?: string | null;
  grupos: GrupoOfertaBezerreiroEntrada[];
}
export interface RetiradaColostroEntrada extends ComandoBezerreiro {
  propriedadeId: number;
  partoId: string;
  data: DataCivilBezerreiro;
  ocorridoEm?: string | null;
  horarioEstimado?: boolean;
  primeiraRetirada: boolean;
  quantidadeLitros: DecimalBezerreiro;
  medicaoGeralId?: string | null;
  entradaId?: string | null;
  origemFisicaSnapshot: Prisma.InputJsonValue;
  responsavel?: string | null;
  observacao?: string | null;
}
export interface AlocacaoColostroEntrada {
  origemId: string;
  unidadeId?: string | null;
  quantidadeLitros: DecimalBezerreiro;
}
export interface InsumoPreparoColostroEntrada {
  produtoId: string;
  partidaId?: string | null;
  quantidade: DecimalBezerreiro;
  unidade: string;
}
export interface PreparoColostroEntrada extends ComandoBezerreiro {
  propriedadeId: number;
  data: DataCivilBezerreiro;
  ocorridoEm?: string | null;
  volumeFinalLitros: DecimalBezerreiro;
  responsavel: string;
  observacao?: string | null;
  origens: AlocacaoColostroEntrada[];
  insumos: InsumoPreparoColostroEntrada[];
}
export interface DestinacaoColostroEntrada extends ComandoBezerreiro {
  propriedadeId: number;
  data: DataCivilBezerreiro;
  ocorridoEm?: string | null;
  horarioEstimado?: boolean;
  fornecimentos: Array<{
    criaId: string;
    alocacoes: AlocacaoColostroEntrada[];
    responsavel: string;
    motivoExcecao?: string | null;
    observacao?: string | null;
  }>;
  unidades: Array<{ origemId: string; codigo: string }>;
}
export interface PaginaBezerreiro<T> { itens: T[]; total: number; pagina: number; porPagina: number }
export type SituacaoCustoBezerreiro = "APURADO" | "PARCIAL" | "A_APURAR" | "OCULTO";
export interface CustoBezerreiroDTO { valorTotal: string | null; situacao: SituacaoCustoBezerreiro }
