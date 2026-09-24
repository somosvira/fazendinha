// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NovoAnimal } from "./NovoAnimal";
import { cadastrarAnimal, listarCategorias, obterCatalogos } from "../api";
import type { Catalogos } from "../types";
import { navegarPara } from "../../../router";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  obterCatalogos: vi.fn(),
  listarCategorias: vi.fn(),
  cadastrarAnimal: vi.fn(),
}));
vi.mock("../../../router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../router")>()),
  navegarPara: vi.fn(),
}));
vi.mock("../../../propriedadeScope", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../propriedadeScope")>()),
  getPropriedadeAtiva: () => null,
}));

const catalogos: Catalogos = {
  racas: [{ id: "raca-1", nome: "Nelore", sigla: "NE", base: true }],
  motivosBaixa: [],
  propriedades: [{ id: 1, nome: "Sede", apelido: null }],
  lotes: [{ id: "lote-1", nome: "Lote A", propriedadeId: 1 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(obterCatalogos).mockResolvedValue(catalogos);
  vi.mocked(listarCategorias).mockResolvedValue({ itens: [], semCategoria: 0 });
});
afterEach(cleanup);

async function montar() {
  render(<NovoAnimal onVoltar={vi.fn()} />);
  await screen.findByRole("heading", { name: "Novo animal" });
  await screen.findByLabelText("Sítio");
}

describe("NovoAnimal", () => {
  it("mostra erros de validação ao submeter sem brinco, nascimento ou sítio", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Salvar animal" }));
    expect(await screen.findByText("Informe o brinco")).toBeTruthy();
    expect(screen.getByText("Selecione o sítio")).toBeTruthy();
    expect(cadastrarAnimal).not.toHaveBeenCalled();
  });

  it("trava a data de entrada igual ao nascimento quando a origem é nascido na propriedade", async () => {
    await montar();
    const nascimento = screen.getByLabelText("Data de nascimento") as HTMLInputElement;
    const entrada = screen.getByLabelText("Data de entrada") as HTMLInputElement;
    expect(entrada.disabled).toBe(true);
    fireEvent.change(nascimento, { target: { value: "2024-01-10" } });
    expect(entrada.value).toBe("2024-01-10");
    fireEvent.change(screen.getByLabelText("Origem"), { target: { value: "COMPRADO" } });
    expect(entrada.disabled).toBe(false);
  });

  it("trocar o sexo para macho esconde e zera papel reprodutivo e partos (R1)", async () => {
    vi.mocked(cadastrarAnimal).mockResolvedValue({
      id: "animal-2", brinco: "boi-1", nome: null, sexo: "M", categoria: null, categoriaOrigem: "SEM_CATEGORIA", categoriaCalculada: null, idadeMeses: 0, idadeNaBaixa: false,
      dataNascimento: "2026-01-01", dataEntrada: "2026-01-01", origem: "NASCIDO", propriedade: { id: 1, nome: "Sede" },
      lote: null, aptidao: "CORTE", papelReprodutivo: "NENHUM", composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
      brincoEletronico: null, sisbov: null, nascimentoEstimado: false, partosAntesDaEntrada: 0, observacao: null,
      composicao: [], historicoLocalizacoes: [], historicoDestinos: [], historicoPesagens: [], historicoCategoriasManuais: [], baixa: null,
    });
    await montar();
    // fêmea: papel e partos aparecem; troca o papel antes de trocar de sexo
    expect(screen.getByLabelText("Papel reprodutivo")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Papel reprodutivo"), { target: { value: "RECEPTORA" } });
    fireEvent.change(screen.getByLabelText("Partos antes da entrada"), { target: { value: "2" } });

    fireEvent.change(screen.getByLabelText("Sexo"), { target: { value: "M" } });
    expect(screen.queryByLabelText("Papel reprodutivo")).toBeNull();
    expect(screen.queryByLabelText("Partos antes da entrada")).toBeNull();

    fireEvent.change(screen.getByLabelText("Brinco"), { target: { value: "boi-1" } });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Sítio"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar animal" }));
    await waitFor(() => expect(cadastrarAnimal).toHaveBeenCalledWith(expect.objectContaining({
      sexo: "M", papelReprodutivo: "NENHUM", partosAntesDaEntrada: 0,
    })));
  });

  it("filtra o lote pelo sítio selecionado e envia o cadastro completo", async () => {
    vi.mocked(cadastrarAnimal).mockResolvedValue({
      id: "animal-1", brinco: "1234", nome: null, sexo: "F", categoria: { id: "cat-crescimento", nome: "Em crescimento" }, categoriaOrigem: "AUTOMATICA", categoriaCalculada: { id: "cat-crescimento", nome: "Em crescimento" }, idadeMeses: 0, idadeNaBaixa: false,
      dataNascimento: "2026-01-01", dataEntrada: "2026-01-01", origem: "NASCIDO", propriedade: { id: 1, nome: "Sede" },
      lote: null, aptidao: "LEITE", papelReprodutivo: "NENHUM", composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
      brincoEletronico: null, sisbov: null, nascimentoEstimado: false, partosAntesDaEntrada: 0, observacao: null,
      composicao: [], historicoLocalizacoes: [], historicoDestinos: [], historicoPesagens: [], historicoCategoriasManuais: [], baixa: null,
    });
    await montar();
    fireEvent.change(screen.getByLabelText("Brinco"), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Sítio"), { target: { value: "1" } });
    expect(screen.getByRole("option", { name: "Lote A" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Lote"), { target: { value: "lote-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar animal" }));
    await waitFor(() => expect(cadastrarAnimal).toHaveBeenCalledWith(expect.objectContaining({
      brinco: "1234", dataNascimento: "2026-01-01", dataEntrada: "2026-01-01", propriedadeId: 1, loteId: "lote-1", aptidao: "LEITE",
    })));
    expect(navegarPara).toHaveBeenCalledWith("/pecuaria/rebanho/animais/animal-1");
  });
});
