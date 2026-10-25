import { contemSql, funcaoSql } from "../../../test/sql-baseline.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../../../../prisma/migrations/20261025000000_base_unificada/migration.sql", import.meta.url), "utf8");
describe("contrato SQL da evidência de finalidade", () => {
  it("concilia somente intervalo histórico único Leite e preserva FK restritiva", () => {
    expect(contemSql(funcaoSql("exigir_finalidade_medicao_leite"), "quantidade<>1 OR NOT EXISTS")).toBe(true);
    expect(contemSql(funcaoSql("exigir_finalidade_medicao_leite"), "WHERE id=finalidade_id AND aptidao='LEITE'")).toBe(true);
    expect(contemSql(sql, 'f.desde<=dia AND (')).toBe(true);
    expect(contemSql(sql, 'pecuaria."finalidades_producao_na_data"(NEW."animalId",dia)')).toBe(true);
    expect(contemSql(sql, 'REFERENCES pecuaria."FinalidadeAnimal"(id) ON UPDATE RESTRICT ON DELETE RESTRICT')).toBe(true);
    expect(contemSql(sql, 'REFERENCES pecuaria."DestinoAnimal"')).toBe(false);
  });
  it("protege o animal original quando um update SQL tenta deslocar sua finalidade", () => {
    expect(contemSql(sql, 'OLD."animalId" IS DISTINCT FROM NEW."animalId"')).toBe(true);
    expect(contemSql(sql, 'unnest(ARRAY[OLD."animalId",NEW."animalId"])')).toBe(true);
    expect(contemSql(sql, 'WHERE "finalidadeId"=OLD.id')).toBe(true);
    expect(contemSql(sql, 'p."animalId"=OLD."animalId"')).toBe(true);
    expect(contemSql(sql, '"finalidades_producao_na_data"(OLD."animalId",d."dataOperacional")')).toBe(true);
  });
  it("reativar um participante exige revalidar finalidade mesmo preservando o snapshot antigo", () => {
    expect(contemSql(sql, 'AND NOT (OLD."excluidoEm" IS NOT NULL AND NEW."excluidoEm" IS NULL) THEN RETURN NEW;')).toBe(true);
  });
  it("preserva a extremidade exclusivamente pela baixa ativa da finalidade exata", () => {
    expect(contemSql(sql, 'b."destinoFechadoId"=f.id AND b.data=dia AND b."estornadaEm" IS NULL')).toBe(true);
    expect(contemSql(funcaoSql("finalidades_producao_na_data"), "f.ate=dia AND EXISTS")).toBe(true);
    expect(contemSql(sql, '"finalidades_producao_na_data"(NEW."animalId",dia)')).toBe(true);
    expect(contemSql(sql, '"finalidades_producao_na_data"(animal_id,dia)')).toBe(true);
  });
  it("retirar ou alterar a baixa que comprova a extremidade também revalida o estado final", () => {
    expect(contemSql(sql, 'CREATE CONSTRAINT TRIGGER "BaixaAnimal_proteger_producao" AFTER INSERT OR UPDATE OR DELETE')).toBe(true);
    expect(contemSql(sql, 'datas:=ARRAY[OLD.data,NEW.data]')).toBe(true);
    expect(contemSql(sql, 'animais:=ARRAY[OLD."animalId",NEW."animalId"]')).toBe(true);
    expect(contemSql(sql, 'p."finalidadeId" IS NULL OR f.id=p."finalidadeId"')).toBe(true);
    expect(contemSql(sql, 'regularize ou reabra a finalidade na mesma transação')).toBe(true);
  });
  it("confere a transação final da mudança e protege medição/confirmação", () => {
    expect(contemSql(sql, 'DEFERRABLE INITIALLY DEFERRED')).toBe(true);
    expect(contemSql(sql, 'pg_advisory_xact_lock(hashtext(\'pec-animal:\'')).toBe(true);
    expect(contemSql(sql, 'CREATE TRIGGER "MedicaoLeite_finalidade" BEFORE INSERT OR UPDATE')).toBe(true);
    expect(contemSql(sql, 'CREATE TRIGGER "VinculoMedicaoEntradaLeite_finalidade" BEFORE INSERT OR UPDATE')).toBe(true);
    expect(contemSql(sql, 'AND v.ativo')).toBe(true);
  });
});
