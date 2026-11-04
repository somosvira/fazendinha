import "./lib/dom-parser-polyfill.js";
import { app } from "./app.js";
import { criarPrismaClient, comPrismaPorRequisicao } from "./db.js";
import { env } from "./env.js";
import { avaliarAlertasTemporais } from "./services/pecuaria/sanidade/alertas/avaliador.js";
import { processarPendentes } from "./services/pecuaria/nutricao/mensal.js";

import { processarAutomacoes } from "./services/pecuaria/protocolos/automacao.js";

export default {
  fetch: app.fetch.bind(app),
  async scheduled(controller: { scheduledTime: number; cron?: string }) {
    if (env.REPRODUCAO_AUTOMACAO_ENABLED) {
      try { await comPrismaPorRequisicao(() => processarAutomacoes(new Date(controller.scheduledTime))); }
      catch (erro) { console.error("[reproducao/automacao] Falha ao processar fila", erro instanceof Error ? erro.name : "Erro"); }
    }
    // Manter rotinas existentes a cada 15 minutos.
    if (controller.cron && Math.floor(controller.scheduledTime / 60_000) % 15 !== 0) return;
    if (env.ALERTAS_CRON_ENABLED) {
      const db = criarPrismaClient();
      try { await avaliarAlertasTemporais(db, new Date(controller.scheduledTime)); }
      finally { await db.$disconnect(); }
    }
    if (env.NUTRICAO_MENSAL_ENABLED && env.NUTRICAO_AUTOMACAO_ENABLED) {
      const resultado = await comPrismaPorRequisicao(() => processarPendentes());
      console.info("[nutricao/processamento]", resultado);
    }
  },
};
