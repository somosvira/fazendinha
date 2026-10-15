import { diaIatf, serializarDataIatf, type PrecisaoIatf } from "./horarios.calc.js";
import { hashDados } from "./operacoes.js";
export type JanelaPlanner = "DIA" | "ANTERIOR" | "FUTURA" | "SEM_PREVISAO";
export function janelaPlanner(previstaPara: Date, precisao: PrecisaoIatf, previsaoPendente: boolean, data: string): JanelaPlanner {
  if (previsaoPendente) return "SEM_PREVISAO";
  const prevista = diaIatf(previstaPara, precisao);
  return prevista === data ? "DIA" : prevista < data ? "ANTERIOR" : "FUTURA";
}
export function identidadeGrupoProtocolo(t: { protocoloId: string; versao: number; tipo: string; programacaoId: string | null; participacaoId: string; etapaId: string; previstaPara: Date; precisaoTemporal: PrecisaoIatf; previsaoPendente: boolean }) {
  return hashDados({ protocoloId: t.protocoloId, versao: t.versao, tipo: t.tipo,
    turma: t.programacaoId ?? t.participacaoId, etapaId: t.etapaId,
    previstaPara: t.previsaoPendente ? null : serializarDataIatf(t.previstaPara, t.precisaoTemporal),
    precisaoTemporal: t.precisaoTemporal, previsaoPendente: t.previsaoPendente });
}
/** O fingerprint pertence ao conjunto completo e ordenado, nunca à página exibida. */
export function fingerprintGrupoPlanner(grupo: unknown, propriedadeId: number, data: string, membros: unknown[]) {
  return hashDados({ versao: 1, grupo, propriedadeId, data, membros });
}
export function paginarPlanner<T>(itens: T[], pagina: number, tamanhoPagina: number) {
  return itens.slice((pagina - 1) * tamanhoPagina, pagina * tamanhoPagina);
}
