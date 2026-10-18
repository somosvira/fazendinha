import { describe, expect, it } from 'vitest';
import { animaisV4, sequenciaTentativas } from './catalogo.js';

describe('cronologia demonstrativa dos ciclos V4', () => {
  it.each([1, 2, 3])('mantém %i tentativas no mesmo ciclo, sem inventar diagnóstico da última', quantidade => {
    const tentativas = sequenciaTentativas(quantidade, -10);
    expect(tentativas).toHaveLength(quantidade);
    expect(tentativas.at(-1)).toEqual({ dia: -10, negativoEm: null });
    for (let i = 0; i < tentativas.length - 1; i++) {
      expect(tentativas[i].negativoEm).toBeGreaterThan(tentativas[i].dia);
      expect(tentativas[i].negativoEm).toBeLessThan(tentativas[i + 1].dia);
    }
  });
  it('desloca toda a sequência para uma concepção histórica sem mudar sua ordem', () => {
    expect(sequenciaTentativas(3, -100)).toEqual([
      { dia: -200, negativoEm: -170 }, { dia: -150, negativoEm: -120 }, { dia: -100, negativoEm: null },
    ]);
  });
  it.each([0, 4, 1.5])('recusa contagem não prevista: %s', n => {
    expect(() => sequenciaTentativas(n)).toThrow();
  });
});

describe('população de demonstração operacional', () => {
  it('prepara 120 matrizes diferentes para exercitar paginação e confirmação em blocos', () => {
    const grupo = animaisV4.filter(a => a.lote === 'Diagnóstico coletivo');
    expect(grupo).toHaveLength(120);
    expect(grupo.every(a => a.sexo === 'F')).toBe(true);
    expect(new Set(animaisV4.map(a => a.numero)).size).toBe(animaisV4.length);
  });
  it('inclui doadora, receptora, touro e os desfechos que precisam ser encontrados na UI', () => {
    expect(animaisV4.some(a => a.papel === 'DOADORA')).toBe(true);
    expect(animaisV4.some(a => a.papel === 'RECEPTORA')).toBe(true);
    expect(animaisV4.some(a => a.sexo === 'M')).toBe(true);
    for (const numero of [7, 8, 9, 10, 11, 12]) expect(animaisV4.find(a => a.numero === numero)?.cenario).toBeTruthy();
  });
});
