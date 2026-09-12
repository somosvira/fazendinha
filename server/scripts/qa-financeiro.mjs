import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

// Nunca reutiliza DATABASE_URL da aplicação, nem carrega server/.env.
const adminUrl = new URL(process.env.QA_DATABASE_ADMIN_URL ?? `postgresql://${userInfo().username}@127.0.0.1:5432/postgres`);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(adminUrl.hostname) || adminUrl.search) {
  throw new Error('QA_DATABASE_ADMIN_URL deve apontar para PostgreSQL local, sem query parameters');
}
const database = `fazendinha_qa249_${randomBytes(8).toString('hex')}`;
const reportDir = mkdtempSync(join(tmpdir(), 'fazendinha-qa249-'));
const target = new URL(adminUrl);
target.pathname = `/${database}`;
const env = { ...process.env, DATABASE_URL: target.href, DIRECT_URL: target.href, NODE_ENV: 'test', FINANCE_QA_DATABASE: database, FINANCE_QA_REPORT_DIR: reportDir };
const admin = new pg.Client({ connectionString: adminUrl.href });
let created = false;
function run(args) {
  const result = spawnSync('pnpm', args, { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  created = true;
  console.log(`Banco temporário: ${database}\nEvidências: ${reportDir}`);
  const migration = run(['exec', 'prisma', 'migrate', 'deploy']);
  process.exitCode = migration || run(['exec', 'vitest', 'run', '--config', 'vitest.financeiro.config.ts', '--reporter=default', '--reporter=json', `--outputFile=${join(reportDir, 'resultados.json')}`]);
} finally {
  if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
  console.log(`Banco temporário removido. Evidências preservadas em ${reportDir}`);
}
