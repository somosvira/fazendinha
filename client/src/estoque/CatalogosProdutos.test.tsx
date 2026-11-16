// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CatalogoProdutos, SeletorCatalogoProduto, rotuloUsoCatalogo } from './CatalogosProdutos';
const mocks = vi.hoisted(() => ({ listarCatalogo: vi.fn(), listarCatalogoProdutos: vi.fn() }));
vi.mock('./catalogos-api', async importar => ({ ...(await importar<typeof import('./catalogos-api')>()), ...mocks }));
const base = { apresentacao: 'Frasco 50 ml', fabricante: { id: 'f1', nome: 'Fabricante A' }, classificacaoTecnica: { id: 'c1', nome: 'Endectocidas' }, usoSanitario: true, usoNutricional: false, usoGenetico: false };
const naoAdotado = { ...base, id: 'cat-1', nomeCompleto: 'Abamectina 1% (Frasco 50 ml)', produtoId: null };
const adotado = { ...base, id: 'cat-2', nomeCompleto: 'Ivermectina 1% (Frasco 50 ml)', produtoId: 'prod-9' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listarCatalogoProdutos.mockResolvedValue({ itens: [naoAdotado, adotado], total: 2, pagina: 1, porPagina: 10 });
  mocks.listarCatalogo.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('lista produtos do catálogo com fabricante, classificação e uso, sem ações de cadastro', async () => {
  render(<CatalogoProdutos />);
  expect((await screen.findAllByText(naoAdotado.nomeCompleto)).length).toBeGreaterThan(0);
  expect(screen.getAllByText('Fabricante A').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Endectocidas').length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: /Cadastrar|Editar/ })).toBeNull();
});

it('envia busca e paginação remotas, voltando à primeira página', async () => {
  render(<CatalogoProdutos />);
  await screen.findAllByText(naoAdotado.nomeCompleto);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por produto ou fabricante' }), { target: { value: 'ivermec' } });
  await waitFor(() => expect(mocks.listarCatalogoProdutos).toHaveBeenLastCalledWith(expect.objectContaining({ busca: 'ivermec', pagina: 1, porPagina: 10 })));
});

it('erro de consulta oferece Tentar novamente', async () => {
  mocks.listarCatalogoProdutos.mockRejectedValueOnce(new Error('Falha de rede'));
  render(<CatalogoProdutos />);
  expect(await screen.findByText('Falha de rede')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect((await screen.findAllByText(naoAdotado.nomeCompleto)).length).toBeGreaterThan(0);
});

it('busca sem resultado mostra estado vazio', async () => {
  mocks.listarCatalogoProdutos.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 });
  render(<CatalogoProdutos />);
  expect(await screen.findByText('Nenhum produto encontrado')).toBeTruthy();
});

it('rótulo de uso junta os usos marcados', () => {
  expect(rotuloUsoCatalogo({ usoSanitario: true, usoNutricional: true, usoGenetico: false })).toBe('Sanitário · Nutricional');
  expect(rotuloUsoCatalogo({ usoSanitario: false, usoNutricional: false, usoGenetico: false })).toBe('—');
});

it('seletor de fabricante não oferece cadastro rápido', () => {
  render(<SeletorCatalogoProduto tipo="fabricantes" rotulo="Fabricante" valor="" onChange={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Cadastrar fabricante' })).toBeNull();
});
