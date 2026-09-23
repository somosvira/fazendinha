// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
    await waitFor(() => expect(screen.queryByText(/Carregando fornecedores/)).toBeNull());
    // Fornecedores e centros são multiselects: as opções só aparecem ao abrir o dropdown.
    fireEvent.click(screen.getByRole("button", { name: "Fornecedores do produto" }));
    fireEvent.click(await screen.findByRole("option", { name: "Cooperativa" }));
    expect(screen.getByRole("button", { name: "Remover Cooperativa" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fornecedores do produto" })); // fecha o dropdown
    await waitFor(() => expect(screen.queryByRole("option", { name: "Cooperativa" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Centros de custo" }));
    fireEvent.click(await screen.findByRole("option", { name: "Atividade leiteira" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Remover Atividade leiteira" })).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Sal mineral" } });
    fireEvent.change(screen.getByLabelText("Unidade"), { target: { value: "KG" } });
    fireEvent.change(screen.getByLabelText(/^Categoria/), { target: { value: "11" } });
    await screen.findByText("Uso nutricional");
    fireEvent.click(screen.getByRole("button", { name: "Criar produto" }));

    await waitFor(() => expect(mocks.criarProduto).toHaveBeenCalledWith(expect.objectContaining({ nome: "Sal mineral", unidade: "KG", categoriaId: 11, fornecedorIds: [7], centroCustoIds: [20] })));
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
    await waitFor(() => expect(mocks.listarFornecedores).toHaveBeenCalled());

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

describe("FormProduto — multiselects de centros e fornecedores", () => {
  it("mostra vínculos inativos como chip rotulado e sem opção nova inativa; enviar mantém os ids", async () => {
    vi.clearAllMocks();
    const centrosMistos = [...centros, { id: 21, nome: "Café antigo", ativo: false, ordem: 1 }, { id: 22, nome: "Descontinuado", ativo: false, ordem: 2 }];
    const parceiros = [...fornecedores, { ...fornecedores[0], id: 8, nome: "Ex-fornecedor", ativo: false }];
    const produto = { ...produtoCriado, unidade: "KG" as const, centroCustoIds: [21], centrosCusto: [{ id: 21, nome: "Café antigo", ativo: false }], fornecedores: [{ id: 8, nome: "Ex-fornecedor", ativo: false }] };
    mocks.editarProduto.mockResolvedValue(produto);
    render(<FormProduto produto={produto} parceiros={parceiros} categorias={categorias} centros={centrosMistos} onSalvo={vi.fn()} onFechar={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Remover Café antigo (inativo)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remover Ex-fornecedor (inativo)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Centros de custo" }));
    expect(await screen.findByRole("option", { name: "Atividade leiteira" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Descontinuado" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Centros de custo" }));

    fireEvent.change(screen.getByLabelText(/^Categoria/), { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar produto" }));
    await waitFor(() => expect(mocks.editarProduto).toHaveBeenCalledWith(99, expect.objectContaining({ centroCustoIds: [21], fornecedorIds: [8] })));
  });

  it("mostra o erro do servidor por campo junto ao multiselect", async () => {
    vi.clearAllMocks();
    const { ApiError } = await import("../estoque/api");
    mocks.criarProduto.mockRejectedValue(new ApiError("Fornecedor inválido", 400, "VALIDACAO", "fornecedorIds"));
    render(<FormProduto produto={null} parceiros={fornecedores} categorias={categorias} centros={centros} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Sal mineral" } });
    fireEvent.change(screen.getByLabelText(/^Categoria/), { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar produto" }));
    const alerta = await screen.findByText("Fornecedor inválido");
    expect(alerta.getAttribute("role")).toBe("alert");
    expect(screen.getByRole("button", { name: "Fornecedores do produto" }).getAttribute("aria-invalid")).toBe("true");
  });
});
