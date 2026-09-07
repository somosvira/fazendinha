// O seed local não importa mais Excel nem recria dados legados. Ele aplica o
// schema e gera somente um cenário financeiro pequeno e determinístico.
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não configurada");
const destino = new URL(databaseUrl);
if (!["127.0.0.1", "localhost"].includes(destino.hostname) || destino.pathname !== "/fazendinha_local") {
  throw new Error("seed:all destrutivo bloqueado: use somente o banco local fazendinha_local");
}

execFileSync("prisma", ["db", "push", "--force-reset", "--skip-generate"], { cwd: serverDir, stdio: "inherit" });
execFileSync("tsx", ["prisma/seed.ts"], { cwd: serverDir, stdio: "inherit" });
