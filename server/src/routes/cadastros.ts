// Dimensões para o form de Lançar Gasto. O frontend precisa dos IDs reais
// pra construir os chips de Conta, Atividade (CentroCusto) e o cascade de
// Categoria, e do top-N de fornecedores recentes para o autocomplete.

import { Hono } from "hono";
import { prisma } from "../db.js";

export const cadastrosRouter = new Hono().get("/cadastros", async (c) => {
  const [centrosCusto, contas, grupos, fornecedoresTop] = await Promise.all([
    prisma.centroCusto.findMany({
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
      select: { id: true, nome: true, ehInvestimento: true },
    }),
    prisma.contaBancaria.findMany({
      orderBy: { id: "asc" },
      select: { id: true, nome: true, banco: true },
    }),
    prisma.grupoCategoria.findMany({
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
      select: {
        id: true,
        nome: true,
        categorias: {
          orderBy: { nome: "asc" },
          select: { id: true, nome: true },
        },
      },
    }),
    // Top-50 fornecedores por lançamentos recentes — ordem alfabética
    // como fallback porque ainda não há uma agregação dedicada.
    prisma.clienteFornecedor.findMany({
      take: 50,
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, documento: true },
    }),
  ]);

  return c.json({
    centrosCusto,
    contas,
    grupos,
    fornecedores: fornecedoresTop,
  });
});
