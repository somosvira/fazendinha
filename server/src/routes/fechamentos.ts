import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const fechamentosRouter = Router();

fechamentosRouter.get("/", async (_req, res) => {
  const lista = await prisma.fechamentoMensal.findMany({ orderBy: [{ ano: "desc" }, { mes: "desc" }] });
  res.json(lista);
});

const schema = z.object({ ano: z.number().int(), mes: z.number().int().min(1).max(12), observacao: z.string().optional() });

fechamentosRouter.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { ano, mes, observacao } = parsed.data;
  try {
    const f = await prisma.fechamentoMensal.create({ data: { ano, mes, observacao } });
    res.status(201).json(f);
  } catch {
    res.status(409).json({ error: "Mês já está fechado" });
  }
});

fechamentosRouter.delete("/:ano/:mes", async (req, res) => {
  try {
    await prisma.fechamentoMensal.delete({
      where: { ano_mes: { ano: Number(req.params.ano), mes: Number(req.params.mes) } },
    });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Fechamento não encontrado" });
  }
});
