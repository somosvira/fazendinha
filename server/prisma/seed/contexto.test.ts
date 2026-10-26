import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argumentos, BANCO, ContextoSeed, chave, deslocar, hojeBrasil, noMes, validarDestino, type Manifesto } from './contexto.js';
let pasta: string;
const manifesto = (): Manifesto => ({ versao: 1, banco: BANCO, identidade: 'teste', baseline: { nome: 'baseline', checksum: 'a'.repeat(64) }, fuso: 'America/Sao_Paulo', dataBase: '2026-10-24', ids: {}, etapas: [], acoes: [], criadoEm: '2026-10-24T12:00:00.000Z' });
beforeEach(async () => { pasta = await mkdtemp(join(tmpdir(), 'seed-unificada-unit-')); });
afterEach(async () => { await rm(pasta, { recursive: true, force: true }); });
describe('destino e modos da seed única', () => {
  it.each(['postgresql://u:p@remote/fazendinha_seedatev3', 'postgresql://u:p@localhost/postgres', 'https://localhost/fazendinha_seedatev3', 'postgresql://u:p@localhost/fazendinha_seedatev3?host=remote', 'postgresql://u:p@localhost/fazendinha_seedatev3?options=-hremote'])('rejeita destino ou redirecionamento %s', url => expect(() => validarDestino(url, 'test')).toThrow('apenas'));
  it('recusa produção mesmo no PostgreSQL autorizado', () => expect(() => validarDestino(`postgresql://localhost/${BANCO}`, 'production')).toThrow());
  it('aceita somente modos conhecidos e evita escrita em modo de leitura', () => {
    expect(argumentos(['--preflight']).modo).toBe('preflight');
    expect(argumentos(['--verificar']).modo).toBe('verificar');
    expect(argumentos(['--interromper-apos=estoque']).interromperApos).toBe('estoque');
    expect(() => argumentos(['--verificar', '--arquivos-r2'])).toThrow();
    expect(() => argumentos(['--preflight', '--interromper-apos=estoque'])).toThrow();
    expect(() => argumentos(['--reset'])).toThrow();
  });
  it('congela data civil brasileira e chaves separadas dos executores antigos', () => {
    expect(hojeBrasil(new Date('2026-10-24T01:30:00Z'))).toBe('2026-10-23');
    expect(noMes('2026-01-01', -1, 1)).toBe('2025-12-01');
    expect(deslocar('2024-03-01', -1)).toBe('2024-02-29');
    expect(chave('compra')).toBe(chave('compra')); expect(chave('compra')).not.toBe(chave('venda'));
  });
});
describe('retomada e preservação dos fatos', () => {
  it('recupera registro já confirmado antes do manifesto sem repetir criação', async () => {
    const c = new ContextoSeed(manifesto(), false, undefined, pasta), criar = vi.fn();
    await c.registro('operacao', async () => ({ id: 'confirmada' }), criar);
    expect(criar).not.toHaveBeenCalled(); expect(c.id('operacao')).toBe('confirmada');
  });
  it('retoma somente a etapa faltante e preserva data-base', async () => {
    const c = new ContextoSeed(manifesto(), false, 'catalogos', pasta), executar = vi.fn(async () => {});
    await expect(c.etapa('catalogos', executar)).rejects.toThrow('Interrupção');
    const retomado = new ContextoSeed(JSON.parse(await readFile(join(pasta, 'manifesto.json'), 'utf8')), false, undefined, pasta);
    await retomado.etapa('catalogos', executar); expect(executar).toHaveBeenCalledTimes(1);
    expect(retomado.dataBase).toBe('2026-10-24');
  });
  it('reconcilia ação confirmada durante interrupção e não a repete', async () => {
    const c = new ContextoSeed(manifesto(), false, undefined, pasta), executar = vi.fn();
    await c.acao('compra', async () => true, executar); await c.acao('compra', async () => false, executar);
    expect(executar).not.toHaveBeenCalled(); expect(c.manifesto.acoes).toEqual(['compra']);
  });
  it('recusa remoção, troca de ID ou alias divergente, sem recriar', async () => {
    const m = manifesto(); m.ids.animal = 'original'; const c = new ContextoSeed(m, false, undefined, pasta), criar = vi.fn();
    await expect(c.registro('animal', async () => null, criar)).rejects.toThrow('removido');
    await expect(c.registro('animal', async () => ({ id: 'outro' }), criar)).rejects.toThrow('divergiu');
    await expect(c.guardar('animal', 'outro')).rejects.toThrow('divergente'); expect(criar).not.toHaveBeenCalled();
  });
  it('modo leitura não executa callbacks nem cria manifesto', async () => {
    const c = new ContextoSeed(manifesto(), true, undefined, pasta), executar = vi.fn(async () => {}), buscar = vi.fn(async () => null), criar = vi.fn(async () => ({ id: 'novo' }));
    await expect(c.salvar()).rejects.toThrow('não pode escrever');
    await expect(c.guardar('animal', 'id')).rejects.toThrow('não pode preparar');
    await expect(c.registro('animal', buscar, criar)).rejects.toThrow('não pode preparar');
    await expect(c.acao('acao', async () => false, executar)).rejects.toThrow('não pode executar');
    await expect(c.etapa('etapa', executar)).rejects.toThrow('não pode executar');
    expect(buscar).not.toHaveBeenCalled(); expect(criar).not.toHaveBeenCalled(); expect(executar).not.toHaveBeenCalled(); expect(await readdir(pasta)).toEqual([]);
  });
});
