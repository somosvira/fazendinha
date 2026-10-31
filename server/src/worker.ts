import "./lib/dom-parser-polyfill.js";
import { app } from "./app.js";
import { criarPrismaClient } from "./db.js";
import { env } from "./env.js";
import { avaliarAlertasTemporais } from "./services/pecuaria/sanidade/alertas/avaliador.js";
// Nenhum cron de ambiente é habilitado nesta entrega. Fetch mantém o contrato Hono/SPA.
export default {
  fetch: app.fetch.bind(app),
  async scheduled(controller: { scheduledTime:number }) {
    if (!env.ALERTAS_CRON_ENABLED) return;
    const db=criarPrismaClient();
    try { await avaliarAlertasTemporais(db,new Date(controller.scheduledTime)); }
    finally { await db.$disconnect(); }
  },
};
