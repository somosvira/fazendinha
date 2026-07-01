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
import { indicadoresEmbrapaRouter } from "./routes/rebanho/indicadores-embrapa.js";
import { plantioTalhoesRouter } from "./routes/plantio/talhoes.js";
import { plantioDashboardRouter } from "./routes/plantio/dashboard.js";
import { plantioCadastrosRouter } from "./routes/plantio/cadastros.js";
import { plantioEventosRouter } from "./routes/plantio/eventos.js";
import { plantioCustoRouter } from "./routes/plantio/custo.js";
import { plantioEstoqueRouter } from "./routes/plantio/estoque.js";
import { plantioColheitaRouter } from "./routes/plantio/colheita.js";
import { plantioPlanejamentoRouter } from "./routes/plantio/planejamento.js";
import { plantioIaRouter } from "./routes/plantio/ia.js";
import { corteLotesRouter } from "./routes/corte/lotes.js";
import { corteDashboardRouter } from "./routes/corte/dashboard.js";
import { corteEventosRouter } from "./routes/corte/eventos.js";
import { corteCustoRouter } from "./routes/corte/custo.js";
import { corteIaRouter } from "./routes/corte/ia.js";
import { cultivoSafrasRouter } from "./routes/cultivo/safras.js";
import { cultivoAreasRouter } from "./routes/cultivo/areas.js";
import { cultivoCustosRouter } from "./routes/cultivo/custos.js";
import { cultivoProducaoRouter } from "./routes/cultivo/producao.js";
import { cultivoSilosRouter } from "./routes/cultivo/silos.js";
import { buscaRouter } from "./routes/busca.js";
import { botRouter } from "./routes/bot.js";
import { whatsappRouter } from "./routes/whatsapp.js";

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
app.route("/api", indicadoresEmbrapaRouter);
app.route("/api", plantioTalhoesRouter);
app.route("/api", plantioDashboardRouter);
app.route("/api", plantioCadastrosRouter);
app.route("/api", plantioEventosRouter);
app.route("/api", plantioCustoRouter);
app.route("/api", plantioEstoqueRouter);
app.route("/api", plantioColheitaRouter);
app.route("/api", plantioPlanejamentoRouter);
app.route("/api", plantioIaRouter);
app.route("/api", corteLotesRouter);
app.route("/api", corteDashboardRouter);
app.route("/api", corteEventosRouter);
app.route("/api", corteCustoRouter);
app.route("/api", corteIaRouter);
app.route("/api", cultivoSafrasRouter);
app.route("/api", cultivoAreasRouter);
app.route("/api", cultivoCustosRouter);
app.route("/api", cultivoProducaoRouter);
app.route("/api", cultivoSilosRouter);
app.route("/api", buscaRouter);
app.route("/api", botRouter);
app.route("/api", whatsappRouter);

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`API Rio Novo rodando em http://localhost:${port}`);
});
