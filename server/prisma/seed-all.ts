// Seed completo de desenvolvimento. Não altera o schema nem apaga o banco:
// `prisma migrate reset` faz o reset e chama este arquivo automaticamente.
// O seed do rebanho prepara seus cadastros; em seguida, o import substitui os
// oito animais demo pelo rebanho real versionado em rebanho_real.json.
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const passos = [
  ["Financeiro", "prisma/seed.ts"],
  ["Cadastros do rebanho", "prisma/seed-rebanho.ts"],
  ["Rebanho real", "prisma/import-rebanho.ts"],
  ["Plantio", "prisma/seed-plantio.ts"],
  ["Plantios reais", "prisma/seed-plantios-reais.ts"],
  ["Gado de corte", "prisma/seed-corte.ts"],
  ["Equipe e ponto", "prisma/seed-ponto.ts"],
  ["Usuários", "prisma/seed-usuarios.ts"],
] as const;

console.log(`\n=== seed:all — ${passos.length} etapas ===`);

for (const [indice, [titulo, arquivo]] of passos.entries()) {
  console.log(`\n[${indice + 1}/${passos.length}] ${titulo}`);
  execFileSync("tsx", [arquivo], { cwd: serverDir, stdio: "inherit" });
}

console.log("\nSeed completo concluído.");
