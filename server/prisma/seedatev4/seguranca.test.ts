import { describe, expect, it } from 'vitest';
import { exigirAtendimentoIntocado, exigirMesmaComposicao, exigirUnico, idsDoManifesto } from './seguranca.js';

describe('retomada da seed V4 preserva inclusões manuais', () => {
  it('limita tentativas às identidades persistidas da própria seed', () => {
    expect(idsDoManifesto({ 'animal:1': 'v3', 'seedatev4-v1:animal:1': 'animal-v4',
      'seedatev4-v1:tentativa:1:1': 'tentativa-seed', 'seedatev4-v1:tentativa:2:1': 'tentativa-seed-2' }, 'seedatev4-v1:tentativa:'))
      .toEqual(['tentativa-seed', 'tentativa-seed-2']);
  });
  it('não confunde participações de programações com nomes semelhantes', () => {
    expect(idsDoManifesto({ 'seedatev4-v1:participante:Turma:1': 'proprio', 'seedatev4-v1:participante:Turma nova:1': 'outro' }, 'seedatev4-v1:participante:Turma:'))
      .toEqual(['proprio']);
  });
  it('recusa reconstruir identidade ambígua ou removida', () => {
    expect(exigirUnico([{ id: 'original' }], 'participação')).toEqual({ id: 'original' });
    expect(() => exigirUnico([], 'participação')).toThrow('removido');
    expect(() => exigirUnico([{ id: 'original' }, { id: 'manual' }], 'participação')).toThrow('ambíguo');
  });
  it('impede encerrar uma visita que recebeu atividade ou participante manual', () => {
    expect(() => exigirMesmaComposicao(['b', 'a'], ['a', 'b'], 'visita')).not.toThrow();
    expect(() => exigirMesmaComposicao(['a', 'b', 'manual'], ['a', 'b'], 'visita')).toThrow('composição alterada');
    expect(() => exigirMesmaComposicao(['a'], ['a', 'b'], 'visita')).toThrow('composição alterada');
    expect(() => exigirMesmaComposicao(['a', 'manual'], ['a', 'b'], 'visita')).toThrow('composição alterada');
  });
  it('aceita preparar ausência somente antes do primeiro atendimento', () => {
    expect(() => exigirAtendimentoIntocado([{ status: 'PENDENTE', versaoRascunho: 0 }])).not.toThrow();
  });
  it.each([
    { status: 'PENDENTE', versaoRascunho: 1 }, { status: 'ADIADO', versaoRascunho: 0 },
    { status: 'NAO_ATENDIDO', versaoRascunho: 0 }, { status: 'CONFIRMADO', versaoRascunho: 0 },
  ])('preserva a decisão manual %j em vez de substituí-la pelo cenário', participante => {
    expect(() => exigirAtendimentoIntocado([participante])).toThrow('Atendimento alterado');
  });
});
