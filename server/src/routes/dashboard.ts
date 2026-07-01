import { Hono } from "hono";
import { buildDashboard, buildLancamentos } from "../services/dashboard.js";

// Aceita ?from=YYYY-MM-DD&to=YYYY-MM-DD (data de liquidação). Datas inválidas são
// ignoradas → cai no comportamento padrão (janela 23m, sem bloco `periodo`).
function parseDia(s?: string): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export const dashboardRouter = new Hono()
  .get("/dashboard", async (c) => {
    const { from, to } = c.req.query();
    const payload = await buildDashboard({ from: parseDia(from), to: parseDia(to) });
    return c.json(payload);
  })
  // Drill: lançamentos reais de uma categoria (?categoriaId=, opcional &fornecedor=, &from=&to=)
  .get("/dashboard/lancamentos", async (c) => {
    const q = c.req.query();
    const categoriaId = Number(q.categoriaId);
    if (!Number.isInteger(categoriaId)) return c.json({ erro: "categoriaId inválido" }, 400);
    const lancamentos = await buildLancamentos({
      categoriaId,
      fornecedor: q.fornecedor || undefined,
      from: parseDia(q.from),
      to: parseDia(q.to),
    });
    return c.json({ lancamentos });
  });
