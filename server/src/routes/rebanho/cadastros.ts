import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as svc from "../../services/rebanho/cadastros.js";
import { parseEntityId } from "../../lib/ids.js";

type Status = 404 | 409 | 500;
function fail(e: unknown): { status: Status; body: { error: string } } {
  if (e instanceof svc.CadastroError) {
    const map = { NAO_ENCONTRADO: 404, DUPLICADO: 409 } as const;
    return { status: map[e.code], body: { error: e.message } };
  }
  console.error("[cadastros]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

const parseAtivo = (v?: string) => (v === "true" ? true : v === "false" ? false : undefined);

export const cadastrosRouter = new Hono()
  .get("/rebanho/produtos", async (c) => c.json(await svc.listarProdutos({ tipo: c.req.query("tipo"), q: c.req.query("q"), ativo: parseAtivo(c.req.query("ativo")) })))
  .post("/rebanho/produtos", zValidator("json", svc.produtoSchema), async (c) => { try { return c.json(await svc.criarProduto(c.req.valid("json")), 201); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .patch("/rebanho/produtos/:id", zValidator("json", svc.produtoSchema.partial()), async (c) => { try { return c.json(await svc.editarProduto(Number(c.req.param("id")), c.req.valid("json"))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .get("/rebanho/fornecedores", async (c) => c.json(await svc.listarFornecedores({ tipo: c.req.query("tipo"), q: c.req.query("q") })))
  .post("/rebanho/fornecedores", zValidator("json", svc.fornecedorSchema), async (c) => { try { return c.json(await svc.criarFornecedor(c.req.valid("json")), 201); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .patch("/rebanho/fornecedores/:id", zValidator("json", svc.fornecedorSchema.omit({ id: true }).partial()), async (c) => { try { return c.json(await svc.editarFornecedor(parseEntityId(c.req.param("id")), c.req.valid("json"))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } });
