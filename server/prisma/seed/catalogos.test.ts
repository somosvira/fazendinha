import { describe, expect, it, vi } from 'vitest';
import { registrarPadrao, registrarDoencaPadrao, GRUPOS_PADRAO } from './catalogos.js';

const db = vi.hoisted(() => ({ findUnique: vi.fn(), queryRaw: vi.fn() }));
vi.mock('../../src/db.js', () => ({ prisma: { doenca: { findUnique: db.findUnique }, $queryRaw: db.queryRaw } }));
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

describe('doenças padrão da seed', () => {
  it('reutiliza equivalente ativo sem criar registro', async () => {
    db.queryRaw.mockResolvedValueOnce([{ id: 'equivalente', ativo: true }]);
    const c = contexto();
    await registrarDoencaPadrao(c, 'Mastite');
    expect(c.id('doenca:Mastite')).toBe('equivalente');
  });
  it('recusa equivalente inativo sem guardar referência', async () => {
    db.queryRaw.mockResolvedValueOnce([{ id: 'inativo', ativo: false }]);
    const c = contexto();
    await expect(registrarDoencaPadrao(c, 'Metrite')).rejects.toThrow('exige referência ativa');
    expect(c.manifesto.ids).toEqual({});
  });
  it('respeita o ID do manifesto e recusa sua inativação', async () => {
    db.findUnique.mockResolvedValueOnce({ id: 'original', ativo: false });
    const c = contexto({ 'doenca:Pneumonia': 'original' });
    await expect(registrarDoencaPadrao(c, 'Pneumonia')).rejects.toThrow('exige referência ativa');
    expect(db.findUnique).toHaveBeenCalledWith({ where: { id: 'original' }, select: { id: true, ativo: true } });
    expect(c.id('doenca:Pneumonia')).toBe('original');
  });
  it('sinaliza ausência sem cadastrar', async () => {
    db.queryRaw.mockResolvedValueOnce([]);
    await expect(registrarDoencaPadrao(contexto(), 'Mastite')).rejects.toThrow('Cadastro padrão ausente: doenca:Mastite');
  });
});
