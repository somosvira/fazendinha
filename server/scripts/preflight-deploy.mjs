import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const nome = '20261124170000_base_unificada';
export async function verificarDestino(cliente, checksum) {
  const tabela = await cliente.query("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS existe");
  if (tabela.rows[0].existe) {
    const ledger = await cliente.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations');
    const ativas = ledger.rows.filter(m => !m.rolled_back_at);
    const base = ativas.filter(m => m.migration_name === nome);
    if (base.length === 1 && base[0].finished_at && base[0].checksum === checksum && ativas.every(m => m.finished_at)) return;
    if (ativas.length) throw new Error('Banco existente exige reconciliação e baseline comprovada antes do deploy.');
  }
  const objetos = await cliente.query(`SELECT
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','pecuaria') AND c.relkind IN ('r','p','v','m','S','f') AND c.relname <> '_prisma_migrations') +
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','pecuaria')) +
    (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','pecuaria') AND t.typtype IN ('e','d')) AS total`);
  if (Number(objetos.rows[0].total) !== 0) throw new Error('Banco não está vazio e não possui baseline comprovada.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let cliente;
  try {
    const { default: pg } = await import('pg');
    const sql = await readFile(new URL('../prisma/migrations/20261124170000_base_unificada/migration.sql', import.meta.url));
    const checksum = createHash('sha256').update(sql).digest('hex');
    cliente = new pg.Client({ connectionString: process.env.DIRECT_URL, options: '-c default_transaction_read_only=on' });
    await cliente.connect();
    await verificarDestino(cliente, checksum);
  } catch (erro) {
    console.error('Preflight de migrations recusou o destino:', erro instanceof Error ? erro.message : 'erro desconhecido');
    process.exitCode = 1;
  } finally { if (cliente) await cliente.end(); }
}
