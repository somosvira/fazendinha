// Job de manutenção dos uploads pendentes. Roda 1x por hora:
//
//   1. Marca como EXPIRADO tudo que está AGUARDANDO além de expiraEm.
//   2. Apaga do storage objetos de pendentes CANCELADO/EXPIRADO com mais de
//      24h — dá uma janela pra retomada caso o usuário reenvie a foto antes
//      do cleanup rodar.
//
// Idempotente: se rodar 2x em sequência, a segunda execução não faz nada.

import { prisma } from "../../db.js";
import { getStorage } from "../../lib/storage.js";

const INTERVALO_MS = 60 * 60 * 1000; // 1h
const TTL_STORAGE_MS = 24 * 60 * 60 * 1000; // 24h

let timer: ReturnType<typeof setInterval> | null = null;

async function expirarAguardando(): Promise<void> {
  const r = await prisma.notaFiscalUploadPendente.updateMany({
    where: { status: "AGUARDANDO", expiraEm: { lt: new Date() } },
    data: { status: "EXPIRADO", decididoEm: new Date() },
  });
  if (r.count > 0) console.log(`[cleanupPendentes] expirados: ${r.count}`);
}

async function apagarStorageOrfaos(): Promise<void> {
  const corte = new Date(Date.now() - TTL_STORAGE_MS);
  // Janela cap: 50 por execução pra não estourar quotas do R2 em casos
  // patológicos (bot/teste subindo milhares).
  const orfaos = await prisma.notaFiscalUploadPendente.findMany({
    where: {
      status: { in: ["CANCELADO", "EXPIRADO"] },
      storageKey: { not: "" },
      decididoEm: { lt: corte },
    },
    take: 50,
    select: { id: true, storageKey: true },
  });
  if (orfaos.length === 0) return;

  const storage = await getStorage();
  let apagados = 0;
  for (const o of orfaos) {
    try {
      await storage.deleteObject({ key: o.storageKey });
      // Apagar a row depois de apagar do storage: se o delete do storage falhar,
      // a row continua e tentamos de novo na próxima passada.
      await prisma.notaFiscalUploadPendente.delete({ where: { id: o.id } });
      apagados += 1;
    } catch (e) {
      console.error(`[cleanupPendentes] apagar ${o.storageKey} falhou:`, e);
    }
  }
  if (apagados > 0) console.log(`[cleanupPendentes] storage limpo: ${apagados} objeto(s)`);
}

async function tick(): Promise<void> {
  try {
    await expirarAguardando();
    await apagarStorageOrfaos();
  } catch (e) {
    console.error("[cleanupPendentes] tick falhou:", e);
  }
}

export function iniciarCleanupPendentes(): void {
  if (timer) return;
  // Primeira passada 30s após o boot — dá tempo do servidor estar saudável.
  setTimeout(() => void tick(), 30_000);
  timer = setInterval(() => void tick(), INTERVALO_MS);
}

export function pararCleanupPendentes(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
