import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../../../../prisma/migrations/20261021190000_finalidade_producao_leite/migration.sql", import.meta.url), "utf8");
describe("contrato SQL da evidência de finalidade", () => {
  it("concilia somente intervalo histórico único Leite e preserva FK restritiva", () => {
    expect(sql).toContain("HAVING count(*)=1 AND bool_and(f.aptidao='LEITE')");
    expect(sql).toContain('f.desde<=dia AND (');
    expect(sql).toContain('JOIN LATERAL pecuaria."finalidades_producao_na_data"(p."animalId",d."dataOperacional")');
    expect(sql).toContain('REFERENCES pecuaria."FinalidadeAnimal"(id) ON DELETE RESTRICT ON UPDATE RESTRICT');
    expect(sql).not.toContain('REFERENCES pecuaria."DestinoAnimal"');
  });
  it("protege o animal original quando um update SQL tenta deslocar sua finalidade", () => {
    expect(sql).toContain('OLD."animalId" IS DISTINCT FROM NEW."animalId"');
    expect(sql).toContain('unnest(ARRAY[OLD."animalId",NEW."animalId"])');
    expect(sql).toContain('WHERE "finalidadeId"=OLD.id');
    expect(sql).toContain('p."animalId"=OLD."animalId"');
    expect(sql).toContain('"finalidades_producao_na_data"(OLD."animalId",d."dataOperacional")');
  });
  it("reativar um participante exige revalidar finalidade mesmo preservando o snapshot antigo", () => {
    expect(sql).toContain('AND NOT (OLD."excluidoEm" IS NOT NULL AND NEW."excluidoEm" IS NULL) THEN RETURN NEW;');
  });
  it("preserva a extremidade exclusivamente pela baixa ativa da finalidade exata", () => {
    expect(sql).toContain('b."destinoFechadoId"=f.id AND b.data=dia AND b."estornadaEm" IS NULL');
    expect(sql).toContain("'motivoExtremidade',CASE WHEN h.baixa_id IS NOT NULL THEN 'BAIXA_NO_DIA' END");
    expect(sql).toContain('"finalidades_producao_na_data"(NEW."animalId",dia)');
    expect(sql).toContain('"finalidades_producao_na_data"(animal_id,dia)');
  });
  it("retirar ou alterar a baixa que comprova a extremidade também revalida o estado final", () => {
    expect(sql).toContain('CREATE CONSTRAINT TRIGGER "BaixaAnimal_proteger_producao" AFTER INSERT OR UPDATE OR DELETE');
    expect(sql).toContain('datas:=ARRAY[OLD.data,NEW.data]');
    expect(sql).toContain('animais:=ARRAY[OLD."animalId",NEW."animalId"]');
    expect(sql).toContain('p."finalidadeId" IS NULL OR f.id=p."finalidadeId"');
    expect(sql).toContain('regularize ou reabra a finalidade na mesma transação');
  });
  it("confere a transação final da mudança e protege medição/confirmação", () => {
    expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(sql).toContain('pg_advisory_xact_lock(hashtext(\'pec-animal:\'');
    expect(sql).toContain('CREATE TRIGGER "MedicaoLeite_finalidade" BEFORE INSERT OR UPDATE');
    expect(sql).toContain('CREATE TRIGGER "VinculoMedicaoEntradaLeite_finalidade" BEFORE INSERT OR UPDATE');
    expect(sql).toContain('AND v.ativo');
  });
});
