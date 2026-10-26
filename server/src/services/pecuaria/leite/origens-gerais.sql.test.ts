import { contemSql, funcaoSql } from "../../../test/sql-baseline.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../../../../prisma/migrations/20261025000000_base_unificada/migration.sql", import.meta.url), "utf8");

describe("contrato estrutural SQL das origens gerais (sem executar PostgreSQL)", () => {
  it("indexa a identidade explícita sem criar medições, preencher lacunas ou alterar dados", () => {
    expect(contemSql(sql, 'USING GIN ("animaisOrigem" jsonb_path_ops)')).toBe(true);
    expect(contemSql(sql, 'g."animaisOrigem" @> jsonb_build_array(animal_id)')).toBe(true);
    expect(funcaoSql("conferir_historico_origem_geral")).not.toMatch(/INSERT INTO|UPDATE pecuaria|DELETE FROM/i);
  });
  it("serializa origem, confirmação e histórico pelo mesmo advisory lock antes da sessão", () => {
    expect(contemSql(sql, "hashtext('pec-animal:'||id)")).toBe(true);
    expect(contemSql(sql, 'chaves ORDER BY h')).toBe(true);
    expect(contemSql(sql, '"MedicaoGeralLeite_00_travar_origens" BEFORE INSERT OR UPDATE')).toBe(true);
    expect(contemSql(sql, '"EntradaProducaoLeite_00_travar_origens" BEFORE INSERT OR UPDATE')).toBe(true);
    const entrada = funcaoSql("travar_entrada_origem_geral");
    expect(entrada.indexOf('travar_animais_origem_geral(ids)')).toBeLessThan(entrada.indexOf('FOR NO KEY UPDATE'));
    expect(contemSql(sql, 'OLD."animaisOrigem"')).toBe(true);
  });
  it("confere estado final da finalidade, baixa, sítio, cadastro e lactação", () => {
    for (const entidade of ['FinalidadeAnimal', 'BaixaAnimal', 'LocalizacaoAnimal', 'Animal', 'LactacaoAnimal']) {
      expect(contemSql(sql, `CREATE CONSTRAINT TRIGGER "${entidade}_proteger_origem_geral"`)).toBe(true);
      expect(contemSql(sql, `CREATE TRIGGER "${entidade}_travar_origem_geral" BEFORE`)).toBe(true);
    }
    expect(contemSql(sql, 'DEFERRABLE INITIALLY DEFERRED')).toBe(true);
    expect(contemSql(sql, 'pecuaria."finalidades_producao_na_data"(animal_id,fato.dia)')).toBe(true);
    expect(contemSql(sql, 'b."localizacaoFechadaId"=l.id')).toBe(true);
    expect(contemSql(sql, 'LEAST(COALESCE(OLD.ate')).toBe(true);
    expect(contemSql(sql, 'd."dataOperacional"<fim')).toBe(true);
  });
  it("preserva snapshots anulados e valida identidades somente das entradas confirmadas", () => {
    expect(contemSql(sql, "e.status='CONFIRMADA'")).toBe(true);
    expect(contemSql(sql, "entrada.status<>'CONFIRMADA' THEN RETURN NEW")).toBe(true);
    expect(contemSql(sql, "evidencia->>'finalidadeId' IS DISTINCT FROM finalidade_id")).toBe(true);
    expect(contemSql(sql, "evidencia->>'localizacaoId' IS DISTINCT FROM local_id")).toBe(true);
    expect(contemSql(sql, "Snapshot deve preservar exatamente os animais da aferição geral")).toBe(true);
    expect(contemSql(sql, 'SELECT * INTO entrada FROM pecuaria."EntradaProducaoLeite" WHERE id=NEW.id')).toBe(true);
  });
});
