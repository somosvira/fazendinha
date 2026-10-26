import { Prisma } from "@prisma/client";
import type { MedicaoLeiteInput, PosicaoOrdenhaDTO } from "./schemas.js";
import { RebanhoError } from "../rebanho/regras.js";

export const ORDENHAS_INICIAIS: readonly PosicaoOrdenhaDTO[] = [
  { posicaoId: "00000000-0000-4000-8000-000000000001", nome: "Manhã", ordem: 1, horario: null },
  { posicaoId: "00000000-0000-4000-8000-000000000002", nome: "Tarde", ordem: 2, horario: null },
  { posicaoId: "00000000-0000-4000-8000-000000000003", nome: "Noite", ordem: 3, horario: null },
];
export interface ResumoProducaoLeite {
  litros: number | null;
  esperadas: number;
  medidas: number;
  naoOrdenhadas: number;
  pendentes: number;
  resolvidas: number;
  completa: boolean;
}
type Celula = { estado: string; litros: Prisma.Decimal | number | null };
/** null representa volume ainda desconhecido; zero só nasce de MEDIDO explícito. */
export function resumirProducao(medicoes: readonly Celula[], esperadas = medicoes.length): ResumoProducaoLeite {
  const medidas = medicoes.filter(m => m.estado === "MEDIDO");
  const naoOrdenhadas = medicoes.filter(m => m.estado === "NAO_ORDENHADO").length;
  const resolvidas = medidas.length + naoOrdenhadas;
  const litros = medidas.length ? medidas.reduce((total, m) => total.plus(m.litros ?? 0), new Prisma.Decimal(0)).toNumber() : null;
  return { litros, esperadas, medidas: medidas.length, naoOrdenhadas, resolvidas,
    pendentes: Math.max(0, esperadas - resolvidas), completa: esperadas > 0 && esperadas === resolvidas };
}
export function medicaoMudou(anterior: { estado: string; litros: Prisma.Decimal | null; motivo: string | null }, proxima: MedicaoLeiteInput): boolean {
  const litros = proxima.litros == null ? null : new Prisma.Decimal(proxima.litros);
  return anterior.estado !== proxima.estado ||
    (anterior.litros === null ? litros !== null : litros === null || !anterior.litros.equals(litros)) ||
    anterior.motivo !== (proxima.motivo || null);
}
export function conferirCorrecaoMedicao(anterior: { estado: string }, motivo: string | null | undefined) {
  if (anterior.estado !== "PENDENTE" && !motivo)
    throw new RebanhoError("VALIDACAO", "Explique a correção de uma medição já resolvida", "motivoCorrecao");
}
