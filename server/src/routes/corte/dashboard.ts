import { Hono } from "hono";
import { buildCorteDashboard } from "../../services/corte/dashboard.js";

export const corteDashboardRouter = new Hono()
  .get("/corte/dashboard", (c) => c.json(buildCorteDashboard()));
