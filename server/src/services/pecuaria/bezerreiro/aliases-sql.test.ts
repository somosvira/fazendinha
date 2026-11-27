import { describe, expect, it } from 'vitest';
import { funcaoSql } from '../../../test/sql-baseline.js';
const nomes = ['conferir_participacao_bezerreiro', 'conferir_oferta_bezerreiro', 'conferir_contexto_colostro', 'conferir_acompanhamento_colostragem', 'observar_fisico_colostro'];
describe('funções atuais dos triggers do Bezerreiro', () => {
  it.each(nomes)('%s não usa nome de record como alias SQL', nome => {
    const sql = funcaoSql(nome);
    const declaracao = /DECLARE([\s\S]*?)BEGIN/.exec(sql)?.[1] ?? '';
    const registros = [...declaracao.matchAll(/(\w+)\s+record\b/gi)].map(r => r[1]);
    const aliases = [...sql.matchAll(/(?:FROM|JOIN)\s+(?:pecuaria|public)\."[^"]+"\s+(\w+)\b/g)].map(r => r[1]);
    expect(registros.filter(r => aliases.includes(r))).toEqual([]);
  });
  it('movimento comum percorre as três buscas sem record não atribuído', () => {
    const sql = funcaoSql('observar_fisico_colostro');
    expect(sql).toContain('DECLARE v_origem_id text;');
    expect(sql.match(/FOR v_origem_id IN SELECT/g)).toHaveLength(3);
    expect(sql.match(/conferir_saldo_colostro\(v_origem_id\)/g)).toHaveLength(3);
    expect(sql).not.toMatch(/\bo\./);
  });
});
