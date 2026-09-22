import { Hono } from "hono";
import { prisma } from "../db.js";
import { obterCentrosAtividade } from "../services/estoque/centros-atividade.js";

// Montado sob o mesmo gate de /api/estoque/* (pecuaria|agricultura|financeiro)
// em app.ts. Expõe os centros de custo "de atividade" (leite/café) para o
// front resolver o filtro inicial da tela de Estoque sem depender de
// /financeiro/configuracoes (que exige área financeiro).
export const estoqueCentrosRouter = new Hono()
  .get("/estoque/centros-atividade", async (c) => c.json(await obterCentrosAtividade(prisma)));
