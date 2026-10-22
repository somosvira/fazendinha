import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { exigeArea, exigePermissao, getUsuario } from "../../middleware/permissao.js";
import { resolverEscopoEscrita, resolverEscopoLeitura, PropriedadeError } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { listarFormatosQualidade, criarFormatoQualidade, editarFormatoQualidade, registrarQualidade, corrigirQualidade, listarAmostrasQualidade, obterAmostraQualidade, historicoQualidade, listarOrigensQualidade, consultarParametrosQualidade } from "../../services/pecuaria/leite/qualidade.js";
import { solicitarLaudoQualidade, confirmarLaudoQualidade, baixarLaudoQualidade } from "../../services/pecuaria/leite/qualidade.laudos.js";
import { criarFormatoQualidadeSchema, editarFormatoQualidadeSchema, registrarQualidadeSchema, corrigirQualidadeSchema, consultarQualidadeSchema, consultarOrigensQualidadeSchema, consultarParametrosQualidadeSchema, historicoQualidadeSchema, solicitarLaudoQualidadeSchema, confirmarLaudoQualidadeSchema } from "../../services/pecuaria/leite/qualidade.schemas.js";
const validar = <T extends z.ZodTypeAny>(schema: T) => zValidator("json", schema, (r, c) => !r.success ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422) : undefined);
const query = <T extends z.ZodTypeAny>(schema: T) => zValidator("query", schema, (r, c) => !r.success ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422) : undefined);
const autor = (c: Context) => { const id = getUsuario(c)?.id; return id && id > 0 ? id : null; };
async function sitio(c: Context) { const id = await resolverEscopoLeitura(c); if (id === null) throw new RebanhoError("VALIDACAO", "Selecione um sítio para consultar a qualidade do leite"); return id; }
function falha(c: Context, erro: unknown) {
  if (erro instanceof RebanhoError) return c.json({ error: erro.message, code: erro.code, campo: erro.campo }, erro.code === "NAO_ENCONTRADO" ? 404 : erro.code === "VALIDACAO" ? 422 : 409);
  if (erro instanceof PropriedadeError) return c.json({ error: erro.message, code: erro.code }, erro.code === "NAO_ENCONTRADO" ? 404 : 422);
  if (erro instanceof z.ZodError) return c.json({ error: erro.issues[0].message, code: "VALIDACAO" }, 422);
  if (erro instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2004", "P2025", "P2034"].includes(erro.code)) return c.json({ error: "O registro mudou ou já existe; recarregue e confira o formato e o laudo", code: "CONFLITO" }, 409);
  console.error("[pecuaria/leite/qualidade]", erro); return c.json({ error: "Erro ao processar a qualidade do leite" }, 500);
}
export const leiteQualidadeRouter = new Hono().use("*", exigeArea("pecuaria"))
  .get("/formatos", query(z.object({ incluirInativos: z.enum(["true", "false"]).optional() })), async c => {
    try { return c.json(await listarFormatosQualidade(c.req.valid("query").incluirInativos === "true")); } catch (e) { return falha(c, e); }
  })
  .post("/formatos", exigePermissao("lancar"), validar(criarFormatoQualidadeSchema), async c => {
    try { return c.json(await criarFormatoQualidade(c.req.valid("json"), autor(c)), 201); } catch (e) { return falha(c, e); }
  })
  .post("/formatos/:id/versoes", exigePermissao("lancar"), validar(criarFormatoQualidadeSchema), async c => {
    try { return c.json(await criarFormatoQualidade(c.req.valid("json"), autor(c), c.req.param("id")), 201); } catch (e) { return falha(c, e); }
  })
  .patch("/formatos/:id", exigePermissao("lancar"), validar(editarFormatoQualidadeSchema), async c => {
    try { return c.json(await editarFormatoQualidade(c.req.param("id"), c.req.valid("json"), autor(c))); } catch (e) { return falha(c, e); }
  })
  .get("/origens", query(consultarOrigensQualidadeSchema), async c => {
    try { return c.json(await listarOrigensQualidade(await sitio(c), c.req.valid("query"))); } catch (e) { return falha(c, e); }
  })
  .get("/parametros", query(consultarParametrosQualidadeSchema), async c => {
    try { return c.json(await consultarParametrosQualidade(await sitio(c), c.req.valid("query"))); } catch (e) { return falha(c, e); }
  })
  .get("/amostras", query(consultarQualidadeSchema), async c => {
    try { return c.json(await listarAmostrasQualidade(await sitio(c), c.req.valid("query"))); } catch (e) { return falha(c, e); }
  })
  .post("/amostras", exigePermissao("lancar"), validar(registrarQualidadeSchema), async c => {
    try { const input = c.req.valid("json"), propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId); return c.json(await registrarQualidade({ ...input, propriedadeId }, autor(c)), 201); } catch (e) { return falha(c, e); }
  })
  .get("/amostras/:id", async c => {
    try { return c.json(await obterAmostraQualidade(c.req.param("id"), await sitio(c))); } catch (e) { return falha(c, e); }
  })
  .post("/amostras/:id/correcoes", exigePermissao("lancar"), validar(corrigirQualidadeSchema), async c => {
    try { const input = c.req.valid("json"), propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId); return c.json(await corrigirQualidade(c.req.param("id"), { ...input, propriedadeId }, autor(c))); } catch (e) { return falha(c, e); }
  })
  .get("/amostras/:id/historico", query(historicoQualidadeSchema), async c => {
    try { const { pagina, tamanho } = c.req.valid("query"); return c.json(await historicoQualidade(c.req.param("id"), await sitio(c), pagina, tamanho)); } catch (e) { return falha(c, e); }
  })
  .post("/amostras/:id/laudos/upload", exigePermissao("lancar"), validar(solicitarLaudoQualidadeSchema), async c => {
    try { const input = c.req.valid("json"), propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId); return c.json(await solicitarLaudoQualidade(c.req.param("id"), propriedadeId, { ...input, propriedadeId }, autor(c))); } catch (e) { return falha(c, e); }
  })
  .post("/amostras/:id/laudos/confirmar", exigePermissao("lancar"), validar(confirmarLaudoQualidadeSchema), async c => {
    try { const input = c.req.valid("json"), propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId); return c.json(await confirmarLaudoQualidade(c.req.param("id"), propriedadeId, input.uploadToken, autor(c)), 201); } catch (e) { return falha(c, e); }
  })
  .get("/amostras/:id/laudos/:laudoId/download", async c => {
    try { return c.json(await baixarLaudoQualidade(c.req.param("id"), c.req.param("laudoId"), await sitio(c))); } catch (e) { return falha(c, e); }
  });
