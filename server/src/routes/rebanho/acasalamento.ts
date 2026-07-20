import { Hono } from "hono";
import { recomendarParaAnimal, AcasalamentoError } from "../../services/rebanho/acasalamento.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

// Recomendação de acasalamento para um animal (ranking de touros do catálogo).
export const acasalamentoRouter = new Hono()
  .get("/rebanho/animais/:id/acasalamento", async (c) => {
    try {
      const propriedadeId = await resolverEscopoLeitura(c);
      return c.json(await recomendarParaAnimal(Number(c.req.param("id")), propriedadeId));
    } catch (e) {
      if (e instanceof AcasalamentoError) return c.json({ error: e.message }, 404);
      console.error("[acasalamento]", e); return c.json({ error: "Erro inesperado ao processar. Tente novamente." }, 500);
    }
  });
