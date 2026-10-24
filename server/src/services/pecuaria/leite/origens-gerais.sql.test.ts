import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../../../../prisma/migrations/20261023140000_historico_origens_gerais_leite/migration.sql", import.meta.url), "utf8");

describe("contrato estrutural SQL das origens gerais (sem executar PostgreSQL)", () => {
  it("indexa a identidade explícita sem criar medições, preencher lacunas ou alterar dados", () => {
    expect(sql).toContain('USING GIN ("animaisOrigem" jsonb_path_ops)');
    expect(sql).toContain('g."animaisOrigem" @> jsonb_build_array(animal_id)');
    expect(sql).not.toMatch(/INSERT INTO|UPDATE pecuaria|DELETE FROM/i);
  });
  it("serializa origem, confirmação e histórico pelo mesmo advisory lock antes da sessão", () => {
    expect(sql).toContain("hashtext('pec-animal:'||id)");
    expect(sql).toContain('chaves ORDER BY h');
    expect(sql).toContain('"MedicaoGeralLeite_00_travar_origens" BEFORE INSERT OR UPDATE');
    expect(sql).toContain('"EntradaProducaoLeite_00_travar_origens" BEFORE INSERT OR UPDATE');
    const entrada = sql.slice(sql.indexOf('CREATE FUNCTION pecuaria.travar_entrada_origem_geral'), sql.indexOf('CREATE FUNCTION pecuaria.conferir_historico_origem_geral'));
    expect(entrada.indexOf('travar_animais_origem_geral(ids)')).toBeLessThan(entrada.indexOf('FOR NO KEY UPDATE'));
    expect(sql).toContain('OLD."animaisOrigem"');
  });
  it("confere estado final da finalidade, baixa, sítio, cadastro e lactação", () => {
    for (const entidade of ['FinalidadeAnimal', 'BaixaAnimal', 'LocalizacaoAnimal', 'Animal', 'LactacaoAnimal']) {
      expect(sql).toContain(`CREATE CONSTRAINT TRIGGER "${entidade}_proteger_origem_geral"`);
      expect(sql).toContain(`CREATE TRIGGER "${entidade}_travar_origem_geral" BEFORE`);
    }
    expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(sql).toContain('pecuaria."finalidades_producao_na_data"(animal_id,fato.dia)');
    expect(sql).toContain('b."localizacaoFechadaId"=l.id');
    expect(sql).toContain('LEAST(COALESCE(OLD.ate');
    expect(sql).toContain('d."dataOperacional"<fim');
  });
  it("preserva snapshots anulados e valida identidades somente das entradas confirmadas", () => {
    expect(sql).toContain("e.status='CONFIRMADA'");
    expect(sql).toContain("entrada.status<>'CONFIRMADA' THEN RETURN NEW");
    expect(sql).toContain("evidencia->>'finalidadeId' IS DISTINCT FROM finalidade_id");
    expect(sql).toContain("evidencia->>'localizacaoId' IS DISTINCT FROM local_id");
    expect(sql).toContain("Snapshot deve preservar exatamente os animais da aferição geral");
    expect(sql).toContain('SELECT * INTO entrada FROM pecuaria."EntradaProducaoLeite" WHERE id=NEW.id');
  });
});
