import "./lib/dom-parser-polyfill.js";
import { app } from "./app.js";
import { criarPrismaClient, comPrismaPorRequisicao } from "./db.js";
import { env } from "./env.js";
import { avaliarAlertasTemporais } from "./services/pecuaria/sanidade/alertas/avaliador.js";
import { processarPendentes } from "./services/pecuaria/nutricao/mensal.js";

import { processarRadarDiario } from "./services/assistente/radar/servico.js";

export default {
  fetch: app.fetch.bind(app),
  async scheduled(controller: { scheduledTime: number }) {
    if (env.ALERTAS_CRON_ENABLED) {
      const db = criarPrismaClient();
      try { await avaliarAlertasTemporais(db, new Date(controller.scheduledTime)); }
      finally { await db.$disconnect(); }
    }
    if (env.ASSISTENTE_CONSULTA_ENABLED) {
      try { await comPrismaPorRequisicao(() => processarRadarDiario(new Date(controller.scheduledTime))); }
      catch { console.error("[assistente/radar] processamento diário indisponível"); }
    }
    if (env.NUTRICAO_MENSAL_ENABLED && env.NUTRICAO_AUTOMACAO_ENABLED) {
      const resultado = await comPrismaPorRequisicao(() => processarPendentes());
      console.info("[nutricao/processamento]", resultado);
    }
  },
};
