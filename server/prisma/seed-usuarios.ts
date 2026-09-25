// Seed de contas de acesso (login real). Idempotente: upsert por e-mail, então
// pode rodar quantas vezes quiser sem duplicar. Senha guardada só como hash
// scrypt (nunca em claro). Rodar: pnpm --filter rionovo-server run seed:usuarios
import { prisma } from "../src/db.js";
import { hashSenha } from "../src/services/auth/hash.js";
import { aplicarPreset } from "../src/services/auth/papeis.js";

const SENHA = "senha123";

// Acesso total pra todos: todos com o preset "proprietario" (todas as abas +
// todas as flags). Só o Marco é o dono (irrevogável). Ajustável na tela de
// Acessos depois, se quiser restringir alguém.
const CONTAS: { nome: string; email: string; papel: string; dono: boolean }[] = [
  { nome: "Marco Antonio", email: "marco@rionovo.com.br", papel: "proprietario", dono: true },
  { nome: "testdev", email: "testdev@rionovo.com.br", papel: "proprietario", dono: false },
  { nome: "Tássila", email: "tassila@rionovo.com.br", papel: "proprietario", dono: false },
  { nome: "Mariana", email: "mariana@rionovo.com.br", papel: "proprietario", dono: false },
];

async function main() {
  for (const c of CONTAS) {
    const preset = aplicarPreset(c.papel);
    const dados = {
      nome: c.nome,
      papel: c.papel,
      abas: preset.abas,
      flags: preset.flags,
      status: "ATIVO" as const,
      dono: c.dono,
      senhaHash: hashSenha(SENHA), // hash próprio por conta → salt único (não compartilhado)
    };
    const u = await prisma.usuario.upsert({
      where: { email: c.email },
      update: dados,
      create: { email: c.email, ...dados },
    });
    console.log(`  ✓ ${u.nome.padEnd(14)} ${u.email.padEnd(26)} ${u.papel}${u.dono ? " · dono" : ""}`);
  }
  console.log(`\n${CONTAS.length} contas prontas. Senha de todas: ${SENHA}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
