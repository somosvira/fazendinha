import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";
import { isCloudflareWorkers } from "./lib/runtime.js";

// Workers bloqueia socket TCP cru, então dentro dele o Prisma só pode falar
// com o banco via HTTP/WebSocket (driver do Neon). Fora do Worker (dev local,
// testes, o processo Node tradicional) usa TCP normal (`pg`) — funciona tanto
// contra o Neon (aceita o protocolo Postgres padrão) quanto contra um Postgres
// local (docker-compose), sem precisar de nenhuma env extra: é a mesma
// DATABASE_URL, só o valor muda por ambiente.
neonConfig.poolQueryViaFetch = true;
if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

function criarPrismaClient(): PrismaClient {
  const adapter = isCloudflareWorkers() ? new PrismaNeon({ connectionString: env.DATABASE_URL }) : new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Fora do Worker, cachear em globalThis sobrevive ao HMR do `tsx watch` (evita
// esgotar conexões a cada reload) — um processo Node de vida longa, uma conexão
// TCP de vida longa, sem problema em reusar entre chamadas.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Dentro do Worker o singleton acima quebra: um isolate NÃO reinicia a cada
// requisição (é reaproveitado entre muitas, é assim que o modelo de isolate
// ganha performance) — só reinicia em cold start. Um PrismaClient criado uma
// vez no module scope, então, fica compartilhado entre requisições diferentes,
// e o I/O do adapter do Neon (fetch/WebSocket) fica atrelado à requisição em
// que foi originado. O runtime do Cloudflare detecta esse reuso entre
// requisições e cancela a promise ("A promise was resolved or rejected from a
// different request context...") — reproduzido em produção em várias rotas
// (/api/auth/me, /api/rebanho/parametros), sempre como pendurar/500 ("Worker's
// code had hung"). Por isso, dentro do Worker, cada requisição usa seu próprio
// PrismaClient — `resetPrismaPorRequisicao()` é chamado por um middleware logo
// no topo de app.ts, antes de qualquer rota (inclusive as isentas de auth).
let prismaDaRequisicaoAtual: PrismaClient | undefined;

export function resetPrismaPorRequisicao(): void {
  if (isCloudflareWorkers()) prismaDaRequisicaoAtual = criarPrismaClient();
}

function criarPrismaProxyPorRequisicao(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      if (!prismaDaRequisicaoAtual) prismaDaRequisicaoAtual = criarPrismaClient();
      return Reflect.get(prismaDaRequisicaoAtual, prop, prismaDaRequisicaoAtual);
    },
  });
}

export const prisma: PrismaClient = isCloudflareWorkers() ? criarPrismaProxyPorRequisicao() : globalForPrisma.prisma ?? criarPrismaClient();

if (!isCloudflareWorkers() && env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
