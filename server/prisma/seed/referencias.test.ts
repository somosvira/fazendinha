import { describe, expect, it, vi } from 'vitest';
import { tabelaReferencia, verificarReferenciasPg } from './referencias.js';
describe('integridade do manifesto antes da retomada', () => {
  it('resolve tabelas distintas para aliases e dados aninhados', () => {
    expect(tabelaReferencia('usuario:dono')).toBe('usuario');
    expect(tabelaReferencia('partida:Arrendado:vacina')).toBe('partida');
    expect(tabelaReferencia('exame:tratamento:14')).toBe('exameFato');
    expect(tabelaReferencia('positivo:1')).toBe('avaliacao');
    expect(tabelaReferencia('visita:participante:encerrada:14')).toBe('participante');
    expect(tabelaReferencia('seedatev5-v1:formato:v2')).toBe('exame');
    expect(tabelaReferencia('seedatev5-v1:comercial:atual:retirada-id:0')).toBe('retirada');
    expect(tabelaReferencia('seedatev5-v1:comercial:atual:recebimento')).toBe('transacao');
    expect(tabelaReferencia('seedatev5-v1:comercial:atual:fechamento')).toBe('fechamentoLeite');
    expect(tabelaReferencia('seedatev5-v1:data:controle')).toBe(null);
    expect(() => tabelaReferencia('chave-nova:desconhecida')).toThrow('sem contrato');
  });
  it('mapeia cada fato das parcelas complementares para sua tabela real', () => {
    const casos = {
      'parto-historico-arrendado': 'parto', 'lactacao-historica-arrendado': 'lactacao',
      'configuracao-primeira-ordenha': 'configuracao', 'primeira-ordenha-historica': 'medicao',
      'direta-desconhecida': 'medicao', 'zero-explicito': 'medicao', 'parcela-regularizada': 'medicao',
      'parcela-corrigida': 'medicao', 'entrada-original': 'entrada', 'entrada-corrigida': 'entrada',
      'anular-entrada-original': 'movimentoEstoque', 'inclusao-posterior': 'medicao',
    };
    for (const [chave, tabela] of Object.entries(casos)) expect(tabelaReferencia(`seedatev5-v1:cobertura:${chave}`)).toBe(tabela);
    expect(() => tabelaReferencia('seedatev5-v1:cobertura:nao-contratada')).toThrow('sem contrato');
  });
  it('agrupa IDs por tabela e preserva aliases sem avaliar conteúdo alterado na UI', async () => {
    const query = vi.fn(async (_sql: string, _valores?: unknown[]) => ({ rows: [{ id: 'mesmo-id' }] }));
    await verificarReferenciasPg({ query }, { ids: { 'produto:racao': 'mesmo-id', 'produto:alias': 'mesmo-id' } });
    expect(query).toHaveBeenCalledOnce(); expect(query.mock.calls[0]).toEqual(['SELECT "id"::text AS id FROM public."Produto" WHERE "id"::text = ANY($1::text[])', [['mesmo-id']]]);
  });
  it('interrompe na remoção externa, inclusive em etapa concluída', async () => {
    const query = vi.fn(async (_sql: string, _valores?: unknown[]) => ({ rows: [] }));
    await expect(verificarReferenciasPg({ query }, { ids: { 'animal:1': 'removido' } })).rejects.toThrow('antes de qualquer escrita');
  });
  it('mantém IDs como parâmetro e nunca os interpola em identificadores SQL', async () => {
    const id = "'; DROP TABLE public.Produto;--", query = vi.fn(async (_sql: string, _valores?: unknown[]) => ({ rows: [{ id }] }));
    await verificarReferenciasPg({ query }, { ids: { 'produto:racao': id } });
    expect(query.mock.calls[0][0]).not.toContain(id); expect(query.mock.calls[0][1]).toEqual([[id]]);
  });
});
