import { contemSql, tabelaSql } from "../../../test/sql-baseline.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../../../../prisma/migrations/20261025000000_base_unificada/migration.sql", import.meta.url), "utf8");
describe("contrato estrutural da migration de parcelas; não comprova execução SQL", () => {
  it("mantém dados antigos sem backfill e admite recipiente livre explicitamente identificado", () => {
    expect(tabelaSql('MedicaoGeralLeite')).toMatch(/"tanqueId" text,/);
    expect(tabelaSql('MedicaoGeralLeite')).not.toMatch(/"tanqueId" text NOT NULL/);
    expect(contemSql(sql, 'CREATE UNIQUE INDEX "MedicaoGeralLeite_recipiente_unico"')).toBe(true);
    expect(contemSql(sql, 'lower(TRIM(BOTH FROM recipiente))')).toBe(true);
    expect(sql).not.toMatch(/UPDATE\s+pecuaria\."(?:ConfiguracaoOrdenha|MedicaoGeralLeite)"\s+SET/i);
    expect(contemSql(sql, 'DROP INDEX pecuaria."MedicaoGeralLeite_sessaoId_tanqueId_key"')).toBe(false);
  });
  it("régua manual não exige tabela e a conversão histórica continua documentada", () => {
    expect(contemSql(sql, "IF NEW.\"origemLitros\"='TABELA_TANQUE' THEN")).toBe(true);
    expect(contemSql(sql, "IF TG_OP='INSERT' THEN RAISE EXCEPTION 'novas parcelas usam litros manuais")).toBe(true);
    expect(contemSql(sql, 'jsonb_array_elements(tanque."tabelaConversao")')).toBe(true);
    expect(contemSql(sql, 'NEW.litros>tanque."capacidadeLitros"')).toBe(true);
  });
  it("conjunto, snapshot e contexto usam a barreira da sessão e guardas diferidas", () => {
    for (const texto of ['FOR NO KEY UPDATE', 'DEFERRABLE INITIALLY DEFERRED', 'ta."identidadeId"=tb."identidadeId"', 'NEW.snapshot->\'declaracaoDireta\'', 'NEW.snapshot->\'criterioColostroSnapshot\'', 'pa.status=\'VALIDO\'', 'l.inicio=pa.data', 'g."primeiraOrdenhaColostro" IS DISTINCT FROM true']) expect(contemSql(sql, texto)).toBe(true);
    expect(contemSql(sql, 'CREATE TRIGGER "PartoAnimal_travar_parcelas_leite"')).toBe(true);
    expect(contemSql(sql, 'CREATE CONSTRAINT TRIGGER "LactacaoAnimal_proteger_partos_parcelas_leite"')).toBe(true);
    expect(contemSql(sql, 'DROP TRIGGER')).toBe(false);
  });
});
