import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { categoriasRouter } from "./routes/categorias.js";
import { healthRouter } from "./routes/health.js";
import { animaisRouter } from "./routes/rebanho/animais.js";
import { eventosRouter } from "./routes/rebanho/eventos.js";
import { sanidadeRouter } from "./routes/rebanho/sanidade.js";
import { nutricaoRouter } from "./routes/rebanho/nutricao.js";
import { rebanhoDashboardRouter } from "./routes/rebanho/dashboard.js";
import { iaRouter } from "./routes/rebanho/ia.js";
import { configRouter } from "./routes/rebanho/config.js";
import { producaoRouter } from "./routes/rebanho/producao.js";
import { cadastrosRouter } from "./routes/rebanho/cadastros.js";
import { estoqueRouter } from "./routes/rebanho/estoque.js";
import { custoProducaoRouter } from "./routes/rebanho/custo-producao.js";
import { custoSanidadeRouter } from "./routes/rebanho/custo-sanidade.js";
import { financeiroRefRouter } from "./routes/rebanho/financeiro-ref.js";

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
app.route("/api", categoriasRouter);
app.route("/api", animaisRouter);
app.route("/api", eventosRouter);
app.route("/api", sanidadeRouter);
app.route("/api", nutricaoRouter);
app.route("/api", rebanhoDashboardRouter);
app.route("/api", iaRouter);
app.route("/api", configRouter);
app.route("/api", producaoRouter);
app.route("/api", cadastrosRouter);
app.route("/api", estoqueRouter);
app.route("/api", custoProducaoRouter);
app.route("/api", custoSanidadeRouter);
app.route("/api", financeiroRefRouter);

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`API Rio Novo rodando em http://localhost:${port}`);
});
