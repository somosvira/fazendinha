// Gerencia a allowlist de telefones do bot de WhatsApp.
//   pnpm --filter rionovo-server run whatsapp:user add 5531999999999 "Marco Antônio"
//   pnpm --filter rionovo-server run whatsapp:user list
//   pnpm --filter rionovo-server run whatsapp:user remove 5531999999999
// Telefone no formato E.164 SEM "+" (como a Meta entrega), ex.: 5531999999999.

import { prisma } from "../db.js";

const soDigitos = (s: string) => (s ?? "").replace(/\D/g, "");

async function main() {
  const [cmd, arg1, ...rest] = process.argv.slice(2);

  if (cmd === "add") {
    const telefone = soDigitos(arg1);
    const nome = rest.join(" ").trim();
    if (!telefone || !nome) throw new Error('uso: add <telefone> "<nome>"');
    const u = await prisma.usuarioWhatsapp.upsert({
      where: { telefone },
      create: { telefone, nome, ativo: true },
      update: { nome, ativo: true },
    });
    console.log(`✅ liberado: ${u.nome} (${u.telefone})`);
  } else if (cmd === "remove") {
    const telefone = soDigitos(arg1);
    await prisma.usuarioWhatsapp.update({ where: { telefone }, data: { ativo: false } });
    console.log(`🚫 desativado: ${telefone}`);
  } else if (cmd === "list") {
    const us = await prisma.usuarioWhatsapp.findMany({ orderBy: { nome: "asc" } });
    if (!us.length) console.log("(allowlist vazia)");
    for (const u of us) console.log(`  ${u.ativo ? "✅" : "🚫"} ${u.nome} — ${u.telefone}`);
  } else {
    console.log('uso: add <telefone> "<nome>" | remove <telefone> | list');
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
