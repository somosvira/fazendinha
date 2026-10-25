import { describe, expect, it } from 'vitest';
import { animaisSeed, brincoSeed } from './rebanho.js';
import { dadosPartosSeed, sequenciaTentativas } from './reproducao.js';
import { carenciasSeed, vacinacoesSeed } from './sanidade.js';

describe('grafo operacional da seed única', () => {
  it('distribui exatamente os animais e preserva eixos independentes', () => {
    expect(animaisSeed).toHaveLength(132);
    expect(new Set(animaisSeed.map(a => brincoSeed(a.numero))).size).toBe(132);
    for (const [sitio, total] of [['Principal', 72], ['Arrendado', 36], ['Test', 24]]) expect(animaisSeed.filter(a => a.sitio === sitio)).toHaveLength(total as number);
    const principal = animaisSeed.filter(a => a.sitio === 'Principal');
    expect(Object.fromEntries(['Lactantes', 'Secas', 'Novilhas', 'Crias', 'Reprodução'].map(grupo => [grupo, principal.filter(a => a.grupo === grupo).length]))).toEqual({ Lactantes: 36, Secas: 12, Novilhas: 10, Crias: 8, Reprodução: 6 });
    const arrendado = animaisSeed.filter(a => a.sitio === 'Arrendado');
    expect(arrendado.filter(a => a.papel === 'RECEPTORA')).toHaveLength(12);
    expect(arrendado.filter(a => a.grupo === 'Novilhas')).toHaveLength(14);
    expect(arrendado.filter(a => a.sexo === 'M')).toHaveLength(1);
    expect(arrendado.filter(a => a.aptidao === 'CORTE' && a.raca === 'NE')).toHaveLength(9);
    expect(arrendado.filter(a => a.papel === 'RECEPTORA').every(a => a.aptidao === 'REPRODUCAO')).toBe(true);
    expect(animaisSeed.filter(a => a.sitio === 'Test').every(a => a.aptidao === 'CORTE' && a.raca === 'NE')).toBe(true);
    expect(animaisSeed.filter(a => a.sitio === 'Test' && a.grupo === 'Garrotes')).toHaveLength(8);
  });
  it('crias são produzidas exclusivamente por partos, incluindo gêmeos e natimorto', () => {
    const crias = dadosPartosSeed.flatMap(p => [...p.crias]);
    const planejadas = animaisSeed.filter(a => a.criaParto).map(a => a.numero);
    expect(crias).toEqual(planejadas);
    expect(new Set(crias).size).toBe(8);
    expect(dadosPartosSeed.some(p => p.crias.length === 2)).toBe(true);
    expect(dadosPartosSeed.some(p => p.crias.length === 0)).toBe(true);
    expect(dadosPartosSeed.every(p => p.dia <= 0 && p.dia >= -20)).toBe(true);
    expect(dadosPartosSeed.filter(p => p.dia >= -2)).toHaveLength(4);
    expect(dadosPartosSeed.filter(p => p.dia < -2)).toHaveLength(4);
    expect(dadosPartosSeed.every(p => animaisSeed.some(a => a.numero === p.matriz && a.grupo === 'Lactantes'))).toBe(true);
    expect(animaisSeed.find(a => a.numero === 7)?.papel).toBe('RECEPTORA');
    expect(animaisSeed.find(a => a.numero === 7)?.aptidao).toBe('LEITE');
  });
  it('terceira e quarta tentativas exigem negativos anteriores e janela cronológica real', () => {
    expect(sequenciaTentativas(4)).toEqual([{ ordem: 1, dia: -160, negativoEm: -130 }, { ordem: 2, dia: -110, negativoEm: -80 }, { ordem: 3, dia: -60, negativoEm: -30 }, { ordem: 4, dia: -10, negativoEm: null }]);
    for (const quantidade of [3, 4]) {
      const fatos = sequenciaTentativas(quantidade);
      expect(fatos).toHaveLength(quantidade);
      for (let i = 0; i < fatos.length - 1; i++) {
        expect(fatos[i].negativoEm).toBeGreaterThan(fatos[i].dia);
        expect(fatos[i].negativoEm).toBeLessThan(fatos[i + 1].dia);
      }
      expect(fatos.at(-1)?.negativoEm).toBeNull();
    }
    for (const quantidade of [0, 5, 2.5, NaN]) expect(() => sequenciaTentativas(quantidade)).toThrow();
  });
  it('sanidade mantém carência desconhecida e vacinação nos três sítios', () => {
    expect(carenciasSeed.filter(a => a.estado === 'INFORMADO')).toHaveLength(4);
    expect(carenciasSeed.filter(a => a.estado === 'NAO_INFORMADO')).toEqual([{ numero: 13, dia: -1, estado: 'NAO_INFORMADO', horas: null }]);
    expect(carenciasSeed.every(a => animaisSeed.some(b => b.numero === a.numero && b.grupo === 'Lactantes'))).toBe(true);
    expect(carenciasSeed.filter(a => a.estado === 'INFORMADO').every(a => a.horas! > -a.dia * 24)).toBe(true);
    expect(vacinacoesSeed).toHaveLength(36);
    for (const sitio of ['Principal', 'Arrendado', 'Test']) expect(vacinacoesSeed.filter(v => v.sitio === sitio)).toHaveLength(12);
    for (const v of vacinacoesSeed) expect(animaisSeed.find(a => a.numero === v.numero)?.sitio).toBe(v.sitio);
  });
});
