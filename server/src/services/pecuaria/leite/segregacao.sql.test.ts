import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../../../prisma/migrations/20261020050000_segregacao_origens_leite/migration.sql", import.meta.url), "utf8");
describe("segregação física por medição inteira no SQL", () => {
  it("libera vários grupos por sessão e impede dupla confirmação da medição entre quaisquer produtos", () => {
    expect(sql).toContain('DROP INDEX pecuaria."EntradaLeite_sessao_confirmada"');
    expect(sql).toContain('ON pecuaria."VinculoMedicaoEntradaLeite"("medicaoId") WHERE ativo');
    expect(sql).toContain('CHECK (quantidade > 0 AND "versaoMedicao" > 0)');
    expect(sql).toContain('FOR NO KEY UPDATE');
  });
  it("exige soma exata, mesma sessão, medição positiva, versão e identidade do snapshot", () => {
    for (const prova of ['quantidade_total IS DISTINCT FROM e.quantidade', 'md."sessaoId"<>e."sessaoId"', 'md.litros IS DISTINCT FROM v.quantidade', 'md.versao<>v."versaoMedicao"', `j->>'animalId'=p."animalId"`, 'v.ativo<>(e.status=\'CONFIRMADA\')'])
      expect(sql).toContain(prova);
    expect(sql).toContain('PERFORM pecuaria.conferir_medicoes_entrada_leite(entrada.id)');
    expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(sql).toContain('CROSS JOIN LATERAL jsonb_array_elements(e.snapshot->\'medicoes\')');
  });
  it("serializa alteração manual da medição com confirmação antes de consultar entradas", () => {
    const guard = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION pecuaria.proteger_medicao_leite_confirmada'));
    expect(guard).toContain('ARRAY[OLD."sessaoId",NEW."sessaoId"]');
    expect(guard).toContain('ORDER BY id FOR NO KEY UPDATE');
    expect(guard.indexOf('ORDER BY id FOR NO KEY UPDATE')).toBeLessThan(guard.indexOf('IF EXISTS'));
  });
  it("preserva vínculos e permite apenas liberar após anulação, conservando consumidores e inversos", () => {
    expect(sql).toContain("IF TG_OP='DELETE' THEN RAISE EXCEPTION");
    expect(sql).toContain("(to_jsonb(NEW)-'ativo') IS DISTINCT FROM (to_jsonb(OLD)-'ativo')");
    expect(sql).toContain("NOT OLD.ativo OR NEW.ativo OR e.status<>'ANULADA'");
    expect(sql).toContain('BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."VinculoMedicaoEntradaLeite"');
    expect(sql).toContain('BEFORE UPDATE ON pecuaria."MedicaoLeite"');
    expect(sql).toContain("(entrada.status='ANULADA' AND q<>0)");
    expect(sql).toContain('origem."valorTotal" IS DISTINCT FROM m."valorTotal"');
    expect(sql).toContain('PERFORM pecuaria.conferir_valor_entrada_leite(entrada.id)');
  });
});
