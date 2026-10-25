import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import { env } from '../../src/env.js';
import { schemaManifesto, validarDestino } from '../seedatev3/contexto.js';

export function argumentos(args: string[]) {
  let modo: 'aplicar' | 'preflight' | 'verificar' = 'aplicar';
  let base = resolve('prisma/../.seedatev3/manifesto.json');
  let interromper: string | undefined;
  let arquivosR2 = false;
  for (const a of args.filter(a => a !== '--')) {
    if (a === '--preflight' || a === '--verificar') {
      if (modo !== 'aplicar') throw new Error('Escolha apenas um modo.');
      modo = a === '--preflight' ? 'preflight' : 'verificar';
    } else if (a.startsWith('--base=')) base = resolve(a.slice(7));
    else if (a === '--arquivos-r2') arquivosR2 = true;
    else if (a.startsWith('--interromper-apos=')) interromper = a.slice(19);
    else throw new Error(`Argumento desconhecido: ${a}`);
  }
  if (arquivosR2 && modo !== 'aplicar') throw new Error('Arquivos R2 só podem ser carregados no modo de aplicação.');
  return { modo, base, pasta: resolve(dirname(base), 'v5'), interromper, arquivosR2 };
}
export function conferirMigrations(arquivos: { nome: string; hash: string }[], aplicadas: { migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }[]) {
  const pendentes = arquivos.filter(a => !aplicadas.some(m => m.migration_name === a.nome && m.checksum === a.hash && m.finished_at && !m.rolled_back_at)).map(a => a.nome);
  if (aplicadas.some(m => !m.finished_at && !m.rolled_back_at)) pendentes.push('MIGRATION_INTERROMPIDA');
  return pendentes;
}
/** Somente leitura no banco; a conexão mantém a mesma trava usada pelas seeds V3/V4. */
export async function preparar(base: string) {
  const destino = validarDestino(env.DATABASE_URL, env.NODE_ENV);
  if (!['dev', 'test'].includes(env.STORAGE_NAMESPACE)) throw new Error('Namespace precisa ser dev ou test.');
  const original = await readFile(base, 'utf8');
  const manifesto = schemaManifesto.parse(JSON.parse(original));
  const db = new pg.Client({ connectionString: destino.toString(), options: '-c default_transaction_read_only=on' });
  await db.connect();
  try {
    if (!(await db.query<{ livre: boolean }>("SELECT pg_try_advisory_lock(hashtext('seedatev3')) AS livre")).rows[0].livre) throw new Error('Outra seed está em execução.');
    const migrations = (await db.query<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations')).rows;
    const pasta = new URL('../migrations/', import.meta.url);
    const arquivos = await Promise.all((await readdir(pasta)).filter(n => /^\d/.test(n)).map(async nome => ({ nome, hash: createHash('sha256').update(await readFile(new URL(`${nome}/migration.sql`, pasta))).digest('hex') })));
    const identidadeDb = (await db.query<{ identidade: string }>("SELECT oid::text || ':' || current_database() AS identidade FROM pg_database WHERE datname=current_database()")).rows[0].identidade;
    const identidade = `${destino.hostname}:${destino.port}:${identidadeDb}:${migrations.filter(m => m.finished_at).map(m => m.finished_at!.toISOString()).sort()[0]}`;
    if (manifesto.identidade !== identidade) throw new Error('Manifesto base pertence a outra instância. Não copie nem recrie o manifesto.');
    const sitios = (await db.query<{ id: number; nome: string }>('SELECT id,nome FROM public."Propriedade" ORDER BY id')).rows;
    const principal = Number(manifesto.ids['sitio:Principal']);
    if (!sitios.some(s => s.id === principal)) throw new Error('Sítio principal do manifesto não existe. Nenhum sítio será criado.');
    const animais = (await db.query<{ id: string }>('SELECT id FROM pecuaria."Animal" ORDER BY id')).rows.map(a => a.id);
    const pendentes = conferirMigrations(arquivos, migrations);
    return { manifesto, principal, sitios, animais, pendentes, db,
      conferirPreservacao: async () => {
        if (await readFile(base, 'utf8') !== original) throw new Error('O manifesto base foi alterado durante a execução.');
        const atuais = (await db.query('SELECT id,nome FROM public."Propriedade" ORDER BY id')).rows;
        if (JSON.stringify(atuais) !== JSON.stringify(sitios)) throw new Error('A lista de sítios mudou durante a execução.');
        const atuaisAnimais = (await db.query<{ id: string }>('SELECT id FROM pecuaria."Animal" ORDER BY id')).rows.map(a => a.id);
        if (JSON.stringify(atuaisAnimais) !== JSON.stringify(animais)) throw new Error('A lista de animais mudou durante a execução.');
      }, fechar: () => db.end() };
  } catch (e) { await db.end(); throw e; }
}
