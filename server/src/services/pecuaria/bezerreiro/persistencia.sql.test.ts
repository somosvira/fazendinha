import { baselineSql as sql, contemSql } from '../../../test/sql-baseline.js';
import { describe, expect, it } from 'vitest';


describe('garantias finais do Bezerreiro na baseline', () => {
  it('protege fatos históricos de exclusão e recongelamento', () => {
    expect(contemSql(sql, 'Fato histórico deve ser estornado, nunca excluído')).toBe(true);
    expect(contemSql(sql, 'Unidade retirada não pode ser recongelada')).toBe(true);
  });
  it('garante intervalos concorrentes, escopo e programação publicada completa', () => {
    expect(contemSql(sql, 'EXCLUDE USING gist ("animalId" WITH =, daterange(desde,ate,\'[)\'::text) WITH &&)')).toBe(true);
    expect(contemSql(sql, 'EXCLUDE USING gist ("participacaoId" WITH =, daterange(desde,ate,\'[)\'::text) WITH &&)')).toBe(true);
    expect(contemSql(sql, 'Participação exige localização comprovada no lote/sítio durante todo o intervalo')).toBe(true);
    expect(contemSql(sql, 'Programação publicada deve fechar 100 por cento')).toBe(true);
    expect(contemSql(sql, 'f."litrosDia"=0 AND NOT EXISTS(SELECT 1 FROM pecuaria."OfertaProgramadaBezerreiro"')).toBe(true);
    expect(contemSql(sql, 'FaseBezerreiroVersao_snapshot_coleira')).toBe(true);
  });
  it('liga a oferta ao item real e conserva a atribuição sem dias fictícios', () => {
    expect(contemSql(sql, 'ItemFechamentoConsumo_origem_xor')).toBe(true);
    expect(contemSql(sql, '("criterioAtribuicao" = \'ATRIBUIDA_POR_OFERTA\'::text) AND (dias IS NULL)')).toBe(true);
    expect(contemSql(sql, 'Fornecimento deve corresponder à oferta e grupo conferidos')).toBe(true);
    expect(contemSql(sql, 'Origens e destinatários devem conservar os litros do fornecimento')).toBe(true);
    expect(contemSql(sql, 'sem segunda baixa genérica')).toBe(true);
  });
  it('conserva saldo bruto/preparado, embalagens e destinos em estado final atômico', () => {
    expect(contemSql(sql, 'OrigemColostro_origem_xor')).toBe(true);
    expect(contemSql(sql, '"volumeLitros" = (2)::numeric')).toBe(true);
    expect(contemSql(sql, 'pg_advisory_xact_lock(hashtextextended(\'colostro:\'||ident,0))')).toBe(true);
    expect(contemSql(sql, 'DEFERRABLE INITIALLY DEFERRED')).toBe(true);
    expect(contemSql(sql, 'Saldo físico não comporta consumo e unidades reservadas de colostro')).toBe(true);
    expect(contemSql(sql, 'Destinação deve ser confirmada/estornada integralmente')).toBe(true);
    expect(contemSql(sql, 'Ciclo de preparo de colostro')).toBe(true);
  });
  it('mantém separados o exame da cria e o Brix do alimento', () => {
    expect(contemSql(sql, '(sujeito = \'COLOSTRO\'::text) AND ("origemColostroId" IS NOT NULL)')).toBe(true);
    expect(contemSql(sql, 'Exame deve pertencer à cria acompanhada e ao sítio do acompanhamento')).toBe(true);
    expect(contemSql(sql, 'Identidade e formato da amostra são históricos')).toBe(true);
  });
});
