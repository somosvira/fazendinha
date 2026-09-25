// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormMovimentar } from "./FormMovimentar";
import { movimentarAnimais } from "../api";
import type { AnimalResumo, CatalogoLote, Propriedade } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  movimentarAnimais: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const propriedades: Propriedade[] = [{ id: 1, nome: "Sede", apelido: null }, { id: 2, nome: "Sítio Novo", apelido: null }];
const lotes: CatalogoLote[] = [{ id: "lote-1", nome: "Lote A", propriedadeId: 1 }, { id: "lote-2", nome: "Lote B", propriedadeId: 2 }];

const catVaca = { id: "cat-vaca", nome: "Vaca" };

function criarAnimal(overrides: Partial<AnimalResumo>): AnimalResumo {
  return {
    id: "a1", brinco: "0001", nome: null, sexo: "F", categoria: catVaca, categoriaOrigem: "AUTOMATICA", categoriaCalculada: catVaca, idadeMeses: 30, idadeNaBaixa: false,
    dataNascimento: "2023-01-01", dataEntrada: "2023-01-01", origem: "NASCIDO",
    propriedade: { id: 1, nome: "Sede" }, lote: { id: "lote-1", nome: "Lote A" }, aptidao: "LEITE", papelReprodutivo: "NENHUM",
    composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
    gmdRecente: null, noLocalDesde: null, baixa: null,
    ...overrides,
  };
}

const animal1 = criarAnimal({ id: "a1", brinco: "0001" });
const animal2 = criarAnimal({ id: "a2", brinco: "0002", nome: "Mimosa", lote: null, propriedade: { id: 1, nome: "Sede" } });
const animal3 = criarAnimal({ id: "a3", brinco: "0003" });

describe("FormMovimentar", () => {
  it("ajusta o título ao número de animais selecionados", () => {
    render(<FormMovimentar animais={[animal1]} propriedades={propriedades} lotes={lotes} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Movimentar animal" })).toBeTruthy();
    cleanup();
    render(<FormMovimentar animais={[animal1, animal2, animal3]} propriedades={propriedades} lotes={lotes} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Movimentar 3 animais" })).toBeTruthy();
  });

  it("lista os animais com a localização atual de cada um", () => {
    render(<FormMovimentar animais={[animal1, animal2]} propriedades={propriedades} lotes={lotes} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    expect(screen.getByText("Animais que serão movidos (2)")).toBeTruthy();
    expect(screen.getByText("0001")).toBeTruthy();
    expect(screen.getByText(/está em: Lote A \(Sede\)/)).toBeTruthy();
    expect(screen.getByText(/Mimosa/)).toBeTruthy();
    expect(screen.getByText(/está em: Sede, sem lote/)).toBeTruthy();
  });

  it("tirar um animal da lista remove o id do envio e atualiza o título", async () => {
    const onSalvo = vi.fn();
    render(<FormMovimentar animais={[animal1, animal2]} propriedades={propriedades} lotes={lotes} onSalvo={onSalvo} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Tirar 0002" }));
    expect(screen.getByRole("heading", { name: "Movimentar animal" })).toBeTruthy();
    expect(screen.queryByText(/está em: Sede, sem lote/)).toBeNull();

    fireEvent.change(screen.getByLabelText("Sítio de destino"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Movimentar" }));
    await waitFor(() => expect(movimentarAnimais).toHaveBeenCalledWith(expect.objectContaining({ animalIds: ["a1"] })));
  });

  it("lista vazia desabilita o botão Movimentar e mostra um aviso", () => {
    render(<FormMovimentar animais={[animal1]} propriedades={propriedades} lotes={lotes} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Tirar 0001" }));
    expect((screen.getByRole("button", { name: "Movimentar" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Nenhum animal selecionado/)).toBeTruthy();
    expect(movimentarAnimais).not.toHaveBeenCalled();
  });

  it("exige o sítio de destino antes de confirmar", () => {
    render(<FormMovimentar animais={[animal1]} propriedades={propriedades} lotes={lotes} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Movimentar" }));
    expect(screen.getByText("Selecione o sítio de destino.")).toBeTruthy();
    expect(movimentarAnimais).not.toHaveBeenCalled();
  });

  it("filtra o lote pelo sítio escolhido e envia a movimentação", async () => {
    const onSalvo = vi.fn();
    render(<FormMovimentar animais={[animal1, animal3]} propriedades={propriedades} lotes={lotes} onSalvo={onSalvo} onFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Sítio de destino"), { target: { value: "2" } });
    expect(screen.queryByRole("option", { name: "Lote A" })).toBeNull();
    expect(screen.getByRole("option", { name: "Lote B" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Lote"), { target: { value: "lote-2" } });
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-02-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Movimentar" }));
    await waitFor(() => expect(movimentarAnimais).toHaveBeenCalledWith({ animalIds: ["a1", "a3"], propriedadeId: 2, loteId: "lote-2", data: "2026-02-01", motivo: null }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
  });
});
