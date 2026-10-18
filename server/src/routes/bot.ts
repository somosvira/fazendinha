import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { zValidator } from "@hono/zod-validator";
import { consultarAssistente } from "../services/bot/agent.js";
import { BotDesligadoError } from "../services/bot/openai.js";
import { perguntaSchema, ConsultaAssistenteError } from "../services/bot/consulta.schema.js";
import { transcreverAudio, LIMITE_AUDIO } from "../services/bot/audio.js";
import { resolverEscopoLeitura } from "../services/propriedade.js";
import { getUsuario } from "../middleware/permissao.js";
import { temArea, temPermissao } from "../services/auth/papeis.js";
import { env } from "../env.js";
import type { Context } from "hono";

function falha(c: Context, erro: unknown) {
  if (erro instanceof BotDesligadoError) return c.json({ error: erro.message }, 503);
  if (erro instanceof ConsultaAssistenteError) return c.json({ error: erro.message }, 422);
  console.error("[assistente] falha na consulta", erro instanceof Error ? erro.name : "Erro");
  return c.json({ error: "Não consegui concluir agora. Tente novamente em instantes." }, 502);
}

export const botRouter = new Hono()
  .use("/bot/*", async (c, next) => {
    const u = getUsuario(c);
    if (!u || u.id <= 0) return c.json({ error: "Entre com uma conta pessoal para usar o assistente." }, 401);
    const permissoes = ["verValores", "verSalarios", "verInvestimento"] as const;
    // Totais integrais: não liberar para perfis que não podem consultar parte deles.
    if (!temArea(u, "financeiro") || !permissoes.every(flag => temPermissao(u, flag))) {
      return c.json({ error: "Esta versão exige acesso ao Financeiro e permissão para consultar valores, pessoal/salários e investimentos. Peça ao proprietário para revisar seu acesso." }, 403);
    }
    await next();
  })
  .get("/bot/status", c => c.json({ configurado: !!env.OPENAI_API_KEY?.trim() }))
  .post("/bot/ask", bodyLimit({ maxSize: 16_384 }), zValidator("json", perguntaSchema, (result, c) => {
    if (!result.success) return c.json({ error: "Envie uma pergunta com até 2.000 caracteres e um contexto válido." }, 422);
  }), async c => {
    try {
      const { pergunta, contexto } = c.req.valid("json");
      return c.json(await consultarAssistente(pergunta, contexto ?? null, await resolverEscopoLeitura(c)));
    } catch (erro) { return falha(c, erro); }
  })
  .post("/bot/transcrever", bodyLimit({ maxSize: LIMITE_AUDIO + 64 * 1024, onError: c => c.json({ error: "Envie um áudio com até 10 MB." }, 413) }), async c => {
    try {
      let form: FormData;
      try { form = await c.req.raw.formData(); }
      catch { return c.json({ error: "Envie o arquivo de áudio em um formulário válido." }, 422); }
      const arquivo = form.get("audio");
      if (!(arquivo instanceof File)) return c.json({ error: "Selecione ou grave um áudio." }, 422);
      return c.json({ texto: await transcreverAudio(arquivo) });
    } catch (erro) { return falha(c, erro); }
  });
