import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { exigeArea, exigePermissao, getUsuario } from "../../middleware/permissao.js";
import { PropriedadeError, resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { criarConfiguracao, listarConfiguracoes } from "../../services/pecuaria/leite/configuracoes.js";
import { consultarFolha, listarCandidatos, salvarFolha } from "../../services/pecuaria/leite/producao.js";
import { configuracaoOrdenhaSchema, consultaCandidatosSchema, consultaConfiguracaoSchema, consultaFolhaSchema, salvarFolhaSchema } from "../../services/pecuaria/leite/schemas.js";

const validar = <T extends z.ZodTypeAny>(schema: T) => zValidator("json", schema, (r, c) => !r.success ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422) : undefined);
const validarQuery = <T extends z.ZodTypeAny>(schema: T) => zValidator("query", schema, (r, c) => !r.success ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422) : undefined);
function falha(c: Context, erro: unknown) {
  if (erro instanceof RebanhoError) return c.json({ error: erro.message, code: erro.code, campo: erro.campo }, erro.code === "NAO_ENCONTRADO" ? 404 : erro.code === "VALIDACAO" ? 422 : 409);
  if (erro instanceof PropriedadeError) return c.json({ error: erro.message, code: erro.code }, erro.code === "NAO_ENCONTRADO" ? 404 : 422);
  if (erro instanceof z.ZodError) return c.json({ error: erro.issues[0].message, code: "VALIDACAO" }, 422);
  if (erro instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034", "P2025"].includes(erro.code))
    return c.json({ error: "A folha mudou; recarregue e tente novamente", code: "CONFLITO" }, 409);
  console.error("[pecuaria/leite]", erro);
  return c.json({ error: "Erro inesperado ao processar a produção de leite" }, 500);
}
async function sitioLeitura(c: Context) {
  const propriedadeId = await resolverEscopoLeitura(c);
  if (propriedadeId === null) throw new RebanhoError("VALIDACAO", "Selecione um sítio para consultar a folha de ordenha", "propriedadeId");
  return propriedadeId;
}
function autor(c: Context): number | null {
  const id = getUsuario(c)?.id;
  return id != null && id > 0 ? id : null;
}
export const leiteRouter = new Hono()
  .use("*", exigeArea("pecuaria"))
  .get("/candidatos", validarQuery(consultaCandidatosSchema), async c => {
    try {
      const { dataOperacional, busca, pagina } = c.req.valid("query");
      return c.json(await listarCandidatos(await sitioLeitura(c), dataOperacional, busca, pagina));
    } catch (erro) { return falha(c, erro); }
  })
  .get("/configuracoes", validarQuery(consultaConfiguracaoSchema), async c => {
    try { return c.json(await listarConfiguracoes(await sitioLeitura(c), c.req.valid("query").data)); }
    catch (erro) { return falha(c, erro); }
  })
  .post("/configuracoes", exigePermissao("lancar"), validar(configuracaoOrdenhaSchema), async c => {
    try {
      const input = c.req.valid("json"), propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId);
      return c.json(await criarConfiguracao({ ...input, propriedadeId }, autor(c)), 201);
    } catch (erro) { return falha(c, erro); }
  })
  .get("/folha", validarQuery(consultaFolhaSchema), async c => {
    try { return c.json(await consultarFolha(await sitioLeitura(c), c.req.valid("query").dataOperacional)); }
    catch (erro) { return falha(c, erro); }
  })
  .post("/folha", exigePermissao("lancar"), validar(salvarFolhaSchema), async c => {
    try {
      const input = c.req.valid("json"), propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId);
      return c.json(await salvarFolha({ ...input, propriedadeId }, autor(c)));
    } catch (erro) { return falha(c, erro); }
  });
