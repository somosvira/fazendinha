import pg from "../server/node_modules/pg/lib/index.js";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
const base = new URL("postgresql://fazendinha:fazendinha@localhost:54332/postgres");
const banco = `qa_ui_${randomBytes(8).toString("hex")}`;
const alvo = new URL(base); alvo.pathname = `/${banco}`;
const env = { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: alvo.href, DIRECT_URL: alvo.href, NODE_ENV: "test", JWT_SECRET: "qa-interface-isolada-2026", R2_ACCOUNT_ID: "qa-inerte", R2_ACCESS_KEY_ID: "qa-inerte", R2_SECRET_ACCESS_KEY: "qa-inerte", R2_BUCKET_NOTAS: "qa-inerte", STORAGE_NAMESPACE: "test", PORT: "41883", APP_BASE_URL: "http://localhost:41885", OCR_ENABLED: "false", ASSISTENTE_CONSULTA_ENABLED: "false" };
const admin = new pg.Client({ connectionString: base.href });
const filhos = []; let criado = false;
function executar(args) { const r = spawnSync("pnpm", args, { cwd: "server", env, stdio: "inherit" }); if (r.status !== 0) throw new Error(`QA comando falhou: ${args[0]}`); }
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${banco}"`); criado = true;
  executar(["exec", "prisma", "migrate", "deploy"]);
  executar(["exec", "tsx", "../.impeccable/qa-interface-fixtures.ts"]);
  filhos.push(spawn("pnpm", ["exec", "tsx", "watch", "src/index.ts"], { cwd: "server", env, stdio: "inherit", detached: true }));
  filhos.push(spawn("pnpm", ["exec", "vite", "--config", "../.impeccable/vite-qa.config.ts"], { cwd: "client", env, stdio: "inherit", detached: true }));
  console.log(`QA_ISOLADA_PRONTA ${banco} http://localhost:41885`);
  await new Promise(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
} finally {
  for (const filho of filhos) { try { process.kill(-filho.pid, "SIGTERM"); } catch {} }
  if (criado) await admin.query(`DROP DATABASE "${banco}" WITH (FORCE)`);
  await admin.end(); console.log("Banco e servidores QA removidos; ambiente original preservado.");
}
