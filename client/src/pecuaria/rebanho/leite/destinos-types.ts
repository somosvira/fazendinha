export type NaturezaDestinoLeite =
  | "COLOSTRO"
  | "LEITE_COMUM"
  | "LEITE_NAO_COMERCIAL";
export interface OrigemDestinoLeite {
  nomeOrdenha?: string | null;
  natureza?: "NAO_INFORMADA" | "COMERCIAL" | "COLOSTRO" | "NAO_COMERCIAL";
  classificacaoId?: string | null;
  entradaId: string;
  sessaoId: string;
  produtoId: string;
  data: string;
  quantidadeDisponivelLitros: number;
}
export interface DestinoLeiteDTO {
  id: string;
  propriedadeId: number;
  entradaId: string;
  sessaoId: string;
  produtoId: string;
  movimentoId: string;
  data: string;
  natureza: string;
  declaracaoOrigem: string;
  quantidadeLitros: number;
  saldoOrigemAntes: number;
  saldoOrigemDepois: number;
  responsavel: string | null;
  observacao: string | null;
  status: string;
  versao: number;
  criadoEm: string;
  criadoPorId: number | null;
  estornadoEm: string | null;
  motivoEstorno: string | null;
  movimentoEstornoId: string | null;
  parcelas: {
    id: string;
    animalId: string;
    brinco: string;
    nome: string | null;
    quantidadeLitros: number;
    fornecimentoColostroId: string | null;
    criaId: string | null;
    criadoNoDestino: boolean;
    ativo: boolean;
  }[];
}
export interface CandidatoDestinoLeite {
  animalId: string;
  brinco: string;
  nome: string | null;
  criaId?: string | null;
  fornecimentos?: {
    id: string;
    data: string;
    quantidadeLitros: number | null;
  }[];
}
export interface CandidatosDestinos {
  itens: CandidatoDestinoLeite[];
  total: number;
  pagina: number;
  porPagina: number;
}
export interface ParcelaDestinoDraft {
  animalId: string;
  brinco: string;
  nome: string | null;
  litros: string;
  criaId?: string;
  fornecimentoColostroId?: string;
  fornecimentos?: {
    id: string;
    data: string;
    quantidadeLitros: number | null;
  }[];
}
export const nomeNaturezaDestino = (natureza: string) =>
  natureza === "COLOSTRO"
    ? "Colostro"
    : natureza === "LEITE_NAO_COMERCIAL"
      ? "Leite não comercial"
      : "Leite comum";
export function somarParcelasDestino(
  parcelas: readonly ParcelaDestinoDraft[],
  saldo: number | null,
) {
  let mililitros = 0;
  let validas = parcelas.length > 0;
  for (const p of parcelas) {
    if (!/^\d+(?:[.,]\d{1,3})?$/.test(p.litros.trim())) {
      validas = false;
      continue;
    }
    const litros = Number(p.litros.replace(",", "."));
    if (litros <= 0 || litros > 9999999.999) {
      validas = false;
      continue;
    }
    mililitros += Math.round(litros * 1000);
  }
  const total = mililitros / 1000;
  return {
    total,
    validas,
    remanescente:
      saldo === null ? null : Math.round((saldo - total) * 1000) / 1000,
    excedeu: saldo !== null && mililitros > Math.round(saldo * 1000),
  };
}
