// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConfiguracaoAcompanhamento } from './ConfiguracaoAcompanhamento';
import { DemandasAcompanhamento } from './DemandasAcompanhamento';
import { reqV4 } from './api';
vi.mock('./api', () => ({ reqV4: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it('políticas distinguem leitura pendente de sítio sem regras', async () => {
  let resolver!: (v: []) => void;
  vi.mocked(reqV4).mockImplementation(path => path.endsWith('/politicas') ? new Promise(resolve => { resolver = resolve; }) : Promise.resolve([]));
  render(<ConfiguracaoAcompanhamento propriedadeId={7} podeLancar={false} />);
  expect(screen.getByRole('status').textContent).toBe('Carregando políticas…');
  expect(screen.queryByText('Nenhuma política registrada neste sítio.')).toBeNull();
  await act(async () => resolver([]));
  expect(screen.getByText('Nenhuma política registrada neste sítio.')).toBeTruthy();
});
it('erro de política não afirma que o sítio está sem regras', async () => {
  vi.mocked(reqV4).mockRejectedValue(new Error('Políticas indisponíveis'));
  render(<ConfiguracaoAcompanhamento propriedadeId={7} podeLancar={false} />);
  await screen.findByText('Políticas indisponíveis');
  expect(screen.queryByText('Carregando políticas…')).toBeNull();
  expect(screen.queryByText('Nenhuma política registrada neste sítio.')).toBeNull();
});
it('erro de demandas não afirma que o animal está sem demanda', async () => {
  vi.mocked(reqV4).mockRejectedValue(new Error('Demandas indisponíveis'));
  render(<DemandasAcompanhamento propriedadeId={7} animalId="a" painel={{animais:[],tentativas:[],avaliacoes:[],partos:[],restricoes:[]}} podeLancar={false} onAvaliar={vi.fn()} atualizacao={0} />);
  expect(screen.getByRole('status').textContent).toBe('Carregando acompanhamentos…');
  await screen.findByText('Demandas indisponíveis');
  expect(screen.queryByText(/Nenhuma demanda registrada/)).toBeNull();
});
