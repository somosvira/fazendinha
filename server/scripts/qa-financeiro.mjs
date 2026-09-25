import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

// Cria um banco temporário no Postgres local (a partir do fazendinha_local, que
// só serve de porta de entrada) e o remove ao final — os dados locais não são
// tocados. Banco inteiro, e não um schema: o Prisma usa os schemas fixos
// "public" e "pecuaria", que não se isolam por `?schema=`.
const target = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.pathname !== '/fazendinha_local') {
  throw new Error('Os testes exigem DATABASE_URL local apontando para fazendinha_local');
}
const database = `qa249_test_${randomBytes(8).toString('hex')}`;
const reportDir = mkdtempSync(join(tmpdir(), 'fazendinha-qa249-'));
const connection = new URL(target); connection.searchParams.delete('schema');
const qa = new URL(connection); qa.pathname = `/${database}`;
const env = { ...process.env, DATABASE_URL: qa.href, DIRECT_URL: qa.href, NODE_ENV: 'test', FINANCE_QA_DATABASE: database, FINANCE_QA_REPORT_DIR: reportDir };
const admin = new pg.Client({ connectionString: connection.href });
let created = false;
function run(args) {
  const result = spawnSync('pnpm', args, { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`); created = true;
  console.log(`Banco temporário: ${database}\nEvidências: ${reportDir}`);
  const migration = run(['exec', 'prisma', 'migrate', 'deploy']);
  process.exitCode = migration || run(['exec', 'vitest', 'run', '--config', 'vitest.financeiro.config.ts', '--reporter=default', '--reporter=json', `--outputFile=${join(reportDir, 'resultados.json')}`]);
} finally {
  if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
  console.log(`Banco temporário removido; dados locais preservados. Evidências: ${reportDir}`);
}
