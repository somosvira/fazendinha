import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const m = vi.hoisted(() => ({ requisicao: vi.fn() }));
vi.mock('../../src/db.js', () => ({ prisma: { requisicaoPecuaria: { findUnique: m.requisicao } } }));
import { Contexto, type Manifesto } from '../seedatev3/contexto.js';
import { executar } from './base.js';
import { ref } from './catalogo.js';
const pastas: string[] = [];
async function contexto(verificar = false) {
  const pasta = await mkdtemp(join(tmpdir(), 'seed-v5-test-')); pastas.push(pasta);
  const manifesto: Manifesto = { versao: 1, banco: 'fazendinha_seedatev3', identidade: 'teste', dataBase: '2026-10-24', ids: { 'sitio:Principal': '114', 'usuario:dono': '1' }, etapas: [], acoes: [], criadoEm: new Date().toISOString() };
  return { c: new Contexto(manifesto, verificar, undefined, pasta), pasta };
}
afterEach(async () => { vi.resetAllMocks(); await Promise.all(pastas.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
describe('retomada da seed V5', () => {
  it('executa uma vez e conserva o identificador do fato após reexecução', async () => {
    const { c, pasta } = await contexto(); m.requisicao.mockResolvedValue(null);
    const criar = vi.fn().mockResolvedValue({ id: 'fato-criado' });
    await executar(c, 'teste', criar); await executar(c, 'teste', criar);
    expect(criar).toHaveBeenCalledTimes(1);
    const salvo = JSON.parse(await readFile(join(pasta, 'manifesto.json'), 'utf8'));
    expect(salvo.ids[ref('teste')]).toBe('fato-criado');
    expect(salvo.ids['sitio:Principal']).toBe('114');
  });
  it('recupera a resposta transacional após perda do manifesto da ação sem repetir a saída', async () => {
    const { c } = await contexto();
    m.requisicao.mockResolvedValue({ propriedadeId: 114, usuarioId: 1, resultadoIds: { id: 'fato-confirmado' } });
    const criar = vi.fn(); await executar(c, 'retirada', criar);
    expect(criar).not.toHaveBeenCalled();
    expect(c.id(ref('retirada'))).toBe('fato-confirmado');
  });
  it('não adota requisição de outro sítio/autor', async () => {
    const { c } = await contexto();
    m.requisicao.mockResolvedValue({ propriedadeId: 115, usuarioId: 1, resultadoIds: { id: 'outro' } });
    const criar = vi.fn(); await expect(executar(c, 'teste', criar)).rejects.toThrow('outro contexto');
    expect(criar).not.toHaveBeenCalled(); expect(c.manifesto.acoes).toEqual([]);
  });
  it('não marca falha como concluída e proíbe escrita na verificação', async () => {
    const { c } = await contexto(); m.requisicao.mockResolvedValue(null);
    await expect(executar(c, 'falha', async () => { throw new Error('transação desfeita'); })).rejects.toThrow('transação desfeita');
    expect(c.manifesto.acoes).toEqual([]);
    const somenteLeitura = await contexto(true);
    await expect(executar(somenteLeitura.c, 'proibida', vi.fn())).rejects.toThrow('Verificação não pode');
  });
});
