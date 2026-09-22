import { Hono } from "hono";
import { prisma } from "../db.js";
import { CENTROS_ATIVIDADE, resolverIdsCentros } from "../services/estoque/centros-atividade.js";

// Router separado de estoque.ts (outro agente edita esse arquivo em paralelo).
// Montado sob o mesmo gate de /api/estoque/* (pecuaria|agricultura|financeiro)
// em app.ts. Expõe os centros de custo "de atividade" (leite/café) para o
// front resolver o filtro inicial da tela de Estoque sem depender de
// /financeiro/configuracoes (que exige área financeiro).
export async function obterCentrosAtividade() {
  const [idsLeite, idsCafe] = await Promise.all([
    resolverIdsCentros(prisma, [CENTROS_ATIVIDADE.LEITE]),
    resolverIdsCentros(prisma, [CENTROS_ATIVIDADE.CAFE]),
  ]);
  return { leite: idsLeite[0] ?? null, cafe: idsCafe[0] ?? null };
}

export const estoqueCentrosRouter = new Hono()
  .get("/estoque/centros-atividade", async (c) => c.json(await obterCentrosAtividade()));
