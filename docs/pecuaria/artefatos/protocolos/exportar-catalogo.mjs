import fs from "node:fs/promises";
import pg from "../../../../server/node_modules/pg/lib/index.js";

// Somente estrutura física. Não consulta linhas das tabelas operacionais.
const destino = new URL(process.env.DATABASE_URL ?? "");
if (destino.pathname !== "/fazendinha_seedatev3" || !["localhost", "127.0.0.1", "[::1]"].includes(destino.hostname)) {
  throw new Error("A inspeção usa somente o PostgreSQL local fazendinha_seedatev3.");
}
const tabelas = [
  ["pecuaria", "Protocolo"], ["pecuaria", "MomentoProtocolo"], ["pecuaria", "EtapaProtocolo"],
  ["pecuaria", "ProgramacaoProtocolo"], ["pecuaria", "ParticipacaoProtocolo"], ["pecuaria", "TarefaProtocolo"],
  ["pecuaria", "VinculoTarefaProtocolo"], ["pecuaria", "EventoTarefaProtocolo"], ["pecuaria", "Animal"],
  ["pecuaria", "AplicacaoProduto"], ["pecuaria", "ManejoAnimal"], ["pecuaria", "TentativaReprodutiva"],
  ["pecuaria", "ExameAnimal"], ["pecuaria", "ResultadoExame"], ["pecuaria", "InterpretacaoReprodutiva"],
  ["pecuaria", "GestacaoAnimal"], ["pecuaria", "DemandaAcompanhamentoReprodutivo"],
  ["pecuaria", "ClassificacaoCustoPecuaria"], ["pecuaria", "RequisicaoPecuaria"],
  ["pecuaria", "MaterialGenetico"], ["public", "MovimentoEstoque"], ["public", "Operacao"],
];
const conexao = new pg.Client({ connectionString: destino.href, options: "-c default_transaction_read_only=on" });
await conexao.connect();
try {
  await conexao.query("BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ");
  const catalogo = [];
  for (const [schema, table] of tabelas) {
    const nome = `${schema}."${table}"`;
    const oid = (await conexao.query("SELECT to_regclass($1)::oid AS oid", [nome])).rows[0].oid;
    if (!oid) throw new Error(`Tabela física ausente: ${nome}`);
    const columns = (await conexao.query(`SELECT a.attname AS name, format_type(a.atttypid,a.atttypmod) AS type,
      pg_get_expr(d.adbin,d.adrelid) AS "default", NOT a.attnotnull AS nullable
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`, [oid])).rows;
    const indexes = (await conexao.query(`SELECT c.relname AS name,pg_get_indexdef(i.indexrelid) AS definition
      FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid=$1 ORDER BY c.relname`, [oid])).rows;
    const constraints = (await conexao.query(`SELECT contype::text AS kind,conname AS name,pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid=$1 ORDER BY conname`, [oid])).rows;
    const triggers = (await conexao.query(`SELECT tgname AS name,pg_get_functiondef(tgfoid) AS function,
      pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid=$1 AND NOT tgisinternal ORDER BY tgname`, [oid])).rows;
    catalogo.push({ table, schema, columns, indexes, triggers, constraints });
  }
  await conexao.query("ROLLBACK");
  await fs.writeFile(new URL("./db/schema.json", import.meta.url), JSON.stringify(catalogo, null, 2) + "\n");
  console.log(`Catálogo físico exportado: ${catalogo.length} tabelas; somente metadados.`);
} finally {
  await conexao.end();
}
