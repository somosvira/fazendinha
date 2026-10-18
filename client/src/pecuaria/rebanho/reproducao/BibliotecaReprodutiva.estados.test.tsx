// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BibliotecaReprodutiva } from './BibliotecaReprodutiva';
import { reqV4 } from './api';
vi.mock('./api', () => ({ reqV4: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
function abrir() {
  render(<BibliotecaReprodutiva propriedadeId={7} podeLancar={false} onCopiou={vi.fn()} />);
  fireEvent.click(screen.getByText('Biblioteca de referências reprodutivas'));
}
it('distingue leitura pendente de consulta vazia', async () => {
  let resolver!: (valor: []) => void;
  vi.mocked(reqV4).mockImplementation(() => new Promise(resolve => { resolver = resolve; }));
  abrir();
  expect(screen.getByRole('status').textContent).toBe('Carregando referências…');
  expect(screen.queryByText('Nenhuma referência encontrada.')).toBeNull();
  await act(async () => resolver([]));
  expect(screen.getByRole('status').textContent).toBe('Nenhuma referência encontrada.');
});
it('falha de leitura não é apresentada como biblioteca vazia', async () => {
  vi.mocked(reqV4).mockRejectedValue(new Error('Referências indisponíveis'));
  abrir();
  await screen.findByText('Referências indisponíveis');
  expect(screen.queryByText('Carregando referências…')).toBeNull();
  expect(screen.queryByText('Nenhuma referência encontrada.')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Copiar como rascunho' })).toBeNull();
});
