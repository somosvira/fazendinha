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
// esgotar conexões a cada reload). Dentro do Worker isso não existe — cada
// isolate recomeça do zero, e o adapter HTTP/WebSocket do Neon não mantém pool
// próprio da mesma forma que uma conexão TCP de vida longa, então recriar por
// invocação não tem o mesmo custo que teria em Node.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? criarPrismaClient();

if (!isCloudflareWorkers() && env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
