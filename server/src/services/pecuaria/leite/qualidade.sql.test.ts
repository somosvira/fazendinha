import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../../../../prisma/migrations/20261020060000_qualidade_leite_configuravel/migration.sql", import.meta.url), "utf8");
describe("garantias declaradas na migration de qualidade (sem execução em banco)", () => {
  it("coletivo tem origem explícita sem animal e individual referencia exame real", () => {
    expect(sql).toContain("sujeito='ANIMAL' AND \"exameAnimalId\" IS NOT NULL");
    expect(sql).toContain("sujeito='COLETIVO' AND \"exameAnimalId\" IS NULL AND \"origemColetiva\" IS NOT NULL");
    expect(sql).toContain('e."propriedadeId" IS DISTINCT FROM NEW."propriedadeId"');
    expect(sql).toContain('e.data<>NEW.data');
  });
  it("entrada aponta para sítio/data comprovados, sem condicionar ao saldo restante", () => {
    expect(sql).toContain('d."propriedadeId"=NEW."propriedadeId" AND d."dataOperacional"<=NEW.data');
    expect(sql).toContain("x.status='CONFIRMADA'");
    expect(sql).not.toMatch(/saldo|disponivel/);
  });
  it("formato utilizado congela campos/unidades também após coleta coletiva", () => {
    expect(sql).toContain('BEFORE UPDATE ON pecuaria."TipoExame"');
    expect(sql).toContain('EXISTS (SELECT 1 FROM pecuaria."AmostraQualidadeLeite" WHERE "tipoExameId"=OLD.id)');
    expect(sql).toContain('(NEW."tipoResultado",NEW.unidade,NEW.opcoes,NEW.campos) IS DISTINCT FROM');
  });
  it("resultados só encerram vigência, preservando valor/autoria e sem apagar", () => {
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON pecuaria."ResultadoQualidadeLeite"');
    expect(sql).toContain('NEW.valor,NEW.unidade,NEW."criadoEm",NEW."criadoPorId"');
    expect(sql).toContain('OR NOT OLD.vigente OR NEW.vigente OR NEW."substituidoEm" IS NULL');
    expect(sql).toContain('WHERE vigente');
    expect(sql).toContain('Campo/unidade fora do formato preservado');
  });
});


it("datas novas são DATE anuláveis, só na amostra e sem preenchimento retroativo (checagem estrutural)", () => {
  const datas = readFileSync(new URL("../../../../prisma/migrations/20261023160000_datas_qualidade_leite/migration.sql", import.meta.url), "utf8");
  expect(datas).toContain('ALTER TABLE pecuaria."AmostraQualidadeLeite"');
  expect(datas).toContain('ADD COLUMN "dataResultadoLaboratorial" DATE');
  expect(datas).toContain('ADD COLUMN "dataRecebimentoLaudo" DATE');
  expect(datas).not.toMatch(/NOT NULL|DEFAULT|UPDATE |ExameAnimal/);
});
