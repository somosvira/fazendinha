import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { exigeArea, exigePermissao, getUsuario } from "../../middleware/permissao.js";
import { resolverEscopoEscrita, resolverEscopoLeitura } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { falhaV4 } from "./reproducao.js";
import { registrarConferenciaSaldoLeiteSchema, consultarConferenciasSaldoLeiteSchema } from "../../services/pecuaria/leite/conferencias-saldo.schemas.js";
import { registrarConferenciaSaldoLeite, listarConferenciasSaldoLeite } from "../../services/pecuaria/leite/conferencias-saldo.js";
async function sitio(c: Context) { const id = await resolverEscopoLeitura(c); if (id === null) throw new RebanhoError("VALIDACAO", "Selecione um sítio para conferir o saldo físico"); return id; }
export const leiteConferenciasSaldoRouter = new Hono().use("*", exigeArea("pecuaria"))
  .get("/conferencias-saldo", async c => { try { return c.json(await listarConferenciasSaldoLeite(await sitio(c), consultarConferenciasSaldoLeiteSchema.parse(c.req.query()))); } catch (e) { return falhaV4(c, e); } })
  .post("/conferencias-saldo", exigePermissao("lancar"), zValidator("json", registrarConferenciaSaldoLeiteSchema, (r, c) => !r.success ? c.json({ error: r.error.issues[0].message, code: "VALIDACAO" }, 422) : undefined), async c => {
    try { const input = c.req.valid("json"), propriedadeId = await resolverEscopoEscrita(c, input.propriedadeId), id = getUsuario(c)?.id; return c.json(await registrarConferenciaSaldoLeite({ ...input, propriedadeId }, id != null && id > 0 ? id : null), 201); } catch (e) { return falhaV4(c, e); }
  });
