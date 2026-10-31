import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const sql=readFileSync(new URL('../../../../prisma/migrations/20261028210000_regularizacao_retirada_colostro/migration.sql',import.meta.url),'utf8');
const schema=readFileSync(new URL('../../../../prisma/schema.prisma',import.meta.url),'utf8');
describe('contrato SQL da regularização de retirada',()=>{
 it('substitui exclusividade global pela exclusividade ativa de medição e entrada sem apagar histórico',()=>{
  for(const campo of ['medicaoGeralId','entradaId']){
   expect(sql).toContain(`CREATE UNIQUE INDEX "LoteColostro_${campo}_ativo_key"`);
   expect(sql).toContain(`("${campo}") WHERE status<>'ESTORNADO' AND "${campo}" IS NOT NULL`);
   expect(sql).toContain(`DROP INDEX pecuaria."LoteColostro_${campo}_key"`);
   expect(sql.indexOf(`CREATE UNIQUE INDEX "LoteColostro_${campo}_ativo_key"`)).toBeLessThan(sql.indexOf(`DROP INDEX pecuaria."LoteColostro_${campo}_key"`));
  }
  expect(sql).not.toMatch(/\b(?:UPDATE|DELETE FROM|INSERT INTO|TRUNCATE|DROP TABLE)\b(?!'| ON)/);
  const lote=schema.split('model LoteColostro {')[1].split('model OrigemColostro {')[0];
  expect(lote).not.toMatch(/(?:medicaoGeralId|entradaId) String\? @unique/);
  for(const modelo of ['MedicaoGeralLeite','EntradaProducaoLeite'])expect(schema.split(`model ${modelo} {`)[1].split('\nmodel ')[0]).toContain('lotesColostro LoteColostro[]');
 });
 it('estorna snapshot obsoleto apenas com motivo, versão e identidade imutável, sem liberar origem ativa',()=>{
  expect(sql).toContain("IF OLD.status NOT IN ('RASCUNHO','CONFIRMADO') OR NEW.versao<>OLD.versao+1");
  expect(sql).toContain("IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno'])");
  expect(sql).toContain('Regularize a origem e seus consumidores');
  const retornoEstorno=sql.indexOf('RETURN NULL;');
  expect(retornoEstorno).toBeLessThan(sql.indexOf('SELECT * INTO p FROM pecuaria."PartoAnimal"'));
  expect(sql).toContain("g.litros=NEW.\"quantidadeLitros\"");
  expect(sql).toContain("e.status='CONFIRMADA'");
 });
 it('substitui somente o trigger de contexto de LoteColostro e conserva as demais proteções',()=>{
  expect(sql).toContain('DROP TRIGGER "LoteColostro_contexto" ON pecuaria."LoteColostro"');
  expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_contexto_retirada_colostro()');
  expect(sql).not.toContain('DROP FUNCTION');expect(sql).not.toContain('DISABLE TRIGGER');
 });
});
