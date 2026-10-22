import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { exigeArea } from "../../middleware/permissao.js";
import { resolverEscopoLeitura, PropriedadeError } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { consultarHistoricoProdutivo } from "../../services/pecuaria/leite/historico.js";
import { consultarHistoricoProdutivoSchema } from "../../services/pecuaria/leite/historico.schemas.js";
export const leiteHistoricoRouter = new Hono().use("*", exigeArea("pecuaria"))
  .get("/animais/:id", zValidator("param", z.object({ id: z.string().uuid() })), zValidator("query", consultarHistoricoProdutivoSchema, (r, c) => !r.success ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422) : undefined), async c => {
    try {
      const propriedadeId = await resolverEscopoLeitura(c);
      if (propriedadeId === null) throw new RebanhoError("VALIDACAO", "Selecione um sítio para consultar o histórico produtivo");
      return c.json(await consultarHistoricoProdutivo(propriedadeId, c.req.valid("param").id, c.req.valid("query")));
    } catch (erro) {
      if (erro instanceof RebanhoError || erro instanceof PropriedadeError) return c.json({ error: erro.message, code: erro.code }, erro.code === "NAO_ENCONTRADO" ? 404 : erro.code === "VALIDACAO" ? 422 : 409);
      if (erro instanceof z.ZodError) return c.json({ error: erro.issues[0].message, code: "VALIDACAO" }, 422);
      console.error("[pecuaria/leite/historico]", erro); return c.json({ error: "Não foi possível consultar o histórico produtivo" }, 500);
    }
  });
