import type { EntradaAuditoria } from "../types";

const ENTIDADES: Record<string, string> = {
  OcorrenciaSanitaria: "Ocorrência sanitária", ExameAnimal: "Exame", AplicacaoProduto: "Aplicação sanitária",
  ExecucaoProtocoloSanitario: "Participação em protocolo", RodadaProtocoloSanitario: "Ciclo sanitário", Pesagem: "Pesagem",
  ManejoAnimal: "Manejo", Animal: "Animal", DestinoAnimal: "Finalidade do animal", CategoriaManualAnimal: "Categoria manual",
};
const ACOES: Record<string, string> = {
  REGISTRO: "registro", REGISTRO_COLETIVO: "registro coletivo", ENCERRAMENTO: "encerramento", INCLUSAO_RODADA: "inclusão no ciclo",
  INICIO: "início", CORRECAO: "correção", ANULACAO: "anulação", ESTORNO: "estorno", REMOCAO_RODADA: "saída do ciclo",
};

/** Traduz somente o resumo técnico padrão; textos específicos do servidor permanecem intactos. */
export function resumoAuditoriaLegivel(entrada: Pick<EntradaAuditoria, "resumo" | "entidade" | "acao">): string {
  if (entrada.resumo !== `${entrada.entidade} — ${entrada.acao}`) return entrada.resumo;
  const entidade = ENTIDADES[entrada.entidade];
  const acao = ACOES[entrada.acao];
  return entidade && acao ? `${entidade} — ${acao}` : entrada.resumo;
}
