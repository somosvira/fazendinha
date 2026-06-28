import { Hono } from "hono";
import { buildPlantioDashboard } from "../../services/plantio/dashboard.js";

export const plantioDashboardRouter = new Hono()
  .get("/plantio/dashboard", (c) => c.json(buildPlantioDashboard()));
