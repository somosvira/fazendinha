import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  exigeArea,
  exigePermissao,
  getUsuario,
} from "../../middleware/permissao.js";
import {
  resolverEscopoEscrita,
  resolverEscopoLeitura,
} from "../../services/propriedade.js";
import { podeVerValoresFinanceiros } from "../../services/pecuaria/custos/permissoes.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import {
  anularEntradaLeiteSchema,
  anularEntradaProducaoLeite,
  apuracaoValorLeiteSchema,
  apurarValorProducaoLeite,
  confirmarProducaoLeiteSchema,
  confirmarProducaoLeite,
  confirmarSessaoProducaoLeite,
  confirmarSessaoProducaoLeiteSchema,
  consultarEstoqueLeite,
  vendaLeiteSchema,
  venderLeite,
  classificarEntradaLeiteSchema,
  classificarEntradaLeite,
  consultaVendasLeiteSchema,
  consultarVendasLeite,
  correcaoVendaLeiteSchema,
  corrigirVendaLeite,
} from "../../services/pecuaria/leite/estoque.js";
import { falhaV4 } from "./reproducao.js";

const validar = <T extends z.ZodTypeAny>(schema: T) =>
  zValidator("json", schema, (r, c) => {
    if (!r.success)
      return c.json(
        { error: r.error.issues[0].message, code: "VALIDACAO" },
        422,
      );
  });
export const leiteEstoqueRouter = new Hono()
  .use("*", exigeArea("pecuaria"))
  .get("/vendas", exigeArea("financeiro"), exigePermissao("verValores"), zValidator("query", consultaVendasLeiteSchema, (r, c) => {
    if (!r.success) return c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422);
  }), async c => {
    try {
      const propriedadeId = await resolverEscopoLeitura(c);
      if (propriedadeId === null) throw new RebanhoError("VALIDACAO", "Selecione um sítio para consultar as vendas de leite");
      return c.json(await consultarVendasLeite(c.req.valid("query"), { propriedadeId, usuarioId: getUsuario(c)?.id ?? null }));
    } catch (erro) { return falhaV4(c, erro); }
  })
  .post("/vendas/correcoes", exigeArea("financeiro"), exigePermissao("verValores"), exigePermissao("lancar"), validar(correcaoVendaLeiteSchema), async c => {
    try { return c.json(await corrigirVendaLeite(c.req.valid("json"), { propriedadeId: await resolverEscopoEscrita(c), usuarioId: getUsuario(c)?.id ?? null }), 201); }
    catch (erro) { return falhaV4(c, erro); }
  })
  .get(
    "/",
    zValidator("query", z.object({ produtoId: z.string().uuid() }), (r, c) => {
      if (!r.success)
        return c.json(
          { error: "Selecione um produto de leite", code: "VALIDACAO" },
          422,
        );
    }),
    async (c) => {
      try {
        const propriedadeId = await resolverEscopoLeitura(c);
        if (propriedadeId === null)
          throw new RebanhoError(
            "VALIDACAO",
            "Selecione um sítio para consultar o estoque de leite",
          );
        return c.json(
          await consultarEstoqueLeite(
            c.req.valid("query").produtoId,
            { propriedadeId, usuarioId: getUsuario(c)?.id ?? null },
            podeVerValoresFinanceiros(getUsuario(c)),
          ),
        );
      } catch (erro) {
        return falhaV4(c, erro);
      }
    },
  )
  .post(
    "/confirmacoes",
    exigePermissao("lancar"),
    validar(confirmarProducaoLeiteSchema),
    async (c) => {
      try {
        const entrada = await confirmarProducaoLeite(c.req.valid("json"), {
          propriedadeId: await resolverEscopoEscrita(c),
          usuarioId: getUsuario(c)?.id ?? null,
        });
        // A confirmação física não expõe valor, hash, snapshot de auditoria nem relações financeiras.
        return c.json(
          {
            id: entrada.id,
            sessaoId: entrada.sessaoId,
            versaoSessao: entrada.versaoSessao,
            status: entrada.status,
            quantidadeLitros: entrada.movimento.quantidade.toString(),
          },
          201,
        );
      } catch (erro) {
        return falhaV4(c, erro);
      }
    },
  )
  .post("/confirmacoes-sessao", exigePermissao("lancar"), validar(confirmarSessaoProducaoLeiteSchema), async c => {
    try {
      return c.json(await confirmarSessaoProducaoLeite(c.req.valid("json"), {
        propriedadeId: await resolverEscopoEscrita(c), usuarioId: getUsuario(c)?.id ?? null,
      }), 201);
    } catch (erro) { return falhaV4(c, erro); }
  })
  .post(
    "/anulacoes",
    exigePermissao("lancar"),
    validar(anularEntradaLeiteSchema),
    async (c) => {
      try {
        const inverso = await anularEntradaProducaoLeite(c.req.valid("json"), {
          propriedadeId: await resolverEscopoEscrita(c),
          usuarioId: getUsuario(c)?.id ?? null,
        });
        return c.json({
          id: inverso.id,
          quantidadeLitros: inverso.quantidade.toString(),
        });
      } catch (erro) {
        return falhaV4(c, erro);
      }
    },
  )
  .post(
    "/classificacoes",
    exigePermissao("lancar"),
    validar(classificarEntradaLeiteSchema),
    async (c) => {
      try {
        const r = await classificarEntradaLeite(c.req.valid("json"), {
          propriedadeId: await resolverEscopoEscrita(c),
          usuarioId: getUsuario(c)?.id ?? null,
        });
        return c.json(
          {
            id: r.id,
            entradaId: r.entradaId,
            versao: r.versao,
            natureza: r.natureza,
          },
          201,
        );
      } catch (erro) {
        return falhaV4(c, erro);
      }
    },
  )
  .post(
    "/vendas",
    exigeArea("financeiro"),
    exigePermissao("verValores"),
    exigePermissao("lancar"),
    validar(vendaLeiteSchema),
    async (c) => {
      try {
        return c.json(
          await venderLeite(c.req.valid("json"), {
            propriedadeId: await resolverEscopoEscrita(c),
            usuarioId: getUsuario(c)?.id ?? null,
          }),
          201,
        );
      } catch (erro) {
        return falhaV4(c, erro);
      }
    },
  )
  .post(
    "/apuracoes",
    exigeArea("financeiro"),
    exigePermissao("verValores"),
    exigePermissao("lancar"),
    validar(apuracaoValorLeiteSchema),
    async (c) => {
      try {
        return c.json(
          await apurarValorProducaoLeite(c.req.valid("json"), {
            propriedadeId: await resolverEscopoEscrita(c),
            usuarioId: getUsuario(c)?.id ?? null,
          }),
          201,
        );
      } catch (erro) {
        return falhaV4(c, erro);
      }
    },
  );
