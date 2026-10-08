import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
vi.mock('../../src/env.js', () => ({ env: { DATABASE_URL: 'postgresql://local:local@localhost/fazendinha_seedatev3', NODE_ENV: 'test', STORAGE_NAMESPACE: 'test' } }));
import { BANCO, Contexto, deslocar, hojeBrasil, chave, noMes, validarDestino, type Manifesto } from './contexto.js';

let pasta: string;
const manifesto = (): Manifesto => ({ versao: 1, banco: BANCO, identidade: 'teste', dataBase: '2026-10-07', ids: {}, etapas: [], acoes: [], criadoEm: '2026-10-07T12:00:00.000Z' });
beforeEach(async () => { pasta = await mkdtemp(join(tmpdir(), 'seedatev3-unit-')); });
afterEach(async () => { await rm(pasta, { recursive: true, force: true }); });

describe('proteções e datas do seedatev3', () => {
  it.each(['postgresql://u:p@remote/fazendinha_seedatev3', 'postgresql://u:p@localhost/fazendinha', 'postgresql://u:p@localhost/postgres', 'https://localhost/fazendinha_seedatev3'])('recusa destino %s', url => { expect(() => validarDestino(url, 'development')).toThrow('apenas'); });
  it('recusa produção mesmo no banco local autorizado', () => { expect(() => validarDestino(`postgresql://u:p@localhost/${BANCO}`, 'production')).toThrow(); });
  it('calcula data-base no Brasil e trata mudanças de ano/mês', () => {
    expect(hojeBrasil(new Date('2026-10-08T01:30:00Z'))).toBe('2026-10-07');
    expect(noMes('2026-01-01', -2, 1)).toBe('2025-11-01');
    expect(deslocar('2024-03-01', -1)).toBe('2024-02-29');
    expect(chave('compra')).toMatch(/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-a[a-f\d]{3}-[a-f\d]{12}$/);
    expect(chave('compra')).toBe(chave('compra')); expect(chave('compra')).not.toBe(chave('venda'));
  });
});
describe('manifesto, retomada e preservação manual', () => {
  it('reconcilia fato confirmado antes de salvar o manifesto sem repetir a criação', async () => {
    const c = new Contexto(manifesto(), false, undefined, pasta); const criar = vi.fn();
    await c.registro('operacao:teste', async () => ({ id: 'ja-confirmada' }), criar);
    expect(criar).not.toHaveBeenCalled(); expect(c.id('operacao:teste')).toBe('ja-confirmada');
    expect(JSON.parse(await readFile(join(pasta, 'manifesto.json'), 'utf8')).dataBase).toBe('2026-10-07');
  });
  it('retoma a partir da etapa seguinte e mantém a mesma data-base', async () => {
    const c = new Contexto(manifesto(), false, 'catalogos', pasta); const criar = vi.fn(async () => {});
    await expect(c.etapa('catalogos', criar)).rejects.toThrow('Interrupção de teste');
    const retomado = new Contexto(JSON.parse(await readFile(join(pasta, 'manifesto.json'), 'utf8')), false, undefined, pasta);
    await retomado.etapa('catalogos', criar); expect(criar).toHaveBeenCalledTimes(1);
    expect(retomado.manifesto.dataBase).toBe(c.manifesto.dataBase);
  });
  it('não sobrescreve uma ação concluída mesmo se um usuário a alterou depois', async () => {
    const m = manifesto(); m.acoes.push('dieta'); const c = new Contexto(m, false, undefined, pasta);
    const consultar = vi.fn(async () => false); const alterar = vi.fn(); await c.acao('dieta', consultar, alterar);
    expect(consultar).not.toHaveBeenCalled(); expect(alterar).not.toHaveBeenCalled();
  });
  it('usa o ID persistido, não recria cadastro removido ou renomeado', async () => {
    const m = manifesto(); m.ids.cadastro = 'id-original'; const c = new Contexto(m, false, undefined, pasta); const criar = vi.fn();
    const buscar = vi.fn(async () => ({ id: 'id-original' })); await c.registro('cadastro', buscar, criar);
    expect(buscar).toHaveBeenCalledWith('id-original'); expect(criar).not.toHaveBeenCalled();
    await expect(c.registro('cadastro', async () => null, criar)).rejects.toThrow('removido manualmente');
    expect(criar).not.toHaveBeenCalled();
  });
  it('impede escrita do manifesto durante a verificação', async () => { await expect(new Contexto(manifesto(), true, undefined, pasta).salvar()).rejects.toThrow('não pode escrever'); });
  it('recusa preparação em modo de conferência antes de executar qualquer callback', async () => {
    const c = new Contexto(manifesto(), true, undefined, pasta);
    const buscar = vi.fn(async () => null); const criar = vi.fn(async () => ({ id: 'novo' }));
    const concluida = vi.fn(async () => false); const executar = vi.fn(async () => {});
    await expect(c.registro('cadastro', buscar, criar)).rejects.toThrow('não pode preparar');
    await expect(c.acao('acao', concluida, executar)).rejects.toThrow('não pode executar');
    await expect(c.etapa('etapa', executar)).rejects.toThrow('não pode executar');
    expect(buscar).not.toHaveBeenCalled(); expect(criar).not.toHaveBeenCalled();
    expect(concluida).not.toHaveBeenCalled(); expect(executar).not.toHaveBeenCalled();
    expect(c.manifesto.ids).toEqual({}); expect(c.manifesto.acoes).toEqual([]); expect(c.manifesto.etapas).toEqual([]);
  });
});
