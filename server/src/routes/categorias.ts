import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../db.js";
import { EntityIdError, parseEntityId } from "../lib/ids.js";

const schema = z.object({ classificacao: z.enum(["CUSTEIO", "INVESTIMENTO"]).nullable() });

// Override gerencial da classificação de uma categoria (custeio × investimento).
// Usado pelo card de inconsistência do dashboard (reclassificar/reverter).
export const categoriasRouter = new Hono().patch(
  "/categorias/:id/classificacao",
  zValidator("json", schema),
  async (c) => {
    try {
      const id = parseEntityId(c.req.param("id"));
      const { classificacao } = c.req.valid("json");
      const cat = await prisma.categoria.update({ where: { id }, data: { classificacao } });
      return c.json({ id: cat.id, nome: cat.nome, classificacao: cat.classificacao });
    } catch (erro) {
      if (erro instanceof EntityIdError) return c.json({ error: erro.message }, 400);
      console.error("[categorias]", erro);
      return c.json({ error: "Erro inesperado ao processar. Tente novamente." }, 500);
    }
  },
);
