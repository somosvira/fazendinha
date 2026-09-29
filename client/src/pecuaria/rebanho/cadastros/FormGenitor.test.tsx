// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormGenitor } from "./FormGenitor";
import { criarGenitor, editarGenitor, substituirComposicaoGenitor, RebanhoApiError } from "../api";
import { listarFornecedores } from "../../../estoque/api";
import type { GenitorDTO } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  criarGenitor: vi.fn(), editarGenitor: vi.fn(), substituirComposicaoGenitor: vi.fn(),
}));
vi.mock("../../../estoque/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../estoque/api")>()), listarFornecedores: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarFornecedores).mockResolvedValue([
    { id: "fornecedor-1", nome: "Central ABS", tipo: "FORNECEDOR", ativo: true },
  ] as never);
});
afterEach(cleanup);

describe("FormGenitor — fornecedor cadastrado", () => {
  it("seleciona o parceiro e envia seu ID ao criar", async () => {
    vi.mocked(criarGenitor).mockResolvedValue({} as never);
    render(<FormGenitor genitor={null} racas={[]} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    await screen.findByRole("option", { name: "Central ABS" });
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Zeus" } });
    fireEvent.change(screen.getByLabelText("Fornecedor"), { target: { value: "fornecedor-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar genitor" }));
    await waitFor(() => expect(criarGenitor).toHaveBeenCalledWith(expect.objectContaining({ fornecedorId: "fornecedor-1" })));
  });

  it("mantém o texto importado ao editar sem trocar o fornecedor", async () => {
    const genitor: GenitorDTO = { id: "genitor-1", nome: "Zeus", sexo: "M", codigo: null, fornecedor: "Central IDEAGRI", fornecedorId: null, observacao: null, ativo: true, composicao: [], composicaoRotulo: "", filhos: 0 };
    vi.mocked(editarGenitor).mockResolvedValue({} as never);
    vi.mocked(substituirComposicaoGenitor).mockResolvedValue({} as never);
    render(<FormGenitor genitor={genitor} racas={[]} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    await screen.findByRole("option", { name: "Central IDEAGRI (sem vínculo cadastrado)" });
    fireEvent.click(screen.getByRole("button", { name: "Salvar genitor" }));
    await waitFor(() => expect(editarGenitor).toHaveBeenCalledWith("genitor-1", expect.not.objectContaining({ fornecedorId: expect.anything() })));
  });

  it("mostra no campo Sexo por que uma doadora usada em material não pode virar macho", async () => {
    const genitor: GenitorDTO = { id: "doadora-1", nome: "Doadora", sexo: "F", codigo: null, fornecedor: null, fornecedorId: null, observacao: null, ativo: true, composicao: [], composicaoRotulo: "", filhos: 0 };
    vi.mocked(editarGenitor).mockRejectedValue(new RebanhoApiError("Esta doadora é usada em material genético", 409, "CONFLITO", "sexo"));
    render(<FormGenitor genitor={genitor} racas={[]} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    await screen.findByRole("option", { name: "Central ABS" });
    fireEvent.change(screen.getByLabelText("Sexo"), { target: { value: "M" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar genitor" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Esta doadora é usada em material genético");
    expect(screen.getByLabelText("Sexo").getAttribute("aria-invalid")).toBe("true");
  });
});
