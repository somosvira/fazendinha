import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../../../prisma/migrations/20261028000000_bezerreiro_colostro/migration.sql', import.meta.url), 'utf8');

describe('migration aditiva do Bezerreiro', () => {
  it('preserva históricos e não inventa participação ou origem para dados anteriores', () => {
    expect(sql).not.toMatch(/\b(?:DROP TABLE|TRUNCATE|DELETE FROM|INSERT INTO)\b/i);
    expect(sql).toContain('Fato histórico deve ser estornado, nunca excluído');
    expect(sql).toContain('Unidade retirada não pode ser recongelada');
  });
  it('garante intervalos concorrentes, escopo e programação publicada completa', () => {
    expect(sql).toContain('EXCLUDE USING gist ("animalId" WITH =, daterange("desde","ate",\'[)\') WITH &&)');
    expect(sql).toContain('EXCLUDE USING gist ("participacaoId" WITH =, daterange("desde","ate",\'[)\') WITH &&)');
    expect(sql).toContain('Participação exige localização comprovada no lote/sítio durante todo o intervalo');
    expect(sql).toContain('Programação publicada deve fechar 100 por cento');
    expect(sql).toContain('f."litrosDia"=0 AND NOT EXISTS(SELECT 1 FROM pecuaria."OfertaProgramadaBezerreiro"');
    expect(sql).toContain('FaseBezerreiroVersao_snapshot_coleira');
  });
  it('liga a oferta ao item real e conserva a atribuição sem dias fictícios', () => {
    expect(sql).toContain('ItemFechamentoConsumo_origem_xor');
    expect(sql).toContain('"criterioAtribuicao"=\'ATRIBUIDA_POR_OFERTA\' AND "dias" IS NULL');
    expect(sql).toContain('Fornecimento deve corresponder à oferta e grupo conferidos');
    expect(sql).toContain('Origens e destinatários devem conservar os litros do fornecimento');
    expect(sql).toContain('sem segunda baixa genérica');
  });
  it('conserva saldo bruto/preparado, embalagens e destinos em estado final atômico', () => {
    expect(sql).toContain('OrigemColostro_origem_xor');
    expect(sql).toContain('"volumeLitros"=2');
    expect(sql).toContain('pg_advisory_xact_lock(hashtextextended(\'colostro:\'||ident,0))');
    expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(sql).toContain('Saldo físico não comporta consumo e unidades reservadas de colostro');
    expect(sql).toContain('Destinação deve ser confirmada/estornada integralmente');
    expect(sql).toContain('Ciclo de preparo de colostro');
  });
  it('mantém separados o exame da cria e o Brix do alimento', () => {
    expect(sql).toContain('sujeito=\'COLOSTRO\' AND "origemColostroId" IS NOT NULL');
    expect(sql).toContain('Exame deve pertencer à cria acompanhada e ao sítio do acompanhamento');
    expect(sql).toContain('Identidade e formato da amostra são históricos');
  });
});
