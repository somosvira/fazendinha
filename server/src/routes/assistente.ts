import { assistenteRadarRouter } from "./assistente-radar.js";
import { assistenteMetasRouter } from "./assistente-metas.js";
import { contextoAssistente as contexto, falhaAssistente as falha } from "../services/assistente/contexto-http.js";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { emitirLocucao, lerLocucao } from "../services/assistente/locucao.js";
import {
  conversaSchema,
  contextoHistorico,
  listarConversas,
  obterConversa,
  salvarConversa,
} from "../services/assistente/conversas.js";
import {
  confirmarPesagem,
  podeEditarRebanho,
} from "../services/assistente/pesagem.js";
import { env } from "../env.js";
import { prisma } from "../db.js";
import { getUsuario } from "../middleware/permissao.js";
import {
  PropriedadeError,
  resolverEscopoLeitura,
} from "../services/propriedade.js";
import { LimiteFixo } from "../services/auth/rate-limit.js";
import { artigosDisponiveis } from "../services/assistente/ajuda.js";
import {
  perguntaAssistenteSchema,
  responderPergunta,
} from "../services/assistente/agente.js";
import {
  consultaFinanceiraSchema,
  podeConsultarFinanceiro,
} from "../services/assistente/financeiro.js";
import { executarFerramenta } from "../services/assistente/registro.js";
import {
  apresentar,
  AssistenteError,
  type ContextoAssistente,
} from "../services/assistente/tipos.js";
import {
  MAX_AUDIO_BYTES,
  transcreverAudio,
} from "../services/assistente/midia.js";
import { sintetizarResposta } from "../services/assistente/voz.js";

const entradaSchema = z.union([
  perguntaAssistenteSchema,
  z.object({ artigoId: z.string().min(1).max(80) }).strict(),
  z.object({ consulta: consultaFinanceiraSchema }).strict(),
]);
const limite = new LimiteFixo(12, 60_000);
const visoes = [
  "resumo",
  "saldo",
  "pagar",
  "receber",
  "despesas_categoria",
] as const;
export const assistenteRouter = new Hono()
  .use("/assistente/*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    const u = getUsuario(c);
    // Canal novo só aceita identidade real; a ponte sintética não cria sessões.
    if (!u || u.id <= 0 || u.status !== "ATIVO")
      return c.json({ error: "Autentique-se para usar o assistente." }, 401);
    if (!env.ASSISTENTE_CONSULTA_ENABLED)
      return c.json(
        {
          error: "Assistente indisponível neste ambiente.",
          code: "DESABILITADO",
        },
        503,
      );
    return next();
  })
  .route("/", assistenteRadarRouter)
  .route("/", assistenteMetasRouter)
  .get("/assistente/configuracao", async (c) => {
    try {
      const ctx = await contexto(c);
      return c.json({
        contextoHistorico: contextoHistorico(ctx),
        conversaDisponivel: !!env.OPENAI_API_KEY?.trim(),
        podeEditar: podeEditarRebanho(ctx.usuario),
        escopo: { propriedadeId: ctx.propriedadeId, nome: ctx.nomeEscopo },
        consultas: visoes.filter((visao) =>
          podeConsultarFinanceiro(ctx, visao),
        ),
        artigos: artigosDisponiveis(ctx).map((a) => ({
          id: a.id,
          titulo: a.titulo,
        })),
      });
    } catch (e) {
      return falha(c, e);
    }
  })
  .post(
    "/assistente/ouvir",
    bodyLimit({ maxSize: 32_000 }),
    zValidator(
      "json",
      z.object({ token: z.string().min(1).max(20000) }).strict(),
    ),
    async (c) => {
      if (!limite.consumir(String(getUsuario(c)!.id)))
        return c.json(
          { error: "Aguarde um minuto antes de ouvir novamente." },
          429,
        );
      try {
        const ctx = await contexto(c);
        return c.json({
          audio: await sintetizarResposta(
            lerLocucao(c.req.valid("json").token, ctx),
          ),
        });
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .get("/assistente/conversas", async (c) => {
    try {
      return c.json(await listarConversas(await contexto(c)));
    } catch (e) {
      return falha(c, e);
    }
  })
  .get("/assistente/conversas/:id", async (c) => {
    if (!z.string().uuid().safeParse(c.req.param("id")).success)
      return c.json({ error: "Conversa inválida." }, 422);
    try {
      const conversa = await obterConversa(
        c.req.param("id"),
        await contexto(c),
      );
      return conversa
        ? c.json(conversa)
        : c.json({ error: "Conversa indisponível." }, 404);
    } catch (e) {
      return falha(c, e);
    }
  })
  .put(
    "/assistente/conversas",
    bodyLimit({ maxSize: 2_000_000 }),
    zValidator("json", conversaSchema),
    async (c) => {
      try {
        const resultado = await salvarConversa(
          c.req.valid("json"),
          await contexto(c),
        );
        return c.json({ salvo: true, ...resultado });
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .post(
    "/assistente/confirmar",
    zValidator(
      "json",
      z
        .object({
          token: z.string().min(1).max(3000),
          modo: z.literal("editar"),
        })
        .strict(),
    ),
    async (c) => {
      try {
        const ctx = { ...(await contexto(c)), modo: "editar" as const };
        if (!podeEditarRebanho(ctx.usuario))
          return c.json(
            { error: "Sem permissão para registrar pesagens." },
            403,
          );
        return c.json(
          apresentar(
            await confirmarPesagem(c.req.valid("json").token, ctx),
            ctx,
          ),
        );
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .post(
    "/assistente/transcrever",
    bodyLimit({
      maxSize: MAX_AUDIO_BYTES + 16_384,
      onError: (c) =>
        c.json({ error: "Envie um áudio de até 60 segundos." }, 413),
    }),
    async (c) => {
      if (!limite.consumir(String(getUsuario(c)!.id)))
        return c.json(
          {
            error: "Aguarde um minuto antes de transcrever outro áudio.",
            code: "LIMITE",
          },
          429,
          { "Retry-After": "60" },
        );
      try {
        // Valida também o sítio antes de enviar qualquer mídia ao provedor.
        await contexto(c);
        let form: FormData;
        try {
          form = await c.req.formData();
        } catch {
          throw new AssistenteError(
            "VALIDACAO",
            "Envie o áudio pelo gravador ou seletor do assistente.",
          );
        }
        const arquivo = form.get("audio");
        if (
          [...form.keys()].length !== 1 ||
          !(arquivo instanceof File) ||
          arquivo.size > MAX_AUDIO_BYTES ||
          arquivo.type !== "audio/wav"
        )
          throw new AssistenteError(
            "VALIDACAO",
            "Envie um áudio válido pelo gravador ou seletor do assistente.",
          );
        return c.json({
          texto: await transcreverAudio(
            new Uint8Array(await arquivo.arrayBuffer()),
          ),
        });
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .post(
    "/assistente/conversar",
    bodyLimit({
      maxSize: 32_000,
      onError: (c) => c.json({ error: "Pergunta muito grande." }, 413),
    }),
    zValidator(
      "json",
      perguntaAssistenteSchema.omit({ imagem: true, documento: true }),
      (resultado, c) => {
        if (!resultado.success)
          return c.json(
            {
              error: "Envie uma pergunta de até 2.000 caracteres.",
              code: "VALIDACAO",
            },
            422,
          );
      },
    ),
    async (c) => {
      if (!limite.consumir(String(getUsuario(c)!.id)))
        return c.json(
          {
            error: "Aguarde um minuto antes de continuar a conversa.",
            code: "LIMITE",
          },
          429,
          { "Retry-After": "60" },
        );
      try {
        const ctx = await contexto(c);
        const conteudo = await responderPergunta(c.req.valid("json"), ctx);
        const resposta = apresentar(conteudo, ctx);
        // Resultado negado fica escrito; o cliente encerra a voz e limpa dados anteriores.
        if (conteudo.modo === "acesso_negado")
          return c.json({ ...resposta, audio: null });
        try {
          return c.json({
            ...resposta,
            audio: await sintetizarResposta(conteudo.resposta),
          });
        } catch {
          return c.json({
            ...resposta,
            audio: null,
            avisoVoz:
              "Não foi possível gerar a voz. Confira a resposta escrita e retome quando quiser.",
          });
        }
      } catch (e) {
        return falha(c, e);
      }
    },
  )
  .post(
    "/assistente/consultar",
    bodyLimit({
      maxSize: 3_000_000,
      onError: (c) => c.json({ error: "Pergunta ou print muito grande." }, 413),
    }),
    zValidator("json", entradaSchema, (resultado, c) => {
      if (!resultado.success)
        return c.json(
          {
            error:
              "Envie uma pergunta de até 2.000 caracteres ou uma consulta válida.",
            code: "VALIDACAO",
          },
          422,
        );
    }),
    async (c) => {
      if (!limite.consumir(String(getUsuario(c)!.id)))
        return c.json(
          {
            error:
              "Você fez muitas consultas. Aguarde um minuto e tente novamente.",
            code: "LIMITE",
          },
          429,
          { "Retry-After": "60" },
        );
      try {
        const entrada = c.req.valid("json");
        const ctx = await contexto(c);
        const conteudo =
          "artigoId" in entrada
            ? await executarFerramenta("consultar_ajuda", entrada, ctx)
            : "consulta" in entrada
              ? await executarFerramenta(
                  "consultar_financeiro",
                  entrada.consulta,
                  ctx,
                )
              : await responderPergunta(entrada, ctx);
        return c.json({
          ...apresentar(conteudo, ctx),
          ...(conteudo.modo !== "acesso_negado"
            ? { locucao: emitirLocucao(conteudo.resposta, ctx) }
            : {}),
        });
      } catch (e) {
        return falha(c, e);
      }
    },
  );
