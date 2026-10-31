import type { EntradaAuditoria } from "../types";

export function entidadeHistorico(entidade: string) {
  return entidade === "DestinoAnimal" ? "FinalidadeAnimal" : entidade;
}
export function identidadeHistorico(entidade: string, id: string) {
  return `${entidadeHistorico(entidade)}:${id}`;
}
/** Datas do domínio são dias civis, inclusive quando o transporte contém UTC. */
export function diasCivisEntre(data: string, agora = new Date()): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  if (!partes) return null;
  const [, ano, mes, dia] = partes;
  const fato = Date.UTC(Number(ano), Number(mes) - 1, Number(dia));
  const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((hoje - fato) / 86_400_000);
}
export function dataRelativaFato(data: string, agora = new Date()): string {
  const dias = diasCivisEntre(data, agora);
  if (dias == null) return "Data não informada";
  if (!dias) return "Hoje";
  if (dias === 1) return "Há 1 dia";
  if (dias < 0) return -dias === 1 ? "Em 1 dia" : `Em ${-dias} dias`;
  return `Há ${dias} dias`;
}
/** Somente ações de constituição do fato podem compartilhar sua linha. */
export function auditoriaConstituiFato(entrada: Pick<EntradaAuditoria, "acao">): boolean {
  return ["CADASTRO", "CRIACAO", "REGISTRO", "REGISTRO_MANEJO", "MOVIMENTACAO", "MUDANCA_DESTINO", "PAPEL_REGISTRADO", "COLETA"].includes(entrada.acao);
}
/** O fim explícito do período anterior precisa coincidir com o novo início. */
export function anteriorContiguo<T extends { id: string; ate: string | null }>(itens: T[], atual: { id: string; desde: string }): T | undefined {
  const candidatos = itens.filter(item => item.id !== atual.id && item.ate != null && item.ate.slice(0, 10) === atual.desde.slice(0, 10));
  return candidatos.length === 1 ? candidatos[0] : undefined;
}
export function resumoTransicao(anterior: string | null | undefined, atual: string, primeira: boolean): string {
  return anterior ? `${anterior} → ${atual}` : primeira ? atual : `Anterior não informado → ${atual}`;
}
