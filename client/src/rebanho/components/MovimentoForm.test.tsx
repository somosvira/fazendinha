// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ listar: vi.fn(), ajustar: vi.fn(), propriedades: vi.fn() }));
vi.mock("../api", () => ({ listarSaldos: mocks.listar, ajustarContagem: mocks.ajustar, listarPropriedades: mocks.propriedades }));
vi.mock("./ProdutoForm", () => ({ ProdutoForm: () => null }));
import { MovimentoForm } from "./MovimentoForm";
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.propriedades.mockResolvedValue([{ id: 1 }]); mocks.listar.mockResolvedValue([{ produtoId: 1, nome: "Ração", unidade: "kg", saldo: 12 }]); });
async function preencher(contada = "10") {
  render(<MovimentoForm onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await screen.findByRole("option", { name: "Ração (kg)" });
  fireEvent.change(screen.getByLabelText("Produto"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Quantidade encontrada na contagem"), { target: { value: contada } });
  fireEvent.change(screen.getByLabelText("Justificativa"), { target: { value: "Contagem conferida" } });
}
describe("ajustar quantidade pelo estoque", () => {
  it("mostra diferença e envia contagem absoluta, protegendo clique duplicado", async () => {
    mocks.ajustar.mockReturnValue(new Promise(() => {}));
    await preencher();
    expect(screen.getByText("Diferença: -2 kg")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Confirmar ajuste" });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.ajustar).toHaveBeenCalledTimes(1);
    expect(mocks.ajustar).toHaveBeenCalledWith({ produtoId: 1, quantidadeContada: 10, saldoEsperado: 12, observacao: "Contagem conferida" });
    expect(screen.queryByText("Gerar lançamento financeiro")).toBeNull();
  });
  it("permite zerar o estoque", async () => {
    await preencher("0");
    expect((screen.getByRole("button", { name: "Confirmar ajuste" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("Diferença: -12 kg")).toBeTruthy();
  });
  it("não cria ajuste sem diferença", async () => {
    await preencher("12");
    expect(screen.getByText("Nenhum ajuste necessário")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Confirmar ajuste" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("preserva contagem e motivo após conflito e permite revisar saldo atualizado", async () => {
    mocks.ajustar.mockRejectedValue(new Error("O estoque mudou. Atualize o saldo."));
    await preencher(); fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await screen.findByRole("alert");
    mocks.listar.mockResolvedValue([{ produtoId: 1, nome: "Ração", unidade: "kg", saldo: 15 }]);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar saldo" }));
    await waitFor(() => expect(screen.getByText("Diferença: -5 kg")).toBeTruthy());
    expect((screen.getByLabelText("Quantidade encontrada na contagem") as HTMLInputElement).value).toBe("10");
    expect((screen.getByLabelText("Justificativa") as HTMLTextAreaElement).value).toBe("Contagem conferida");
  });
});

it("bloqueia a contagem consolidada antes de consultar o saldo agregado", async () => {
  mocks.propriedades.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  render(<MovimentoForm onFechar={vi.fn()} onSalvo={vi.fn()} />);
  expect((await screen.findByRole("alert")).textContent).toContain("Selecione uma fazenda");
  expect(mocks.listar).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Confirmar ajuste" })).toBeNull();
  expect(mocks.ajustar).not.toHaveBeenCalled();
});
