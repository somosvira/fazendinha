import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { EstoqueError } from "../../services/estoque/estoque.js";
import { FinanceiroError } from "../../services/financeiro/regras.js";
import { exigePermissao, getUsuario } from "../../middleware/permissao.js";
import { resolverEscopoEscrita, resolverEscopoLeitura, PropriedadeError } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { prepararColetaSchema, salvarColetaSchema, concluirColetaSchema } from "../../services/pecuaria/coletas/schemas.js";
import * as coletas from "../../services/pecuaria/coletas/coletas.js";

const validar = <T extends z.ZodTypeAny>(schema: T) => zValidator("json", schema, (r, c) => !r.success ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO", campo: r.error.issues[0].path.join(".") }, 422) : undefined);
function falha(c: Context, e: unknown) {
  if (e instanceof RebanhoError || e instanceof EstoqueError || e instanceof FinanceiroError) return c.json({ error: e.message, code: e.code, campo: e.campo }, e.code === "NAO_ENCONTRADO" ? 404 : e.code === "VALIDACAO" ? 422 : 409);
  if (e instanceof PropriedadeError) return c.json({ error: e.message, code: e.code }, 400);
  if (e instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2025", "P2034"].includes(e.code)) return c.json({ error: "A ficha mudou. Reabra a ficha e confira os dados.", code: "CONFLITO" }, 409);
  return c.json({ error: "Não conseguimos atualizar a ficha. Tente novamente.", code: "ERRO" }, 500);
}
const autor = (c: Context) => { const id = getUsuario(c)?.id; return id && id > 0 ? id : null; };
export const coletasRouter = new Hono()
  .get("/", async (c) => { try { const pagina = z.coerce.number().int().min(1).max(100000).parse(c.req.query("pagina") ?? 1); const tipo = z.enum(["PESAGEM", "EXAME", "APLICACAO"]).optional().parse(c.req.query("tipo")); return c.json(await coletas.listarColetas(await resolverEscopoLeitura(c), pagina, tipo)); } catch (e) { if (e instanceof z.ZodError) return c.json({ error: "Filtro ou página inválidos" }, 422); return falha(c, e); } })
  .get("/:id", async (c) => { try { return c.json(await coletas.obterColeta(c.req.param("id"), await resolverEscopoLeitura(c))); } catch (e) { return falha(c, e); } })
  .get("/:id/impressao", exigePermissao("exportar"), async (c) => { try { return c.json(await coletas.obterColeta(c.req.param("id"), await resolverEscopoLeitura(c))); } catch (e) { return falha(c, e); } })
  .post("/", exigePermissao("lancar"), validar(prepararColetaSchema), async (c) => { try { const input = c.req.valid("json"); return c.json(await coletas.prepararColeta({ ...input, propriedadeId: await resolverEscopoEscrita(c, input.propriedadeId) }, autor(c)), 201); } catch (e) { return falha(c, e); } })
  .put("/:id/rascunho", exigePermissao("lancar"), validar(salvarColetaSchema), async (c) => { try { const input = c.req.valid("json"); return c.json(await coletas.salvarColeta(c.req.param("id"), await resolverEscopoEscrita(c, input.propriedadeId), input.versao, input.rascunho, autor(c))); } catch (e) { return falha(c, e); } })
  .post("/:id/confirmacao", exigePermissao("lancar"), validar(concluirColetaSchema), async (c) => { try { const input = c.req.valid("json"); return c.json(await coletas.concluirColeta(c.req.param("id"), await resolverEscopoEscrita(c, input.propriedadeId), input.versao, autor(c))); } catch (e) { return falha(c, e); } });
