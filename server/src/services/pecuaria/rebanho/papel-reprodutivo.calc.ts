import type { PapelReprodutivo } from "@prisma/client";

export type EvidenciaPapel = {
  id: string; tipo: string; inicio: Date; fim: Date | null; revogadoEm?: Date | null;
};
export type PapelNaData = {
  papel: PapelReprodutivo | null;
  estado: "CONHECIDO" | "DESCONHECIDO" | "CONFLITO";
  evidencias: string[];
};

/** Períodos usam limites [início, fim). Ausência e conflito nunca viram NENHUM. */
export function resolverPapelReprodutivo(periodos: ReadonlyArray<EvidenciaPapel>, data: Date, retratoNaBaixa = false): PapelNaData {
  let vigentes = periodos.filter(p => !p.revogadoEm && p.inicio <= data && (!p.fim || p.fim > data));
  // A baixa conserva o retrato do destino que ela própria fechou nesse dia.
  if (retratoNaBaixa && !vigentes.length) vigentes = periodos.filter(p => !p.revogadoEm && p.inicio <= data && p.fim?.getTime() === data.getTime());
  const tipos = [...new Set(vigentes.map(p => p.tipo))];
  const papel = tipos.length === 1 && ["NENHUM", "DOADORA", "RECEPTORA"].includes(tipos[0]) ? tipos[0] as PapelReprodutivo : null;
  return { papel, estado: papel ? "CONHECIDO" : tipos.length ? "CONFLITO" : "DESCONHECIDO", evidencias: vigentes.map(p => p.id).sort() };
}
