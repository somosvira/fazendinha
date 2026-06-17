import { prisma } from "../../db.js";

// Listas de referência do plano de contas financeiro, para os selects da ponte
// (Categoria contábil / Centro de custo) no formulário de Produto e de Movimento.

export async function listarCategorias() {
  return prisma.categoria.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}

export async function listarCentrosCusto() {
  return prisma.centroCusto.findMany({
    orderBy: { ordem: "asc" },
    select: { id: true, nome: true, ehInvestimento: true },
  });
}
