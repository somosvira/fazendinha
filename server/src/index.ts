import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { healthRouter } from "./routes/health.js";
import { notaFiscalRouter } from "./routes/notaFiscal.js";

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
app.route("/api", notaFiscalRouter);

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`API Rio Novo rodando em http://localhost:${port}`);
});

// Bot WhatsApp (Baileys) — gateado por WHATSAPP_ENABLED. Quando false, esses
// imports lazy nem disparam o carregamento de @whiskeysockets/baileys.
if (env.WHATSAPP_ENABLED) {
  const { iniciarBotWhatsapp, encerrarBotWhatsapp } = await import("./services/whatsapp/bot.js");
  const { iniciarCleanupConfirmacoes } = await import("./services/whatsapp/cleanup.js");
  iniciarBotWhatsapp().catch((e) => {
    console.error("[wpp] inicialização do bot falhou:", e);
  });
  iniciarCleanupConfirmacoes();
  const shutdown = async () => {
    await encerrarBotWhatsapp();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
