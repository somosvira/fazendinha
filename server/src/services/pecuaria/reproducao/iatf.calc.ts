import { Prisma } from "@prisma/client";
import type { EtapaIatf } from "./schemas.js";
export type SnapshotIatf = {
  versao: 1;
  etapa: EtapaIatf;
  referencias: Record<string, unknown>;
  previstaEm: string;
  previsaoOriginal: string;
  inicioReferencia: string;
};
export type DiferencaIatf = {
  campo: string;
  planejado: unknown;
  realizado: unknown;
};
const decimal = (v: unknown) => {
  if (v === null || v === undefined) return null;
  try {
    return new Prisma.Decimal(String(v)).toString();
  } catch {
    return String(v);
  }
};
const texto = (v: unknown) =>
  typeof v === "string" ? v.trim() || null : (v ?? null);
/** Compara parâmetros declarados. Tipo de avaliação identifica o procedimento,
 * sem prever um resultado clínico positivo ou negativo. Ausência de plano não é conformidade. */
export function compararExecucaoIatf(
  plano: SnapshotIatf | null,
  realizadaEm: string,
  dados: Record<string, unknown>,
): { aferido: boolean; diferencas: DiferencaIatf[] } {
  if (!plano) return { aferido: false, diferencas: [] };
  const diferencas: DiferencaIatf[] = [];
  const comparar = (campo: string, planejado: unknown, realizado: unknown) => {
    if (JSON.stringify(planejado) !== JSON.stringify(realizado))
      diferencas.push({ campo, planejado, realizado });
  };
  comparar(
    "dataHora",
    new Date(plano.previstaEm).toISOString(),
    new Date(realizadaEm).toISOString(),
  );
  const e = plano.etapa;
  if (e.tipo === "APLICACAO" && e.planoAplicacao) {
    comparar("produtoId", e.planoAplicacao.produtoId, dados.produtoId ?? null);
    comparar("dose", decimal(e.planoAplicacao.dose), decimal(dados.dose));
    comparar(
      "unidadeDose",
      e.planoAplicacao.unidadeDose,
      dados.unidadeDose ?? null,
    );
    comparar("via", texto(e.planoAplicacao.via), texto(dados.via));
  }
  if (e.tipo === "TENTATIVA" && e.planoTentativa) {
    comparar("tipoTentativa", e.planoTentativa.tipo, dados.tipo ?? null);
    comparar(
      "materialId",
      e.planoTentativa.materialId,
      dados.materialId ?? null,
    );
    comparar(
      "quantidade",
      decimal(e.planoTentativa.quantidade),
      decimal(dados.quantidade),
    );
  }
  if (e.tipo === "AVALIACAO" && e.planoAvaliacao) {
    const tipo = ["SEXAGEM", "RECONFIRMACAO"].includes(String(dados.resultado))
      ? dados.resultado
      : "DIAGNOSTICO";
    comparar("tipoAvaliacao", e.planoAvaliacao.tipo, tipo);
  }
  const aferido =
    (e.tipo !== "APLICACAO" || !!e.planoAplicacao) &&
    (e.tipo !== "TENTATIVA" || !!e.planoTentativa) &&
    (e.tipo !== "AVALIACAO" || !!e.planoAvaliacao);
  return { aferido, diferencas };
}
export function snapshotIatf(
  etapa: EtapaIatf,
  referencias: Record<string, unknown>,
  previstaEm: Date,
  previsaoOriginal: Date,
  inicioReferencia: Date,
): SnapshotIatf {
  return {
    versao: 1,
    etapa,
    referencias,
    previstaEm: previstaEm.toISOString(),
    previsaoOriginal: previsaoOriginal.toISOString(),
    inicioReferencia: inicioReferencia.toISOString(),
  };
}
