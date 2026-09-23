// Espelha server/src/services/pecuaria/rebanho/categoria.calc.ts — só para a
// revisão ao vivo do cadastro (NovoAnimal). O servidor é a fonte da verdade;
// aqui é só para não deixar o usuário sem feedback antes de salvar.
import type { Categoria, Sexo } from "../types";

const MESES_BEZERRO = 12;
const MESES_GARROTE = 24;

/** Diferença de calendário em meses completos (não é (hoje-nasc)/30). */
export function idadeEmMesesCliente(dataNascimento: string, hoje: string): number {
  const nasc = new Date(`${dataNascimento}T00:00:00Z`);
  const ref = new Date(`${hoje}T00:00:00Z`);
  let meses = (ref.getUTCFullYear() - nasc.getUTCFullYear()) * 12 + (ref.getUTCMonth() - nasc.getUTCMonth());
  if (ref.getUTCDate() < nasc.getUTCDate()) meses -= 1;
  return Math.max(0, meses);
}

export function calcularCategoriaCliente(input: { sexo: Sexo; dataNascimento: string; partosAntesDaEntrada: number; hoje: string }): Categoria {
  const meses = idadeEmMesesCliente(input.dataNascimento, input.hoje);
  if (input.sexo === "F") {
    if (input.partosAntesDaEntrada >= 1) return "VACA";
    return meses < MESES_BEZERRO ? "BEZERRA" : "NOVILHA";
  }
  if (meses < MESES_BEZERRO) return "BEZERRO";
  if (meses < MESES_GARROTE) return "GARROTE";
  return "TOURO";
}
