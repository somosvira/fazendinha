import { Hono, type Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { env } from "../../env.js";
import { getUsuario } from "../../middleware/permissao.js";
import {
  resolverEscopoLeitura,
  resolverEscopoEscrita,
} from "../../services/propriedade.js";
import { podeVerValoresFinanceiros } from "../../services/pecuaria/custos/permissoes.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import {
  configuracaoSchema,
  competenciaSchema,
  quantidadeSchema,
} from "../../services/pecuaria/nutricao/mensal.calc.js";
import * as mensal from "../../services/pecuaria/nutricao/mensal.js";
import { prisma } from "../../db.js";
const validar = <T extends z.ZodTypeAny>(schema: T) =>
  zValidator("json", schema, (r, c) =>
    !r.success ? c.json({ error: r.error.issues[0].message }, 422) : undefined,
  );
const base = z.object({
  propriedadeId: z.number().int().positive(),
  chave: z.string().uuid(),
  revisao: z.number().int().positive(),
  motivo: z.string().trim().max(500).default(""),
});
const item = z
  .object({
    produtoId: z.string().uuid(),
    quantidade: quantidadeSchema,
    partidas: z
      .array(
        z.object({
          partidaId: z.string().uuid(),
          quantidade: quantidadeSchema,
          cienciaValidadeDesconhecida: z.boolean().optional(),
        }),
      )
      .optional(),
  })
  .strict();
const valores = (c: Context) => podeVerValoresFinanceiros(getUsuario(c));
export const nutricaoMensalRouter = new Hono()
  .get("/status", (c) =>
    c.json({
      habilitada: env.NUTRICAO_MENSAL_ENABLED,
      automacao: env.NUTRICAO_AUTOMACAO_ENABLED,
    }),
  )
  .use("*", async (c, next) => {
    if (!env.NUTRICAO_MENSAL_ENABLED)
      return c.json(
        { error: "Nutrição mensal ainda não habilitada neste ambiente" },
        503,
      );
    const u = getUsuario(c);
    if (!u || u.id <= 0)
      return c.json(
        { error: "Entre com uma conta para usar a nutrição mensal" },
        403,
      );
    return next();
  })
  .onError((e, c) => {
    if (e instanceof RebanhoError)
      return c.json(
        { error: e.message, code: e.code },
        e.code === "NAO_ENCONTRADO" ? 404 : 409,
      );
    if (
      e instanceof Error &&
      [
        "ValorizacaoError",
        "EstoqueError",
        "FinanceiroError",
        "PropriedadeError",
      ].includes(e.constructor.name)
    )
      return c.json({ error: e.message }, 409);
    console.error("[nutricao/mensal]", e);
    return c.json(
      {
        error:
          "Não foi possível concluir a operação; recarregue e tente novamente",
      },
      500,
    );
  })
  .get("/configuracoes", async (c) =>
    c.json(await mensal.listarConfiguracoes(await resolverEscopoLeitura(c))),
  )
  .post("/configuracoes", validar(configuracaoSchema), async (c) => {
    const input = c.req.valid("json");
    const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId);
    return c.json(
      await mensal.salvarConfiguracao(
        { ...input, propriedadeId },
        getUsuario(c)!.id,
      ),
      201,
    );
  })
  .get(
    "/meses",
    zValidator(
      "query",
      z.object({
        loteId: z.string().uuid().optional(),
        competencia: competenciaSchema.optional(),
        alertas: z.enum(["true", "false"]).optional(),
        pagina: z.coerce.number().int().min(1).max(100000).default(1),
      }),
    ),
    async (c) => {
      const f = c.req.valid("query"),
        r = await mensal.consultarMeses(
          await resolverEscopoLeitura(c),
          f.loteId,
          f.competencia,
          f.pagina,
          f.alertas === "true",
        );
      return c.json({
        ...r,
        itens: r.itens.map((m) => mensal.resumoMes(m, valores(c))),
      });
    },
  )
  .get(
    "/meses/:id",
    zValidator("param", z.object({ id: z.string().uuid() })),
    async (c) => {
      const escopo = await resolverEscopoLeitura(c);
      return c.json(
        mensal.resumoMes(
          await mensal.carregarMesTx(prisma, c.req.valid("param").id, escopo),
          valores(c),
        ),
      );
    },
  )
  .post(
    "/reprocessar",
    validar(
      z
        .object({
          propriedadeId: z.number().int().positive(),
          loteId: z.string().uuid(),
        })
        .strict(),
    ),
    async (c) => {
      const p = c.req.valid("json"),
        sitio = await resolverEscopoEscrita(c, p.propriedadeId);
      if (
        !(await prisma.lote.findFirst({
          where: { id: p.loteId, propriedadeId: sitio },
        }))
      )
        throw new RebanhoError("NAO_ENCONTRADO", "Lote não encontrado");
      return c.json(await mensal.processarPendentes(p.loteId, sitio));
    },
  )
  .post(
    "/meses/:id/confirmacao",
    zValidator("param", z.object({ id: z.string().uuid() })),
    validar(base.extend({ itens: z.array(item).max(500) }).strict()),
    async (c) => {
      const input = c.req.valid("json"),
        sitio = await resolverEscopoEscrita(c, input.propriedadeId);
      return c.json(
        await mensal.confirmarMes(
          c.req.valid("param").id,
          sitio,
          getUsuario(c)!.id,
          input,
        ),
      );
    },
  )
  .post(
    "/meses/:id/dias",
    zValidator("param", z.object({ id: z.string().uuid() })),
    validar(
      base
        .extend({
          dias: z
            .array(
              z.object({
                id: z.string().uuid(),
                itens: z.array(item).max(100),
              }),
            )
            .min(1)
            .max(31),
        })
        .strict(),
    ),
    async (c) => {
      const input = c.req.valid("json"),
        sitio = await resolverEscopoEscrita(c, input.propriedadeId);
      return c.json(
        await mensal.confirmarDias(
          c.req.valid("param").id,
          sitio,
          getUsuario(c)!.id,
          input,
        ),
      );
    },
  )
  .post(
    "/meses/:id/reconciliacao",
    zValidator("param", z.object({ id: z.string().uuid() })),
    validar(
      base.extend({ motivo: z.string().trim().min(5).max(500) }).strict(),
    ),
    async (c) => {
      const input = c.req.valid("json"),
        sitio = await resolverEscopoEscrita(c, input.propriedadeId);
      return c.json(
        await mensal.reconciliarMes(
          c.req.valid("param").id,
          sitio,
          getUsuario(c)!.id,
          input,
        ),
      );
    },
  )
  .post(
    "/meses/:id/reabertura",
    zValidator("param", z.object({ id: z.string().uuid() })),
    validar(
      z
        .object({
          propriedadeId: z.number().int().positive(),
          motivo: z.string().trim().min(5).max(500),
        })
        .strict(),
    ),
    async (c) => {
      const p = c.req.valid("json"),
        sitio = await resolverEscopoEscrita(c, p.propriedadeId);
      return c.json(
        await mensal.reabrirMes(
          c.req.valid("param").id,
          sitio,
          getUsuario(c)!.id,
          p.motivo,
        ),
      );
    },
  );
