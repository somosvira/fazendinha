import { Hono } from "hono";
import { buildRebanhoDashboard } from "../../services/rebanho/dashboard-rebanho.js";
export const rebanhoDashboardRouter = new Hono().get("/rebanho/dashboard", async (c) => c.json(await buildRebanhoDashboard()));
