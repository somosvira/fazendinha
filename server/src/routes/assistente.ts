import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { env } from "../env.js";
import { prisma } from "../db.js";
import { getUsuario } from "../middleware/permissao.js";
import { PropriedadeError, resolverEscopoLeitura } from "../services/propriedade.js";
import { LimiteFixo } from "../services/auth/rate-limit.js";
import { artigosDisponiveis } from "../services/assistente/ajuda.js";
import { perguntaAssistenteSchema, responderPergunta } from "../services/assistente/agente.js";
import { consultaFinanceiraSchema, podeConsultarFinanceiro } from "../services/assistente/financeiro.js";
import { executarFerramenta } from "../services/assistente/registro.js";
import { apresentar, AssistenteError, type ContextoAssistente } from "../services/assistente/tipos.js";
import { MAX_AUDIO_BYTES, transcreverAudio } from "../services/assistente/midia.js";

const entradaSchema = z.union([
  perguntaAssistenteSchema,
  z.object({ artigoId: z.string().min(1).max(80) }).strict(),
  z.object({ consulta: consultaFinanceiraSchema }).strict(),
]);
const limite = new LimiteFixo(12, 60_000);
const visoes = ["resumo", "saldo", "pagar", "receber", "despesas_categoria"] as const;
async function contexto(c: Parameters<typeof getUsuario>[0]): Promise<ContextoAssistente> {
  const usuario = getUsuario(c)!;
  const propriedadeId = await resolverEscopoLeitura(c);
  const sitio = propriedadeId == null ? null : await prisma.propriedade.findFirst({ where: { id: propriedadeId, ativo: true }, select: { nome: true } });
  if (propriedadeId != null && !sitio) throw new PropriedadeError("ESCOPO_INVALIDO", "Sítio não encontrado ou inativo.");
  return { usuario, propriedadeId, nomeEscopo: sitio?.nome ?? "Consolidado", agora: new Date() };
}
function falha(c: Parameters<typeof getUsuario>[0], erro: unknown) {
  if (erro instanceof PropriedadeError || erro instanceof z.ZodError) return c.json({ error: "Confira os parâmetros da consulta e o sítio selecionado.", code: "VALIDACAO" }, 422);
  if (erro instanceof AssistenteError) return c.json({ error: erro.message, code: erro.code }, erro.code === "VALIDACAO" ? 422 : 503);
  console.error("[assistente] falha de consulta", erro instanceof Error ? erro.name : "desconhecida");
  return c.json({ error: "Não foi possível consultar os dados. Tente novamente.", code: "INDISPONIVEL" }, 503);
}
export const assistenteRouter = new Hono()
  .use("/assistente/*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    const u = getUsuario(c);
    // Canal novo só aceita identidade real; a ponte sintética não cria sessões.
    if (!u || u.id <= 0 || u.status !== "ATIVO") return c.json({ error: "Autentique-se para usar o assistente." }, 401);
    if (!env.ASSISTENTE_CONSULTA_ENABLED) return c.json({ error: "Assistente indisponível neste ambiente.", code: "DESABILITADO" }, 503);
    return next();
  })
  .get("/assistente/configuracao", async c => {
    try {
      const ctx = await contexto(c);
      return c.json({ conversaDisponivel: !!env.OPENAI_API_KEY?.trim(), escopo: { propriedadeId: ctx.propriedadeId, nome: ctx.nomeEscopo }, consultas: visoes.filter(visao => podeConsultarFinanceiro(ctx, visao)), artigos: artigosDisponiveis(ctx).map(a => ({ id: a.id, titulo: a.titulo })) });
    } catch (e) { return falha(c, e); }
  })
  .post("/assistente/transcrever", bodyLimit({ maxSize: MAX_AUDIO_BYTES + 16_384, onError: c => c.json({ error: "Envie um áudio de até 60 segundos." }, 413) }), async c => {
    if (!limite.consumir(String(getUsuario(c)!.id))) return c.json({ error: "Aguarde um minuto antes de transcrever outro áudio.", code: "LIMITE" }, 429, { "Retry-After": "60" });
    try {
      // Valida também o sítio antes de enviar qualquer mídia ao provedor.
      await contexto(c);
      let form: FormData;
      try { form = await c.req.formData(); }
      catch { throw new AssistenteError("VALIDACAO", "Envie o áudio pelo gravador ou seletor do assistente."); }
      const arquivo = form.get("audio");
      if ([...form.keys()].length !== 1 || !(arquivo instanceof File) || arquivo.size > MAX_AUDIO_BYTES || arquivo.type !== "audio/wav") throw new AssistenteError("VALIDACAO", "Envie um áudio válido pelo gravador ou seletor do assistente.");
      return c.json({ texto: await transcreverAudio(new Uint8Array(await arquivo.arrayBuffer())) });
    } catch (e) { return falha(c, e); }
  })
  .post("/assistente/consultar", bodyLimit({ maxSize: 3_000_000, onError: c => c.json({ error: "Pergunta ou print muito grande." }, 413) }),
    zValidator("json", entradaSchema, (resultado, c) => { if (!resultado.success) return c.json({ error: "Envie uma pergunta de até 2.000 caracteres ou uma consulta válida.", code: "VALIDACAO" }, 422); }), async c => {
      if (!limite.consumir(String(getUsuario(c)!.id))) return c.json({ error: "Você fez muitas consultas. Aguarde um minuto e tente novamente.", code: "LIMITE" }, 429, { "Retry-After": "60" });
      try {
        const entrada = c.req.valid("json");
        const ctx = await contexto(c);
        const conteudo = "artigoId" in entrada ? await executarFerramenta("consultar_ajuda", entrada, ctx)
          : "consulta" in entrada ? await executarFerramenta("consultar_financeiro", entrada.consulta, ctx)
          : await responderPergunta(entrada, ctx);
        return c.json(apresentar(conteudo, ctx));
      } catch (e) { return falha(c, e); }
    });
