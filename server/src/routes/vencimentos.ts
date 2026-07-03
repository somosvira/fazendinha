// Contas a vencer — GET /vencimentos (item 6 do backlog: avisar vencendo/vencida).
// Aceita ?hoje=YYYY-MM-DD (opcional, para teste/âncora do frontend); default = agora.
// Só leitura — nenhuma mutação, portanto sem regra de FechamentoMensal.

import { Hono } from "hono";
import { listarContasAVencer } from "../services/vencimentos.js";

export const vencimentosRouter = new Hono().get("/vencimentos", async (c) => {
  const hojeParam = c.req.query("hoje");
  let hoje: Date;
  if (hojeParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hojeParam)) {
      return c.json({ error: "hoje inválido (use YYYY-MM-DD)" }, 400);
    }
    hoje = new Date(`${hojeParam}T00:00:00.000Z`);
    if (Number.isNaN(hoje.getTime())) {
      return c.json({ error: "hoje inválido (use YYYY-MM-DD)" }, 400);
    }
  } else {
    hoje = new Date();
  }
  return c.json(await listarContasAVencer(hoje));
});
