/* Explicações simples das opções com jargão dos formulários do café
 * (mostradas só na lista aberta do RebSelect). Fontes: comentários de
 * ../types, indicadores de ../domains (pH < 5,2 → calagem; limiar MIP),
 * rótulos e placeholders dos formulários e o mock de eventos/talhões
 * (recepa → talhão em formação; desbrota seleciona hastes). */
import type { TipoOperacao } from "../types";

export const EXPLICACAO_OPERACAO: Partial<Record<TipoOperacao, string>> = {
  ADUBACAO_SOLO: "Adubo aplicado no chão, dividido em várias vezes.",
  ADUBACAO_FOLIAR: "Adubo aplicado direto nas folhas, geralmente micronutrientes.",
  CALAGEM: "Calcário no solo para corrigir a acidez (pH baixo).",
  GESSAGEM: "Aplicação de gesso agrícola no solo.",
  APLICACAO_FUNGICIDA: "Produto contra doenças, como a ferrugem.",
  APLICACAO_INSETICIDA: "Produto contra insetos, como o bicho-mineiro e a broca.",
  APLICACAO_HERBICIDA: "Produto para controlar o mato.",
  ROCAGEM_MECANICA: "Corte do mato com roçadeira.",
  CAPINA_MANUAL: "Retirada do mato na enxada.",
  PODA_RECEPA: "Corte baixo do pé para renovar; o talhão fica em formação e produz menos por um tempo.",
  PODA_DECOTE: "Corte do topo da planta, deixando entre 1,80 e 2,40 m.",
  PODA_ESQUELETAMENTO: "Poda feita depois da colheita (jun/jul).",
  DESBROTA: "Retirada dos brotos a mais, deixando só as hastes escolhidas (ex.: 2 por planta).",
  REPLANTIO: "Plantio de mudas onde há falhas no talhão.",
  AMOSTRAGEM_SOLO: "Coleta de terra para análise do solo (ex.: pH).",
  AMOSTRAGEM_FOLIAR: "Coleta de folhas para analisar os nutrientes da planta.",
  MONITORAMENTO_MIP: "Vistoria de folhas e frutos para medir pragas e doenças antes de decidir aplicar.",
};

export const EXPLICACAO_METODO_COLHEITA: Record<"DERRIÇA_PANO" | "DERRIÇA_MECANIZADA" | "SELETIVA" | "VARRIÇÃO", string> = {
  "DERRIÇA_PANO": "Derriça à mão, com os grãos caindo em panos estendidos.",
  "DERRIÇA_MECANIZADA": "Derriça feita por máquina.",
  SELETIVA: "Colhe só os frutos escolhidos, à mão.",
  "VARRIÇÃO": "Recolhe o café que caiu no chão.",
};
