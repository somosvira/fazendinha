// Cria o dono no primeiro boot (tabela Usuario vazia + AUTH_BOOTSTRAP_EMAIL
// setado) — status PENDENTE, loga um link único de definir senha. Sem efeito
// se a tabela já tiver algum usuário. Antes rodava sozinho a cada boot do
// servidor Node (server/src/index.ts); virou script manual — não existe
// "boot" de processo dentro de um Cloudflare Worker pra disparar isso sozinho.
//
//   pnpm --filter rionovo-server run bootstrap:dono

import { prisma } from "../db.js";
import { garantirDonoBootstrap } from "../services/auth/usuarios.js";

async function main() {
  await garantirDonoBootstrap();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
