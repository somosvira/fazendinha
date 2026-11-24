import { describe, expect, it, vi } from 'vitest';
import { registrarPadrao, GRUPOS_PADRAO } from './catalogos.js';
import { Contexto, BANCO } from './contexto.js';

function contexto(ids: Record<string, string> = {}) {
  const c = new Contexto({ versao: 1, banco: BANCO, identidade: 'unitario', baseline: { nome: 'base', checksum: 'a'.repeat(64) }, fuso: 'America/Sao_Paulo', dataBase: '2026-10-24', ids, etapas: [], acoes: [], criadoEm: '2026-10-24T12:00:00.000Z' }, false);
  vi.spyOn(c, 'salvar').mockResolvedValue();
  return c;
}
describe('referências dos cadastros provisionados', () => {
  it('guarda o ID existente e não cria cadastro', async () => {
    const c = contexto();
    await registrarPadrao(c, 'centro:Recria', async () => ({ id: 'existente' }));
    expect(c.id('centro:Recria')).toBe('existente');
  });
  it('falha claramente quando um cadastro padrão está ausente', async () => {
    const c = contexto();
    await expect(registrarPadrao(c, 'categoria:Sanidade', async () => null)).rejects.toThrow('Cadastro padrão ausente: categoria:Sanidade');
    expect(c.manifesto.ids).toEqual({});
  });
  it('retoma pelo ID original e recusa sua substituição', async () => {
    const c = contexto({ 'grupo:Sanidade': 'original' });
    const buscar = vi.fn(async (id?: string) => id === 'original' ? { id } : null);
    await registrarPadrao(c, 'grupo:Sanidade', buscar);
    expect(buscar).toHaveBeenCalledWith('original');
    await expect(registrarPadrao(c, 'grupo:Sanidade', async () => null)).rejects.toThrow('foi removido ou divergiu');
    expect(c.id('grupo:Sanidade')).toBe('original');
  });
  it('mantém chaves de manifesto antigas para os nomes de grupos atuais', () => {
    expect(GRUPOS_PADRAO).toContainEqual(['Sanidade', 'Saúde do rebanho']);
    expect(GRUPOS_PADRAO).toContainEqual(['Nutrição', 'Alimentação do rebanho']);
    expect(GRUPOS_PADRAO).toContainEqual(['Reprodução', 'Manejo reprodutivo']);
  });
});
