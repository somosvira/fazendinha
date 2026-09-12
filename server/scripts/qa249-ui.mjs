import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import { resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const serverDir = fileURLToPath(new URL('..', import.meta.url));
const stateDir = resolve(serverDir, '.qa249');
const pointer = resolve(stateDir, 'atual.json');
const mode = process.argv[2] ?? 'prepare';
if (!['prepare', 'dev'].includes(mode)) throw new Error('Use prepare ou dev');
mkdirSync(stateDir, { recursive: true, mode: 0o700 });
function validate(raw, expected) {
  const u = new URL(raw);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) || u.search) throw new Error('Somente PostgreSQL local, sem query parameters');
  if (expected && (!/^fazendinha_qa249_ui_[a-f0-9]{16}$/.test(expected) || u.pathname !== `/${expected}`)) throw new Error('Banco QA inválido');
  return u;
}
function environment(config) {
  validate(config.url, config.database);
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(OPENAI_|WHATSAPP_|R2_|RESEND_|AUTH_|SHARED_ACCESS_TOKEN$)/.test(key)) delete env[key];
  return { ...env, DATABASE_URL: config.url, DIRECT_URL: config.url, QA249_UI_DATABASE: config.database,
    QA249_UI_DIR: config.directory, NODE_ENV: 'development', PORT: '42973',
    APP_BASE_URL: 'http://localhost:42975', CORS_ORIGIN: 'http://localhost:42975',
    STORAGE_DRIVER: 'local', LOCAL_STORAGE_DIR: resolve(config.directory, 'uploads'), AUTH_EMAIL_PROVIDER: 'log' };
}
function run(args, config) {
  const r = spawnSync('pnpm', args, { cwd: serverDir, env: environment(config), stdio: 'inherit' });
  if (r.error || r.status !== 0) throw new Error(`Comando falhou: pnpm ${args.join(' ')}`);
}
if (mode === 'prepare') {
  if (existsSync(pointer) && !process.argv.includes('--nova-rodada')) {
    const config = JSON.parse(readFileSync(pointer, 'utf8'));
    run(['exec', 'tsx', 'prisma/seed-qa249.ts'], config);
    console.log('Rodada existente preservada. Use --nova-rodada para começar em outro banco, sem apagar este.');
  } else {
    const adminUrl = validate(process.env.QA_DATABASE_ADMIN_URL ?? `postgresql://${userInfo().username}@127.0.0.1:5432/postgres`);
    const database = `fazendinha_qa249_ui_${randomBytes(8).toString('hex')}`;
    const url = new URL(adminUrl); url.pathname = `/${database}`;
    const directory = resolve(stateDir, database);
    mkdirSync(directory, { mode: 0o700 });
    const config = { database, url: url.href, directory };
    const admin = new pg.Client({ connectionString: adminUrl.href });
    let created = false;
    try {
      await admin.connect(); await admin.query(`CREATE DATABASE "${database}"`); created = true;
      run(['exec', 'prisma', 'migrate', 'deploy'], config);
      run(['exec', 'tsx', 'prisma/seed-qa249.ts'], config);
      writeFileSync(pointer, JSON.stringify(config, null, 2), { mode: 0o600 });
      writeFileSync(resolve(directory, 'conexao.json'), JSON.stringify(config, null, 2), { mode: 0o600 });
      console.log(`Rodada preparada e persistente: ${database}\nManifesto: ${directory}/manifesto.json`);
    } catch (e) {
      if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
      throw e;
    } finally { await admin.end(); }
  }
  console.log('Inicie com: pnpm --filter rionovo-server qa249:dev');
} else {
  if (!existsSync(pointer)) throw new Error('Execute qa249:prepare primeiro');
  const config = JSON.parse(readFileSync(pointer, 'utf8'));
  const env = environment(config);
  const api = spawn('pnpm', ['exec', 'tsx', 'src/index.ts'], { cwd: serverDir, env, stdio: 'inherit', detached: process.platform !== 'win32' });
  const ui = spawn('pnpm', ['--filter', 'rionovo-client', 'exec', 'vite', '--config', 'vite.qa249.config.ts'], { cwd: serverDir, env, stdio: 'inherit', detached: process.platform !== 'win32' });
  let stopping = false;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true; process.exitCode = code;
    for (const child of [api, ui]) {
      try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM'); else child.kill('SIGTERM'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  }
  process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
  for (const child of [api, ui]) {
    child.on('error', () => stop(1));
    child.on('exit', code => { if (!stopping) stop(code ?? 1); });
  }
  console.log(`QA #249: http://localhost:42975 — banco ${config.database}`);
}
