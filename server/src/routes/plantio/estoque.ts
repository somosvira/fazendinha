import { Hono } from "hono";
import { listarEstoquePlantio } from "../../services/plantio/estoque.js";

// Estoque de insumos da lavoura — espelha /api/rebanho/estoque/saldos, mas só
// devolve Produto com subtipoPlantio (não polui com produtos do rebanho).
export const plantioEstoqueRouter = new Hono().get("/plantio/estoque", async (c) => {
  return c.json(await listarEstoquePlantio());
});
