// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConfiguracoesPecuaria } from "./ConfiguracoesPecuaria";
vi.mock("../pecuaria/rebanho/protocolos/cadastros-api", () => ({ listarCadastrosProtocolos: vi.fn().mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 }), obterCadastroProtocolo: vi.fn(), obterAcoesCadastro: vi.fn() }));
afterEach(cleanup);
it("Voltar da página de novo protocolo aguarda confirmação e cancelar preserva a edição e a rota", async () => {
  const nova = "/configuracoes/pecuaria/sanidade/protocolos/novo";
  const lista = "/configuracoes/pecuaria/sanidade/protocolos";
  window.history.replaceState(null, "", nova);
  render(<ConfiguracoesPecuaria podeLancar />);
  fireEvent.click(screen.getByRole("radio", { name: /Começar do zero/ }));
  fireEvent.click(screen.getByRole("button", { name: "Definir novo protocolo" }));
  fireEvent.change(screen.getByLabelText("Nome do protocolo"), { target: { value: "Edição em campo" } });
  window.history.pushState(null, "", lista);
  fireEvent(window, new PopStateEvent("popstate"));
  const dialogo = await screen.findByRole("dialog");
  fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(window.location.pathname).toBe(nova));
  expect(screen.getByLabelText("Nome do protocolo")).toHaveProperty("value", "Edição em campo");
  window.history.pushState(null, "", lista);
  fireEvent(window, new PopStateEvent("popstate"));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Sair sem salvar" }));
  await screen.findByRole("heading", { name: "Protocolos sanitários", level: 1 });
  expect(window.location.pathname).toBe(lista);
  expect(screen.queryByLabelText("Nome do protocolo")).toBeNull();
});
