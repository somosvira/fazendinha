import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { exigeAba } from "../middleware/permissao.js";
import { resolverEscopoLeitura } from "../services/propriedade.js";
import { relatorioGerencialQuerySchema } from "../services/relatorio-gerencial.schemas.js";
import { gerarRelatorioGerencial } from "../services/relatorio-gerencial.js";

export const relatorioGerencialRouter = new Hono()
  .get("/financeiro/relatorio-gerencial", exigeAba("relatorio"), zValidator("query", relatorioGerencialQuerySchema), async (c) => {
    try {
      const propriedadeId = await resolverEscopoLeitura(c);
      return c.json(await gerarRelatorioGerencial(c.req.valid("query"), propriedadeId));
    } catch (e) {
      console.error("[relatorio-gerencial]", e);
      return c.json({ error: "Erro inesperado ao gerar relatório. Tente novamente." }, 500);
    }
  });
