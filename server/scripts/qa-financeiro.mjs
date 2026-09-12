import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

// Um único banco local. Só o schema gerado por esta execução é removido.
const target = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.pathname !== '/fazendinha_local') {
  throw new Error('Os testes exigem DATABASE_URL local apontando para fazendinha_local');
}
const schema = `qa249_test_${randomBytes(8).toString('hex')}`;
const reportDir = mkdtempSync(join(tmpdir(), 'fazendinha-qa249-'));
const connection = new URL(target); connection.searchParams.delete('schema');
target.searchParams.set('schema', schema);
const env = { ...process.env, DATABASE_URL: target.href, DIRECT_URL: target.href, NODE_ENV: 'test', FINANCE_QA_SCHEMA: schema, FINANCE_QA_REPORT_DIR: reportDir };
const admin = new pg.Client({ connectionString: connection.href });
let created = false;
function run(args) {
  const result = spawnSync('pnpm', args, { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
try {
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`); created = true;
  console.log(`Banco: fazendinha_local; schema temporário: ${schema}\nEvidências: ${reportDir}`);
  const migration = run(['exec', 'prisma', 'migrate', 'deploy']);
  process.exitCode = migration || run(['exec', 'vitest', 'run', '--config', 'vitest.financeiro.config.ts', '--reporter=default', '--reporter=json', `--outputFile=${join(reportDir, 'resultados.json')}`]);
} finally {
  if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
  console.log(`Schema temporário removido; dados locais preservados. Evidências: ${reportDir}`);
}
