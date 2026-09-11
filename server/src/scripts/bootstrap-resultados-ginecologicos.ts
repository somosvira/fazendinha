// Dicionário operacional mínimo dos 44 resultados de exame ginecológico
// (até a reextração oficial) — idempotente. Antes rodava sozinho a cada boot
// do servidor Node (server/src/index.ts); virou script manual — não existe
// "boot" de processo dentro de um Cloudflare Worker pra disparar isso sozinho.
//
//   pnpm --filter rionovo-server run bootstrap:resultados-ginecologicos

import { prisma } from "../db.js";
import { garantirResultadosGinecologicosSemente } from "../services/rebanho/exame-ginecologico.js";

async function main() {
  await garantirResultadosGinecologicosSemente();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
