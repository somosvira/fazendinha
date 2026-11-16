// @vitest-environment jsdom
import "../../../lib/controles.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SelecaoAnimais, separarBrincos } from "./SelecaoAnimais";
import { listarAnimais, listarCategorias, obterCatalogos } from "../api";
import type { AnimalResumo, Catalogos, ListarFiltros } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  listarAnimais: vi.fn(),
  obterCatalogos: vi.fn(),
  listarCategorias: vi.fn(),
}));

const catalogos: Catalogos = {
  racas: [],
  motivosBaixa: [],
  propriedades: [{ id: 1, nome: "Sede", apelido: "Apelido antigo" }],
  lotes: [{ id: "lote-1", nome: "Lote A", propriedadeId: 1 }, { id: "lote-2", nome: "Lote B", propriedadeId: 1 }],
};

const catVaca = { id: "cat-vaca", nome: "Vaca" };

function criarAnimal(overrides: Partial<AnimalResumo>): AnimalResumo {
  return {
    id: "a1", brinco: "0001", nome: null, sexo: "F", categoria: catVaca, categoriaOrigem: "AUTOMATICA", categoriaCalculada: catVaca, idadeMeses: 30, idadeNaBaixa: false,
    dataNascimento: "2023-01-01", dataEntrada: "2023-01-01", origem: "NASCIDO",
    propriedade: { id: 1, nome: "Sede" }, lote: null, aptidao: "LEITE", papelReprodutivo: "NENHUM",
    composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
    gmdRecente: null, noLocalDesde: null, baixa: null,
    ...overrides,
  };
}

const painelVazio = { totalAtivos: 0, porCategoria: [], porSitio: [], femeasAtivas: 0, receptorasAtivas: 0 };

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obterCatalogos).mockResolvedValue(catalogos);
  vi.mocked(listarCategorias).mockResolvedValue({ itens: [], semCategoria: 0 });
});

describe("SelecaoAnimais", () => {
  it("separa brincos digitados sem repetir, ignorando caixa", () => {
    expect(separarBrincos(" 0012, 0035;0101\n\n0035 dev-1 DEV-1 ")).toEqual(["0012", "0035", "0101", "dev-1"]);
  });

  it("digitar brincos adiciona os encontrados e devolve os não encontrados para correção", async () => {
    vi.mocked(listarAnimais).mockImplementation((filtros: ListarFiltros) => Promise.resolve(filtros.brincos
      ? { itens: [criarAnimal({ id: "a12", brinco: "0012" }), criarAnimal({ id: "a35", brinco: "DEV-035" })], total: 2, painel: painelVazio }
      : { itens: [], total: 0, painel: painelVazio }));
    const onConfirmar = vi.fn();
    render(<SelecaoAnimais excluirLoteId="lote-2" onConfirmar={onConfirmar} onCancelar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Digitar brincos" }));
    fireEvent.change(screen.getByLabelText("Lista de brincos"), { target: { value: "0012 dev-035\n9999" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar 3 à seleção" }));
    expect(await screen.findByText(/Não encontrados \(1\): 9999/)).toBeTruthy();
    const chamada = vi.mocked(listarAnimais).mock.calls.find(([f]) => f.brincos)![0];
    expect(chamada).toMatchObject({ brincos: ["0012", "dev-035", "9999"], excluirLoteId: "lote-2", situacao: "ATIVO" });
    expect((screen.getByLabelText("Lista de brincos") as HTMLTextAreaElement).value).toBe("9999");
    fireEvent.click(screen.getByRole("button", { name: "Continuar (2)" }));
    expect(onConfirmar.mock.calls[0][0].map((a: AnimalResumo) => a.brinco)).toEqual(["0012", "DEV-035"]);
  });

  it("seleciona todos os encontrados pelos filtros, carregando todas as páginas", async () => {
    const todos = Array.from({ length: 25 }, (_, i) => criarAnimal({ id: `a${i}`, brinco: String(i).padStart(4, "0") }));
    vi.mocked(listarAnimais).mockImplementation((filtros: ListarFiltros) => {
      const tamanho = filtros.pageSize ?? 20; const inicio = ((filtros.page ?? 1) - 1) * tamanho;
      return Promise.resolve({ itens: todos.slice(inicio, inicio + tamanho), total: todos.length, painel: painelVazio });
    });
    render(<SelecaoAnimais sexo="F" onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
    await screen.findAllByText("0000");
    fireEvent.click(screen.getByRole("button", { name: "Selecionar os 25 encontrados" }));
    expect(await screen.findByRole("button", { name: "Continuar (25)" })).toBeTruthy();
    expect(vi.mocked(listarAnimais).mock.calls.every(([f]) => f.sexo === "F" && f.situacao === "ATIVO")).toBe(true);
    expect(screen.queryByRole("combobox", { name: "Sexo" })).toBeNull();
  });

  it("mostra reprodução e produção na lista e remove pelo painel de selecionados", async () => {
    const vaca = criarAnimal({ id: "a1", brinco: "0001", contextoCartao: { situacaoReprodutiva: "GESTANTE", ocorrencias: [], produtivo: { situacaoProdutiva: "LACTANTE", del: 120 } as never } });
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [vaca], total: 1, painel: painelVazio });
    render(<SelecaoAnimais inicial={[vaca]} onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
    expect((await screen.findAllByText("Gestante")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lactante").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DEL 120").length).toBeGreaterThan(0);
    expect(vi.mocked(listarAnimais).mock.calls[0][0].comContexto).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Remover 0001 da seleção" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Continuar (0)" })).toBeTruthy());
  });
});
