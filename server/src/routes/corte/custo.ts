import { Hono } from "hono";
import { agregarCustoCorte } from "../../services/corte/custo.js";

// Custo / economia unitária do corte — espelha /api/plantio/custo.
// Sem ponte financeira fabricada: os números vêm das operações do próprio módulo.
export const corteCustoRouter = new Hono().get("/corte/custo", async (c) => {
  // Clampa meses para inteiro positivo sensato (default 12, máximo 120).
  const meses = Math.min(Math.max(Math.round(Number(c.req.query("meses")) || 12), 1), 120);
  return c.json(await agregarCustoCorte(meses));
});
