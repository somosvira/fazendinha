// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";

// Module-level UUID constants for use in tests
const prod1 = "00000000-0000-0001-8000-000000000001";
const prod2 = "00000000-0000-0002-8000-000000000002";
const prod3 = "00000000-0000-0003-8000-000000000003";
const centro7 = "00000000-0000-0007-8000-000000000007";
const centro8 = "00000000-0000-0008-8000-000000000008";
const cat10 = "00000000-0000-000a-8000-00000000000a";
const cat11 = "00000000-0000-000b-8000-00000000000b";

const apiMocks = vi.hoisted(() => ({
  registrarOperacao: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({ warn: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/Toast", () => ({ useToast: () => toastMocks }));

const rebanhoApiMocks = vi.hoisted(() => ({
  listarCentrosCusto: vi.fn(),
  produtos: [
    {
      id: "00000000-0000-0001-8000-000000000001", nome: "Calcário dolomítico", unidade: "T",
      minimoEstoque: null, ativo: true,
      categoriaId: "00000000-0000-000a-8000-00000000000a", categoriaNome: "Fertilizantes e corretivos", classificacao: null,
      categoria: { id: "00000000-0000-000a-8000-00000000000a", nome: "Fertilizantes e corretivos", usoAgricola: true },
      centroCustoIds: ["00000000-0000-0007-8000-000000000007"], centrosCusto: [{ id: "00000000-0000-0007-8000-000000000007", nome: "Talhões — insumos", ativo: true }],
    },
    {
      id: "00000000-0000-0002-8000-000000000002", nome: "Produto sem centro único", unidade: "KG",
      minimoEstoque: null, ativo: true,
      categoriaId: "00000000-0000-000a-8000-00000000000a", categoriaNome: "Fertilizantes e corretivos", classificacao: null,
      categoria: { id: "00000000-0000-000a-8000-00000000000a", nome: "Fertilizantes e corretivos", usoAgricola: true },
      centroCustoIds: ["00000000-0000-0007-8000-000000000007", "00000000-0000-0008-8000-000000000008"], centrosCusto: [{ id: "00000000-0000-0007-8000-000000000007", nome: "Talhões — insumos", ativo: true }, { id: "00000000-0000-0008-8000-000000000008", nome: "Outro centro", ativo: true }],
    },
    {
      id: "00000000-0000-0003-8000-000000000003", nome: "Herbicida líquido", unidade: "L",
      minimoEstoque: null, ativo: true,
      categoriaId: "00000000-0000-000b-8000-00000000000b", categoriaNome: "Defensivos", classificacao: null,
      categoria: { id: "00000000-0000-000b-8000-00000000000b", nome: "Defensivos", usoAgricola: true },
      centroCustoIds: ["00000000-0000-0007-8000-000000000007"], centrosCusto: [{ id: "00000000-0000-0007-8000-000000000007", nome: "Talhões — insumos", ativo: true }],
    },
  ],
}));

vi.mock("../api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api")>(),
  registrarOperacao: apiMocks.registrarOperacao,
}));

vi.mock("../../estoque/api", () => ({
  useProdutosEstoque: () => ({ data: rebanhoApiMocks.produtos, loading: false, erro: null }),
  listarCentrosCusto: rebanhoApiMocks.listarCentrosCusto,
}));

import { OperacaoForm } from "./OperacaoForm";

const talhao = {
  id: "1", codigo: "CAF-12", nome: "Cafundó alto", variedade: "CATUAI_VERMELHO" as any,
  espacamento: "3,80 × 0,60 m", plantasHa: 4386, areaHa: 5, anoPlantio: 2018, altitude: 900,
  irrigado: false, estado: "ATIVO" as any, lavoura: "Cafundó", dataPlantio: "2018-01-01",
};

const base = { talhaoId: "1", talhao, dominioFixo: "nutricao" as const, onFechar: vi.fn(), onSalvo: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  rebanhoApiMocks.listarCentrosCusto.mockResolvedValue([
    { id: centro7, nome: "Talhões — insumos" },
    { id: centro8, nome: "Outro centro" },
  ]);
});

afterEach(cleanup);

function selectByLabel(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { selector: "select" }), { target: { value } });
}

describe("OperacaoForm — baixa de estoque", () => {
  it("selecionar produto preenche o nome livre e o centro único do produto", async () => {
    render(createElement(OperacaoForm, base));

    // domínio nutrição fixo → CALAGEM já é a 3ª opção, troca pra CALAGEM pra abrir campo Produto
    fireEvent.change(screen.getByLabelText("Tipo de operação"), { target: { value: "CALAGEM" } });

    await screen.findByLabelText("Produto do estoque");
    selectByLabel("Produto do estoque", prod1);

    await waitFor(() => expect((screen.getByPlaceholderText("Ex.: Calcário dolomítico PRNT 85%") as HTMLInputElement).value).toBe("Calcário dolomítico"));
    const centro = screen.getByLabelText("Centro de custo") as HTMLSelectElement;
    await waitFor(() => expect(centro.value).toBe(centro7));
  });

  it("mostra a baixa estimada como dose × área (mesma unidade do produto) e permite sobrescrever com quantidade total", async () => {
    render(createElement(OperacaoForm, base));
    fireEvent.change(screen.getByLabelText("Tipo de operação"), { target: { value: "CALAGEM" } });

    selectByLabel("Produto do estoque", prod1); // Calcário dolomítico, unidade T
    fireEvent.change(screen.getByPlaceholderText("Ex.: 2,5"), { target: { value: "2" } });
    selectByLabel("Unidade da dose", "T");
    // checkbox "por hectare" já vem marcado por padrão

    await screen.findByText(/Baixa estimada:/);
    expect(screen.getByText(/Baixa estimada:/).textContent).toContain("10");
    expect(screen.getByText(/Baixa estimada:/).textContent).toContain("t");

    fireEvent.change(screen.getByLabelText("Quantidade total (sobrescreve a estimativa)"), { target: { value: "3" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(apiMocks.registrarOperacao).toHaveBeenCalledWith("1", expect.objectContaining({
      produtoId: prod1,
      quantidadeTotal: 3,
      centroCustoId: centro7,
    })));
  });

  it("mostra o aviso do servidor quando a aplicação foi salva sem baixa de estoque", async () => {
    apiMocks.registrarOperacao.mockResolvedValueOnce({ id: "op-1", aviso: "Produto sem entrada nesta fazenda: a aplicação foi registrada sem baixa de estoque." });
    render(createElement(OperacaoForm, base));
    fireEvent.change(screen.getByLabelText("Tipo de operação"), { target: { value: "CALAGEM" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(toastMocks.warn).toHaveBeenCalledWith(
      "Aplicação registrada sem baixa de estoque",
      expect.stringContaining("sem baixa de estoque"),
    ));
  });

  it("não mostra aviso quando a resposta não traz aviso", async () => {
    apiMocks.registrarOperacao.mockResolvedValueOnce({ id: "op-2" });
    render(createElement(OperacaoForm, base));
    fireEvent.change(screen.getByLabelText("Tipo de operação"), { target: { value: "CALAGEM" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(apiMocks.registrarOperacao).toHaveBeenCalled());
    expect(toastMocks.warn).not.toHaveBeenCalled();
  });

  it("200 mL/ha × 5 ha, produto em L → baixa 1 L", async () => {
    render(createElement(OperacaoForm, base));
    fireEvent.change(screen.getByLabelText("Tipo de operação"), { target: { value: "CALAGEM" } });

    selectByLabel("Produto do estoque", prod3); // Herbicida líquido, unidade L
    fireEvent.change(screen.getByPlaceholderText("Ex.: 2,5"), { target: { value: "200" } });
    selectByLabel("Unidade da dose", "ML");
    // checkbox "por hectare" já vem marcado por padrão (área do talhão = 5 ha)

    await screen.findByText(/Baixa estimada:/);
    const texto = screen.getByText(/Baixa estimada:/).textContent ?? "";
    expect(texto).toContain("1");
    expect(texto).toContain("L");

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(apiMocks.registrarOperacao).toHaveBeenCalledWith("1", expect.objectContaining({
      produtoId: prod3,
      doseValor: 200,
      doseUnidadeMedida: "ML",
      dosePorHectare: true,
    })));
  });

  it("selecionar produto inicializa a unidade da dose com a unidade do produto (antes de o usuário mexer nela)", async () => {
    render(createElement(OperacaoForm, base));
    fireEvent.change(screen.getByLabelText("Tipo de operação"), { target: { value: "CALAGEM" } });

    selectByLabel("Produto do estoque", prod3); // Herbicida líquido, unidade L
    await waitFor(() => expect((screen.getByLabelText("Unidade da dose") as HTMLSelectElement).value).toBe("L"));
  });

  it("depois que o usuário escolhe a unidade da dose, trocar de produto não sobrescreve mais", async () => {
    render(createElement(OperacaoForm, base));
    fireEvent.change(screen.getByLabelText("Tipo de operação"), { target: { value: "CALAGEM" } });

    selectByLabel("Unidade da dose", "ML"); // usuário mexe na unidade antes de escolher o produto
    selectByLabel("Produto do estoque", prod1); // Calcário dolomítico, unidade T
    await waitFor(() => expect((screen.getByLabelText("Produto do estoque") as HTMLSelectElement).value).toBe(prod1));
    expect((screen.getByLabelText("Unidade da dose") as HTMLSelectElement).value).toBe("ML");
  });

  it("dose em mL para produto em kg — bases diferentes, mostra erro e não estima baixa", async () => {
    render(createElement(OperacaoForm, base));
    fireEvent.change(screen.getByLabelText("Tipo de operação"), { target: { value: "CALAGEM" } });

    selectByLabel("Produto do estoque", prod2); // Produto sem centro único, unidade KG
    fireEvent.change(screen.getByPlaceholderText("Ex.: 2,5"), { target: { value: "200" } });
    selectByLabel("Unidade da dose", "ML");

    await waitFor(() => expect(screen.getByText(/não pode ser convertida/)).toBeTruthy());
    expect(screen.queryByText(/Baixa estimada:/)).toBeNull();
  });
});
