import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { exigePermissao } from "../middleware/permissao.js";
import { listarUsuarios, criarUsuario, atualizarUsuario, revogarUsuario, UsuarioError } from "../services/auth/usuarios.js";
import { gerarLinkConvite, gerarLinkReset, LinkAcessoError } from "../services/auth/contas.js";

const criarSchema = z.object({ nome: z.string().min(1), email: z.string().email(), papel: z.string().min(1) });
const patchSchema = z.object({
  papel: z.string().optional(),
  abas: z.array(z.string()).optional(),
  // `rebanho`/`gado_corte` seguem aceitos durante a transição; o serviço
  // persiste ambos como a área canônica `pecuaria`.
  areas: z.array(z.enum(["financeiro", "pecuaria", "rebanho", "gado_corte"])).optional(),
  flags: z.array(z.string()).optional(),
  status: z.enum(["PENDENTE", "ATIVO", "INATIVO"]).optional(),
});

function erro(c: Context, e: unknown) {
  if (e instanceof UsuarioError) {
    const status = e.code === "NAO_ENCONTRADO" ? 404 : e.code === "EMAIL_DUPLICADO" ? 409 : 422;
    return c.json({ error: e.message, code: e.code }, status);
  }
  throw e;
}

export const usuariosRouter = new Hono()
  .use("/usuarios", exigePermissao("gerenciarAcessos"))
  .use("/usuarios/*", exigePermissao("gerenciarAcessos"))
  .get("/usuarios", async (c) => c.json({ usuarios: await listarUsuarios() }))
  .post("/usuarios", zValidator("json", criarSchema), async (c) => {
    try {
      const usuario = await criarUsuario(c.req.valid("json"));
      const conviteLink = await gerarLinkConvite(usuario.id);
      return c.json({ usuario, conviteLink }, 201);
    } catch (e) {
      return erro(c, e);
    }
  })
  .patch("/usuarios/:id", zValidator("json", patchSchema), async (c) => {
    try {
      const usuario = await atualizarUsuario(Number(c.req.param("id")), c.req.valid("json"));
      return c.json({ usuario });
    } catch (e) {
      return erro(c, e);
    }
  })
  .delete("/usuarios/:id", async (c) => {
    try {
      await revogarUsuario(Number(c.req.param("id")));
      return c.json({ ok: true });
    } catch (e) {
      return erro(c, e);
    }
  })
  .post("/usuarios/:id/convite", async (c) => {
    try {
      return c.json({ conviteLink: await gerarLinkConvite(Number(c.req.param("id"))) });
    } catch (error) {
      if (error instanceof LinkAcessoError) return c.json({ error: error.message }, 422);
      throw error;
    }
  })
  .post("/usuarios/:id/reset", async (c) => {
    try {
      return c.json({ resetLink: await gerarLinkReset(Number(c.req.param("id"))) });
    } catch (error) {
      if (error instanceof LinkAcessoError) return c.json({ error: error.message }, 422);
      throw error;
    }
  });
