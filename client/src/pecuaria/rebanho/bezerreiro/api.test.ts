// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RebanhoApiError } from '../api';
import { consultarBezerreiro } from './api';
afterEach(() => vi.unstubAllGlobals());
describe('Transporte do Bezerreiro', () => {
  it('conserva status, código e campo do conflito', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({error: 'A origem mudou.', code: 'VERSAO_CONFLITANTE', campo: 'versaoEsperada'}), {status: 409})));
    try {
      await consultarBezerreiro('/colostro/origens/abc', 1, {versaoEsperada: 1});
      expect.unreachable('A chamada deveria falhar.');
    } catch (erro: unknown) {
      expect(erro).toBeInstanceOf(RebanhoApiError);
      expect(erro).toMatchObject({message: 'A origem mudou.', status: 409, code: 'VERSAO_CONFLITANTE', campo: 'versaoEsperada'});
    }
  });
  it('envia a chave fornecida e o sítio explícito, sem transformar leitura em comando', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    await consultarBezerreiro('/contexto', 7);
    expect(fetch).toHaveBeenLastCalledWith('/api/pecuaria/rebanho/bezerreiro/contexto', expect.objectContaining({method: 'GET', headers: expect.objectContaining({'X-Propriedade-Id': '7'})}));
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
    await consultarBezerreiro('/ofertas', 7, {chave: 'mesma-chave', quantidade: '4'});
    expect(fetch.mock.calls[1][1].body).toBe('{"chave":"mesma-chave","quantidade":"4"}');
  });
});
