import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { substituirBaseLocal, validarArgumentos } from './substituir-base-local.mjs';

let pasta;
beforeEach(() => { pasta = mkdtempSync(join(tmpdir(), 'substituicao-base-unit-')); });
afterEach(() => { rmSync(pasta, { recursive: true, force: true }); });

function preparar(opcoes = {}) {
  const raiz = join(pasta, 'repo'), pastaServidor = join(raiz, 'server'), backup = join(pasta, 'novo.dump');
  mkdirSync(join(pastaServidor, '.seedatev3', 'v4'), { recursive: true });
  mkdirSync(join(pastaServidor, '.seed'), { recursive: true });
  writeFileSync(join(pastaServidor, '.seed', 'manifesto.json'), '{\"identidade\":\"baseline-anterior\"}');
  writeFileSync(join(pastaServidor, '.seed', 'guia.html'), '<p>Guia anterior preservado</p>');
  const manifesto = join(pastaServidor, '.seedatev3', 'v4', 'manifesto.json');
  writeFileSync(manifesto, '{"identidade":"banco-anterior","ids":{"animal":"preservado"}}\n');
  const ambiente = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://local:senha-ultra-secreta@localhost:54332/fazendinha_seedatev3',
    PGSERVICE: 'nao-reutilizar', PGHOST: 'remoto-indevido', PGOPTIONS: '-h remoto' };
  const chamadas = [], consultas = [];
  let inventarios = 0, terminou = false, conectou = false;
  const db = {
    async connect() { conectou = true; }, async end() { terminou = true; },
    async query(sql) {
      consultas.push(sql);
      assert.match(sql, /^(SELECT|BEGIN|ROLLBACK)/, 'o ensaio unitário só admite comandos de leitura');
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ livre: !opcoes.seedAtiva }] };
      if (sql.includes('pg_stat_activity')) return { rows: [{ total: opcoes.outraConexao ? 1 : 0 }] };
      if (sql.includes('current_database() AS banco')) {
        inventarios++;
        if (inventarios === 2 && opcoes.manifestoMudou) writeFileSync(manifesto, '{}');
        if (inventarios === 2 && opcoes.backupMudou) writeFileSync(backup, 'arquivo alterado');
        return { rows: [{ banco: opcoes.bancoErrado ? 'postgres' : 'fazendinha_seedatev3', oid: '42' }] };
      }
      if (sql.includes('FROM pg_tables')) return { rows: [{ schemaname: 'public', tablename: 'ContaFinanceira' }] };
      if (sql.includes('FROM pg_sequences')) return { rows: [{ schemaname: 'public', sequencename: 'Usuario_id_seq' }] };
      if (sql.includes('last_value::text')) return { rows: [{ last_value: inventarios === 2 && opcoes.sequenciaMudou ? '3' : '2', is_called: true }] };
      if (sql.includes('count(*)::text')) return { rows: [{ quantidade: '4', hash: inventarios === 2 && opcoes.dadosMudaram ? 'divergiu' : 'hash-estavel' }] };
      if (sql.includes('FROM pg_attribute')) return { rows: [{ hash: inventarios === 2 && opcoes.estruturaMudou ? 'estrutura-divergente' : 'estrutura-estavel' }] };
      if (sql.includes('pg_export_snapshot')) return { rows: [{ snapshot: '00000001-00000002-1' }] };
      return { rows: [] };
    },
  };
  const comando = (nome, argumentos, configuracao) => {
    chamadas.push({ nome, argumentos, configuracao });
    assert.ok(!JSON.stringify(argumentos).includes('senha-ultra-secreta'), 'senha nunca vai para argv');
    if (nome === 'pg_dump') {
      assert.equal(configuracao.env.PGHOST, 'localhost');
      assert.equal(configuracao.env.PGDATABASE, 'fazendinha_seedatev3');
      assert.equal(configuracao.env.PGPASSWORD, 'senha-ultra-secreta');
      assert.equal(configuracao.env.PGSERVICE, undefined);
      assert.equal(configuracao.env.PGOPTIONS, '-c default_transaction_read_only=on');
      assert.ok(argumentos.includes('--snapshot=00000001-00000002-1'));
      writeSync(configuracao.stdio[1], Buffer.from('ARQUIVO DE DUMP SINTETICO, nenhum banco acessado'));
      return { status: opcoes.dumpFalhou ? 1 : 0 };
    }
    if (nome === 'pg_restore') return { status: opcoes.dumpIlegivel ? 1 : 0, stdout: 'inventário sintético' };
    assert.equal(nome, 'pnpm');
    assert.equal(configuracao.cwd, pastaServidor);
    assert.deepEqual(argumentos, ['exec', 'prisma', 'migrate', 'reset', '--force', '--skip-seed']);
    return { status: opcoes.resetFalhou ? 1 : 0 };
  };
  const executar = () => substituirBaseLocal({ argumentos: ['--confirmar=fazendinha_seedatev3', `--backup=${backup}`], ambiente, raiz, pastaServidor, conectar: () => db, comando, log() {} });
  return { executar, backup, manifesto, ambiente, raiz, chamadas, consultas, get conectou() { return conectou; }, get terminou() { return terminou; } };
}

test('cria arquivo novo, SHA256 e inventário do mesmo snapshot, preservando manifestos antes do reset simulado', async () => {
  const c = preparar(), antes = readFileSync(c.manifesto);
  const resultado = await c.executar();
  const sidecar = JSON.parse(readFileSync(`${c.backup}.json`, 'utf8'));
  assert.deepEqual(sidecar, resultado);
  assert.equal(sidecar.origem.banco, 'fazendinha_seedatev3');
  assert.equal(sidecar.origem.oid, '42');
  assert.equal(sidecar.backup.sha256, createHash('sha256').update(readFileSync(c.backup)).digest('hex'));
  assert.equal(sidecar.origem.dados[0].hash, 'hash-estavel');
  assert.deepEqual(Buffer.from(sidecar.manifestos.find(m => m.caminho === '.seedatev3/v4/manifesto.json').conteudoBase64, 'base64'), antes);
  assert.equal(existsSync(join(c.raiz, 'server', '.seed')), false);
  assert.equal(readFileSync(join(`${c.backup}.manifestos`, 'local-ativo', 'guia.html'), 'utf8'), '<p>Guia anterior preservado</p>');
  assert.equal(readFileSync(join(`${c.backup}.manifestos`, '.seed', 'guia.html'), 'utf8'), '<p>Guia anterior preservado</p>');
  assert.deepEqual(readFileSync(join(`${c.backup}.manifestos`, '.seedatev3', 'v4', 'manifesto.json')), antes);
  assert.deepEqual(readFileSync(c.manifesto), antes);
  assert.equal(statSync(c.backup).mode & 0o777, 0o600);
  assert.equal(statSync(`${c.backup}.json`).mode & 0o777, 0o600);
  assert.ok(!JSON.stringify(sidecar).includes('senha-ultra-secreta'));
  assert.deepEqual(c.chamadas.map(c => c.nome), ['pg_dump', 'pg_restore', 'pnpm']);
  assert.equal(c.consultas.filter(c => c.includes('current_database() AS banco')).length, 2);
  assert.ok(c.terminou);
});

for (const sufixo of ['', '.json']) test(`recusa arquivo existente ${sufixo || 'dump'} sem conectar ou sobrescrever`, async () => {
  const c = preparar(); writeFileSync(c.backup + sufixo, 'preservar');
  await assert.rejects(c.executar(), /já existe/);
  assert.equal(readFileSync(c.backup + sufixo, 'utf8'), 'preservar');
  assert.equal(c.conectou, false); assert.deepEqual(c.chamadas, []);
});

for (const [opcao, mensagem] of [
  ['seedAtiva', /seed está em execução/], ['outraConexao', /Pare os escritores/], ['bancoErrado', /conexão efetiva/],
  ['dumpFalhou', /Falha ao criar backup/], ['dumpIlegivel', /não pôde ser lido/],
  ['estruturaMudou', /mudaram após/], ['dadosMudaram', /mudaram após/], ['sequenciaMudou', /mudaram após/], ['manifestoMudou', /mudaram após/], ['backupMudou', /mudaram após/],
]) test(`interrompe antes do reset quando ${opcao}`, async () => {
  const c = preparar({ [opcao]: true });
  await assert.rejects(c.executar(), mensagem);
  assert.ok(!c.chamadas.some(c => c.nome === 'pnpm'));
  assert.ok(c.terminou);
});

test('valida escopo, protocolo e diretório externo antes de criar artefatos', () => {
  const c = preparar(), args = ['--confirmar=fazendinha_seedatev3', `--backup=${c.backup}`];
  for (const url of ['postgresql://u:p@remoto/fazendinha_seedatev3', 'postgresql://u:p@localhost/postgres', 'https://localhost/fazendinha_seedatev3', 'postgresql://u:p@localhost/fazendinha_seedatev3?host=remoto'])
    assert.throws(() => validarArgumentos(args, { DATABASE_URL: url }, c.raiz), /restrita/);
  assert.throws(() => validarArgumentos(args, { ...c.ambiente, NODE_ENV: 'production' }, c.raiz), /restrita/);
  assert.throws(() => validarArgumentos(['--confirmar=fazendinha_seedatev3', `--backup=${join(c.raiz, '..backup.dump')}`], c.ambiente, c.raiz), /fora do repositório/);
});


test('reset simulado com falha mantém o manifesto ativo e todas as cópias preservadas', async () => {
  const c = preparar({ resetFalhou: true });
  await assert.rejects(c.executar(), /instalação falhou/);
  assert.ok(existsSync(join(c.raiz, 'server', '.seed', 'manifesto.json')));
  assert.ok(existsSync(join(`${c.backup}.manifestos`, '.seed', 'manifesto.json')));
  assert.equal(existsSync(join(`${c.backup}.manifestos`, 'local-ativo')), false);
  assert.ok(existsSync(`${c.backup}.json`));
});


test('o step de CI só retoma após a falha e o manifesto exatos, sem executar pnpm real', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/staging.yml', import.meta.url), 'utf8');
  const trecho = workflow.split('      - name: Interromper após estoque e retomar\n        run: |\n')[1]?.split('      - name: Verificar e reexecutar sem duplicação')[0];
  assert.ok(trecho, 'step de retomada presente');
  const bloco = trecho.split('\n').filter(l => l.trim()).map(l => l.slice(10)).join('\n');
  for (const cenario of ['correto', 'falha-anterior', 'retorno-zero', 'manifesto-incompleto']) {
    const dir = join(pasta, cenario), bin = join(dir, 'bin');
    mkdirSync(bin, { recursive: true }); mkdirSync(join(dir, 'server', '.seed'), { recursive: true });
    writeFileSync(join(dir, 'server', '.seed', 'manifesto.json'), JSON.stringify({ etapas: cenario === 'manifesto-incompleto' ? ['catalogos'] : ['catalogos', 'financeiro', 'estoque'] }));
    writeFileSync(join(bin, 'pnpm'), `#!/bin/sh
case "$*" in
  *--interromper-apos=estoque*)
    if [ "$CENARIO" = "falha-anterior" ]; then printf 'Falha anterior ao estoque\\n'; exit 1; fi
    printf '[seed] Interrupção de teste após estoque; execute novamente para retomar.\\n'
    if [ "$CENARIO" = "retorno-zero" ]; then exit 0; fi
    exit 1;;
  *) printf 'RETOMADA_CONTROLADA\\n'; exit 0;;
esac
`, { mode: 0o700 });
    // A chamada de testes já foi executada pelo pai; as demais chamadas só leem o manifesto sintético.
    writeFileSync(join(bin, 'node'), `#!/bin/sh
if [ "$1" = "--test" ]; then exit 0; fi
exec "$NODE_ENSAIO" "$@"
`, { mode: 0o700 });
    const resultado = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', bloco.replaceAll('/tmp/seed-interrupcao.log', join(dir, 'interrupcao.log'))], {
      cwd: dir, env: { PATH: `${bin}:${process.env.PATH}`, CENARIO: cenario, NODE_ENSAIO: process.execPath }, encoding: 'utf8',
    });
    assert.equal(resultado.status === 0, cenario === 'correto', `${cenario}: ${resultado.stderr}`);
    assert.equal(resultado.stdout.includes('RETOMADA_CONTROLADA'), cenario === 'correto');
  }
});
