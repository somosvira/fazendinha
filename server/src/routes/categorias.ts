import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../db.js";

const schema = z.object({ classificacao: z.enum(["CUSTEIO", "INVESTIMENTO"]).nullable() });

// Override gerencial da classificação de uma categoria (custeio × investimento).
// Usado pelo card de inconsistência do dashboard (reclassificar/reverter).
export const categoriasRouter = new Hono().patch(
  "/categorias/:id/classificacao",
  zValidator("json", schema),
  async (c) => {
    const id = c.req.param("id");
    const { classificacao } = c.req.valid("json");
    try {
      const cat = await prisma.categoria.update({ where: { id }, data: { classificacao } });
      return c.json({ id: cat.id, nome: cat.nome, classificacao: cat.classificacao });
    } catch {
      return c.json({ error: "categoria não encontrada" }, 404);
    }
  },
);
