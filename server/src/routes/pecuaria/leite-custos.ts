import { Hono, type Context } from "hono";
import {
  exigeArea,
  exigePermissao,
  getUsuario,
} from "../../middleware/permissao.js";
import { podeVerValoresFinanceiros } from "../../services/pecuaria/custos/permissoes.js";
import { consultarCustosLeite } from "../../services/pecuaria/leite/custos.js";
import { consultaCustosLeiteSchema } from "../../services/pecuaria/leite/custos.schemas.js";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { falhaV4 } from "./reproducao.js";

async function consultar(c: Context) {
  const validacao = consultaCustosLeiteSchema.safeParse(c.req.query());
  if (!validacao.success)
    return c.json(
      { error: validacao.error.issues[0].message, code: "VALIDACAO" },
      422,
    );
  try {
    const propriedadeId = await resolverEscopoLeitura(c);
    if (propriedadeId === null)
      throw new RebanhoError(
        "VALIDACAO",
        "Selecione um sítio para consultar os custos do leite",
      );
    return c.json(
      await consultarCustosLeite(
        propriedadeId,
        validacao.data,
        podeVerValoresFinanceiros(getUsuario(c)),
      ),
    );
  } catch (erro) {
    return falhaV4(c, erro);
  }
}
export const leiteCustosRouter = new Hono()
  .use("*", exigeArea("pecuaria"))
  .get("/", consultar)
  .get("/exportacao", exigePermissao("exportar"), consultar);
