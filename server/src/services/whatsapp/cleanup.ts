// Job de manutenção das confirmações pendentes: marca como EXPIRADA tudo que
// está AGUARDANDO além de expiraEm. Roda 1x por hora. Idempotente.

import { prisma } from "../../db.js";

const INTERVALO_MS = 60 * 60 * 1000; // 1h

let timer: ReturnType<typeof setInterval> | null = null;

async function expirarPendentes(): Promise<void> {
  try {
    const r = await prisma.whatsAppConfirmacaoPendente.updateMany({
      where: { status: "AGUARDANDO", expiraEm: { lt: new Date() } },
      data: { status: "EXPIRADA", decididoEm: new Date() },
    });
    if (r.count > 0) console.log(`[wpp] cleanup: ${r.count} confirmação(ões) expirada(s).`);
  } catch (e) {
    console.error("[wpp] cleanup falhou:", e);
  }
}

export function iniciarCleanupConfirmacoes(): void {
  if (timer) return;
  // Roda uma vez logo após o boot e depois a cada INTERVALO_MS.
  setTimeout(() => {
    void expirarPendentes();
  }, 30_000);
  timer = setInterval(() => {
    void expirarPendentes();
  }, INTERVALO_MS);
}

export function pararCleanupConfirmacoes(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
