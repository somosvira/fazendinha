// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormPesagem } from "./FormPesagem";
import { editarPesagem, registrarPesagemAnimal, RebanhoApiError } from "../api";
import type { Pesagem } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  registrarPesagemAnimal: vi.fn(),
  editarPesagem: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const pesagem: Pesagem = { id: "pesagem-1", animalId: "animal-1", data: "2026-05-01", pesoKg: 210, tipo: "ROTINA", origem: "MANUAL", observacao: "ok" };

describe("FormPesagem — edição", () => {
  it("pré-preenche os campos com a pesagem existente e usa PATCH ao salvar", async () => {
    const onSalvo = vi.fn();
    render(<FormPesagem animalId="animal-1" pesagem={pesagem} onSalvo={onSalvo} onFechar={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Editar pesagem" })).toBeTruthy();
    expect((screen.getByLabelText("Data") as HTMLInputElement).value).toBe("01/05/2026");
    expect((screen.getByLabelText("Peso (kg)") as HTMLInputElement).value).toBe("210");
    fireEvent.change(screen.getByLabelText("Peso (kg)"), { target: { value: "215.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar pesagem" }));
    await waitFor(() => expect(editarPesagem).toHaveBeenCalledWith("pesagem-1", { data: "2026-05-01", pesoKg: 215.5, tipo: "ROTINA", origem: "MANUAL", observacao: "ok" }));
    expect(registrarPesagemAnimal).not.toHaveBeenCalled();
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
  });

  it("recusa peso zero ou negativo", async () => {
    render(<FormPesagem animalId="animal-1" pesagem={pesagem} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Peso (kg)"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar pesagem" }));
    expect(await screen.findByText("Informe um peso maior que zero")).toBeTruthy();
    expect(editarPesagem).not.toHaveBeenCalled();
  });

  it("mostra o erro de campo devolvido pela API", async () => {
    vi.mocked(editarPesagem).mockRejectedValue(new RebanhoApiError("Data da pesagem não pode ser anterior ao nascimento", 422, "VALIDACAO", "data"));
    render(<FormPesagem animalId="animal-1" pesagem={pesagem} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar pesagem" }));
    expect(await screen.findByText("Data da pesagem não pode ser anterior ao nascimento")).toBeTruthy();
  });

  it("cria uma nova pesagem quando não recebe `pesagem`", async () => {
    render(<FormPesagem animalId="animal-1" onSalvo={vi.fn()} onFechar={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Registrar pesagem" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Peso (kg)"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar pesagem" }));
    await waitFor(() => expect(registrarPesagemAnimal).toHaveBeenCalledWith("animal-1", expect.objectContaining({ pesoKg: 50 })));
  });
});
