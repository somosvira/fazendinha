// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FormDadosAnimal } from "./FormDadosAnimal";
import { editarAnimal, RebanhoApiError } from "../api";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()), editarAnimal: vi.fn(),
}));
afterEach(cleanup);

it("mostra no campo Sexo a recusa de trocar o sexo de uma mãe", async () => {
  vi.mocked(editarAnimal).mockRejectedValue(new RebanhoApiError("Este animal já é mãe de outros animais", 409, "CONFLITO", "sexo"));
  render(<FormDadosAnimal animal={{
    id: "animal-1", brinco: "N302", nome: "Estrela", brincoEletronico: null, sisbov: null,
    sexo: "F", dataNascimento: "2025-05-01", nascimentoEstimado: false,
    origem: "NASCIDO", dataEntrada: "2025-05-01", partosAntesDaEntrada: 0, observacao: null,
  } as never} onSalvo={vi.fn()} onFechar={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Sexo"), { target: { value: "M" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar dados" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Este animal já é mãe de outros animais");
  expect(screen.getByLabelText("Sexo").getAttribute("aria-invalid")).toBe("true");
});
