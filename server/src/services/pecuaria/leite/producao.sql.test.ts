import { contemSql, funcaoSql } from "../../../test/sql-baseline.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../../../../prisma/migrations/20261025000000_base_unificada/migration.sql", import.meta.url), "utf8");
describe("snapshot SQL da rotina e da identidade da folha", () => {
  it("preserva identidade, data, sítio, configuração e autoria do dia", () => {
    expect(contemSql(sql, 'BEFORE UPDATE ON "pecuaria"."DiaProducaoLeite"')).toBe(true);
    for (const lado of ["NEW", "OLD"])
      expect(contemSql(sql, `ROW(${lado}.id, ${lado}."propriedadeId", ${lado}."dataOperacional", ${lado}."configuracaoId", ${lado}."criadoEm", ${lado}."criadoPorId")`)).toBe(true);
    expect(contemSql(sql, "NEW.versao <> OLD.versao + 1")).toBe(true);
  });
  it("bloqueia configuração em uso e qualquer mutação de posições das versões velha ou nova", () => {
    expect(contemSql(sql, 'BEFORE UPDATE OR DELETE ON "pecuaria"."ConfiguracaoOrdenha"')).toBe(true);
    expect(contemSql(sql, 'BEFORE INSERT OR UPDATE OR DELETE ON "pecuaria"."PosicaoOrdenha"')).toBe(true);
    expect(contemSql(sql, 'ARRAY[OLD."configuracaoId", NEW."configuracaoId"]')).toBe(true);
    expect(contemSql(sql, 'WHERE "configuracaoId"=ANY(configuracoes)')).toBe(true);
    expect(contemSql(sql, 'WHERE "configuracaoId"=OLD.id')).toBe(true);
  });
  it("congelamento e alteração de posição serializam no mesmo pai e invalidam snapshots antigos", () => {
    const posicao = funcaoSql("proteger_posicao_ordenha_usada");
    expect(posicao.indexOf("ORDER BY id FOR UPDATE")).toBeLessThan(posicao.indexOf("IF EXISTS"));
    expect(contemSql(posicao, 'UPDATE "pecuaria"."ConfiguracaoOrdenha" SET id=id WHERE id=ANY(configuracoes)')).toBe(true);
    const congelar = funcaoSql("congelar_configuracao_dia_leite");
    expect(contemSql(congelar, '"propriedadeId"=NEW."propriedadeId" FOR UPDATE')).toBe(true);
    expect(contemSql(congelar, 'UPDATE "pecuaria"."ConfiguracaoOrdenha" SET id=id WHERE id=NEW."configuracaoId"')).toBe(true);
    expect(contemSql(sql, 'BEFORE INSERT ON "pecuaria"."DiaProducaoLeite"')).toBe(true);
  });
});
