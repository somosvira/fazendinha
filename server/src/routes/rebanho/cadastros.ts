import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as svc from "../../services/rebanho/cadastros.js";

const err = (e: unknown) => e instanceof svc.CadastroError ? ({ NAO_ENCONTRADO: 404, DUPLICADO: 409 } as const)[e.code] : 500;

const parseAtivo = (v?: string) => (v === "true" ? true : v === "false" ? false : undefined);

export const cadastrosRouter = new Hono()
  .get("/rebanho/produtos", async (c) => c.json(await svc.listarProdutos({ tipo: c.req.query("tipo"), q: c.req.query("q"), ativo: parseAtivo(c.req.query("ativo")) })))
  .post("/rebanho/produtos", zValidator("json", svc.produtoSchema), async (c) => { try { return c.json(await svc.criarProduto(c.req.valid("json")), 201); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .patch("/rebanho/produtos/:id", zValidator("json", svc.produtoSchema.partial()), async (c) => { try { return c.json(await svc.editarProduto(Number(c.req.param("id")), c.req.valid("json"))); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .get("/rebanho/fornecedores", async (c) => c.json(await svc.listarFornecedores({ tipo: c.req.query("tipo"), q: c.req.query("q") })))
  .post("/rebanho/fornecedores", zValidator("json", svc.fornecedorSchema), async (c) => { try { return c.json(await svc.criarFornecedor(c.req.valid("json")), 201); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } })
  .patch("/rebanho/fornecedores/:id", zValidator("json", svc.fornecedorSchema.partial()), async (c) => { try { return c.json(await svc.editarFornecedor(Number(c.req.param("id")), c.req.valid("json"))); } catch (e) { return c.json({ error: e instanceof Error ? e.message : "erro" }, err(e)); } });
