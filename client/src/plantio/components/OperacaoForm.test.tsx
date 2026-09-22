// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";

const apiMocks = vi.hoisted(() => ({
  registrarOperacao: vi.fn(),
}));

const rebanhoApiMocks = vi.hoisted(() => ({
  listarCentrosCusto: vi.fn(),
  produtos: [
    {
      id: 1, nome: "Calcário dolomítico", tipo: "INSUMO", subtipoPlantio: "CORRETIVO", unidade: "t",
      custoUnitario: null, carencia: null, percentualMS: null, estocavel: true, minimoEstoque: null, ativo: true,
      categoriaId: null, categoriaNome: null, classificacao: null,
      centroCustoIds: [7], centrosCusto: [{ id: 7, nome: "Talhões — insumos", ativo: true }],
    },
    {
      id: 2, nome: "Produto sem centro único", tipo: "INSUMO", subtipoPlantio: "FERTILIZANTE", unidade: "kg",
      custoUnitario: null, carencia: null, percentualMS: null, estocavel: true, minimoEstoque: null, ativo: true,
      categoriaId: null, categoriaNome: null, classificacao: null,
      centroCustoIds: [7, 8], centrosCusto: [{ id: 7, nome: "Talhões — insumos", ativo: true }, { id: 8, nome: "Outro centro", ativo: true }],
    },
  ],
}));

vi.mock("../api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api")>(),
  registrarOperacao: apiMocks.registrarOperacao,
}));

vi.mock("../../rebanho/api", () => ({
  useProdutos: () => ({ data: rebanhoApiMocks.produtos, loading: false, erro: null }),
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
    { id: 7, nome: "Talhões — insumos" },
    { id: 8, nome: "Outro centro" },
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
    selectByLabel("Produto do estoque", "1");

    await waitFor(() => expect((screen.getByPlaceholderText("Ex.: Calcário dolomítico PRNT 85%") as HTMLInputElement).value).toBe("Calcário dolomítico"));
    const centro = screen.getByLabelText("Centro de custo") as HTMLSelectElement;
    await waitFor(() => expect(centro.value).toBe("7"));
  });

  it("mostra a baixa estimada como dose × área e permite sobrescrever com quantidade total", async () => {
    render(createElement(OperacaoForm, base));
    fireEvent.change(screen.getByLabelText("Tipo de operação"), { target: { value: "CALAGEM" } });

    selectByLabel("Produto do estoque", "1");
    fireEvent.change(screen.getByPlaceholderText("Ex.: 2,5"), { target: { value: "2" } });

    // dose "2" sem unidade — mas o campo dose é "t/ha" por rótulo; parseDose não infere
    // unidade a partir do rótulo, então usamos texto com unidade explícita.
    fireEvent.change(screen.getByPlaceholderText("Ex.: 2,5"), { target: { value: "2 t/ha" } });
    await screen.findByText(/Baixa estimada:/);
    expect(screen.getByText(/Baixa estimada:/).textContent).toContain("10");
    expect(screen.getByText(/Baixa estimada:/).textContent).toContain("t");

    fireEvent.change(screen.getByLabelText("Quantidade total (sobrescreve a estimativa)"), { target: { value: "3" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(apiMocks.registrarOperacao).toHaveBeenCalledWith("1", expect.objectContaining({
      produtoId: 1,
      quantidadeTotal: 3,
      centroCustoId: 7,
    })));
  });
});
