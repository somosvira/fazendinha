/* Seed COMPLETO da Fazenda Rio Novo — popula um banco do zero com TODOS os dados
 * da fazenda, na ordem certa de dependência, num único comando:
 *
 *     pnpm --filter rionovo-server run seed:all
 *
 * Fontes REAIS (dados de verdade da fazenda):
 *   • Financeiro — `import.ts` lê `rio_novo.json` (~6.700 lançamentos extraídos do
 *     Excel/Access do BPO). Roda PRIMEIRO: cria o plano de contas (Categoria/
 *     GrupoCategoria/CentroCusto) e a fundação multi-propriedade que os demais usam.
 *   • Rebanho — `import-rebanho.ts` lê `rebanho_real.json` (631 animais do Ideagri,
 *     regenerado por `scripts/extract-rebanho.sh` a partir do Firebird DADOS777.FDB).
 *   • Café + Milho — `seed-plantios-reais.ts` popula as safras reais colhidas na
 *     visita técnica (café adensado ~28k pés + milho silagem → alimenta o painel de
 *     Milho/cultivo).
 *
 * Fontes de DEMONSTRAÇÃO (sem origem real ainda — mantêm os módulos utilizáveis):
 *   • Plantio (talhões de café), Corte (gado de corte) e Equipe & Ponto (RH/folha —
 *     alimenta o painel de Equipe).
 *
 * Cada passo é o mesmo script que já roda isolado (idempotente); aqui só os
 * encadeamos em ordem. Para atualizar o rebanho a partir do Ideagri antes de semear:
 *     bash scripts/extract-rebanho.sh   (regenera rebanho_real.json)
 */
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type Passo = { titulo: string; fonte: "REAL" | "DEMO"; bin: string; args: string[] };

// Ordem importa: o financeiro cria plano de contas + fundação de propriedade que os
// demais assumem existir; rebanho e safras vêm depois; os módulos de demonstração por último.
const PASSOS: Passo[] = [
  { titulo: "Schema (prisma db push)",     fonte: "REAL", bin: "prisma", args: ["db", "push", "--skip-generate"] },
  { titulo: "Financeiro (rio_novo.json)",  fonte: "REAL", bin: "tsx", args: ["prisma/import.ts"] },
  { titulo: "Rebanho (Ideagri)",           fonte: "REAL", bin: "tsx", args: ["prisma/import-rebanho.ts"] },
  { titulo: "Café + Milho (safras reais)", fonte: "REAL", bin: "tsx", args: ["prisma/seed-plantios-reais.ts"] },
  { titulo: "Plantio (talhões demo)",      fonte: "DEMO", bin: "tsx", args: ["prisma/seed-plantio.ts"] },
  { titulo: "Gado de corte (demo)",        fonte: "DEMO", bin: "tsx", args: ["prisma/seed-corte.ts"] },
  { titulo: "Equipe & Ponto (demo)",       fonte: "DEMO", bin: "tsx", args: ["prisma/seed-ponto.ts"] },
];

console.log(`\n=== seed:all — populando a Fazenda Rio Novo (${PASSOS.length} passos) ===\n`);

for (const [i, p] of PASSOS.entries()) {
  const n = i + 1;
  console.log(`\n──── [${n}/${PASSOS.length}] ${p.titulo}  (${p.fonte}) ────`);
  // stdio herdado: cada script imprime seu próprio resumo. Falha → lança e aborta o seed.
  execFileSync(p.bin, p.args, { cwd: serverDir, stdio: "inherit" });
}

console.log(`\n✓ seed:all concluído — banco populado com os dados reais (financeiro + rebanho Ideagri + café/milho) e os módulos de demonstração (plantio/corte/ponto).\n`);
