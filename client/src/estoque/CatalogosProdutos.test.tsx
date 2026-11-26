// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CatalogoProdutos, SeletorCatalogoProduto, rotuloUsoCatalogo } from './CatalogosProdutos';
const mocks = vi.hoisted(() => ({ listarCatalogo: vi.fn(), listarCatalogoProdutos: vi.fn(), obterReferenciaCatalogo: vi.fn() }));
vi.mock('./catalogos-api', async importar => ({ ...(await importar<typeof import('./catalogos-api')>()), ...mocks }));
const base = { apresentacao: 'Frasco 50 ml', fabricante: { id: 'f1', nome: 'Fabricante A' }, classificacaoTecnica: { id: 'c1', nome: 'Endectocidas' }, usoSanitario: true, usoNutricional: false, usoGenetico: false };
const naoAdotado = { ...base, id: 'cat-1', nomeCompleto: 'Abamectina 1% (Frasco 50 ml)', produtoId: null };
const adotado = { ...base, id: 'cat-2', nomeCompleto: 'Ivermectina 1% (Frasco 50 ml)', produtoId: 'prod-9' };
beforeEach(() => {
  vi.clearAllMocks();
  history.replaceState(null, "", "/estoque?aba=catalogo");
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

it('grava busca e filtros no endereço para sobreviverem ao recarregar', async () => {
  render(<CatalogoProdutos />);
  await screen.findAllByText(naoAdotado.nomeCompleto);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por produto ou fabricante' }), { target: { value: 'pf' } });
  fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
  fireEvent.click(await screen.findByRole('combobox', { name: 'Filtrar por uso' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Nutricional' }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Filtrar pela situação na fazenda' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Só no catálogo' }));
  await waitFor(() => expect(mocks.listarCatalogoProdutos).toHaveBeenLastCalledWith(expect.objectContaining({ busca: 'pf', uso: 'nutricional', naFazenda: 'nao', pagina: 1 })));
  const params = new URLSearchParams(location.search);
  expect([params.get('aba'), params.get('buscaCatalogo'), params.get('usoCatalogo'), params.get('naFazendaCatalogo')]).toEqual(['catalogo', 'pf', 'nutricional', 'nao']);
});

it('lê busca e filtros do endereço ao abrir', async () => {
  history.replaceState(null, '', '/estoque?aba=catalogo&buscaCatalogo=pf&usoCatalogo=sanitario&naFazendaCatalogo=sim');
  render(<CatalogoProdutos />);
  await waitFor(() => expect(mocks.listarCatalogoProdutos).toHaveBeenLastCalledWith(expect.objectContaining({ busca: 'pf', uso: 'sanitario', naFazenda: 'sim' })));
  expect((screen.getByRole('searchbox', { name: 'Buscar por produto ou fabricante' }) as HTMLInputElement).value).toBe('pf');
  expect(screen.getByRole('button', { name: 'Remover filtro: Uso: Sanitário' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Remover filtro: Em Produtos' })).toBeTruthy();
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

it("abre a referência exata pela URL e conserva fonte e condição", async () => {
  const item = { ...naoAdotado, orientacaoBula: {
    fonte: "https://calbos.com.br/produto/pirosan/", titulo: "Ficha oficial", consultadaEm: "2026-11-17",
    especie: "Bovinos", concentracao: "Formulação conferida", dosagem: "Dose específica", via: "Intramuscular",
    cuidados: "Condição conferida na fonte", tipoFonte: "FICHA_OFICIAL",
  } };
  history.replaceState(null, "", "/estoque?aba=catalogo&referenciaCatalogo=cat-1&buscaCatalogo=Abamectina");
  mocks.obterReferenciaCatalogo.mockResolvedValue(item);
  render(<CatalogoProdutos />);
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(mocks.obterReferenciaCatalogo).toHaveBeenCalledWith("cat-1");
  expect(screen.getByText("Dose específica")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Abrir documento oficial" }).getAttribute("href")).toBe(item.orientacaoBula.fonte);
});
