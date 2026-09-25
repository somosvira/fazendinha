import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { exigePermissao } from "../middleware/permissao.js";
import * as svc from "../services/propriedade.js";
import { propriedadeSchema } from "../services/propriedade.js";

type Status = 400 | 404 | 409 | 500;
function fail(e: unknown): { status: Status; body: { error: string } } {
  if (e instanceof svc.PropriedadeError) {
    const map = { NAO_ENCONTRADO: 404, NOME_DUPLICADO: 409, ESCOPO_INVALIDO: 400 } as const;
    return { status: map[e.code], body: { error: e.message } };
  }
  console.error("[propriedade]", e);
  return { status: 500, body: { error: "Erro inesperado ao processar. Tente novamente." } };
}

// :id não numérico (ou fora do Int4 do Postgres) vira 400 claro, não NaN passado adiante (S2).
const idParam = zValidator("param", z.object({ id: z.coerce.number().int().positive().max(2147483647) }), (resultado, c) => {
  if (!resultado.success) return c.json({ error: "Identificador inválido" }, 400);
});

// Multi-propriedade (Fatia 1): lista + cadastro dos sítios. O front só mostra o
// seletor quando há ≥2 — com 1 propriedade a camada fica invisível. Ler é livre
// para quem está logado; criar e editar é de quem administra a fazenda (mesma
// permissão de Acessos), como a tela Configurações > Sítios.
export const propriedadeRouter = new Hono()
  .get("/propriedades", async (c) => c.json(await svc.listarPropriedades(c.req.query("incluirInativos") === "true")))
  .post("/propriedades", exigePermissao("gerenciarAcessos"), zValidator("json", propriedadeSchema), async (c) => { try { return c.json(await svc.criarPropriedade(c.req.valid("json")), 201); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } })
  .patch("/propriedades/:id", exigePermissao("gerenciarAcessos"), idParam, zValidator("json", propriedadeSchema), async (c) => { try { return c.json(await svc.editarPropriedade(c.req.valid("param").id, c.req.valid("json"))); } catch (e) { const { status, body } = fail(e); return c.json(body, status); } });
