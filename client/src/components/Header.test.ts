// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { Header } from "./Header";
import type { User } from "../data/acessos";

afterEach(cleanup);

const proprietario: User = {
  id: "u1",
  nome: "Marco Antônio",
  email: "marco@riovono.com",
  inicial: "M",
  papel: "proprietario",
  status: "ativo",
  ultimoAcesso: "hoje",
  abas: [],
  flags: [],
};

function baseProps() {
  return {
    user: proprietario,
    mobileOpen: false,
    onMobileToggle: vi.fn(),
    onAbrirBusca: vi.fn(),
    onPreferencias: vi.fn(),
    onSair: vi.fn(),
  };
}

describe("Header", () => {
  it("abre o menu de conta (ações da conta, não troca de usuário)", async () => {
    const props = baseProps();
    render(h(Header, props));

    // Radix DropdownMenuTrigger abre no pointerdown (não click) — jsdom precisa
    // do pointer event explícito para disparar o estado aberto.
    const trigger = screen.getByLabelText("Menu da conta");
    fireEvent.pointerDown(trigger, { button: 0 });

    // o menu traz só AÇÕES funcionais da conta — nunca outro usuário
    // (Meu perfil / Central de ajuda eram mock e foram removidos)
    expect(await screen.findByText("Preferências")).toBeTruthy();
    expect(screen.getByText("Sair")).toBeTruthy();
  });

  it("chama onSair ao clicar em Sair", async () => {
    const props = baseProps();
    render(h(Header, props));
    fireEvent.pointerDown(screen.getByLabelText("Menu da conta"), { button: 0 });
    fireEvent.click(await screen.findByText("Sair"));
    expect(props.onSair).toHaveBeenCalledTimes(1);
  });

  it("chama onPreferencias ao clicar em Preferências", async () => {
    const props = baseProps();
    render(h(Header, props));
    fireEvent.pointerDown(screen.getByLabelText("Menu da conta"), { button: 0 });
    fireEvent.click(await screen.findByText("Preferências"));
    expect(props.onPreferencias).toHaveBeenCalledTimes(1);
  });

  it("NÃO renderiza mais o seletor de fazenda no header (desceu para a sidebar)", () => {
    const props = baseProps();
    render(h(Header, props));
    expect(screen.queryByRole("button", { name: /Propriedade \/ sítio/i })).toBeNull();
  });

  it("chama onAbrirBusca ao clicar no gatilho de busca", () => {
    const props = baseProps();
    render(h(Header, props));
    fireEvent.click(screen.getByLabelText("Pesquisar páginas e recursos"));
    expect(props.onAbrirBusca).toHaveBeenCalledTimes(1);
  });

  it("chama onMobileToggle ao clicar no burger", () => {
    const props = baseProps();
    render(h(Header, props));
    fireEvent.click(screen.getByLabelText("Abrir menu"));
    expect(props.onMobileToggle).toHaveBeenCalledWith(true);
  });
});
