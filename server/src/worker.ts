import "./lib/dom-parser-polyfill.js";
import { app } from "./app.js";
import { criarPrismaClient, comPrismaPorRequisicao } from "./db.js";
import { env } from "./env.js";
import { avaliarAlertasTemporais } from "./services/pecuaria/sanidade/alertas/avaliador.js";
import { processarPendentes } from "./services/pecuaria/nutricao/mensal.js";

import { processarRadarDiario } from "./services/assistente/radar/servico.js";
import { apurarMetasAutomaticas } from "./services/assistente/metas/servico.js";
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
    if (env.ASSISTENTE_CONSULTA_ENABLED) {
      try { await comPrismaPorRequisicao(() => processarRadarDiario(new Date(controller.scheduledTime))); }
      catch { console.error("[assistente/radar] processamento diário indisponível"); }
    }
    // Uma rodada por dia, às 6h de Brasília: o cron de 15 minutos só entra no primeiro quarto de hora.
    const agora = new Date(controller.scheduledTime);
    const [hora, minuto] = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(agora).split(":").map(Number);
    if (hora === 6 && minuto < 15) {
      try { console.info("[metas/apuracao]", await comPrismaPorRequisicao(() => apurarMetasAutomaticas(null, agora))); }
      catch { console.error("[metas/apuracao] apuração automática indisponível"); }
    }
    if (env.NUTRICAO_MENSAL_ENABLED && env.NUTRICAO_AUTOMACAO_ENABLED) {
      const resultado = await comPrismaPorRequisicao(() => processarPendentes());
      console.info("[nutricao/processamento]", resultado);
    }
  },
};
