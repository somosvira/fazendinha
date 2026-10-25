import { contemSql, funcaoSql, tabelaSql } from "../../../test/sql-baseline.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../../../../prisma/migrations/20261025000000_base_unificada/migration.sql", import.meta.url), "utf8");
describe("garantias declaradas na migration de qualidade (sem execução em banco)", () => {
  it("coletivo tem origem explícita sem animal e individual referencia exame real", () => {
    expect(contemSql(sql, "(sujeito = 'ANIMAL'::text) AND (\"exameAnimalId\" IS NOT NULL)")).toBe(true);
    expect(contemSql(sql, "(sujeito = 'COLETIVO'::text) AND (\"exameAnimalId\" IS NULL) AND (\"origemColetiva\" IS NOT NULL)")).toBe(true);
    expect(contemSql(sql, 'e."propriedadeId" IS DISTINCT FROM NEW."propriedadeId"')).toBe(true);
    expect(contemSql(sql, 'e.data<>NEW.data')).toBe(true);
  });
  it("entrada aponta para sítio/data comprovados, sem condicionar ao saldo restante", () => {
    expect(contemSql(sql, 'd."propriedadeId"=NEW."propriedadeId" AND d."dataOperacional"<=NEW.data')).toBe(true);
    expect(contemSql(sql, "x.status='CONFIRMADA'")).toBe(true);
    expect(funcaoSql("conferir_amostra_qualidade_leite")).not.toMatch(/saldo|disponivel/);
  });
  it("formato utilizado congela campos/unidades também após coleta coletiva", () => {
    expect(contemSql(sql, 'BEFORE UPDATE ON pecuaria."TipoExame"')).toBe(true);
    expect(contemSql(sql, 'EXISTS (SELECT 1 FROM pecuaria."AmostraQualidadeLeite" WHERE "tipoExameId"=OLD.id)')).toBe(true);
    expect(contemSql(sql, '(NEW."tipoResultado",NEW.unidade,NEW.opcoes,NEW.campos) IS DISTINCT FROM')).toBe(true);
  });
  it("resultados só encerram vigência, preservando valor/autoria e sem apagar", () => {
    expect(contemSql(sql, 'BEFORE UPDATE OR DELETE ON pecuaria."ResultadoQualidadeLeite"')).toBe(true);
    expect(contemSql(sql, 'NEW.valor,NEW.unidade,NEW."criadoEm",NEW."criadoPorId"')).toBe(true);
    expect(contemSql(sql, 'OR NOT OLD.vigente OR NEW.vigente OR NEW."substituidoEm" IS NULL')).toBe(true);
    expect(contemSql(sql, 'WHERE vigente')).toBe(true);
    expect(contemSql(sql, 'Campo/unidade fora do formato preservado')).toBe(true);
  });
});


it("datas novas são DATE anuláveis, só na amostra e sem preenchimento retroativo (checagem estrutural)", () => {
  const amostra = tabelaSql("AmostraQualidadeLeite");
  for (const coluna of ["dataResultadoLaboratorial", "dataRecebimentoLaudo"]) {
    expect(amostra).toContain(`"${coluna}" date,`);
    expect(amostra).not.toMatch(new RegExp(`"${coluna}" date (?:NOT NULL|DEFAULT)`));
    expect(tabelaSql("ExameAnimal")).not.toContain(coluna);
  }
});
