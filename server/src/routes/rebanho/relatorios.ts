import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { listarTemplatesRelatorio } from "../../services/rebanho/relatorios.catalogo.js";
import { relatorioQuerySchema } from "../../services/rebanho/relatorios.schemas.js";
import { gerarRelatorio } from "../../services/rebanho/relatorios.js";

export const relatoriosRouter = new Hono()
  .get("/rebanho/relatorios/templates", (c) => c.json(listarTemplatesRelatorio()))
  .get("/rebanho/relatorios", zValidator("query", relatorioQuerySchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoLeitura(c);
      return c.json(await gerarRelatorio(c.req.valid("query"), propriedadeId));
    } catch (e) {
      console.error("[relatorios-rebanho]", e);
      return c.json({ error: "Erro inesperado ao gerar relatório. Tente novamente." }, 500);
    }
  });
