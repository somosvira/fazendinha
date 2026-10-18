import {listarBibliotecaReprodutiva,copiarReferenciaSchema,copiarReferenciaReprodutiva} from "../../services/pecuaria/reproducao/biblioteca.js";
import * as acompanhamento from "../../services/pecuaria/reproducao/acompanhamento.js";
import * as acompanhamentoSchemas from "../../services/pecuaria/reproducao/acompanhamento.schemas.js";
import { ValorizacaoError } from "../../services/estoque/valorizacao.calc.js";
import * as elegibilidade from "../../services/pecuaria/reproducao/elegibilidade.js";
import * as elegibilidadeSchemas from "../../services/pecuaria/reproducao/elegibilidade.schemas.js";
import * as emissoes from "../../services/pecuaria/reproducao/emissoes-relatorios.js";
import { consultaIndicadoresSchema } from "../../services/pecuaria/reproducao/indicadores.schemas.js";
import { consultarIndicadoresReprodutivos } from "../../services/pecuaria/reproducao/indicadores.js";
import { emitirRelatorioPartos, periodoRelatorioPartosSchema } from "../../services/pecuaria/reproducao/relatorio-partos.js";
import * as colostro from "../../services/pecuaria/reproducao/colostro.js";
import { fornecimentoColostroSchema, correcaoColostroSchema } from "../../services/pecuaria/reproducao/colostro.schemas.js";
import { correcaoPartoAmpliadaSchema } from "../../services/pecuaria/reproducao/partos.schemas.js";
import * as exames from "../../services/pecuaria/sanidade/exames.js";
import { camposExameSchema } from "../../services/pecuaria/exames/formatos.js";
import { Hono, type Context, type MiddlewareHandler } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { getUsuario } from "../../middleware/permissao.js";
import { podeConsultarCustosPecuaria, podeVerValoresFinanceiros } from "../../services/pecuaria/custos/permissoes.js";
import { PropriedadeError } from "../../services/propriedade.js";
import { resolverEscopoEscrita, resolverEscopoLeitura } from "./escopo-custos.js";
import { FinanceiroError } from "../../services/financeiro/regras.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { conferirAnimalNoFato } from "../../services/pecuaria/fatos.js";
import { conflitoTransacaoPecuaria } from "../../services/pecuaria/transacao.js";
import * as s from "../../services/pecuaria/reproducao/schemas.js";
import * as registros from "../../services/pecuaria/reproducao/registros.js";
import * as correcoes from "../../services/pecuaria/reproducao/correcoes.js";
import * as iatf from "../../services/pecuaria/reproducao/iatf.js";
import { lactacaoHistoricaSchema, registrarLactacaoHistorica } from "../../services/pecuaria/reproducao/lactacoes.js";
export const validarV4 = <T extends z.ZodTypeAny>(schema: T) =>
  zValidator("json", schema, (r, c) =>
    !r.success
      ? c.json(
          {
            error: r.error.issues[0].message,
            code: "VALIDACAO",
            campo: r.error.issues[0].path.join("."),
          },
          422,
        )
      : undefined,
  );
export const usuarioV4 = (c: Context) => {
  const id = getUsuario(c)?.id;
  return id && id > 0 ? id : null;
};
export function apresentarV4<T>(c: Context, resultado: T): T {
  const u = getUsuario(c);
  return registros.mascararCustos(
    resultado,
    podeVerValoresFinanceiros(u),
    podeConsultarCustosPecuaria(u),
    c.get("sitioCustosPecuaria") as number | null | undefined,
  );
}
export function falhaV4(c: Context, e: unknown) {
  if (e instanceof ValorizacaoError) return c.json({ error: e.message, code: e.code }, e.code === "VALIDACAO" ? 422 : 409);
  if (e instanceof z.ZodError)
    return c.json(
      {
        error: e.issues[0].message,
        code: "VALIDACAO",
        campo: e.issues[0].path.join("."),
      },
      422,
    );
  if (e instanceof RebanhoError || e instanceof FinanceiroError)
    return c.json(
      { error: e.message, code: e.code, campo: e.campo },
      e.code === "NAO_ENCONTRADO" ? 404 : e.code === "VALIDACAO" ? 422 : 409,
    );
  if (e instanceof PropriedadeError)
    return c.json({ error: e.message, code: e.code }, 400);
  if (
    conflitoTransacaoPecuaria(e) ||
    (e instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2025"].includes(e.code))
  )
    return c.json(
      {
        error: "Os dados mudaram; recarregue e confirme novamente",
        code: "CONFLITO",
      },
      409,
    );
  console.error("[pecuaria/v4]", e);
  return c.json({ error: "Erro inesperado ao processar reprodução" }, 500);
}
const encerramento = z
  .object({ propriedadeId: s.sitio, data: s.data, motivo: s.motivo })
  .strict();
const execucao = z
  .object({
    propriedadeId: s.sitio,
    chave: s.uuid,
    realizadaEm: s.dataOuHorario,
    dados: z.record(z.unknown()),
    motivo: s.motivo.optional(),
  })
  .strict();
export const protegerCustosV4: MiddlewareHandler = async (c, next) => {
  if (["POST", "PUT", "PATCH"].includes(c.req.method)) {
    let corpo: unknown;
    try {
      corpo = await c.req.json();
    } catch {
      return next();
    }
    const contemValor = (v: unknown): boolean =>
      !!v &&
      typeof v === "object" &&
      (Array.isArray(v)
        ? v.some(contemValor)
        : Object.entries(v).some(
            ([k, x]) =>
              [
                "valorServicoAtribuido",
                "valorProdutoAtribuido",
                "valorTotal",
                "custoUnitario",
              ].includes(k) || contemValor(x),
          ));
    const u = getUsuario(c);
    if (
      contemValor(corpo) &&
      !podeVerValoresFinanceiros(u)
    )
      return c.json(
        {
          error: "Sem permissão para atribuir valores financeiros",
          code: "SEM_PERMISSAO",
        },
        403,
      );
  }
  return next();
};
export const reproducaoRouter = new Hono()
  .use("*", protegerCustosV4)
  .get("/biblioteca",c=>{try{return c.json(listarBibliotecaReprodutiva(z.string().max(200).parse(c.req.query("busca")??"")));}catch(e){return falhaV4(c,e);}})
  .post("/biblioteca/:id/copiar",validarV4(copiarReferenciaSchema),async c=>{try{const b=c.req.valid("json");return c.json(await copiarReferenciaReprodutiva(c.req.param("id"),{...b,propriedadeId:await resolverEscopoEscrita(c,b.propriedadeId)},usuarioV4(c)),201);}catch(e){return falhaV4(c,e);}})
  .get("/acompanhamento/politicas", async c=>{try{return c.json(await acompanhamento.listarPoliticasAcompanhamento(s.sitio.parse(await resolverEscopoLeitura(c))));}catch(e){return falhaV4(c,e);}})
  .post("/acompanhamento/politicas",validarV4(acompanhamentoSchemas.criarPoliticaAcompanhamentoSchema),async c=>{try{const b=c.req.valid("json");return c.json(await acompanhamento.criarPoliticaAcompanhamento({...b,propriedadeId:await resolverEscopoEscrita(c,b.propriedadeId)},usuarioV4(c)),201);}catch(e){return falhaV4(c,e);}})
  .get("/acompanhamento",async c=>{try{const q=acompanhamentoSchemas.consultaAcompanhamentoSchema.parse({animalId:c.req.query("animalId"),data:c.req.query("data")});return c.json(await acompanhamento.listarAcompanhamentos(s.sitio.parse(await resolverEscopoLeitura(c)),q.animalId,q.data??new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})));}catch(e){return falhaV4(c,e);}})
  .post("/acompanhamento/adocao/previa",validarV4(acompanhamentoSchemas.previaAdocaoAcompanhamentoSchema),async c=>{try{const b=c.req.valid("json");return c.json(await acompanhamento.previaAdocaoAcompanhamento({...b,propriedadeId:await resolverEscopoEscrita(c,b.propriedadeId)}));}catch(e){return falhaV4(c,e);}})
  .post("/acompanhamento/adocao",validarV4(acompanhamentoSchemas.adotarAcompanhamentoSchema),async c=>{try{const b=c.req.valid("json");return c.json(await acompanhamento.adotarAcompanhamento({...b,propriedadeId:await resolverEscopoEscrita(c,b.propriedadeId)},usuarioV4(c)));}catch(e){return falhaV4(c,e);}})
  .get("/colostro", async (c) => {
    try {
      const criaId = s.uuid.parse(c.req.query("criaId"));
      const propriedadeId = s.sitio.parse(await resolverEscopoLeitura(c));
      return c.json(await colostro.listarColostro(criaId, propriedadeId));
    } catch (e) { return falhaV4(c, e); }
  })
  .post("/colostro", validarV4(fornecimentoColostroSchema), async (c) => {
    try { const b = c.req.valid("json");
      return c.json(await colostro.registrarColostro({ ...b,
        propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
      }, usuarioV4(c)), 201);
    } catch (e) { return falhaV4(c, e); }
  })
  .patch("/colostro/:id", validarV4(correcaoColostroSchema), async (c) => {
    try { const b = c.req.valid("json");
      return c.json(await colostro.corrigirColostro(s.uuid.parse(c.req.param("id")), { ...b,
        propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
      }, usuarioV4(c)));
    } catch (e) { return falhaV4(c, e); }
  })
  .post("/lactacoes", validarV4(lactacaoHistoricaSchema), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(await registrarLactacaoHistorica({ ...b,
        propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
      }, usuarioV4(c)), 201);
    } catch (e) { return falhaV4(c, e); }
  })
  .get("/", async (c) => {
    try {
      const animalId = c.req.query("animalId");
      if (animalId) s.uuid.parse(animalId);
      return c.json(
        apresentarV4(
          c,
          await registros.painelReproducao(
            await resolverEscopoLeitura(c),
            animalId,
          ),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .get("/animais/:id", async (c) => {
    try {
      s.uuid.parse(c.req.param("id"));
      return c.json(
        apresentarV4(
          c,
          await registros.painelReproducao(
            await resolverEscopoLeitura(c),
            c.req.param("id"),
          ),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post(
    "/situacoes-iniciais",
    validarV4(s.situacaoInicialSchema),
    async (c) => {
      try {
        const b = c.req.valid("json");
        const propriedadeId = await resolverEscopoEscrita(c, b.propriedadeId);
        return c.json(
          await registros.criarSituacaoInicial(
            { ...b, propriedadeId },
            usuarioV4(c),
          ),
          201,
        );
      } catch (e) {
        return falhaV4(c, e);
      }
    },
  )
  .post("/restricoes", validarV4(s.restricaoSchema), async (c) => {
    try {
      const b = c.req.valid("json");
      const propriedadeId = await resolverEscopoEscrita(c, b.propriedadeId);
      return c.json(
        await registros.criarRestricao({ ...b, propriedadeId }, usuarioV4(c)),
        201,
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post("/restricoes/:id/encerramento", validarV4(encerramento), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await registros.encerrarRestricao(
          c.req.param("id"),
          await resolverEscopoEscrita(c, b.propriedadeId),
          b.data,
          b.motivo,
          usuarioV4(c),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post("/regras-sanitarias", validarV4(s.regraSanitariaSchema), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await registros.configurarRegraSanitaria(
          {
            ...b,
            propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
          },
          usuarioV4(c),
        ),
        201,
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post("/tentativas", validarV4(s.tentativaSchema), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        apresentarV4(
          c,
          await registros.criarTentativa(
            {
              ...b,
              propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
            },
            usuarioV4(c),
          ),
        ),
        201,
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post("/avaliacoes", validarV4(s.avaliacaoSchema), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await registros.criarAvaliacao(
          {
            ...b,
            propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
          },
          usuarioV4(c),
        ),
        201,
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post("/partos", validarV4(s.partoSchema), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        apresentarV4(c, await registros.criarParto(
          {
            ...b,
            propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
          },
          usuarioV4(c),
        )),
        201,
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post("/perdas", validarV4(s.perdaSchema), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await registros.registrarPerda(
          {
            ...b,
            propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
          },
          usuarioV4(c),
        ),
        201,
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post("/lactacoes/:id/encerramento", validarV4(encerramento), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await registros.encerrarLactacao(
          c.req.param("id"),
          await resolverEscopoEscrita(c, b.propriedadeId),
          b.data,
          b.motivo,
          usuarioV4(c),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post("/exposicoes", validarV4(s.exposicaoSchema), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await registros.criarExposicao(
          {
            ...b,
            propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
          },
          usuarioV4(c),
        ),
        201,
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .get("/tipos-exame", async c => {
    try { await resolverEscopoLeitura(c); return c.json(await exames.listarTiposExame(c.req.query("incluirInativos") === "true", "REPRODUTIVO")); }
    catch (e) { return falhaV4(c, e); }
  })
  .post("/tipos-exame", validarV4(z.object({ versaoAnteriorId: z.string().uuid().optional(), nome: z.string().trim().min(2).max(120), tipoResultado: z.literal("MULTIPLO"), campos: camposExameSchema, unidade: z.string().max(30).nullish(), opcoes: z.array(z.string()).nullish() }).strict()), async c => {
    try { await resolverEscopoLeitura(c); return c.json(await exames.criarTipoExame(c.req.valid("json"), usuarioV4(c), "REPRODUTIVO"), 201); }
    catch (e) { return falhaV4(c, e); }
  })
  .patch("/tipos-exame/:id", validarV4(z.object({ nome: z.string().trim().min(2).max(120).optional(), ativo: z.boolean().optional(), tipoResultado: z.literal("MULTIPLO").optional(), campos: camposExameSchema.optional(), unidade: z.string().max(30).nullish(), opcoes: z.array(z.string()).nullish() }).strict()), async c => {
    try { await resolverEscopoLeitura(c); const id = z.string().uuid().parse(c.req.param("id"));
      if (!await prisma.tipoExame.findFirst({ where: { id, contexto: { in: ["REPRODUTIVO", "COMPARTILHADO"] } } })) throw new RebanhoError("NAO_ENCONTRADO", "Tipo de exame reprodutivo não encontrado");
      return c.json(await exames.editarTipoExame(id, c.req.valid("json"), usuarioV4(c)));
    } catch (e) { return falhaV4(c, e); }
  })
  .get("/protocolos", async (c) => {
    try {
      await resolverEscopoLeitura(c);
      return c.json(
        apresentarV4(
          c,
          await iatf.listarProtocolos(),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post("/protocolos", validarV4(s.protocoloSchema), async (c) => {
    try {
      await resolverEscopoLeitura(c);
      return c.json(
        await iatf.criarProtocolo(c.req.valid("json"), usuarioV4(c)),
        201,
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .patch("/protocolos/:id", validarV4(s.protocoloSchema), async c => {
    try { await resolverEscopoLeitura(c); return c.json(await iatf.editarProtocolo(z.string().uuid().parse(c.req.param("id")), c.req.valid("json"), usuarioV4(c))); }
    catch (e) { return falhaV4(c, e); }
  })
  .post("/protocolos/:id/publicar", async c => {
    try { await resolverEscopoLeitura(c); return c.json(await iatf.publicarProtocolo(z.string().uuid().parse(c.req.param("id")), usuarioV4(c))); }
    catch (e) { return falhaV4(c, e); }
  })
  .post("/protocolos/:id/inativar", async c => {
    try { await resolverEscopoLeitura(c); return c.json(await iatf.inativarProtocolo(z.string().uuid().parse(c.req.param("id")), usuarioV4(c))); }
    catch (e) { return falhaV4(c, e); }
  })
  .get("/participacoes", async (c) => {
    try {
      const animalId = z.string().uuid().parse(c.req.query("animalId"));
      const propriedadeId = await resolverEscopoLeitura(c);
      return c.json(apresentarV4(c, await iatf.listarProgramacoes(propriedadeId, undefined, animalId)));
    } catch (e) { return falhaV4(c, e); }
  })
  .get("/programacoes", async (c) => {
    try {
      return c.json(
        apresentarV4(
          c,
          await iatf.listarProgramacoes(await resolverEscopoLeitura(c)),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .get("/programacoes/:id", async (c) => {
    try {
      const item = (
        await iatf.listarProgramacoes(
          await resolverEscopoLeitura(c),
          c.req.param("id"),
        )
      )[0];
      if (!item)
        throw new RebanhoError(
          "NAO_ENCONTRADO",
          "Programação não encontrada neste sítio",
        );
      return c.json(apresentarV4(c, item));
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post("/programacoes", validarV4(s.programacaoSchema), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await iatf.criarProgramacao(
          {
            ...b,
            propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
          },
          usuarioV4(c),
        ),
        201,
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  })
  .post(
    "/participantes-iatf/:id/inicio",
    validarV4(
      z
        .object({
          propriedadeId: s.sitio,
          inicioEfetivo: s.dataOuHorario,
          cienciaSanitaria: z.boolean().optional(),
        })
        .strict(),
    ),
    async (c) => {
      try {
        const b = c.req.valid("json");
        return c.json(
          await iatf.iniciarParticipante(
            c.req.param("id"),
            await resolverEscopoEscrita(c, b.propriedadeId),
            b.inicioEfetivo,
            usuarioV4(c),
            b.cienciaSanitaria,
          ),
        );
      } catch (e) {
        return falhaV4(c, e);
      }
    },
  )
  .post(
    "/participantes-iatf/:id/retirada",
    validarV4(z.object({ propriedadeId: s.sitio, motivo: s.motivo }).strict()),
    async (c) => {
      try {
        const b = c.req.valid("json");
        return c.json(
          await iatf.retirarParticipante(
            c.req.param("id"),
            await resolverEscopoEscrita(c, b.propriedadeId),
            b.motivo,
            usuarioV4(c),
          ),
        );
      } catch (e) {
        return falhaV4(c, e);
      }
    },
  )
  .post(
    "/tarefas-iatf/:id/reprogramacao",
    validarV4(
      z
        .object({
          propriedadeId: s.sitio,
          previstaEm: s.dataOuHorario,
          motivo: s.motivo,
        })
        .strict(),
    ),
    async (c) => {
      try {
        const b = c.req.valid("json");
        return c.json(
          await iatf.reprogramarTarefa(
            c.req.param("id"),
            await resolverEscopoEscrita(c, b.propriedadeId),
            b.previstaEm,
            b.motivo,
            usuarioV4(c),
          ),
        );
      } catch (e) {
        return falhaV4(c, e);
      }
    },
  )
  .post("/tarefas-iatf/:id/execucao", validarV4(execucao), async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        apresentarV4(
          c,
          await iatf.executarTarefa(
            c.req.param("id"),
            {
              ...b,
              propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
            },
            usuarioV4(c),
          ),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  });

const tiposAnulacao = z.enum([
  "tentativas",
  "avaliacoes",
  "partos",
  "situacoes-iniciais",
  "restricoes",
]);
reproducaoRouter.get("/:tipo/:id/anulacao/previa", async (c) => {
  try {
    const tipo = tiposAnulacao.parse(c.req.param("tipo"));
    const propriedadeId = await resolverEscopoEscrita(
      c,
      Number(c.req.query("propriedadeId")),
    );
    return c.json(
      await correcoes.previaAnulacao(tipo, c.req.param("id"), propriedadeId),
    );
  } catch (e) {
    return falhaV4(c, e);
  }
});
reproducaoRouter.post(
  "/:tipo/:id/anulacao",
  validarV4(
    z
      .object({
        propriedadeId: s.sitio,
        chave: s.uuid,
        motivo: s.motivo,
        fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
        cienciaPreservacaoCrias: z.boolean().optional(),
        destinoConsumo: z
          .enum(["DEVOLVER_ESTOQUE", "MANTER_CONSUMO"])
          .optional(),
      })
      .strict(),
  ),
  async (c) => {
    try {
      const b = c.req.valid("json"),
        tipo = tiposAnulacao.parse(c.req.param("tipo"));
      return c.json(
        await correcoes.anularFato(
          tipo,
          c.req.param("id"),
          {
            ...b,
            propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
          },
          usuarioV4(c),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  },
);
reproducaoRouter.post(
  "/gestacoes/:id/previsao",
  validarV4(
    z
      .object({
        propriedadeId: s.sitio,
        previsaoParto: s.data.nullable(),
        motivo: s.motivo,
        origem: z
          .enum(["INFORMADA", "AVALIACAO", "CORRECAO"])
          .default("INFORMADA"),
      })
      .strict(),
  ),
  async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await registros.atualizarPrevisao(
          c.req.param("id"),
          await resolverEscopoEscrita(c, b.propriedadeId),
          b.previsaoParto,
          b.motivo,
          b.origem,
          usuarioV4(c),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  },
);
reproducaoRouter.post(
  "/gestacoes/:id/vinculo",
  validarV4(
    z
      .object({
        propriedadeId: s.sitio,
        tentativaId: s.uuid.nullable(),
        motivo: s.motivo,
      })
      .strict(),
  ),
  async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await registros.corrigirVinculoGestacao(
          c.req.param("id"),
          await resolverEscopoEscrita(c, b.propriedadeId),
          b.tentativaId,
          b.motivo,
          usuarioV4(c),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  },
);
reproducaoRouter.post(
  "/crias/:id/identificacao",
  validarV4(
    z
      .object({
        propriedadeId: s.sitio,
        brinco: z.string().trim().min(1).max(39),
        nome: z.string().trim().max(120).nullish(),
      })
      .strict(),
  ),
  async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await registros.completarIdentificacao(
          c.req.param("id"),
          await resolverEscopoEscrita(c, b.propriedadeId),
          b.brinco,
          b.nome,
          usuarioV4(c),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  },
);
reproducaoRouter.post(
  "/programacoes/:id/participantes",
  validarV4(
    z
      .object({
        propriedadeId: s.sitio,
        chave: s.uuid,
        cienciaSanitaria: z.boolean().optional(),
        animais: z
          .array(
            z
              .object({
                animalId: s.uuid,
                inicioPrevisto: s.dataOuHorario,
              })
              .strict(),
          )
          .min(1)
          .max(100),
      })
      .strict(),
  ),
  async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await iatf.adicionarParticipantes(
          c.req.param("id"),
          {
            ...b,
            propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
          },
          usuarioV4(c),
        ),
        201,
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  },
);
reproducaoRouter.post(
  "/partos/:id/correcao",
  validarV4(correcaoPartoAmpliadaSchema),
  async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        apresentarV4(c, await registros.corrigirParto(
          c.req.param("id"),
          {
            ...b,
            propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
          },
          usuarioV4(c),
        )),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  },
);
reproducaoRouter.post(
  "/lactacoes/:id/correcao",
  validarV4(
    z
      .object({
        propriedadeId: s.sitio,
        chave: s.uuid.optional(),
        versaoEsperada: z.number().int().positive().optional(),
        partoId: s.uuid.nullish(),
        inicio: s.data.optional(),
        encerradaEm: s.data.nullish(),
        motivo: s.motivo,
      })
      .strict(),
  ),
  async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await registros.corrigirLactacao(
          c.req.param("id"),
          {
            ...b,
            propriedadeId: await resolverEscopoEscrita(c, b.propriedadeId),
          },
          usuarioV4(c),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  },
);
reproducaoRouter.post(
  "/exposicoes/:id/encerramento",
  validarV4(encerramento),
  async (c) => {
    try {
      const b = c.req.valid("json");
      return c.json(
        await registros.encerrarExposicao(
          c.req.param("id"),
          await resolverEscopoEscrita(c, b.propriedadeId),
          b.data,
          b.motivo,
          usuarioV4(c),
        ),
      );
    } catch (e) {
      return falhaV4(c, e);
    }
  },
);

reproducaoRouter.get("/alertas-sanitarios", async c => {
  try {
    const animalId = s.uuid.parse(c.req.query("animalId"));
    const data = s.data.parse(c.req.query("data"));
    const acao = z.enum(["IA", "TE", "COBERTURA", "IATF"]).parse(c.req.query("acao"));
    const propriedadeId = await resolverEscopoEscrita(c, Number(c.req.query("propriedadeId")) || undefined);
    await conferirAnimalNoFato(prisma, animalId, propriedadeId, registros.dia(data));
    return c.json(await registros.consultaAlertasSanitariosTx(prisma, animalId, propriedadeId, registros.dia(data), acao));
  } catch(e) { return falhaV4(c,e); }
});

reproducaoRouter.post("/tarefas-iatf/:id/regularizacao",validarV4(s.regularizacaoSchema),async c=>{
  try{const b=c.req.valid("json");return c.json(apresentarV4(c,await iatf.regularizarTarefa(c.req.param("id"),{...b,propriedadeId:await resolverEscopoEscrita(c,b.propriedadeId)},usuarioV4(c))));}catch(e){return falhaV4(c,e);}
});

reproducaoRouter.get("/tarefas-iatf/:id/substitutos", async c => {
  try { return c.json(await iatf.substitutosTarefa(s.uuid.parse(c.req.param("id")), await resolverEscopoEscrita(c, Number(c.req.query("propriedadeId")) || undefined))); }
  catch (e) { return falhaV4(c, e); }
});

reproducaoRouter.get("/politicas-elegibilidade", async c => {
  try { return c.json(await elegibilidade.listarPoliticasElegibilidade(s.sitio.parse(await resolverEscopoLeitura(c)))); }
  catch(e) { return falhaV4(c,e); }
});
reproducaoRouter.post("/politicas-elegibilidade", validarV4(elegibilidadeSchemas.criarPoliticaElegibilidadeSchema), async c => {
  try { const b=c.req.valid("json"); return c.json(await elegibilidade.criarPoliticaElegibilidade({ ...b,
    propriedadeId:await resolverEscopoEscrita(c,b.propriedadeId) },usuarioV4(c)),201); }
  catch(e) { return falhaV4(c,e); }
});
reproducaoRouter.post("/vinculos-politica-ciclo", validarV4(elegibilidadeSchemas.vincularPoliticaCicloSchema), async c => {
  try { const b=c.req.valid("json"); return c.json(await elegibilidade.vincularPoliticaCiclo({ ...b,
    propriedadeId:await resolverEscopoEscrita(c,b.propriedadeId) },usuarioV4(c)),201); }
  catch(e) { return falhaV4(c,e); }
});
reproducaoRouter.post("/decisoes-elegibilidade", validarV4(elegibilidadeSchemas.decidirElegibilidadeCicloSchema), async c => {
  try { const b=c.req.valid("json"); return c.json(await elegibilidade.decidirElegibilidadeCiclo({ ...b,
    propriedadeId:await resolverEscopoEscrita(c,b.propriedadeId) },usuarioV4(c)),201); }
  catch(e) { return falhaV4(c,e); }
});
reproducaoRouter.post("/decisoes-elegibilidade/:id/anular", validarV4(elegibilidadeSchemas.anularDecisaoElegibilidadeSchema), async c => {
  try { const b=c.req.valid("json"); return c.json(await elegibilidade.anularDecisaoElegibilidade(s.uuid.parse(c.req.param("id")),{ ...b,
    propriedadeId:await resolverEscopoEscrita(c,b.propriedadeId) },usuarioV4(c))); }
  catch(e) { return falhaV4(c,e); }
});
reproducaoRouter.get("/animais/:id/elegibilidade", async c => {
  try { return c.json(await elegibilidade.consultarElegibilidadeNaData(s.uuid.parse(c.req.param("id")),
    s.sitio.parse(await resolverEscopoLeitura(c)),s.data.parse(c.req.query("data")))); }
  catch(e) { return falhaV4(c,e); }
});
reproducaoRouter.get("/indicadores", async c => {
  try { const b=consultaIndicadoresSchema.parse({ ...c.req.query(), propriedadeId: await resolverEscopoLeitura(c) });
    return c.json(await consultarIndicadoresReprodutivos(b)); }
  catch(e) { return falhaV4(c,e); }
});
reproducaoRouter.get("/relatorios/partos", async c => {
  try { const b=periodoRelatorioPartosSchema.parse({inicio:c.req.query("inicio"),fim:c.req.query("fim")});
    return c.json(await emitirRelatorioPartos({ ...b, propriedadeId:s.sitio.parse(await resolverEscopoLeitura(c)) })); }
  catch(e) { return falhaV4(c,e); }
});
reproducaoRouter.get("/relatorios/emissoes", async c => {
  try { const b=emissoes.listarEmissoesReprodutivasSchema.parse({ ...c.req.query(),propriedadeId:await resolverEscopoLeitura(c) });
    return c.json(await emissoes.listarEmissoesReprodutivas(b.tipo,b.propriedadeId)); }
  catch(e) { return falhaV4(c,e); }
});
reproducaoRouter.get("/relatorios/emissoes/:id", async c => {
  try { return c.json(await emissoes.obterEmissaoReprodutiva(s.uuid.parse(c.req.param("id")),s.sitio.parse(await resolverEscopoLeitura(c)))); }
  catch(e) { return falhaV4(c,e); }
});
reproducaoRouter.post("/relatorios/emissoes", validarV4(emissoes.criarEmissaoReprodutivaSchema), async c => {
  try { const b=c.req.valid("json"); return c.json(await emissoes.criarEmissaoReprodutiva({ ...b,
    propriedadeId:await resolverEscopoEscrita(c,b.propriedadeId) },usuarioV4(c)),201); }
  catch(e) { return falhaV4(c,e); }
});
