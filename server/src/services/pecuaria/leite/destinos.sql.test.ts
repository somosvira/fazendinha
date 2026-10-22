import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../../../../prisma/migrations/20261020010000_destinos_internos_leite/migration.sql", import.meta.url), "utf8");
const guarda = sql.slice(sql.indexOf('CREATE FUNCTION "pecuaria"."proteger_fatos_destino_leite"'));
describe("contrato SQL de imutabilidade dos destinos internos", () => {
  it("protege ambas as tabelas antes de update/delete, inclusive leite comum sem vínculo clínico", () => {
    for (const tabela of ["DestinoInternoLeite", "ParcelaDestinoLeite"])
      expect(guarda).toContain(`BEFORE INSERT OR UPDATE OR DELETE ON "pecuaria"."${tabela}"`);
    expect(guarda).toContain("IF TG_OP = 'DELETE' THEN");
    expect(guarda).toContain("Histórico de destino interno de leite não pode ser apagado");
    // A proteção usa comparação de todos os campos, sem depender da natureza COLOSTRO.
    expect(guarda).toContain("(to_jsonb(NEW) - 'ativo') IS DISTINCT FROM (to_jsonb(OLD) - 'ativo')");
    expect(guarda).not.toContain("natureza = 'COLOSTRO'");
  });
  it("só exclui da imutabilidade os campos necessários à transição terminal de estorno", () => {
    const lista = "ARRAY['status', 'versao', 'estornadoEm', 'estornadoPorId', 'motivoEstorno', 'movimentoEstornoId']";
    expect(guarda).toContain(`to_jsonb(NEW) - ${lista}`);
    expect(guarda).toContain(`to_jsonb(OLD) - ${lista}`);
    expect(guarda).toContain("OLD.status <> 'CONFIRMADO' OR NEW.status <> 'ESTORNADO'");
    expect(guarda).toContain("NEW.versao <> OLD.versao + 1");
    expect(guarda).toContain('NEW."movimentoEstornoId" IS NULL');
    expect(guarda).toContain('length(btrim(NEW."motivoEstorno")) < 5');
    expect(guarda).toContain("IF NOT OLD.ativo OR NEW.ativo THEN");
  });
  it("exige estado inicial e conserva a conferência diferida do estorno e das parcelas", () => {
    expect(guarda).toContain("NEW.status <> 'CONFIRMADO' OR NEW.versao <> 1");
    expect(guarda).toContain("ELSIF NOT NEW.ativo THEN");
    expect(sql).toContain('inverso."reversaoDeId"=d."movimentoId"');
    expect(sql).toContain("p.ativo <> (d.status='CONFIRMADO')");
    expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "pecuaria"."conferir_destino_interno_leite"()');
  });
});
