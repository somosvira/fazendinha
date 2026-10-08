// Orquestrador histórico, disponível somente por execução explícita de seed:all.
// O seed padrão de desenvolvimento/prisma agora é seedatev3.ts; não combiná-los.
// A pecuária v1 recebe só os catálogos (raças, motivos de baixa); a carga de
// animais é o `import:pecuaria` (JSON do IDEAGRI), rodado à parte.
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const passos = [
  ["Financeiro", "prisma/seed.ts"],
  ["Catálogos da pecuária", "prisma/seed-pecuaria.ts"],
  ["Usuários", "prisma/seed-usuarios.ts"],
  ["Propriedade dos registros", "src/scripts/backfill-propriedade.ts"],
] as const;

console.log(`\n=== seed:all — ${passos.length} etapas ===`);

for (const [indice, [titulo, arquivo]] of passos.entries()) {
  console.log(`\n[${indice + 1}/${passos.length}] ${titulo}`);
  execFileSync("tsx", [arquivo], { cwd: serverDir, stdio: "inherit" });
}

console.log("\nSeed completo concluído.");
