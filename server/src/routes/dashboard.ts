import { Hono } from "hono";
import { buildDashboard } from "../services/dashboard.js";

export const dashboardRouter = new Hono().get("/dashboard", async (c) => {
  const payload = await buildDashboard();
  return c.json(payload);
});
