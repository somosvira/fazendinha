import { contemSql, funcaoSql } from "../../../test/sql-baseline.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../../../prisma/migrations/20261025000000_base_unificada/migration.sql", import.meta.url), "utf8");
describe("segregação física por medição inteira no SQL", () => {
  it("libera vários grupos por sessão e impede dupla confirmação da medição entre quaisquer produtos", () => {
    expect(sql).not.toContain('CREATE UNIQUE INDEX \"EntradaLeite_sessao_confirmada\"');
    expect(contemSql(sql, 'ON pecuaria."VinculoMedicaoEntradaLeite"("medicaoId") WHERE ativo')).toBe(true);
    expect(contemSql(sql, 'CHECK (((quantidade > (0)::numeric) AND ("versaoMedicao" > 0)))')).toBe(true);
    expect(contemSql(sql, 'FOR NO KEY UPDATE')).toBe(true);
  });
  it("exige soma exata, mesma sessão, medição positiva, versão e identidade do snapshot", () => {
    for (const prova of ['quantidade_total IS DISTINCT FROM e.quantidade', 'md."sessaoId"<>e."sessaoId"', 'md.litros IS DISTINCT FROM v.quantidade', 'md.versao<>v."versaoMedicao"', `j->>'animalId'=p."animalId"`, 'v.ativo<>(e.status=\'CONFIRMADA\')'])
      expect(contemSql(sql, prova)).toBe(true);
    expect(contemSql(sql, 'PERFORM pecuaria.conferir_medicoes_entrada_leite(entrada.id)')).toBe(true);
    expect(contemSql(sql, 'DEFERRABLE INITIALLY DEFERRED')).toBe(true);
    expect(contemSql(funcaoSql('conferir_medicoes_entrada_leite'), 'FROM jsonb_array_elements(e.snapshot->\'medicoes\')')).toBe(true);
  });
  it("serializa alteração manual da medição com confirmação antes de consultar entradas", () => {
    const guard = funcaoSql("proteger_medicao_leite_confirmada");
    expect(contemSql(guard, 'ARRAY[OLD."sessaoId",NEW."sessaoId"]')).toBe(true);
    expect(contemSql(guard, 'ORDER BY id FOR NO KEY UPDATE')).toBe(true);
    expect(guard.indexOf('ORDER BY id FOR NO KEY UPDATE')).toBeLessThan(guard.indexOf('IF EXISTS'));
  });
  it("preserva vínculos e permite apenas liberar após anulação, conservando consumidores e inversos", () => {
    expect(contemSql(sql, "IF TG_OP='DELETE' THEN RAISE EXCEPTION")).toBe(true);
    expect(contemSql(sql, "(to_jsonb(NEW)-'ativo') IS DISTINCT FROM (to_jsonb(OLD)-'ativo')")).toBe(true);
    expect(contemSql(sql, "NOT OLD.ativo OR NEW.ativo OR e.status<>'ANULADA'")).toBe(true);
    expect(contemSql(sql, 'BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."VinculoMedicaoEntradaLeite"')).toBe(true);
    expect(contemSql(sql, 'BEFORE UPDATE ON pecuaria."MedicaoLeite"')).toBe(true);
    expect(contemSql(sql, "(entrada.status='ANULADA' AND q<>0)")).toBe(true);
    expect(contemSql(sql, 'origem."valorTotal" IS DISTINCT FROM m."valorTotal"')).toBe(true);
    expect(contemSql(sql, 'PERFORM pecuaria.conferir_valor_entrada_leite(entrada.id)')).toBe(true);
  });
});
