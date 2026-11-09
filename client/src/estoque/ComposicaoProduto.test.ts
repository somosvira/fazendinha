import { describe, expect, it } from 'vitest';
import { prepararComposicao, prepararNutricional, validarComposicao, validarNutricional } from './ComposicaoProduto';
import type { ComposicaoInput, NutricionalInput } from './catalogos-api';
const composicao: ComposicaoInput = { versaoEsperada: null, situacao: 'INFORMADA', referencia: 'Rótulo', itens: [{ principioAtivoId: 'a', concentracaoValor: null, concentracaoUnidade: null }] };
const nutricional: NutricionalInput = { versaoEsperada: null, situacao: 'INFORMADA', referencia: 'Rótulo', itens: [{ nutrienteId: 'n', valor: null, base: 'NAO_INFORMADA', unidadeSnapshot: 'PERCENTUAL' }] };
describe('composição conhecida sem inferir concentração', () => {
  it('aceita ingrediente sem concentração nem referência', () => expect(validarComposicao({ ...composicao, referencia: null }, null)).toBeNull());
  it.each([{ concentracaoValor: '1', concentracaoUnidade: null }, { concentracaoValor: null, concentracaoUnidade: 'MG_ML' as const }])('recusa par incompleto %o', item => expect(validarComposicao({ ...composicao, itens: [{ ...composicao.itens[0], ...item }] }, null)).toMatch(/concentração e sua unidade/));
  it.each(['0', '-1', '1,0000001', '1000000000000'])('recusa concentração inválida %s sem arredondar', v => expect(validarComposicao({ ...composicao, itens: [{ ...composicao.itens[0], concentracaoValor: v, concentracaoUnidade: 'MG_ML' }] }, null)).toMatch(/concentração positiva/));
  it('exige referência e percentual com base explícita dentro do limite', () => {
    expect(validarComposicao({ ...composicao, referencia: null, itens: [{ ...composicao.itens[0], concentracaoValor: '2', concentracaoUnidade: 'MG_ML' }] }, null)).toMatch(/referência/);
    expect(validarComposicao({ ...composicao, itens: [{ ...composicao.itens[0], concentracaoValor: '101', concentracaoUnidade: 'PERCENTUAL_MASSA_VOLUME' }] }, null)).toMatch(/percentual/);
  });
  it('recusa repetição e exige motivo para substituir ou remover versão existente', () => {
    expect(validarComposicao({ ...composicao, itens: [...composicao.itens, ...composicao.itens] }, null)).toMatch(/uma vez/);
    expect(validarComposicao({ ...composicao, itens: [] }, 'anterior')).toMatch(/motivo/);
    expect(prepararComposicao({ ...composicao, itens: [], motivoAlteracao: 'Correção da composição' }).situacao).toBe('NAO_INFORMADA');
  });
  it('conserva string decimal com seis casas e normaliza vírgula sem arredondar', () => expect(prepararComposicao({ ...composicao, itens: [{ ...composicao.itens[0], concentracaoValor: '12,123456', concentracaoUnidade: 'MG_ML' }] }).itens[0].concentracaoValor).toBe('12.123456'));
});
describe('informações nutricionais descritivas', () => {
  it('distingue desconhecido de zero documentado', () => {
    expect(validarNutricional(nutricional, null)).toBeNull();
    expect(validarNutricional({ ...nutricional, itens: [{ ...nutricional.itens[0], valor: '0', base: 'MATERIA_SECA' }] }, null)).toBeNull();
    expect(prepararNutricional({ ...nutricional, itens: [{ ...nutricional.itens[0], valor: '0', base: 'MATERIA_SECA' }] }).itens[0].valor).toBe('0');
  });
  it('não aceita valor sem base ou base sem valor', () => {
    expect(validarNutricional({ ...nutricional, itens: [{ ...nutricional.itens[0], valor: '12' }] }, null)).toMatch(/base juntos/);
    expect(validarNutricional({ ...nutricional, itens: [{ ...nutricional.itens[0], base: 'MATERIA_NATURAL' }] }, null)).toMatch(/base juntos/);
  });
  it('não permite percentual superior a 100 nem duplicação de nutriente', () => {
    expect(validarNutricional({ ...nutricional, itens: [{ ...nutricional.itens[0], valor: '101', base: 'MATERIA_SECA' }] }, null)).toMatch(/percentual/);
    expect(validarNutricional({ ...nutricional, itens: [...nutricional.itens, ...nutricional.itens] }, null)).toMatch(/distintos/);
  });
});
