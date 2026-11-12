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

it("abre somente as configurações de Reprodução e preserva o sítio nos destinos", () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao?sitio=7");
  render(<ConfiguracoesPecuaria podeLancar />);
  expect(screen.getByRole("heading", {name:"Configurações da Reprodução"})).toBeTruthy();
  expect(screen.queryByRole("heading", {name:"Nutrição"})).toBeNull();
  const itens = screen.getAllByRole("link").filter(a => a.getAttribute("href")?.startsWith("/configuracoes/pecuaria/reproducao/"));
  expect(itens).toHaveLength(6);
  expect(itens.every(a => a.getAttribute("href")?.endsWith("?sitio=7"))).toBe(true);
  expect(screen.getByRole("link", {name:"Voltar à Reprodução"}).getAttribute("href")).toBe("/pecuaria/reproducao?sitio=7");
});
