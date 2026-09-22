import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as svc from "../../services/rebanho/cadastros.js";
import * as produtos from "../../services/estoque/produtos.js";
import { patchProdutoSchema, produtoSchema } from "../../services/estoque/produtos.schemas.js";
import { FinanceiroError } from "../../services/financeiro/regras.js";
import { exigePermissao, getUsuario } from "../../middleware/permissao.js";
import type { Context } from "hono";

type Status = 400 | 404 | 409 | 500;
function fail(e: unknown): { status: Status; body: { error: string; campo?: string } } {
  if (e instanceof svc.CadastroError) {
    const map = { NAO_ENCONTRADO: 404, DUPLICADO: 409 } as const;
    return { status: map[e.code], body: { error: e.message } };
  }
  if (e instanceof FinanceiroError) {
    const map = { VALIDACAO: 400, NAO_ENCONTRADO: 404, CONFLITO: 409, PERIODO_FECHADO: 409, SALDO_INSUFICIENTE: 409, JA_REVERTIDO: 409 } as const;
    return { status: map[e.code], body: { error: e.message, ...(e.campo ? { campo: e.campo } : {}) } };
  }
  console.error("[cadastros]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

const usuarioId = (c: Context): number | null => getUsuario(c)?.id ?? null;
const parseAtivo = (v?: string) => (v === "true" ? true : v === "false" ? false : undefined);

export const cadastrosRouter = new Hono()
  .get("/rebanho/produtos", async (c) => c.json(await produtos.listarProdutos({ tipo: c.req.query("tipo"), q: c.req.query("q"), ativo: parseAtivo(c.req.query("ativo")), incluirInativos: true })))
  .post("/rebanho/produtos", exigePermissao("lancar"), zValidator("json", produtoSchema), async (c) => { try { return c.json(await produtos.criarProduto(c.req.valid("json"), usuarioId(c)), 201); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .patch("/rebanho/produtos/:id", exigePermissao("lancar"), zValidator("json", patchProdutoSchema), async (c) => { try { return c.json(await produtos.atualizarProduto(Number(c.req.param("id")), c.req.valid("json"), usuarioId(c))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .get("/rebanho/fornecedores", async (c) => c.json(await svc.listarFornecedores({ tipo: c.req.query("tipo"), q: c.req.query("q") })))
  .post("/rebanho/fornecedores", zValidator("json", svc.fornecedorSchema), async (c) => { try { return c.json(await svc.criarFornecedor(c.req.valid("json")), 201); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .patch("/rebanho/fornecedores/:id", zValidator("json", svc.fornecedorSchema.partial()), async (c) => { try { return c.json(await svc.editarFornecedor(Number(c.req.param("id")), c.req.valid("json"))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } });
