import { Hono } from "hono";
import { agregarCustoPlantio, type ClasseCusto } from "../../services/plantio/custo.js";
import {
  agregarCustoOperacionalCafe,
  CustoOperacionalCafeError,
} from "../../services/plantio/custo-operacional.js";

// :id de rota não numérico → 404 antes do Prisma (evita 500).
const parseId = (raw: string): number | null => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const CLASSES_VALIDAS = new Set(["custeio", "investimento", "tudo"]);
const parseClasse = (raw: string | undefined): ClasseCusto =>
  raw != null && CLASSES_VALIDAS.has(raw) ? (raw as ClasseCusto) : "custeio";

// Ponte financeira do café — espelha /api/rebanho/custo-producao.
export const plantioCustoRouter = new Hono()
  .get("/plantio/custo", async (c) => {
    // Clampa meses para inteiro positivo sensato — negativos/frações/zero produziriam
    // uma janela futura ou sem sentido. Default 12, máximo 120 (10 anos).
    const meses = Math.min(Math.max(Math.round(Number(c.req.query("meses")) || 12), 1), 120);
    const classe = parseClasse(c.req.query("classe"));
    return c.json(await agregarCustoPlantio(meses, classe));
  })
  // Custo OPERACIONAL do café (aditivo) — vem das operações da safra (Ideagri:
  // TarefaAgricola + ApontamentoMaquina), não do financeiro. Ver custo-operacional.ts.
  .get("/plantio/safras/:id/custo-operacional", async (c) => {
    const id = parseId(c.req.param("id"));
    if (id == null) return c.json({ error: "id inválido" }, 404);
    try {
      return c.json(await agregarCustoOperacionalCafe(id));
    } catch (e) {
      if (e instanceof CustoOperacionalCafeError) {
        return c.json({ error: e.message }, 404);
      }
      console.error("[plantio/custo-operacional]", e);
      return c.json({ error: "Erro inesperado ao processar. Tente novamente." }, 500);
    }
  });
