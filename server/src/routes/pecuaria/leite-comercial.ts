import { leiteComercialOperacoesRouter } from "./leite-comercial-operacoes.js";
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
import * as comercial from "../../services/pecuaria/leite/comercial.js";
import * as arquivos from "../../services/pecuaria/leite/comercial.comprovantes.js";
import * as s from "../../services/pecuaria/leite/comercial.schemas.js";
import {
  solicitarLaudoQualidadeSchema,
  confirmarLaudoQualidadeSchema,
} from "../../services/pecuaria/leite/qualidade.schemas.js";
import { falhaV4 } from "./reproducao.js";
const validar = <T extends z.ZodTypeAny>(schema: T) =>
  zValidator("json", schema, (r, c) =>
    !r.success
      ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422)
      : undefined,
  );
const query = zValidator("query", s.consultaComercialLeiteSchema, (r, c) =>
  !r.success
    ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422)
    : undefined,
);
const autor = (c: Context) => {
  const id = getUsuario(c)?.id;
  return id && id > 0 ? id : null;
};
async function leitura(c: Context) {
  const propriedadeId = await resolverEscopoLeitura(c);
  if (propriedadeId === null)
    throw new RebanhoError(
      "VALIDACAO",
      "Selecione um sítio para consultar as entregas de leite",
    );
  return { propriedadeId, usuarioId: autor(c) };
}
async function escrita(c: Context) {
  return { propriedadeId: await resolverEscopoEscrita(c), usuarioId: autor(c) };
}
function falha(c: Context, e: unknown) {
  if (e instanceof ValorizacaoError)
    return c.json(
      { error: e.message, code: e.code },
      e.code === "VALIDACAO" ? 422 : 409,
    );
  return falhaV4(c, e);
}
export const leiteComercialRouter = new Hono()
  .use("*", exigeArea("pecuaria"))
  .route("/operacoes", leiteComercialOperacoesRouter)
  .get("/entregas", query, async (c) => {
    try {
      return c.json(
        await comercial.consultarEntregasLeite(
          c.req.valid("query"),
          await leitura(c),
          podeVerValoresFinanceiros(getUsuario(c)),
        ),
      );
    } catch (e) {
      return falha(c, e);
    }
  })
  .get("/vendas-vinculaveis", query, async (c) => {
    try {
      return c.json(
        await comercial.consultarVendasVinculaveisLeite(
          c.req.valid("query"),
          await leitura(c),
          podeVerValoresFinanceiros(getUsuario(c)),
        ),
      );
    } catch (e) {
      return falha(c, e);
    }
  })
  .post(
    "/entregas",
    exigePermissao("lancar"),
    validar(s.registrarEntregaLeiteSchema),
    async (c) => {
      try {
        const input = c.req.valid("json");
        if (
          input.vinculo.tipo === "NOVA_VENDA" &&
          !podeVerValoresFinanceiros(getUsuario(c))
        )
          return c.json(
            { error: "Criar a venda exige acesso financeiro com valores" },
            403,
          );
        return c.json(
          await comercial.registrarEntregaLeite(input, await escrita(c)),
          201,
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .post(
    "/entregas/:id/conferencias",
    exigePermissao("lancar"),
    validar(s.conferirEntregaLeiteSchema),
    async (c) => {
      try {
        return c.json(
          await comercial.conferirEntregaLeite(
            z.string().uuid().parse(c.req.param("id")),
            c.req.valid("json"),
            await escrita(c),
          ),
          201,
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .get(
    "/demonstrativos",
    exigeArea("financeiro"),
    exigePermissao("verValores"),
    query,
    async (c) => {
      try {
        return c.json(
          await comercial.consultarDemonstrativosLeite(
            c.req.valid("query"),
            await leitura(c),
          ),
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .post(
    "/demonstrativos",
    exigeArea("financeiro"),
    exigePermissao("verValores"),
    exigePermissao("lancar"),
    validar(s.demonstrativoLeiteSchema),
    async (c) => {
      try {
        return c.json(
          await comercial.registrarDemonstrativoLeite(
            c.req.valid("json"),
            await escrita(c),
          ),
          201,
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .post(
    "/demonstrativos/:id/anulacao",
    exigeArea("financeiro"),
    exigePermissao("verValores"),
    exigePermissao("lancar"),
    validar(s.anularDemonstrativoLeiteSchema),
    async (c) => {
      try {
        return c.json(
          await comercial.anularDemonstrativoLeite(
            z.string().uuid().parse(c.req.param("id")),
            c.req.valid("json"),
            await escrita(c),
          ),
          201,
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .post(
    "/entregas/:id/comprovantes/upload",
    exigePermissao("lancar"),
    validar(solicitarLaudoQualidadeSchema),
    async (c) => {
      try {
        const input = c.req.valid("json"),
          propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId);
        return c.json(
          await arquivos.solicitarComprovanteEntregaLeite(
            z.string().uuid().parse(c.req.param("id")),
            propriedadeId,
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
    "/entregas/:id/comprovantes/confirmar",
    exigePermissao("lancar"),
    validar(confirmarLaudoQualidadeSchema),
    async (c) => {
      try {
        const input = c.req.valid("json"),
          propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId);
        return c.json(
          await arquivos.confirmarComprovanteEntregaLeite(
            z.string().uuid().parse(c.req.param("id")),
            propriedadeId,
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
  .get("/entregas/:id/comprovantes/:comprovanteId/download", async (c) => {
    try {
      const ctx = await leitura(c);
      return c.json(
        await arquivos.baixarComprovanteEntregaLeite(
          z.string().uuid().parse(c.req.param("id")),
          z.string().uuid().parse(c.req.param("comprovanteId")),
          ctx.propriedadeId,
        ),
      );
    } catch (e) {
      return falha(c, e);
    }
  });
