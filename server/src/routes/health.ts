import { Hono } from "hono";
import { prisma } from "../db.js";

export const healthRouter = new Hono()
  .get("/health", (c) => c.json({ ok: true }))
  .get("/health/db", async (c) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return c.json({ ok: true, db: "up" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "erro desconhecido";
      return c.json({ ok: false, db: "down", error: message }, 500);
    }
  });
