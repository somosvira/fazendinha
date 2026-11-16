import { RebanhoError } from "../rebanho/regras.js";
export const TIPO_EXAME_ESCORE_CORPORAL = "b0841f3c-3f88-4c2d-9d0d-3ef33d49b841";
export function validarEscalaEscore(valor: number, minimo: number, maximo: number) {
  if (![valor, minimo, maximo].every(Number.isFinite) || minimo >= maximo || valor < minimo || valor > maximo)
    throw new RebanhoError("VALIDACAO", "Informe escala mínima menor que máxima e escore dentro dos limites declarados", "resultados");
}
function numeroEscore(valor: unknown): number | null {
  if (typeof valor !== "number" && (typeof valor !== "string" || !valor.trim())) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}
export function validarResultadosEscore(resultados: readonly { campo: string; valor: unknown }[]) {
  const numero = (campo: string) => numeroEscore(resultados.find(r => r.campo === campo)?.valor);
  const [valor, minimo, maximo] = [numero("ESCORE"), numero("ESCALA_MIN"), numero("ESCALA_MAX")];
  if (typeof valor !== "number" || typeof minimo !== "number" || typeof maximo !== "number") throw new RebanhoError("VALIDACAO", "ECC exige valor e escala numéricos", "resultados");
  validarEscalaEscore(valor, minimo, maximo);
}
export type EscoreCorporalFicha = { id: string; data: string; valor: number | null; escalaMin: number | null; escalaMax: number | null; responsavel: string | null };
/** Não presume escala clínica nem converte entre escalas. */
export function lerEscoreCorporal(e: { id: string; data: Date; resultadoNumero?: { toNumber(): number } | number | null; resultados: { campo: string; valor: unknown }[]; anotacaoOriginal: string | null; responsavel?: string | null }): EscoreCorporalFicha {
  const valor = (campo: string) => e.resultados.find(r => r.campo === campo)?.valor;
  let payload: Record<string, unknown> = {};
  try { const anotacao = JSON.parse(e.anotacaoOriginal ?? "{}") as { payload?: Record<string, unknown> }; payload = anotacao.payload ?? {}; } catch { /* Ausência continua desconhecida. */ }
  const escala = payload.escala === "1_A_5" ? [1,5] : payload.escala === "1_A_9" ? [1,9] : null;
  const numero = numeroEscore;
  return { id: e.id, data: e.data.toISOString().slice(0,10), responsavel: e.responsavel ?? null,
    valor: numero(valor("ESCORE") ?? (typeof e.resultadoNumero === "number" ? e.resultadoNumero : e.resultadoNumero?.toNumber())),
    escalaMin: numero(valor("ESCALA_MIN") ?? payload.escalaMin ?? escala?.[0]), escalaMax: numero(valor("ESCALA_MAX") ?? payload.escalaMax ?? escala?.[1]) };
}
