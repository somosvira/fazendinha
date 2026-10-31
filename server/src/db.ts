import { AsyncLocalStorage } from "node:async_hooks";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";
import { isCloudflareWorkers } from "./lib/runtime.js";

// O Worker usa HTTP/WebSocket pelo adapter Neon; Node usa TCP pelo adapter pg.
// Ambos recebem a conexão validada em env.DATABASE_URL.
neonConfig.poolQueryViaFetch = true;
if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

export function criarPrismaClient(): PrismaClient {
  const adapter = isCloudflareWorkers() ? new PrismaNeon({ connectionString: env.DATABASE_URL }) : new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Fora do Worker, cachear em globalThis sobrevive ao HMR do `tsx watch` (evita
// esgotar conexões a cada reload) — um processo Node de vida longa, uma conexão
// TCP de vida longa, sem problema em reusar entre chamadas.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Requisições concorrentes compartilham o isolate, mas não podem compartilhar
// I/O do Neon. Uma variável global de "requisição atual" troca o cliente de A
// quando B começa durante um await. O contexto assíncrono conserva o cliente
// de cada chamada até a resposta, inclusive dentro de transações.
const contextoPrisma = new AsyncLocalStorage<{ cliente?: PrismaClient }>();

export async function comPrismaPorRequisicao<T>(executar: () => Promise<T>): Promise<T> {
  if (!isCloudflareWorkers()) return executar();
  const contexto: { cliente?: PrismaClient } = {};
  return contextoPrisma.run(contexto, async () => {
    try {
      return await executar();
    } finally {
      try {
        await contexto.cliente?.$disconnect();
      } catch {
        // Falha de limpeza não deve substituir a resposta ou o erro original,
        // nem expor detalhes da conexão nos logs.
        console.warn("[db] Falha ao encerrar conexão da requisição");
      }
    }
  });
}

function criarPrismaProxyPorRequisicao(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      const contexto = contextoPrisma.getStore();
      if (!contexto) throw new Error("Acesso ao banco no Worker exige contexto de requisição");
      const cliente = contexto.cliente ??= criarPrismaClient();
      return Reflect.get(cliente, prop, cliente);
    },
  });
}

export const prisma: PrismaClient = isCloudflareWorkers() ? criarPrismaProxyPorRequisicao() : globalForPrisma.prisma ?? criarPrismaClient();

if (!isCloudflareWorkers() && env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
