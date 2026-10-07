// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormProduto } from "./FormProduto";
import { uid } from "../lib/uid.fixture";

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

const categorias = [{ id: uid(11), nome: "Insumos", classificacao: "CUSTEIO" as const, ativo: true, ordem: 0, usoAgricola: true, usoGenetico: false }];
const centros = [{ id: uid(20), nome: "Atividade leiteira", ativo: true, ordem: 0 }];
const fornecedores = [{ id: uid(7), nome: "Cooperativa", documento: null, tipo: "FORNECEDOR" as const, telefone: null, email: null, ativo: true, referencias: 0 }];
const produtoCriado = {
  id: uid(99), nome: "Sal mineral", unidade: "KG",
  categoriaId: uid(11), categoriaNome: "Insumos", classificacao: "CUSTEIO" as const, ativo: true,
  categoria: { id: uid(11), nome: "Insumos", usoAgricola: true, usoGenetico: false },
  centroCustoIds: [], centrosCusto: [], fornecedores: [],
};

describe("tipos de uso e validação dos perfis", () => {
  it("editar categoria conserva usos e perfil, sem reenviar referência técnica histórica", async () => {
    const produto = { ...produtoCriado, unidade: "ML" as const, rastrearPartidas: true, usoSanitario: true, perfilSanitario: { carenciaLeiteHoras: 0, carenciaCarneHoras: 48, viaPadrao: "Intramuscular", referenciaTecnica: "Referência histórica" } };
    mocks.editarProduto.mockResolvedValue(produto);
    render(<FormProduto produto={produto} categorias={[...categorias, { ...categorias[0], id: uid(12), nome: "Nutrição" }]} centros={[]} parceiros={[]} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    expect(screen.queryByLabelText(/Referência técnica/)).toBeNull();
    expect((screen.getByLabelText("Controlar lotes por validade") as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: uid(12) } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar produto" }));
    await waitFor(() => expect(mocks.editarProduto).toHaveBeenCalledWith(produto.id, expect.objectContaining({
      categoriaId: uid(12), usoSanitario: true,
      perfilSanitario: { carenciaLeiteHoras: 0, carenciaCarneHoras: 48, viaPadrao: "Intramuscular" },
    })));
  });
  beforeEach(() => { vi.clearAllMocks(); mocks.criarProduto.mockResolvedValue(produtoCriado); });
  const montar = () => {
    render(<FormProduto produto={null} categorias={categorias} centros={[]} parceiros={[]} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Produto de teste" } });
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: uid(11) } });
    fireEvent.click(screen.getByLabelText("Nutricional"));
  };
  it.each(["-1", "101", "abc", "90,255"])("recusa MS %s no campo e mantém o formulário", async (valor) => {
    montar(); fireEvent.change(screen.getByLabelText("Matéria seca (%)"), { target: { value: valor } });
    fireEvent.click(screen.getByRole("button", { name: "Criar produto" }));
    expect(await screen.findByText("Informe a matéria seca entre 0% e 100%.")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Matéria seca (%)")));
    expect(mocks.criarProduto).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Nome do produto") as HTMLInputElement).value).toBe("Produto de teste");
  });
  it.each([["0", 0], ["100", 100], ["90,25", 90.25], ["", null]])("aceita MS %s preservando o significado", async (valor, esperado) => {
    montar(); fireEvent.change(screen.getByLabelText("Matéria seca (%)"), { target: { value: valor } });
    fireEvent.click(screen.getByLabelText("Sanitário"));
    fireEvent.click(screen.getByLabelText("Controlar lotes por validade"));
    fireEvent.click(screen.getByRole("button", { name: "Criar produto" }));
    await waitFor(() => expect(mocks.criarProduto).toHaveBeenCalledWith(expect.objectContaining({ usoNutricional: true, usoSanitario: true, usoAgricola: false, rastrearPartidas: true, perfilNutricional: { materiaSecaPercentual: esperado } })));
  });
});

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
    fireEvent.change(screen.getByLabelText(/^Categoria/), { target: { value: uid(11) } });
    fireEvent.click(screen.getByLabelText("Agrícola"));
    fireEvent.click(screen.getByRole("button", { name: "Criar produto" }));

    await waitFor(() => expect(mocks.criarProduto).toHaveBeenCalledWith(expect.objectContaining({ nome: "Sal mineral", unidade: "KG", categoriaId: uid(11), fornecedorIds: [uid(7)], centroCustoIds: [uid(20)] })));
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
    const centrosMistos = [...centros, { id: uid(21), nome: "Café antigo", ativo: false, ordem: 1 }, { id: uid(22), nome: "Descontinuado", ativo: false, ordem: 2 }];
    const parceiros = [...fornecedores, { ...fornecedores[0], id: uid(8), nome: "Ex-fornecedor", ativo: false }];
    const produto = { ...produtoCriado, unidade: "KG" as const, centroCustoIds: [uid(21)], centrosCusto: [{ id: uid(21), nome: "Café antigo", ativo: false }], fornecedores: [{ id: uid(8), nome: "Ex-fornecedor", ativo: false }] };
    mocks.editarProduto.mockResolvedValue(produto);
    render(<FormProduto produto={produto} parceiros={parceiros} categorias={categorias} centros={centrosMistos} onSalvo={vi.fn()} onFechar={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Remover Café antigo (inativo)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remover Ex-fornecedor (inativo)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Centros de custo" }));
    expect(await screen.findByRole("option", { name: "Atividade leiteira" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Descontinuado" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Centros de custo" }));

    fireEvent.change(screen.getByLabelText(/^Categoria/), { target: { value: uid(11) } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar produto" }));
    await waitFor(() => expect(mocks.editarProduto).toHaveBeenCalledWith(uid(99), expect.objectContaining({ centroCustoIds: [uid(21)], fornecedorIds: [uid(8)] })));
  });

  it("mostra o erro do servidor por campo junto ao multiselect", async () => {
    vi.clearAllMocks();
    const { ApiError } = await import("../estoque/api");
    mocks.criarProduto.mockRejectedValue(new ApiError("Fornecedor inválido", 400, "VALIDACAO", "fornecedorIds"));
    render(<FormProduto produto={null} parceiros={fornecedores} categorias={categorias} centros={centros} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nome do produto"), { target: { value: "Sal mineral" } });
    fireEvent.change(screen.getByLabelText(/^Categoria/), { target: { value: uid(11) } });
    fireEvent.click(screen.getByRole("button", { name: "Criar produto" }));
    const alerta = await screen.findByText("Fornecedor inválido");
    expect(alerta.getAttribute("role")).toBe("alert");
    expect(screen.getByRole("button", { name: "Fornecedores do produto" }).getAttribute("aria-invalid")).toBe("true");
  });
});
