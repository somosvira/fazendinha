import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { exigeArea, exigePermissao, getUsuario } from "../../middleware/permissao.js";
import { resolverEscopoLeitura, resolverEscopoEscrita, PropriedadeError } from "../../services/propriedade.js";
import { podeVerValoresFinanceiros } from "../../services/pecuaria/custos/permissoes.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { emitirRelatorioLeiteSchema, listarRelatoriosLeiteSchema } from "../../services/pecuaria/leite/relatoriosleite.schemas.js";
import * as relatorios from "../../services/pecuaria/leite/relatoriosleite.js";
const validar = <T extends z.ZodTypeAny>(schema: T) => zValidator("json", schema, (r, c) => !r.success ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422) : undefined);
async function sitio(c: Context) {
  const id = await resolverEscopoLeitura(c);
  if (id === null) throw new RebanhoError("VALIDACAO", "Selecione um sítio para consultar relatórios do leite");
  return id;
}
function falha(c: Context, erro: unknown) {
  if (erro instanceof relatorios.RelatorioLeiteAcessoError) return c.json({ error: erro.message }, 403);
  if (erro instanceof RebanhoError) return c.json({ error: erro.message, code: erro.code }, erro.code === "NAO_ENCONTRADO" ? 404 : erro.code === "VALIDACAO" ? 422 : 409);
  if (erro instanceof PropriedadeError || erro instanceof z.ZodError) return c.json({ error: erro.message, code: "VALIDACAO" }, 422);
  console.error("[pecuaria/leite/relatorios]", erro); return c.json({ error: "Não foi possível processar a emissão do leite" }, 500);
}
export const leiteRelatoriosRouter = new Hono().use("*", exigeArea("pecuaria"))
  .get("/relatorios/emissoes", async c => {
    try { const filtro = listarRelatoriosLeiteSchema.parse(c.req.query()); return c.json(await relatorios.listarRelatoriosLeite(await sitio(c), filtro.pagina)); }
    catch (erro) { return falha(c, erro); }
  })
  .get("/relatorios/emissoes/:id/csv", exigePermissao("exportar"), async c => {
    try { const id = z.string().uuid().parse(c.req.param("id")); const arquivo = await relatorios.exportarRelatorioLeiteCsv(id, await sitio(c), podeVerValoresFinanceiros(getUsuario(c)));
      return c.body(arquivo.conteudo, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${arquivo.nome}"`, "Cache-Control": "private, no-store" }); }
    catch (erro) { return falha(c, erro); }
  })
  .get("/relatorios/emissoes/:id", async c => {
    try { const id = z.string().uuid().parse(c.req.param("id")); return c.json(await relatorios.obterRelatorioLeite(id, await sitio(c), podeVerValoresFinanceiros(getUsuario(c))), 200, { "Cache-Control": "private, no-store" }); }
    catch (erro) { return falha(c, erro); }
  })
  .post("/relatorios/emissoes", exigePermissao("exportar"), validar(emitirRelatorioLeiteSchema), async c => {
    try { const input = c.req.valid("json"), verValores = podeVerValoresFinanceiros(getUsuario(c));
      if (input.incluirValores && !verValores) return c.json({ error: "Sem acesso aos valores financeiros" }, 403);
      const propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId), usuarioId = getUsuario(c)?.id ?? null;
      return c.json(await relatorios.emitirRelatorioLeite({ ...input, propriedadeId }, usuarioId != null && usuarioId > 0 ? usuarioId : null, verValores), 201); }
    catch (erro) { return falha(c, erro); }
  });
