// Garante a fundação multi-propriedade: cria a "Propriedade principal" se a
// tabela estiver vazia e faz backfill de propriedadeId=NULL nas tabelas legadas
// (estoque, plantio, cultivo, ponto). Antes rodava sozinho a cada boot
// do servidor (server/src/index.ts); virou script manual — rodar depois de
// sincronizar o schema (db push/migrate deploy) e depois dos seeds.
//
//   pnpm --filter rionovo-server run backfill:propriedade

import { prisma } from "../db.js";
import { garantirFundacaoPropriedade } from "../services/propriedade.js";

async function main() {
  await garantirFundacaoPropriedade();
  console.log("[propriedade] fundação garantida: principal criada se faltava, propriedadeId=NULL backfillado.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
