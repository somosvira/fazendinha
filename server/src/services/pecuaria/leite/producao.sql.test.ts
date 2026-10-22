import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../../../../prisma/migrations/20261019230000_producao_leite_individual/migration.sql", import.meta.url), "utf8");
describe("snapshot SQL da rotina e da identidade da folha", () => {
  it("preserva identidade, data, sítio, configuração e autoria do dia", () => {
    expect(sql).toContain('BEFORE UPDATE ON "pecuaria"."DiaProducaoLeite"');
    for (const lado of ["NEW", "OLD"])
      expect(sql).toContain(`ROW(${lado}.id, ${lado}."propriedadeId", ${lado}."dataOperacional", ${lado}."configuracaoId", ${lado}."criadoEm", ${lado}."criadoPorId")`);
    expect(sql).toContain("NEW.versao <> OLD.versao + 1");
  });
  it("bloqueia configuração em uso e qualquer mutação de posições das versões velha ou nova", () => {
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON "pecuaria"."ConfiguracaoOrdenha"');
    expect(sql).toContain('BEFORE INSERT OR UPDATE OR DELETE ON "pecuaria"."PosicaoOrdenha"');
    expect(sql).toContain('ARRAY[OLD."configuracaoId", NEW."configuracaoId"]');
    expect(sql).toContain('WHERE "configuracaoId"=ANY(configuracoes)');
    expect(sql).toContain('WHERE "configuracaoId"=OLD.id');
  });
  it("congelamento e alteração de posição serializam no mesmo pai e invalidam snapshots antigos", () => {
    const posicao = sql.slice(sql.indexOf('CREATE FUNCTION "pecuaria"."proteger_posicao_ordenha_usada"'), sql.indexOf('CREATE FUNCTION "pecuaria"."congelar_configuracao_dia_leite"'));
    expect(posicao.indexOf("ORDER BY id FOR UPDATE")).toBeLessThan(posicao.indexOf("IF EXISTS"));
    expect(posicao).toContain('UPDATE "pecuaria"."ConfiguracaoOrdenha" SET id=id WHERE id=ANY(configuracoes)');
    const congelar = sql.slice(sql.indexOf('CREATE FUNCTION "pecuaria"."congelar_configuracao_dia_leite"'));
    expect(congelar).toContain('"propriedadeId"=NEW."propriedadeId" FOR UPDATE');
    expect(congelar).toContain('UPDATE "pecuaria"."ConfiguracaoOrdenha" SET id=id WHERE id=NEW."configuracaoId"');
    expect(congelar).toContain('BEFORE INSERT ON "pecuaria"."DiaProducaoLeite"');
  });
});
