import { prisma } from "../../db.js";

// Listas de referência do plano de contas financeiro, para os selects da ponte
// (Categoria contábil / Centro de custo) no formulário de Produto e de Movimento.

// Por padrão só ativos (selects de lançamento). O formulário de produto pede
// também os inativos para continuar exibindo um vínculo já existente.
export async function listarCategorias(incluirInativos = false) {
  return prisma.categoria.findMany({ where: incluirInativos ? {} : { ativo: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: { id: true, nome: true, ativo: true, ordem: true, classificacao: true, usoSanitario: true, usoNutricional: true, usoAgricola: true } });
}

export async function listarCentrosCusto(incluirInativos = false) {
  return prisma.centroCusto.findMany({
    where: incluirInativos ? {} : { ativo: true },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, ativo: true, ordem: true },
  });
}
