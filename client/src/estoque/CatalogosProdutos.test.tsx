// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CatalogosProdutos, SeletorCatalogoProduto } from './CatalogosProdutos';
import { ApiError } from './api';
const mocks = vi.hoisted(() => ({ listarCatalogo: vi.fn(), salvarCatalogo: vi.fn() }));
vi.mock('./catalogos-api', async importar => ({ ...(await importar<typeof import('./catalogos-api')>()), ...mocks }));
const item = { id: 'fabricante-a', nome: 'Fabricante registrado', ativo: true, revisao: 3 };
beforeEach(() => { vi.clearAllMocks(); mocks.listarCatalogo.mockResolvedValue({ itens: [item], total: 1, pagina: 1, porPagina: 10 }); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); Element.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('somente leitura permite consultar sem ações de escrita', async () => {
  render(<CatalogosProdutos tipo="fabricantes" somenteLeitura />);
  expect(await screen.findAllByText(item.nome)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Cadastrar fabricante' })).toBeNull();
  fireEvent.click(screen.getAllByRole('button', { name: 'Consultar' })[0]);
  expect(screen.getByLabelText('Nome').matches(':disabled')).toBe(true);
  expect(screen.queryByRole('button', { name: 'Salvar cadastro' })).toBeNull();
  expect(mocks.salvarCatalogo).not.toHaveBeenCalled();
});
it('envia busca e paginação remotas', async () => {
  render(<CatalogosProdutos tipo="fabricantes" somenteLeitura={false} />);
  await screen.findAllByText(item.nome);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar fabricante' }), { target: { value: 'novo' } });
  await waitFor(() => expect(mocks.listarCatalogo).toHaveBeenLastCalledWith('fabricantes', expect.objectContaining({ busca: 'novo', pagina: 1, porPagina: 10 })));
});
it('conserva rascunho após conflito e exige revisão explícita', async () => {
  mocks.salvarCatalogo.mockRejectedValue(new ApiError('Cadastro alterado por outra pessoa', 409));
  render(<CatalogosProdutos tipo="fabricantes" somenteLeitura={false} />);
  await screen.findAllByText(item.nome);
  fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Meu rascunho' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  expect(await screen.findByText(/Seu rascunho foi preservado/)).toBeTruthy();
  expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Meu rascunho');
  expect(mocks.salvarCatalogo).toHaveBeenCalledWith('fabricantes', expect.objectContaining({ nome: 'Meu rascunho', revisaoEsperada: 3, chaveReenvio: expect.any(String) }), item.id);
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  expect(mocks.salvarCatalogo).toHaveBeenCalledTimes(1);
});
it('cadastro rápido conserva formulário pai e retorna o novo id', async () => {
  const submeterProduto = vi.fn();
  const onChange = vi.fn(); mocks.salvarCatalogo.mockResolvedValue({ ...item, id: 'novo', nome: 'Novo fabricante' });
  render(<form onSubmit={submeterProduto}><SeletorCatalogoProduto tipo="fabricantes" rotulo="Fabricante" valor="" onChange={onChange} /></form>);
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar fabricante' }));
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Novo fabricante' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith('novo', expect.objectContaining({ nome: 'Novo fabricante' })));
  expect(screen.queryByRole('heading', { name: 'Cadastrar fabricante' })).toBeNull();
  expect(submeterProduto).not.toHaveBeenCalled();
});
it('duplicidade permite corrigir o nome e reenviar com outra chave', async () => {
  mocks.salvarCatalogo.mockRejectedValueOnce(new ApiError('Nome já cadastrado', 409, 'CONFLITO', 'nome')).mockResolvedValueOnce(item);
  render(<SeletorCatalogoProduto tipo="fabricantes" rotulo="Fabricante" valor="" onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar fabricante' }));
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Nome repetido' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await screen.findByText('Nome já cadastrado');
  const chave = mocks.salvarCatalogo.mock.calls[0][1].chaveReenvio;
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Nome corrigido' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
  await waitFor(() => expect(mocks.salvarCatalogo).toHaveBeenCalledTimes(2));
  expect(mocks.salvarCatalogo.mock.calls[1][1].chaveReenvio).not.toBe(chave);
});
