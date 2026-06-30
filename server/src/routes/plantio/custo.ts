import { Hono } from "hono";
import { agregarCustoPlantio } from "../../services/plantio/custo.js";

// Ponte financeira do café — espelha /api/rebanho/custo-producao.
export const plantioCustoRouter = new Hono().get("/plantio/custo", async (c) => {
  // Clampa meses para inteiro positivo sensato — negativos/frações/zero produziriam
  // uma janela futura ou sem sentido. Default 12, máximo 120 (10 anos).
  const meses = Math.min(Math.max(Math.round(Number(c.req.query("meses")) || 12), 1), 120);
  return c.json(await agregarCustoPlantio(meses));
});
