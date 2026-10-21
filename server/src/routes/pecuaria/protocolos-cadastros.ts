import { Hono, type Context } from "hono";
import { z } from "zod";
import { getUsuario } from "../../middleware/permissao.js";
import { temArea } from "../../services/auth/papeis.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { consultaCadastroProtocoloSchema, consultaAcoesCadastroSchema } from "../../services/pecuaria/protocolos/cadastros.schemas.js";
import { listarCadastrosProtocolos, obterCadastroProtocolo, listarAcoesCadastroProtocolo } from "../../services/pecuaria/protocolos/cadastros.js";
import { listarOpcoesCadastro } from "../../services/pecuaria/protocolos/cadastros-opcoes.js";
function falha(c: Context, e: unknown) {
  if (e instanceof z.ZodError) return c.json({ error: e.issues[0]?.message ?? "Consulta inválida", code: "VALIDACAO" }, 422);
  if (e instanceof RebanhoError) return c.json({ error: e.message, code: e.code }, e.code === "NAO_ENCONTRADO" ? 404 : 409);
  console.error("[protocolos/cadastros]", e);
  return c.json({ error: "Não foi possível consultar o cadastro de protocolos", code: "ERRO_INTERNO" }, 500);
}
/** Catálogo global: sessão e área são exigidas; não lê animais nem fatos de um sítio. */
export const protocolosCadastrosRouter = new Hono().use("*", async (c, next) => {
  const usuario = getUsuario(c);
  if (!usuario || !temArea(usuario, "pecuaria")) return c.json({ error: "Acesso à Pecuária necessário", code: "SEM_PERMISSAO" }, 403);
  await next();
});
protocolosCadastrosRouter.get("/", async c => {
  try { return c.json(await listarCadastrosProtocolos(consultaCadastroProtocoloSchema.parse(c.req.query()))); } catch (e) { return falha(c, e); }
});
protocolosCadastrosRouter.get("/opcoes", async c => {
  try { return c.json(await listarOpcoesCadastro(c.req.query())); } catch (e) { return falha(c, e); }
});
protocolosCadastrosRouter.get("/:id", async c => {
  try { return c.json(await obterCadastroProtocolo(z.string().uuid().parse(c.req.param("id")))); } catch (e) { return falha(c, e); }
});
protocolosCadastrosRouter.get("/:id/acoes", async c => {
  try { return c.json(await listarAcoesCadastroProtocolo(z.string().uuid().parse(c.req.param("id")), consultaAcoesCadastroSchema.parse(c.req.query()))); } catch (e) { return falha(c, e); }
});
