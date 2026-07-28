import { Hono } from "hono";
import {
  recomendarParaAnimal,
  AcasalamentoError,
} from "../../services/rebanho/acasalamento.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";

function combinacaoIdDaQuery(valor: string | undefined): number | undefined {
  if (valor === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(valor)) {
    throw new AcasalamentoError("NAO_ENCONTRADO", "combinação não encontrada");
  }
  const id = Number(valor);
  if (!Number.isSafeInteger(id)) {
    throw new AcasalamentoError("NAO_ENCONTRADO", "combinação não encontrada");
  }
  return id;
}

// Recomendação de acasalamento para um animal (ranking de touros do catálogo).
export const acasalamentoRouter = new Hono()
  .get("/rebanho/animais/:id/acasalamento", async (c) => {
    try {
      const propriedadeId = await resolverEscopoLeitura(c);
      const combinacaoId = combinacaoIdDaQuery(c.req.query("combinacaoId"));
      return c.json(await recomendarParaAnimal(
        Number(c.req.param("id")),
        propriedadeId,
        combinacaoId,
      ));
    } catch (e) {
      if (e instanceof AcasalamentoError) {
        return c.json({ error: e.message }, 404);
      }
      console.error("[acasalamento]", e);
      return c.json({ error: "Erro inesperado ao processar. Tente novamente." }, 500);
    }
  });
