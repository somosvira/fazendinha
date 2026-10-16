import { lerDataIatf, diaIatf, serializarDataIatf, type PrecisaoIatf } from "./horarios.calc.js";
import { Prisma } from "@prisma/client";
import type { EtapaIatf } from "./schemas.js";
import { compararParametros, type DiferencaExecucao } from "../desvios.calc.js";
export type SnapshotIatf = {
  versao: 1;
  precisaoTemporal?: PrecisaoIatf;
  previsaoPendente?: boolean;
  etapa: EtapaIatf;
  referencias: Record<string, unknown>;
  previstaEm: string;
  previsaoOriginal: string;
  inicioReferencia: string;
};
export type DiferencaIatf = DiferencaExecucao;
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
): { aferido: boolean; diferencas: DiferencaIatf[]; horarioAferido?: boolean } {
  if (!plano) return { aferido: false, diferencas: [] };
  const planejado: Record<string, unknown> = {};
  const realizado: Record<string, unknown> = {};
  const comparar = (campo: string, esperado: unknown, atual: unknown) => {
    planejado[campo] = esperado;
    realizado[campo] = atual;
  };
  const execucao = lerDataIatf(realizadaEm);
  const precisaoPlano = plano.precisaoTemporal ?? "HORA";
  const horarioAferido = !plano.previsaoPendente && precisaoPlano === "HORA" && execucao.precisao === "HORA";
  if (!plano.previsaoPendente) comparar(horarioAferido ? "dataHora" : "data",
    horarioAferido ? new Date(plano.previstaEm).toISOString() : diaIatf(new Date(plano.previstaEm), precisaoPlano),
    horarioAferido ? execucao.instante.toISOString() : execucao.data);
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
    const tipo = dados.finalidade ?? (["SEXAGEM", "RECONFIRMACAO"].includes(String(dados.resultado))
      ? dados.resultado
      : "DIAGNOSTICO");
    comparar("tipoAvaliacao", e.planoAvaliacao.tipo, tipo);
    if (e.planoAvaliacao.tipoExameId) comparar("tipoExameId", e.planoAvaliacao.tipoExameId, dados.tipoExameId ?? null);
  }
  if (e.tipo === "EXAME" && e.planoExame) comparar("tipoExameId", e.planoExame.tipoExameId, dados.tipoExameId ?? null);
  const aferido =
    (e.tipo !== "EXAME" || !!e.planoExame) &&
    (e.tipo !== "APLICACAO" || !!e.planoAplicacao) &&
    (e.tipo !== "TENTATIVA" || !!e.planoTentativa) &&
    (e.tipo !== "AVALIACAO" || !!e.planoAvaliacao);
  return { ...compararParametros(planejado, realizado, aferido), horarioAferido };
}
export function snapshotIatf(
  etapa: EtapaIatf,
  referencias: Record<string, unknown>,
  previstaEm: Date,
  previsaoOriginal: Date,
  inicioReferencia: Date,
  precisaoTemporal: PrecisaoIatf = "HORA",
  previsaoPendente = false,
): SnapshotIatf {
  return {
    versao: 1, precisaoTemporal, previsaoPendente,
    etapa,
    referencias,
    previstaEm: serializarDataIatf(previstaEm, precisaoTemporal),
    previsaoOriginal: serializarDataIatf(previsaoOriginal, precisaoTemporal),
    inicioReferencia: serializarDataIatf(inicioReferencia, precisaoTemporal),
  };
}
