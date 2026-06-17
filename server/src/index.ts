import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { healthRouter } from "./routes/health.js";
import { animaisRouter } from "./routes/rebanho/animais.js";
import { eventosRouter } from "./routes/rebanho/eventos.js";
import { sanidadeRouter } from "./routes/rebanho/sanidade.js";
import { nutricaoRouter } from "./routes/rebanho/nutricao.js";

const app = new Hono();

app.use("*", logger());

const corsOrigins = env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean);
app.use(
  "/api/*",
  cors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : "*",
  })
);

app.route("/api", healthRouter);
app.route("/api", dashboardRouter);
app.route("/api", animaisRouter);
app.route("/api", eventosRouter);
app.route("/api", sanidadeRouter);
app.route("/api", nutricaoRouter);

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`API Rio Novo rodando em http://localhost:${port}`);
});
