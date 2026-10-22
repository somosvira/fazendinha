import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  exigeArea,
  exigePermissao,
  getUsuario,
} from "../../middleware/permissao.js";
import {
  resolverEscopoLeitura,
  resolverEscopoEscrita,
} from "../../services/propriedade.js";
import { podeVerValoresFinanceiros } from "../../services/pecuaria/custos/permissoes.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { ValorizacaoError } from "../../services/estoque/valorizacao.calc.js";
import { FinanceiroError } from "../../services/financeiro/regras.js";
import * as servico from "../../services/pecuaria/leite/comercial.operacoes.js";
import * as schemas from "../../services/pecuaria/leite/comercial.operacoes.schemas.js";
import * as anexos from "../../services/pecuaria/leite/comercial.operacoes.comprovantes.js";
import { consultaComercialLeiteSchema } from "../../services/pecuaria/leite/comercial.schemas.js";
import {
  solicitarLaudoQualidadeSchema,
  confirmarLaudoQualidadeSchema,
} from "../../services/pecuaria/leite/qualidade.schemas.js";
import { falhaV4 } from "./reproducao.js";
const json = <T extends z.ZodTypeAny>(s: T) =>
  zValidator("json", s, (r, c) =>
    !r.success
      ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422)
      : undefined,
  );
const uuid = (c: Context, nome = "id") =>
  z.string().uuid().parse(c.req.param(nome));
const autor = (c: Context) => {
  const id = getUsuario(c)?.id;
  return id && id > 0 ? id : null;
};
async function contexto(c: Context, escrita = false) {
  const propriedadeId = escrita
    ? await resolverEscopoEscrita(c)
    : await resolverEscopoLeitura(c);
  if (propriedadeId === null)
    throw new RebanhoError(
      "VALIDACAO",
      "Selecione um sítio para consultar operações de leite",
    );
  return { propriedadeId, usuarioId: autor(c) };
}
function falha(c: Context, e: unknown) {
  if (e instanceof ValorizacaoError || e instanceof FinanceiroError)
    return c.json(
      { error: e.message, code: e.code },
      e.code === "VALIDACAO" ? 422 : e.code === "NAO_ENCONTRADO" ? 404 : 409,
    );
  return falhaV4(c, e);
}
export const leiteComercialOperacoesRouter = new Hono()
  .use("*", exigeArea("pecuaria"))
  .get("/", zValidator("query", consultaComercialLeiteSchema), async (c) => {
    try {
      return c.json(
        await servico.consultarOperacoesLeite(
          c.req.valid("query"),
          await contexto(c),
          podeVerValoresFinanceiros(getUsuario(c)),
        ),
      );
    } catch (e) {
      return falha(c, e);
    }
  })
  .post(
    "/",
    exigePermissao("lancar"),
    json(schemas.abrirOperacaoLeiteSchema),
    async (c) => {
      try {
        return c.json(
          await servico.abrirOperacaoLeite(
            c.req.valid("json"),
            await contexto(c, true),
          ),
          201,
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .get("/cadastros", async (c) => {
    try {
      await contexto(c);
      return c.json(await servico.consultarCadastrosOperacaoLeite());
    } catch (e) {
      return falha(c, e);
    }
  })
  .get("/:id", async (c) => {
    try {
      return c.json(
        await servico.consultarOperacaoLeite(
          uuid(c),
          await contexto(c),
          podeVerValoresFinanceiros(getUsuario(c)),
        ),
      );
    } catch (e) {
      return falha(c, e);
    }
  })
  .post(
    "/:id/retiradas",
    exigePermissao("lancar"),
    json(schemas.retirarOperacaoLeiteSchema),
    async (c) => {
      try {
        return c.json(
          await servico.retirarOperacaoLeite(
            uuid(c),
            c.req.valid("json"),
            await contexto(c, true),
          ),
          201,
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .post(
    "/:id/previa-fechamento",
    exigeArea("financeiro"),
    exigePermissao("verValores"),
    json(schemas.previaFechamentoOperacaoLeiteSchema),
    async (c) => {
      try {
        return c.json(
          await servico.previaFechamentoOperacaoLeite(
            uuid(c),
            c.req.valid("json"),
            await contexto(c),
          ),
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .post(
    "/:id/fechamentos",
    exigeArea("financeiro"),
    exigePermissao("verValores"),
    exigePermissao("lancar"),
    json(schemas.fecharOperacaoLeiteSchema),
    async (c) => {
      try {
        return c.json(
          await servico.fecharOperacaoLeite(
            uuid(c),
            c.req.valid("json"),
            await contexto(c, true),
          ),
          201,
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .post(
    "/retiradas/:id/comprovantes/upload",
    exigePermissao("lancar"),
    json(solicitarLaudoQualidadeSchema),
    async (c) => {
      try {
        const input = c.req.valid("json");
        const p = await resolverEscopoEscrita(c, input.propriedadeId);
        return c.json(
          await anexos.solicitarComprovanteRetiradaOperacaoLeite(
            uuid(c),
            p,
            input,
            autor(c),
          ),
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .post(
    "/retiradas/:id/comprovantes/confirmar",
    exigePermissao("lancar"),
    json(confirmarLaudoQualidadeSchema),
    async (c) => {
      try {
        const input = c.req.valid("json");
        const p = await resolverEscopoEscrita(c, input.propriedadeId);
        return c.json(
          await anexos.confirmarComprovanteRetiradaOperacaoLeite(
            uuid(c),
            p,
            input.uploadToken,
            autor(c),
          ),
          201,
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .get("/retiradas/:id/comprovantes/:comprovanteId/download", async (c) => {
    try {
      return c.json(
        await anexos.baixarComprovanteRetiradaOperacaoLeite(
          uuid(c),
          uuid(c, "comprovanteId"),
          (await contexto(c)).propriedadeId,
        ),
      );
    } catch (e) {
      return falha(c, e);
    }
  });
