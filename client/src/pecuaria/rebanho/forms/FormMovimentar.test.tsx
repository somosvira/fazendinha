// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormMovimentar } from "./FormMovimentar";
import { movimentarAnimais } from "../api";
import type { CatalogoLote, Propriedade } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  movimentarAnimais: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const propriedades: Propriedade[] = [{ id: 1, nome: "Sede", apelido: null }, { id: 2, nome: "Sítio Novo", apelido: null }];
const lotes: CatalogoLote[] = [{ id: "lote-1", nome: "Lote A", propriedadeId: 1 }, { id: "lote-2", nome: "Lote B", propriedadeId: 2 }];

describe("FormMovimentar", () => {
  it("ajusta o título ao número de animais selecionados", () => {
    render(<FormMovimentar animalIds={["a1"]} propriedades={propriedades} lotes={lotes} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Movimentar animal" })).toBeTruthy();
    cleanup();
    render(<FormMovimentar animalIds={["a1", "a2", "a3"]} propriedades={propriedades} lotes={lotes} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Movimentar 3 animais" })).toBeTruthy();
  });

  it("exige o sítio de destino antes de confirmar", () => {
    render(<FormMovimentar animalIds={["a1"]} propriedades={propriedades} lotes={lotes} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Movimentar" }));
    expect(screen.getByText("Selecione o sítio de destino.")).toBeTruthy();
    expect(movimentarAnimais).not.toHaveBeenCalled();
  });

  it("filtra o lote pelo sítio escolhido e envia a movimentação", async () => {
    const onSalvo = vi.fn();
    render(<FormMovimentar animalIds={["a1", "a2"]} propriedades={propriedades} lotes={lotes} onSalvo={onSalvo} onFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Sítio de destino"), { target: { value: "2" } });
    expect(screen.queryByRole("option", { name: "Lote A" })).toBeNull();
    expect(screen.getByRole("option", { name: "Lote B" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Lote"), { target: { value: "lote-2" } });
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-02-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Movimentar" }));
    await waitFor(() => expect(movimentarAnimais).toHaveBeenCalledWith({ animalIds: ["a1", "a2"], propriedadeId: 2, loteId: "lote-2", data: "2026-02-01", motivo: null }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
  });
});
