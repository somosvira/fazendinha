import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baselineSql, contemSql, funcaoSql } from '../../../test/sql-baseline.js';
const schema = readFileSync(new URL('../../../../prisma/schema.prisma', import.meta.url), 'utf8');
describe('contrato SQL da regularização de retirada', () => {
  it('impõe exclusividade ativa de medição e entrada e preserva histórico', () => {
    for (const campo of ['medicaoGeralId', 'entradaId']) {
      expect(contemSql(baselineSql, `CREATE UNIQUE INDEX "LoteColostro_${campo}_ativo_key"`)).toBe(true);
      expect(contemSql(baselineSql, `("${campo}") WHERE ((status <> 'ESTORNADO'::text) AND ("${campo}" IS NOT NULL))`)).toBe(true);
      expect(baselineSql).not.toContain(`CREATE UNIQUE INDEX "LoteColostro_${campo}_key"`);
    }
    const lote = schema.split('model LoteColostro {')[1].split('model OrigemColostro {')[0];
    expect(lote).not.toMatch(/(?:medicaoGeralId|entradaId) String\? @unique/);
    for (const modelo of ['MedicaoGeralLeite', 'EntradaProducaoLeite']) expect(schema.split(`model ${modelo} {`)[1].split('\nmodel ')[0]).toContain('lotesColostro LoteColostro[]');
  });
  it('estorna snapshot obsoleto com motivo, versão e identidade imutável', () => {
    const sql = funcaoSql('conferir_contexto_retirada_colostro');
    expect(sql).toContain("IF OLD.status NOT IN ('RASCUNHO','CONFIRMADO') OR NEW.versao<>OLD.versao+1");
    expect(sql).toContain("IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno'])");
    expect(sql).toContain('Regularize a origem e seus consumidores');
    expect(sql.indexOf('RETURN NULL;')).toBeLessThan(sql.indexOf('SELECT * INTO p FROM pecuaria."PartoAnimal"'));
    expect(sql).toContain('g.litros=NEW."quantidadeLitros"');
    expect(sql).toContain("e.status='CONFIRMADA'");
    expect(contemSql(baselineSql, 'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_contexto_retirada_colostro()')).toBe(true);
  });
});
