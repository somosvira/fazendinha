import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
  let sequencia = 100;
  const animais = new Map<string, { id: string; brinco: string }>(), lotes = new Map<string, { id: string; nome: string }>();
  const id = () => `00000000-0000-4000-a000-${String(++sequencia).padStart(12, '0')}`;
  return { animais, lotes, id, cadastrar: vi.fn(async (dados: { brinco: string }) => { const animal = { id: id(), ...dados }; animais.set(animal.id, animal); return animal; }),
    criarLote: vi.fn(async (dados: { nome: string }) => { const lote = { id: id(), ...dados }; lotes.set(lote.id, lote); return lote; }),
    movimentar: vi.fn(async (_dados: unknown) => ({ id: id() })), categoria: vi.fn(async () => ({ id: id() })), pesagens: vi.fn(async () => ({ id: id() })),
  };
});
vi.mock('../../src/db.js', () => ({ prisma: {
  animal: { findFirst: vi.fn(async ({ where }: { where: { id?: string; brinco?: string } }) => where.id ? mock.animais.get(where.id) ?? null : [...mock.animais.values()].find(a => a.brinco === where.brinco) ?? null) },
  lote: { findFirst: vi.fn(async ({ where }: { where: { id?: string; nome?: string } }) => where.id ? mock.lotes.get(where.id) ?? null : [...mock.lotes.values()].find(a => a.nome === where.nome) ?? null) },
  categoriaAnimal: { findUniqueOrThrow: vi.fn(async () => ({ id: mock.id() })) }, categoriaManualAnimal: { findFirst: vi.fn(async () => null) },
  localizacaoAnimal: { findFirst: vi.fn(async () => null) }, requisicaoPecuaria: { findUnique: vi.fn(async () => null) },
} }));
vi.mock('../../src/services/pecuaria/rebanho/animais.js', () => ({ cadastrar: mock.cadastrar, movimentar: mock.movimentar, definirCategoriaManual: mock.categoria }));
vi.mock('../../src/services/pecuaria/rebanho/lotes.js', () => ({ criarLote: mock.criarLote }));
vi.mock('../../src/services/pecuaria/manejo/manejo.js', () => ({ registrarPesagensColetivas: mock.pesagens }));

import { ContextoSeed, type Manifesto } from './contexto.js';
import { rebanho } from './rebanho.js';
function contexto() {
  const manifesto: Manifesto = { versao: 1, banco: 'fazendinha_seedatev3', identidade: 'teste-unitario', baseline: { nome: 'base', checksum: 'a'.repeat(64) }, fuso: 'America/Sao_Paulo', dataBase: '2026-10-24', ids: {
    'usuario:dono': '1', 'sitio:Principal': '1', 'sitio:Arrendado': '2', 'sitio:Test': '3', 'raca:HO': mock.id(), 'raca:NE': mock.id(), 'centro:Pecuária': mock.id(),
  }, etapas: [], acoes: [], criadoEm: '2026-10-24T12:00:00Z' };
  const c = new ContextoSeed(manifesto, false); vi.spyOn(c, 'salvar').mockResolvedValue(); return c;
}
beforeEach(() => { vi.clearAllMocks(); mock.animais.clear(); mock.lotes.clear(); });
describe('orquestração de rebanho sem banco', () => {
  it('usa serviços e deixa oito crias para o parto; retoma sem duplicar fatos', async () => {
    const c = contexto(); await rebanho(c);
    expect(mock.cadastrar).toHaveBeenCalledTimes(124);
    expect([...mock.animais.values()].some(a => ['DEV-065', 'DEV-072'].includes(a.brinco))).toBe(false);
    expect(mock.movimentar).toHaveBeenCalledTimes(2);
    expect(mock.pesagens).toHaveBeenCalledTimes(6);
    expect(mock.categoria).toHaveBeenCalledTimes(1);
    expect(mock.cadastrar.mock.calls.find(([a]) => a.brinco === 'DEV-035')?.[0]).toMatchObject({ propriedadeId: 2 });
    expect(mock.movimentar.mock.calls[0][0]).toMatchObject({ propriedadeId: 1, data: '2025-01-02' });
    await rebanho(c);
    expect(mock.cadastrar).toHaveBeenCalledTimes(124);
    expect(mock.movimentar).toHaveBeenCalledTimes(2);
    expect(mock.pesagens).toHaveBeenCalledTimes(6);
  });
  it('recusa recriar animal removido após carga', async () => {
    const c = contexto(); await rebanho(c); mock.animais.delete(c.id('animal:1'));
    await expect(rebanho(c)).rejects.toThrow('removido ou divergiu');
    expect(mock.cadastrar).toHaveBeenCalledTimes(124);
  });
});
