import { Hono, type Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { exigeAba, exigePermissao, getUsuario } from "../middleware/permissao.js";
import { resolverEscopoEscrita, resolverEscopoLeitura } from "../services/propriedade.js";
import * as relatorios from "../services/financeiro/relatorios.js";
import { configuracaoRelatorioFinanceiroSchema, rascunhoRelatorioFinanceiroSchema } from "../services/financeiro/relatorios.schemas.js";
import { FinanceiroError } from "../services/financeiro/regras.js";

function falha(c: Context, erro: unknown) {
  if (erro instanceof FinanceiroError) {
    const status = erro.code === "NAO_ENCONTRADO" ? 404 : erro.code === "VALIDACAO" ? 422 : 409;
    return c.json({ error: erro.message, code: erro.code, ...(erro.campo ? { campo: erro.campo } : {}) }, status);
  }
  console.error("[relatorios-financeiros]", erro);
  return c.json({ error: "Erro inesperado ao processar o relatório. Tente novamente." }, 500);
}

function validar<T extends z.ZodTypeAny>(alvo: "json" | "param", schema: T) {
  return zValidator(alvo, schema, (resultado, c) => {
    if (!resultado.success) {
      const erro = resultado.error.issues[0];
      return c.json({ error: erro.message, code: "VALIDACAO", campo: String(erro.path[0] ?? "") }, 422);
    }
  });
}

// O autor vem sempre da sessão; o cliente não informa nem falsifica. O dono
// sintético da ponte de acesso (id 0) assina pelo nome, sem vínculo de usuário.
function autor(c: Context) {
  const usuario = getUsuario(c);
  return { id: usuario?.id && usuario.id > 0 ? usuario.id : null, nome: usuario?.nome ?? "Proprietário" };
}

function exigirUsuarioId(c: Context) {
  const { id } = autor(c);
  if (!id) throw new FinanceiroError("VALIDACAO", "É necessário estar autenticado para salvar um rascunho");
  return id;
}

const idParam = z.object({ id: z.coerce.number().int().positive("Relatório inválido") });

/** Ver o histórico exige a aba de relatórios; montar, gerar e baixar PDF
 * exigem também a permissão de exportar. */
const aba = exigeAba("relatorio");
const exportar = exigePermissao("exportar");

export const relatoriosFinanceirosRouter = new Hono()
  .get("/financeiro/relatorios", aba, async (c) => {
    try { return c.json(await relatorios.listarRelatorios(await resolverEscopoLeitura(c))); } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/relatorios/rascunho", aba, exportar, async (c) => {
    try { return c.json(await relatorios.obterRascunho(await resolverEscopoEscrita(c), exigirUsuarioId(c))); } catch (e) { return falha(c, e); }
  })
  .put("/financeiro/relatorios/rascunho", aba, exportar, validar("json", z.object({ configuracao: rascunhoRelatorioFinanceiroSchema, versao: z.number().int().positive().optional() })), async (c) => {
    try {
      const { configuracao, versao } = c.req.valid("json");
      return c.json(await relatorios.salvarRascunho(await resolverEscopoEscrita(c), exigirUsuarioId(c), configuracao, versao));
    } catch (e) { return falha(c, e); }
  })
  .delete("/financeiro/relatorios/rascunho", aba, exportar, async (c) => {
    try { await relatorios.descartarRascunho(await resolverEscopoEscrita(c), exigirUsuarioId(c)); return c.body(null, 204); } catch (e) { return falha(c, e); }
  })
  .post("/financeiro/relatorios", aba, exportar, validar("json", configuracaoRelatorioFinanceiroSchema), async (c) => {
    try { return c.json(await relatorios.gerarRelatorio(await resolverEscopoEscrita(c), autor(c), c.req.valid("json")), 201); } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/relatorios/:id", aba, validar("param", idParam), async (c) => {
    try { return c.json(await relatorios.obterRelatorio(c.req.valid("param").id, await resolverEscopoLeitura(c))); } catch (e) { return falha(c, e); }
  })
  .get("/financeiro/relatorios/:id/download", aba, exportar, validar("param", idParam), async (c) => {
    try {
      const arquivo = await relatorios.baixarRelatorio(c.req.valid("param").id, await resolverEscopoLeitura(c));
      c.header("Content-Type", "application/pdf");
      c.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`);
      return c.body(new Uint8Array(arquivo.buffer));
    } catch (e) { return falha(c, e); }
  });
