import { readFileSync } from "node:fs";

export const baselineSql = readFileSync(new URL("../../prisma/migrations/20261025000000_base_unificada/migration.sql", import.meta.url), "utf8");

// pg_dump normaliza aspas, espaços, USING btree e a ordem dos eventos de triggers.
// Essas diferenças de representação não alteram as garantias examinadas.
function normalizarSql(sql: string): string {
  return sql.replace(/"/g, "").toLowerCase()
    .replace(/\b(before|after)\s+((?:insert|update|delete)(?:\s+or\s+(?:insert|update|delete))*)/g,
      (_, momento: string, eventos: string) => `${momento} ${eventos.split(/\s+or\s+/).sort().join(" or ")}`)
    .replace(/\s+using btree\s*/g, "")
    .replace(/\s+/g, "");
}

export function contemSql(sql: string, trecho: string): boolean {
  return normalizarSql(sql).includes(normalizarSql(trecho));
}

export function funcaoSql(nome: string): string {
  const definicao = baselineSql.match(new RegExp(`CREATE FUNCTION (?:public|pecuaria)\\.${nome}\\([^]*?\\$\\$;`));
  if (!definicao) throw new Error(`Função ausente na baseline: ${nome}`);
  return definicao[0];
}

export function tabelaSql(nome: string): string {
  const definicao = baselineSql.match(new RegExp(`CREATE TABLE (?:public|pecuaria)\\."${nome}" \\([^]*?\\n\\);`));
  if (!definicao) throw new Error(`Tabela ausente na baseline: ${nome}`);
  return definicao[0];
}
