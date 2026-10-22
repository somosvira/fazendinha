import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  exigeArea,
  exigePermissao,
  getUsuario,
} from "../../middleware/permissao.js";
import {
  resolverEscopoEscrita,
  resolverEscopoLeitura,
} from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import {
  consultarProgramacaoRetirada,
  criarProgramacaoRetirada,
} from "../../services/pecuaria/leite/programacao.js";
import {
  consultarProgramacaoSchema,
  programacaoRetiradaSchema,
} from "../../services/pecuaria/leite/programacao.schemas.js";
import { falhaV4 } from "./reproducao.js";
export const leiteProgramacaoRouter = new Hono()
  .use("*", exigeArea("pecuaria"))
  .get(
    "/",
    zValidator("query", consultarProgramacaoSchema, (r, c) => {
      if (!r.success)
        return c.json(
          { error: r.error.issues[0].message, code: "VALIDACAO" },
          422,
        );
    }),
    async (c) => {
      try {
        const propriedadeId = await resolverEscopoLeitura(c);
        if (propriedadeId === null)
          throw new RebanhoError(
            "VALIDACAO",
            "Selecione um sítio para consultar a programação de retirada",
          );
        const id = getUsuario(c)?.id;
        return c.json(
          await consultarProgramacaoRetirada(
            propriedadeId,
            c.req.valid("query").data,
            id && id > 0 ? id : null,
          ),
        );
      } catch (erro) {
        return falhaV4(c, erro);
      }
    },
  )
  .post(
    "/",
    exigePermissao("lancar"),
    zValidator("json", programacaoRetiradaSchema, (r, c) => {
      if (!r.success)
        return c.json(
          { error: r.error.issues[0].message, code: "VALIDACAO" },
          422,
        );
    }),
    async (c) => {
      try {
        const dados = c.req.valid("json");
        const propriedadeId = await resolverEscopoEscrita(
          c,
          dados.propriedadeId,
        );
        const id = getUsuario(c)?.id;
        return c.json(
          await criarProgramacaoRetirada(
            { ...dados, propriedadeId },
            id && id > 0 ? id : null,
          ),
          201,
        );
      } catch (erro) {
        return falhaV4(c, erro);
      }
    },
  );
