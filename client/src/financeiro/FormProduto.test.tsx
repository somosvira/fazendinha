// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormProduto } from "./FormProduto";

const mocks = vi.hoisted(() => ({
  listarFornecedores: vi.fn(),
  listarCategorias: vi.fn(),
  listarCentrosCusto: vi.fn(),
  criarProduto: vi.fn(),
  editarProduto: vi.fn(),
}));

vi.mock("../estoque/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../estoque/api")>()),
  listarFornecedores: mocks.listarFornecedores,
  listarCategorias: mocks.listarCategorias,
  listarCentrosCusto: mocks.listarCentrosCusto,
  criarProduto: mocks.criarProduto,
  editarProduto: mocks.editarProduto,
}));

afterEach(cleanup);

const categorias = [{ id: 11, nome: "Insumos", classificacao: "CUSTEIO" as const, ativo: true, ordem: 0, usoSanitario: false, usoNutricional: true, usoAgricola: false }];
const centros = [{ id: 20, nome: "Atividade leiteira", ativo: true, ordem: 0 }];
const fornecedores = [{ id: 7, nome: "Cooperativa", documento: null, tipo: "FORNECEDOR" as const, telefone: null, email: null, ativo: true, referencias: 0 }];
const produtoCriado = {
  id: 99, nome: "Sal mineral", unidade: "KG",
  categoriaId: 11, categoriaNome: "Insumos", classificacao: "CUSTEIO" as const, ativo: true,
  categoria: { id: 11, nome: "Insumos", usoSanitario: false, usoNutricional: true, usoAgricola: false },
  centroCustoIds: [], centrosCusto: [], fornecedores: [],
};

describe("FormProduto sem props", () => {
  it("carrega fornecedores/categorias/centros do estoque e chama onSalvo com o produto criado", async () => {
    mocks.listarFornecedores.mockResolvedValue(fornecedores);
    mocks.listarCategorias.mockResolvedValue(categorias);
    mocks.listarCentrosCusto.mockResolvedValue(centros);
    mocks.criarProduto.mockResolvedValue(produtoCriado);
    const onSalvo = vi.fn();

    render(<FormProduto produto={null} onSalvo={onSalvo} onFechar={vi.fn()} />);

    await waitFor(() => expect(mocks.listarFornecedores).toHaveBeenCalledTimes(1));
    expect(mocks.listarCategorias).toHaveBeenCalledTimes(1);
    expect(mocks.listarCentrosCusto).toHaveBeenCalledTimes(1);
    await screen.findByText("Cooperativa");

    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Sal mineral" } });
    fireEvent.change(screen.getByLabelText("Unidade"), { target: { value: "KG" } });
    fireEvent.change(screen.getByLabelText(/^Categoria/), { target: { value: "11" } });
    await screen.findByText("Uso nutricional");
    fireEvent.click(screen.getByRole("button", { name: "Criar produto" }));

    await waitFor(() => expect(mocks.criarProduto).toHaveBeenCalledWith(expect.objectContaining({ nome: "Sal mineral", unidade: "KG", categoriaId: 11 })));
    expect(mocks.criarProduto.mock.calls[0][0]).not.toHaveProperty("estocavel");
    expect(screen.queryByLabelText(/Controla estoque/)).toBeNull();
    await waitFor(() => expect(onSalvo).toHaveBeenCalledWith(produtoCriado));
  });

  it("categoria é obrigatória: sem ela não envia e mostra o erro no campo", async () => {
    vi.clearAllMocks();
    mocks.listarFornecedores.mockResolvedValue(fornecedores);
    mocks.listarCategorias.mockResolvedValue(categorias);
    mocks.listarCentrosCusto.mockResolvedValue(centros);

    render(<FormProduto produto={null} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    await screen.findByText("Cooperativa");

    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Sal mineral" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar produto" }));

    expect(await screen.findByText("Produto precisa de uma categoria")).toBeTruthy();
    expect(mocks.criarProduto).not.toHaveBeenCalled();
  });

  it("mostra erro visível quando o carregamento falha", async () => {
    mocks.listarFornecedores.mockRejectedValue(new Error("Falha de rede"));
    mocks.listarCategorias.mockResolvedValue([]);
    mocks.listarCentrosCusto.mockResolvedValue([]);

    render(<FormProduto produto={null} onSalvo={vi.fn()} onFechar={vi.fn()} />);

    expect(await screen.findByText(/Falha de rede/)).toBeTruthy();
  });
});
