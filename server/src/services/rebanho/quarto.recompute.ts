// Fonte real em packages/shared (compartilhado com o patch otimista offline
// de useSaudeUbere no client); re-export pra quem já importa daqui não precisar mudar.
export {
  recomputarQuartos, CCS_POSITIVO, JANELA_MESES, DIAS_ATIVO,
  type Quarto, type ScoreCmt, type EstadoQuarto, type ExameQuartoIn, type EstadoPorQuarto, type ResumoQuartos,
} from "@rionovo/shared";
