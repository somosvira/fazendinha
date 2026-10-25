import { describe, expect, it } from 'vitest';
import { argumentos, conferirMigrations } from './seguranca.js';
import { calendario, ETAPAS, key } from './catalogo.js';
import { validarDestino } from '../seedatev3/contexto.js';
import { configuracaoOrdenhaSchema } from '../../src/services/pecuaria/leite/schemas.js';

describe('seed V5 aditiva', () => {
  it('recusa destinos remotos, outro banco e produção', () => {
    for (const [url, ambiente] of [
      ['postgresql://u:p@prod.example/fazendinha_seedatev3', 'development'],
      ['postgresql://u:p@localhost/temporario', 'development'],
      ['postgresql://u:p@localhost/fazendinha_seedatev3', 'production'],
    ]) expect(() => validarDestino(url, ambiente)).toThrow();
    expect(validarDestino('postgresql://u:p@localhost/fazendinha_seedatev3', 'development').pathname).toBe('/fazendinha_seedatev3');
  });
  it('não confunde ausência de migration com histórico sem falha', () => {
    const arquivos = [{ nome: 'a', hash: '1' }, { nome: 'b', hash: '2' }];
    const a = { migration_name: 'a', checksum: '1', finished_at: new Date(), rolled_back_at: null };
    expect(conferirMigrations(arquivos, [a])).toEqual(['b']);
    expect(conferirMigrations(arquivos, [a, { ...a, migration_name: 'b', checksum: 'outro' }])).toEqual(['b']);
    expect(conferirMigrations(arquivos, [a, { ...a, migration_name: 'b', checksum: '2' }])).toEqual([]);
    expect(conferirMigrations(arquivos, [a, { ...a, migration_name: 'b', finished_at: null }])).toContain('MIGRATION_INTERROMPIDA');
    expect(conferirMigrations([arquivos[0]], [{ ...a, rolled_back_at: new Date() }])).toEqual(['a']);
  });
  it('separa preflight/verificação de escrita e mantém base explícita', () => {
    expect(argumentos(['--preflight', '--base=/tmp/original/manifesto.json'])).toMatchObject({ modo: 'preflight', base: '/tmp/original/manifesto.json', pasta: '/tmp/original/v5' });
    expect(argumentos(['--verificar']).modo).toBe('verificar');
    expect(argumentos(['--interromper-apos=destinos']).interromper).toBe('destinos');
    expect(() => argumentos(['--reset'])).toThrow();
    expect(() => argumentos(['--verificar', '--preflight'])).toThrow();
  });
  it.each(['2026-01-01', '2026-02-28', '2028-02-29', '2026-10-24'])('não cria produção futura ou datas inválidas para %s', base => {
    const c = calendario(base);
    for (const d of [c.individual, c.inicio, c.anterior, c.controle, ...c.atual]) {
      expect(new Date(d).toISOString().slice(0, 10)).toBe(d);
      expect(d <= base).toBe(true);
    }
    expect(c.individual < c.confirmacaoIndividual && c.confirmacaoIndividual < c.inicio && c.anterior < c.inicioAtual).toBe(true);
    expect(c.confirmacaoIndividual.slice(0, 7)).toBe(c.anterior.slice(0, 7));
    expect(new Set(c.atual).size).toBe(c.atual.length);
  });
  it('gera saídas anteriores antes das entradas atuais, respeitando cronologia de estoque', () => {
    expect(ETAPAS.indexOf('comercial-anterior')).toBeLessThan(ETAPAS.indexOf('geral-atual'));
    expect(ETAPAS.indexOf('nutricao')).toBeLessThan(ETAPAS.indexOf('comercial-atual'));
    expect(ETAPAS.indexOf('comercial-atual')).toBeLessThan(ETAPAS.indexOf('regularizacoes'));
  });
  it('usa identidades estáveis e configuração mensal independente', () => {
    expect(key('teste')).toBe(key('teste'));
    expect(key('teste')).not.toBe(key('outro'));
    const c = configuracaoOrdenhaSchema.parse({ chave: key('rotina'), propriedadeId: 1, vigenteDesde: '2026-10-01', fonteProducao: 'GERAL',
      ordenhas: ['Manhã', 'Tarde', 'Noite'].map((nome, i) => ({ nome, ordem: i + 1, posicaoId: key(`posicao:${i}`) })) });
    expect(c.intervaloIndividualUnidade).toBe('MESES');
    expect(c.intervaloIndividualQuantidade).toBe(1);
  });
});
