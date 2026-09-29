// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormMaterialGenetico } from "./FormMaterialGenetico";
import { criarMaterialGenetico, editarMaterialGenetico, listarGenitores } from "../api";
import { listarCategorias } from "../../../estoque/api";
import type { GenitorDTO } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  criarMaterialGenetico: vi.fn(),
  editarMaterialGenetico: vi.fn(),
  listarGenitores: vi.fn(),
}));

vi.mock("../../../estoque/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../estoque/api")>()),
  listarCategorias: vi.fn(),
}));

const categoriasGeneticas = [
  { id: "cat-1", nome: "Genética", classificacao: "INVESTIMENTO" as const, ativo: true, ordem: 0, usoAgricola: false, usoGenetico: true },
];

const touroExterno: GenitorDTO = { id: "touro-ext", sexo: "M", nome: "Touro X", codigo: null, fornecedor: null, fornecedorId: null, observacao: null, ativo: true, composicao: [], composicaoRotulo: "", filhos: 0 };
const doadoraExterna: GenitorDTO = { id: "doadora-ext", sexo: "F", nome: "Estrela", codigo: null, fornecedor: null, fornecedorId: null, observacao: null, ativo: true, composicao: [], composicaoRotulo: "", filhos: 0 };

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarCategorias).mockResolvedValue(categoriasGeneticas);
  vi.mocked(listarGenitores).mockImplementation((filtros) => Promise.resolve(filtros?.sexo === "M" ? [touroExterno] : [doadoraExterna]));
});

describe("FormMaterialGenetico — criação", () => {
  it("sêmen: escolhendo touro externo e categoria, envia body sem doadora", async () => {
    vi.mocked(criarMaterialGenetico).mockResolvedValue({} as never);
    const onSalvo = vi.fn();
    render(<FormMaterialGenetico material={null} onSalvo={onSalvo} onFechar={vi.fn()} />);

    await screen.findByText("Genética");
    fireEvent.click(screen.getByRole("button", { name: "Genitor externo" }));
    await screen.findByText("Touro X");
    fireEvent.change(screen.getByLabelText(/Selecionar touro entre os genitores externos/), { target: { value: "touro-ext" } });
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "cat-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar material/ }));

    await waitFor(() => expect(criarMaterialGenetico).toHaveBeenCalledWith({
      tipo: "SEMEN",
      tipoSemen: "CONVENCIONAL",
      touro: { tipo: "EXTERNO", id: "touro-ext" },
      doadora: null,
      observacao: null,
      produto: { nome: undefined, categoriaId: "cat-1" },
    }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
  });

  it("embrião: aceita doadora desconhecida e mantém a escolha de uma doadora conhecida", async () => {
    const onSalvo = vi.fn();
    render(<FormMaterialGenetico material={null} onSalvo={onSalvo} onFechar={vi.fn()} />);

    await screen.findByText("Genética");
    fireEvent.click(screen.getByRole("button", { name: "Embrião" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Genitor externo" })[0]);
    await screen.findByText("Touro X");
    fireEvent.change(screen.getByLabelText(/Selecionar touro entre os genitores externos/), { target: { value: "touro-ext" } });
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "cat-1" } });

    vi.mocked(criarMaterialGenetico).mockResolvedValue({} as never);
    fireEvent.click(screen.getByRole("button", { name: /Criar material/ }));
    await waitFor(() => expect(criarMaterialGenetico).toHaveBeenCalledWith(expect.objectContaining({ doadora: null })));
    vi.mocked(criarMaterialGenetico).mockClear();

    fireEvent.click(screen.getAllByRole("button", { name: "Genitor externo" })[1]);
    await screen.findByText("Estrela");
    fireEvent.change(screen.getByLabelText(/Selecionar doadora entre os genitores externos/), { target: { value: "doadora-ext" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar material/ }));

    await waitFor(() => expect(criarMaterialGenetico).toHaveBeenCalledWith({
      tipo: "EMBRIAO",
      tipoSemen: undefined,
      touro: { tipo: "EXTERNO", id: "touro-ext" },
      doadora: { tipo: "EXTERNO", id: "doadora-ext" },
      observacao: null,
      produto: { nome: undefined, categoriaId: "cat-1" },
    }));
  });
});

describe("FormMaterialGenetico — edição", () => {
  const material = {
    id: "mg1", tipo: "SEMEN" as const, tipoSemen: "CONVENCIONAL" as const,
    touro: { tipo: "EXTERNO" as const, id: "touro-ext", nome: "Touro X", codigo: null },
    doadora: null, observacao: null,
    produto: { id: "p1", nome: "Sêmen Touro X", unidade: "DOSE", ativo: true, categoriaNome: "Genética" },
    saldo: 5,
  };

  it("envia só tipoSemen e observação", async () => {
    vi.mocked(editarMaterialGenetico).mockResolvedValue({} as never);
    const onSalvo = vi.fn();
    render(<FormMaterialGenetico material={material} onSalvo={onSalvo} onFechar={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Tipo de sêmen"), { target: { value: "SEXADO_FEMEA" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(editarMaterialGenetico).toHaveBeenCalledWith("mg1", { tipoSemen: "SEXADO_FEMEA", observacao: null }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
  });

  it("permite identificar depois a doadora de um embrião cadastrado sem ela", async () => {
    vi.mocked(editarMaterialGenetico).mockResolvedValue({} as never);
    render(<FormMaterialGenetico material={{ ...material, tipo: "EMBRIAO", tipoSemen: null, doadora: null }} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Genitor externo" }));
    await screen.findByText("Estrela");
    fireEvent.change(screen.getByLabelText(/Selecionar doadora entre os genitores externos/), { target: { value: "doadora-ext" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(editarMaterialGenetico).toHaveBeenCalledWith("mg1", {
      tipoSemen: undefined, doadora: { tipo: "EXTERNO", id: "doadora-ext" }, observacao: null,
    }));
  });
});
