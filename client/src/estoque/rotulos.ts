import type { OrigemMovimento } from "./api";

export const ROTULO_ORIGEM: Record<OrigemMovimento, string> = {
  COMPRA: "Compra", CONSUMO_DIRETO: "Consumo direto", TRANSFERENCIA: "Transferência", PRODUCAO: "Produção própria", DEVOLUCAO: "Devolução",
  BONIFICACAO: "Bonificação", INVENTARIO_INICIAL: "Inventário inicial", PERDA: "Perda",
  AJUSTE_INVENTARIO: "Ajuste de estoque", APLICACAO: "Aplicação agrícola",
  SANIDADE: "Aplicação sanitária", NUTRICAO: "Consumo nutricional", IDENTIFICACAO_PARTIDA: "Identificação de lote",
};
