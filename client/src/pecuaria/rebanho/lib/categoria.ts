// Espelha server/src/services/pecuaria/rebanho/categoria.calc.ts (regrasAutomaticas/regraCasa/
// idadeEmMeses) — usado só para a revisão ao vivo do cadastro (NovoAnimal), a partir das
// categorias carregadas de GET /categorias. O servidor é a fonte da verdade; aqui é só para não
// deixar o usuário sem feedback antes de salvar.
import type { CategoriaDTO, CategoriaRef, Sexo } from "../types";

/** Diferença de calendário em meses completos (não é (hoje-nasc)/30). */
export function idadeEmMesesCliente(dataNascimento: string, hoje: string): number {
  const nasc = new Date(`${dataNascimento}T00:00:00Z`);
  const ref = new Date(`${hoje}T00:00:00Z`);
  let meses = (ref.getUTCFullYear() - nasc.getUTCFullYear()) * 12 + (ref.getUTCMonth() - nasc.getUTCMonth());
  if (ref.getUTCDate() < nasc.getUTCDate()) meses -= 1;
  return Math.max(0, meses);
}

export type AnimalParaCategoriaCliente = { sexo: Sexo; dataNascimento: string; partosAntesDaEntrada: number; hoje: string };

function regraCasa(regra: CategoriaDTO, animal: AnimalParaCategoriaCliente): boolean {
  if (regra.sexo !== animal.sexo) return false;
  if (regra.partos === "SEM" && animal.partosAntesDaEntrada > 0) return false;
  if (regra.partos === "COM" && animal.partosAntesDaEntrada < 1) return false;
  const meses = idadeEmMesesCliente(animal.dataNascimento, animal.hoje);
  if (regra.idadeMinMeses != null && meses < regra.idadeMinMeses) return false;
  if (regra.idadeMaxMeses != null && meses >= regra.idadeMaxMeses) return false;
  return true;
}

/** Regras que concorrem no cálculo automático de um sexo, na ordem de avaliação. */
function regrasAutomaticas(categorias: CategoriaDTO[], sexo: Sexo): CategoriaDTO[] {
  return categorias
    .filter((c) => c.ativo && c.automatica && c.sexo === sexo)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
}

/** Primeira regra automática ativa do sexo que casa (em `ordem`), ou null (sem categoria). */
export function calcularCategoriaCliente(categorias: CategoriaDTO[], animal: AnimalParaCategoriaCliente): CategoriaRef | null {
  const regra = regrasAutomaticas(categorias, animal.sexo).find((r) => regraCasa(r, animal));
  return regra ? { id: regra.id, nome: regra.nome } : null;
}
