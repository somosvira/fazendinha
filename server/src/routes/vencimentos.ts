// Contas a vencer — GET /vencimentos (item 6 do backlog: avisar vencendo/vencida)
// + POST /vencimentos/:id/liquidar (marcar como paga direto do card).
// O GET é só leitura; o POST muta e por isso respeita FechamentoMensal (no service).

import { Hono } from "hono";
import { listarContasAVencer, liquidarConta } from "../services/vencimentos.js";
import { exigePermissao } from "../middleware/permissao.js";

const parseDiaUTC = (s: string) => new Date(`${s}T00:00:00.000Z`);

export const vencimentosRouter = new Hono()
  .get("/vencimentos", async (c) => {
    const hojeParam = c.req.query("hoje");
    let hoje: Date;
    if (hojeParam) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(hojeParam)) {
        return c.json({ error: "hoje inválido (use YYYY-MM-DD)" }, 400);
      }
      hoje = parseDiaUTC(hojeParam);
      if (Number.isNaN(hoje.getTime())) {
        return c.json({ error: "hoje inválido (use YYYY-MM-DD)" }, 400);
      }
    } else {
      hoje = new Date();
    }
    return c.json(await listarContasAVencer(hoje));
  })
  // Marcar como paga direto do card. Body { data?: "YYYY-MM-DD" } (default agora).
  .post("/vencimentos/:id/liquidar", exigePermissao("lancar"), async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "id inválido" }, 400);
    let dataLiq = new Date();
    const body = await c.req.json().catch(() => ({}));
    if (body?.data != null) {
      if (typeof body.data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.data)) {
        return c.json({ error: "data inválida (use YYYY-MM-DD)" }, 400);
      }
      dataLiq = parseDiaUTC(body.data);
      if (Number.isNaN(dataLiq.getTime())) return c.json({ error: "data inválida (use YYYY-MM-DD)" }, 400);
    }
    const r = await liquidarConta(id, dataLiq);
    if (r.ok) return c.json(r);
    if (r.codigo === "NAO_ENCONTRADA") return c.json({ erro: "conta não encontrada", codigo: r.codigo }, 404);
    if (r.codigo === "JA_LIQUIDADA") return c.json({ erro: "conta já está paga", codigo: r.codigo }, 409);
    return c.json(
      { erro: `Mês ${r.mes.toString().padStart(2, "0")}/${r.ano} está fechado contabilmente.`, codigo: r.codigo },
      423,
    );
  });
