import pg from '../server/node_modules/pg/lib/index.js';
const nome = 'qa_ui_31ade0f981799800';
const db = new pg.Client({connectionString:'postgresql://fazendinha:fazendinha@localhost:54332/postgres'});
await db.connect();
try {
  const existe = await db.query('SELECT datname FROM pg_database WHERE datname = $1', [nome]);
  if (existe.rows.length) {
    await db.query(`DROP DATABASE "${nome}" WITH (FORCE)`);
    console.log('Removido somente o banco temporário fictício desta validação.');
  } else console.log('Banco temporário já removido.');
} finally { await db.end(); }
