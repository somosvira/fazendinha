import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const cwd = new URL('../', import.meta.url);
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
function executar(target = 'staging', overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fazendinha-deploy-test-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const log = join(dir, 'commands');
  const stubs = {
    pnpm: `#!/bin/sh
printf '%s\n' "$*" >> "$TEST_COMMANDS"
case "$*" in
  'exec prisma migrate deploy')
    if [ "$TEST_MIGRATION_FAIL" = 1 ]; then echo 'migration failed'; exit 1; fi
    echo 'No pending migrations to apply.' ;;
  'exec wrangler deploy'*)
    if [ "$TEST_DEPLOY_FAIL" = 1 ]; then exit 1; fi ;;
  *) exit 99 ;;
esac
`,
    curl: `#!/bin/sh
printf '%s\\n' "$*" >> "$TEST_COMMANDS"
printf '%s' "$TEST_HEALTH"
`,
    sleep: '#!/bin/sh\nexit 0\n',
  };
  for (const [name, content] of Object.entries(stubs)) writeFileSync(join(bin, name), content, { mode: 0o755 });
  const host = target === 'producao' ? 'ep-calm-frog-acks64ue.sa-east-1.aws.neon.tech' : 'ep-green-recipe-acyjvbqp.sa-east-1.aws.neon.tech';
  const url = `postgresql://test:test@${host}/neondb?sslmode=require`;
  try {
    const result = spawnSync('sh', ['scripts/cf-deploy.sh', target], { cwd, encoding: 'utf8', env: {
      PATH: `${bin}:${process.env.PATH}`, HOME: process.env.HOME,
      CLOUDFLARE_ACCOUNT_ID: '1148b69b1e1518155a8dd0cf91929ebf', CLOUDFLARE_API_TOKEN: 'test-inerte',
      DATABASE_URL: url, DIRECT_URL: url,
      WORKERS_CI_COMMIT_SHA: sha, WORKERS_CI_BUILD_UUID: 'test',
      GITHUB_ACTIONS: 'true', GITHUB_REF: target === 'producao' ? 'refs/heads/main' : 'refs/heads/staging', GITHUB_EVENT_NAME: 'push',
      TEST_COMMANDS: log, TEST_MIGRATION_FAIL: '0', TEST_DEPLOY_FAIL: '0',
      TEST_HEALTH: JSON.stringify({ status: 'ok', database: { connected: true }, config: { ok: true }, migrations: { upToDate: true }, commit: sha }),
      ...overrides,
    } });
    let commands = '';
    try { commands = readFileSync(log, 'utf8'); } catch {}
    return { ...result, commands };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

for (const target of ['staging', 'producao']) test(`publica ${target} após migrations e confere health`, () => {
  const r = executar(target);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.commands, new RegExp(`exec prisma migrate deploy\\nexec wrangler deploy --env ${target}`));
  assert.match(r.commands, /WORKERS_CI_COMMIT_SHA:/);
  assert.match(r.commands, new RegExp(`https://fazendinha-${target === 'staging' ? 'stg' : 'producao'}.somosvirasudo.workers.dev/api/health`));
  assert.doesNotMatch(r.commands, /seed|reset/);
});
for (const [name, target, env] of [
  ['ambiente ausente', '', {}],
  ['branch incompatível', 'producao', { GITHUB_REF: 'refs/heads/staging' }],
  ['PR não publica', 'staging', { GITHUB_EVENT_NAME: 'pull_request' }],
  ['conta incorreta', 'staging', { CLOUDFLARE_ACCOUNT_ID: 'outra' }],
  ['credencial ausente', 'staging', { CLOUDFLARE_API_TOKEN: '' }],
  ['banco trocado', 'producao', { DIRECT_URL: 'postgresql://test:test@ep-green-recipe-acyjvbqp.sa-east-1.aws.neon.tech/neondb?sslmode=require' }],
  ['conexão inválida sem expor segredo', 'staging', { DIRECT_URL: 'senha-que-nao-pode-aparecer' }],
  ['SHA incorreto', 'staging', { WORKERS_CI_COMMIT_SHA: 'a'.repeat(40) }],
]) test(`bloqueia ${name} antes de escrever`, () => {
  const r = executar(target, env);
  assert.notEqual(r.status, 0);
  assert.equal(r.commands, '');
  assert.doesNotMatch(r.stdout + r.stderr, /senha-que-nao-pode-aparecer/);
});
test('migration falha impede publicação', () => {
  const r = executar('staging', { TEST_MIGRATION_FAIL: '1' });
  assert.notEqual(r.status, 0);
  assert.doesNotMatch(r.commands, /wrangler|health/);
});
test('falha de publicação impede health', () => {
  const r = executar('staging', { TEST_DEPLOY_FAIL: '1' });
  assert.notEqual(r.status, 0);
  assert.doesNotMatch(r.commands, /api\/health/);
});
for (const health of [
  { status: 'ok', database: { connected: true }, config: { ok: true }, migrations: { upToDate: true }, commit: 'outro' },
  { status: 'ok', database: { connected: true }, config: { ok: true }, migrations: { upToDate: null }, commit: sha },
]) test('HTTP 200 sem confirmar versão e migrations falha', () => {
  const r = executar('staging', { TEST_HEALTH: JSON.stringify(health) });
  assert.notEqual(r.status, 0);
  assert.equal(r.commands.match(/api\/health/g)?.length, 5);
});
