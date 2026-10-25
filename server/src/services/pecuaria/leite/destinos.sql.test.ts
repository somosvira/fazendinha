import { contemSql, funcaoSql } from "../../../test/sql-baseline.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../../../../prisma/migrations/20261025000000_base_unificada/migration.sql", import.meta.url), "utf8");
const guarda = funcaoSql("proteger_fatos_destino_leite");
describe("contrato SQL de imutabilidade dos destinos internos", () => {
  it("protege ambas as tabelas antes de update/delete, inclusive leite comum sem vínculo clínico", () => {
    for (const tabela of ["DestinoInternoLeite", "ParcelaDestinoLeite"])
      expect(contemSql(sql, `BEFORE INSERT OR UPDATE OR DELETE ON "pecuaria"."${tabela}"`)).toBe(true);
    expect(contemSql(guarda, "IF TG_OP = 'DELETE' THEN")).toBe(true);
    expect(contemSql(guarda, "Histórico de destino interno de leite não pode ser apagado")).toBe(true);
    // A proteção usa comparação de todos os campos, sem depender da natureza COLOSTRO.
    expect(contemSql(guarda, "(to_jsonb(NEW) - 'ativo') IS DISTINCT FROM (to_jsonb(OLD) - 'ativo')")).toBe(true);
    expect(contemSql(guarda, "natureza = 'COLOSTRO'")).toBe(false);
  });
  it("só exclui da imutabilidade os campos necessários à transição terminal de estorno", () => {
    const lista = "ARRAY['status', 'versao', 'estornadoEm', 'estornadoPorId', 'motivoEstorno', 'movimentoEstornoId']";
    expect(contemSql(guarda, `to_jsonb(NEW) - ${lista}`)).toBe(true);
    expect(contemSql(guarda, `to_jsonb(OLD) - ${lista}`)).toBe(true);
    expect(contemSql(guarda, "OLD.status <> 'CONFIRMADO' OR NEW.status <> 'ESTORNADO'")).toBe(true);
    expect(contemSql(guarda, "NEW.versao <> OLD.versao + 1")).toBe(true);
    expect(contemSql(guarda, 'NEW."movimentoEstornoId" IS NULL')).toBe(true);
    expect(contemSql(guarda, 'length(btrim(NEW."motivoEstorno")) < 5')).toBe(true);
    expect(contemSql(guarda, "IF NOT OLD.ativo OR NEW.ativo THEN")).toBe(true);
  });
  it("exige estado inicial e conserva a conferência diferida do estorno e das parcelas", () => {
    expect(contemSql(guarda, "NEW.status <> 'CONFIRMADO' OR NEW.versao <> 1")).toBe(true);
    expect(contemSql(guarda, "ELSIF NOT NEW.ativo THEN")).toBe(true);
    expect(contemSql(sql, 'inverso."reversaoDeId"=d."movimentoId"')).toBe(true);
    expect(contemSql(sql, "p.ativo <> (d.status='CONFIRMADO')")).toBe(true);
    expect(contemSql(sql, 'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "pecuaria"."conferir_destino_interno_leite"()')).toBe(true);
  });
});
