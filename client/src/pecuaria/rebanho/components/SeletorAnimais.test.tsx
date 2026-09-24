// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SeletorAnimais } from "./SeletorAnimais";
import { listarAnimais, obterCatalogos } from "../api";
import type { AnimalResumo, Catalogos, ListarFiltros } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  listarAnimais: vi.fn(),
  obterCatalogos: vi.fn(),
}));

const catalogos: Catalogos = {
  racas: [],
  motivosSaida: [],
  propriedades: [{ id: 1, nome: "Sede", apelido: null }],
  lotes: [{ id: "lote-1", nome: "Lote A", propriedadeId: 1 }, { id: "lote-2", nome: "Lote B", propriedadeId: 1 }],
};

const catVaca = { id: "cat-vaca", nome: "Vaca" };

function criarAnimal(overrides: Partial<AnimalResumo>): AnimalResumo {
  return {
    id: "a1", brinco: "0001", nome: null, sexo: "F", categoria: catVaca, categoriaOrigem: "AUTOMATICA", categoriaCalculada: catVaca, idadeMeses: 30,
    dataNascimento: "2023-01-01", dataEntrada: "2023-01-01", origem: "NASCIDO",
    propriedade: { id: 1, nome: "Sede" }, lote: null, aptidao: "LEITE", papelReprodutivo: "NENHUM",
    composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
    ...overrides,
  };
}

const painelVazio = { totalAtivos: 0, porCategoria: [], porSitio: [], femeasAtivas: 0, receptorasAtivas: 0 };

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obterCatalogos).mockResolvedValue(catalogos);
});

describe("SeletorAnimais", () => {
  it("mantém a seleção ao trocar de página", async () => {
    const pagina1 = [criarAnimal({ id: "a1", brinco: "0001" })];
    const pagina2 = [criarAnimal({ id: "a2", brinco: "0002" })];
    vi.mocked(listarAnimais).mockImplementation((filtros: ListarFiltros) =>
      Promise.resolve({ itens: filtros.page === 2 ? pagina2 : pagina1, total: 21, painel: painelVazio }));

    render(<SeletorAnimais onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
    await screen.findAllByText("0001");
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Selecionar 0001" })[0]);
    expect(await screen.findByText(/1 animal selecionado/)).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Próxima" })[0]);
    await screen.findAllByText("0002");
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Selecionar 0002" })[0]);
    expect(await screen.findByText(/2 animais selecionados/)).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Anterior" })[0]);
    await screen.findAllByText("0001");
    expect((screen.getAllByRole("checkbox", { name: "Selecionar 0001" })[0] as HTMLInputElement).checked).toBe(true);
  });

  it("'selecionar todos da página' marca e desmarca os itens exibidos", async () => {
    const itens = [criarAnimal({ id: "a1", brinco: "0001" }), criarAnimal({ id: "a2", brinco: "0002" })];
    vi.mocked(listarAnimais).mockResolvedValue({ itens, total: 2, painel: painelVazio });

    render(<SeletorAnimais onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
    await screen.findAllByText("0001");
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos da página" }));
    expect(await screen.findByText(/2 animais selecionados/)).toBeTruthy();
    expect((screen.getAllByRole("checkbox", { name: "Selecionar 0001" })[0] as HTMLInputElement).checked).toBe(true);
    expect((screen.getAllByRole("checkbox", { name: "Selecionar 0002" })[0] as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos da página" }));
    await waitFor(() => expect(screen.queryByText(/selecionados? no total/)).toBeNull());
  });

  it("excluirLoteId remove o lote do filtro de origem e some os animais que estão nele", async () => {
    const itens = [criarAnimal({ id: "a1", brinco: "0001", lote: { id: "lote-2", nome: "Lote B" } }), criarAnimal({ id: "a2", brinco: "0002", lote: null })];
    vi.mocked(listarAnimais).mockResolvedValue({ itens, total: 2, painel: painelVazio });

    render(<SeletorAnimais excluirLoteId="lote-2" onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
    await screen.findAllByText("0002");
    expect(screen.queryByText("0001")).toBeNull();
    expect(within(screen.getByLabelText("Filtrar por lote de origem")).queryByRole("option", { name: "Lote B" })).toBeNull();
    expect(within(screen.getByLabelText("Filtrar por lote de origem")).getByRole("option", { name: "Lote A" })).toBeTruthy();
  });

  it("onConfirmar recebe os animais selecionados", async () => {
    const itens = [criarAnimal({ id: "a1", brinco: "0001" }), criarAnimal({ id: "a2", brinco: "0002" })];
    vi.mocked(listarAnimais).mockResolvedValue({ itens, total: 2, painel: painelVazio });
    const onConfirmar = vi.fn();

    render(<SeletorAnimais onConfirmar={onConfirmar} onCancelar={vi.fn()} />);
    await screen.findAllByText("0001");
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Selecionar 0001" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Continuar (1)" }));
    expect(onConfirmar).toHaveBeenCalledWith([itens[0]]);
  });
});
