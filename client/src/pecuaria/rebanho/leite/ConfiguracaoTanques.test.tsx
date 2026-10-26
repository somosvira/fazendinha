// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfiguracaoTanques } from "./ConfiguracaoTanques";
import { registrarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({ registrarLeite: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);
function abrir() {
  const aoFechar = vi.fn();
  const aoSalvar = vi.fn();
  render(<ConfiguracaoTanques sitio={1} data="2026-10-23" aoFechar={aoFechar} aoSalvar={aoSalvar} />);
  return { aoFechar, aoSalvar };
}
it("fecha o tanque intacto pelo Cancelar sem confirmação", () => {
  const { aoFechar } = abrir();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(aoFechar).toHaveBeenCalledOnce();
  expect(screen.queryByText("Descartar alterações?")).toBeNull();
});
it("Cancelar preserva tabela ao continuar editando e só fecha após descartar", async () => {
  const { aoFechar } = abrir();
  fireEvent.change(screen.getByLabelText("Tabela de conversão — milímetros;litros"), { target: { value: "0;22,5\n100;336,7" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  await screen.findByText("Descartar alterações?");
  expect(aoFechar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect((screen.getByLabelText("Tabela de conversão — milímetros;litros") as HTMLTextAreaElement).value).toBe("0;22,5\n100;336,7");
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  fireEvent.click(await screen.findByRole("button", { name: "Descartar alterações" }));
  expect(aoFechar).toHaveBeenCalledOnce();
});
it("mantém dados após erro, bloqueia fechamento ao enviar e conclui salvamento", async () => {
  let resolver!: (valor: unknown) => void;
  vi.mocked(registrarLeite).mockRejectedValueOnce(new Error("Falha no servidor")).mockImplementationOnce(() => new Promise((resolve) => { resolver = resolve; }));
  const { aoFechar, aoSalvar } = abrir();
  fireEvent.change(screen.getByLabelText("Nome do tanque"), { target: { value: "Tanque A" } });
  fireEvent.change(screen.getByLabelText("Capacidade (L)"), { target: { value: "3000" } });
  fireEvent.change(screen.getByLabelText("Tabela de conversão — milímetros;litros"), { target: { value: "0;22,5" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar tanque" }));
  await screen.findByText("Falha no servidor");
  expect((screen.getByLabelText("Nome do tanque") as HTMLInputElement).value).toBe("Tanque A");
  fireEvent.click(screen.getByRole("button", { name: "Salvar tanque" }));
  expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Cadastrar tanque" }), { key: "Escape" });
  expect(aoFechar).not.toHaveBeenCalled();
  expect(screen.queryByText("Descartar alterações?")).toBeNull();
  resolver({});
  await waitFor(() => expect(aoSalvar).toHaveBeenCalledOnce());
  expect(aoFechar).not.toHaveBeenCalled();
  expect(registrarLeite).toHaveBeenLastCalledWith("/tanques", 1, expect.objectContaining({ nome: "Tanque A", tabelaConversao: [{ mm: 0, litros: 22.5 }] }));
});
