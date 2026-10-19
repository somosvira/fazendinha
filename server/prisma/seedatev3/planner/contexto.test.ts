import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
vi.mock('../../../src/env.js', () => ({ env: {} }));
import { abrirComplementoPlanner } from './contexto.js';
import type { Manifesto } from '../contexto.js';
let pasta: string;
const base = (): Manifesto => ({ versao: 1, banco: 'fazendinha_seedatev3', identidade: 'instancia-local',
  dataBase: '2026-10-07', ids: { 'usuario:dono': '1' }, etapas: ['catalogos'], acoes: ['original'], criadoEm: '2026-10-07T12:00:00Z' });
beforeEach(async () => { pasta = await mkdtemp(join(tmpdir(), 'planner-manifesto-')); });
afterEach(async () => { await rm(pasta, { recursive: true, force: true }); });
describe('complemento aditivo do planner', () => {
  it('preserva o manifesto base e mantém referências sem compartilhar objetos mutáveis', async () => {
    const original = base(), antes = JSON.stringify(original);
    const c = await abrirComplementoPlanner(original, false, async () => false, pasta);
    c.manifesto.ids.planner = 'novo'; c.manifesto.acoes.push('nova'); await c.salvar();
    expect(JSON.stringify(original)).toBe(antes);
    expect(c.id('usuario:dono')).toBe('1'); expect(c.manifesto.etapas).toEqual([]);
    expect(c.manifesto.acoes).toEqual(['nova']);
  });
  it('retoma a data e etapas persistidas sem reavaliar existência ou inicializar outra carga', async () => {
    const persistido = base(); persistido.etapas = ['planner-concluido'];
    await writeFile(join(pasta, 'manifesto.json'), JSON.stringify(persistido));
    const existe = vi.fn();
    const c = await abrirComplementoPlanner(base(), false, existe, pasta);
    expect(c.manifesto.dataBase).toBe('2026-10-07'); expect(c.manifesto.etapas).toEqual(['planner-concluido']);
    expect(existe).not.toHaveBeenCalled();
  });
  it('recusa registros sem manifesto e não grava um substituto', async () => {
    await expect(abrirComplementoPlanner(base(), false, async () => true, pasta)).rejects.toThrow('sem manifesto');
    await expect(readFile(join(pasta, 'manifesto.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('recusa outra instância e manifesto corrompido sem sobrescrever', async () => {
    const texto = JSON.stringify({ ...base(), identidade: 'outro-banco' });
    await writeFile(join(pasta, 'manifesto.json'), texto);
    await expect(abrirComplementoPlanner(base(), false, async () => false, pasta)).rejects.toThrow('outra instância');
    expect(await readFile(join(pasta, 'manifesto.json'), 'utf8')).toBe(texto);
    await writeFile(join(pasta, 'manifesto.json'), '{invalido');
    await expect(abrirComplementoPlanner(base(), false, async () => false, pasta)).rejects.toThrow();
    expect(await readFile(join(pasta, 'manifesto.json'), 'utf8')).toBe('{invalido');
  });
  it('verifica sem criar arquivos nem escrever o manifesto existente', async () => {
    const existe = vi.fn();
    await expect(abrirComplementoPlanner(base(), true, existe, pasta)).rejects.toThrow('antes de verificar');
    expect(existe).not.toHaveBeenCalled();
    const texto = JSON.stringify(base()); await writeFile(join(pasta, 'manifesto.json'), texto);
    const c = await abrirComplementoPlanner(base(), true, existe, pasta);
    await expect(c.salvar()).rejects.toThrow('não pode escrever');
    expect(await readFile(join(pasta, 'manifesto.json'), 'utf8')).toBe(texto);
  });
});
