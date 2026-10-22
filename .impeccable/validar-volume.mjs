import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
const require = createRequire(new URL('../server/package.json', import.meta.url));
const { Client } = require('pg');
const banco = `qa_volume_${crypto.randomBytes(8).toString('hex')}`;
const admin = new Client({ connectionString: 'postgresql://fazendinha:fazendinha@127.0.0.1:54332/postgres' });
await admin.connect();
let criado = false;
try {
  await admin.query(`CREATE DATABASE "${banco}"`); criado = true;
  console.log(JSON.stringify({ bancoDescartavel: banco, estado: 'criado' }));
  const url = `postgresql://fazendinha:fazendinha@127.0.0.1:54332/${banco}`;
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: 'test', PECUARIA_DB_INTEGRATION: '1', NUTRICAO_VOLUME_INTEGRATION: '1', AUTH_DB_INTEGRATION: '0', FINANCE_DB_INTEGRATION: '0' };
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { cwd: 'server', env, stdio: 'inherit' });
  if (process.argv[2] !== '--somente-auth') execFileSync('pnpm', ['exec', 'vitest', 'run', 'src/services/pecuaria/nutricao/volume.integration.test.ts'], { cwd: 'server', env, stdio: 'inherit' });
  execFileSync('pnpm', ['exec', 'vitest', 'run', 'src/services/auth/contas.integration.test.ts'], { cwd: 'server', env: { ...env, AUTH_DB_INTEGRATION: '1', NUTRICAO_VOLUME_INTEGRATION: '0' }, stdio: 'inherit' });
} finally {
  if (criado) { await admin.query(`DROP DATABASE "${banco}" WITH (FORCE)`); console.log(JSON.stringify({ bancoDescartavel: banco, estado: 'removido' })); }
  await admin.end();
}
