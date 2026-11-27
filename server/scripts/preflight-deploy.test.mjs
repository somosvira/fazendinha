import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarDestino } from './preflight-deploy.mjs';
const nome = '20261124170000_base_unificada';
const base = { migration_name: nome, checksum: 'hash', finished_at: new Date(), rolled_back_at: null };
function cliente({ existe = true, rows = [], total = 0 } = {}) {
  return { query: async sql => sql.includes('to_regclass') ? { rows: [{ existe }] } : sql.includes('_prisma_migrations') && !sql.includes('pg_class') ? { rows } : { rows: [{ total }] } };
}
test('autoriza banco vazio ou baseline conferida', async () => {
  await verificarDestino(cliente({ existe: false }), 'hash');
  await verificarDestino(cliente({ rows: [base] }), 'hash');
});
test('recusa histórico antigo, checksum divergente, duplicata, pendente e estrutura sem ledger', async () => {
  for (const opcoes of [
    { rows: [{ ...base, migration_name: 'antiga' }] },
    { rows: [{ ...base, checksum: 'outro' }] },
    { rows: [base, base] },
    { rows: [base, { ...base, migration_name: 'pendente', finished_at: null }] },
    { existe: false, total: 1 },
  ]) await assert.rejects(verificarDestino(cliente(opcoes), 'hash'));
});
