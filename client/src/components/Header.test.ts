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

const secretaria: User = {
  id: "u2",
  nome: "Joana Silva",
  email: "joana@riovono.com",
  inicial: "J",
  papel: "secretaria",
  status: "ativo",
  ultimoAcesso: "hoje",
  abas: [],
  flags: [],
};

function baseProps() {
  return {
    user: proprietario,
    allUsers: [proprietario, secretaria],
    onSwitchUser: vi.fn(),
    mobileOpen: false,
    onMobileToggle: vi.fn(),
    onAbrirBusca: vi.fn(),
    onSair: vi.fn(),
    propAtiva: null,
    onTrocarProp: vi.fn(),
  };
}

describe("Header", () => {
  it("abre o menu do usuário e troca de perfil ao clicar num item", async () => {
    const props = baseProps();
    render(h(Header, props));

    // trigger renders the current user's first name
    // Radix DropdownMenuTrigger opens on pointerdown (not click) — jsdom needs
    // the pointer event fired explicitly to trigger the open state.
    const trigger = screen.getByText("Marco Antônio".split(" ")[0]);
    fireEvent.pointerDown(trigger, { button: 0 });

    // menu portalled: item for the other user appears
    const item = await screen.findByText("Joana Silva");
    fireEvent.click(item);

    expect(props.onSwitchUser).toHaveBeenCalledWith("u2");
  });

  it("não renderiza dropdown de usuário quando só há 1 usuário e sem onSair", () => {
    const props = { ...baseProps(), allUsers: [proprietario], onSair: undefined };
    render(h(Header, props));
    // chip renders, but has no aria-haspopup (no menu)
    const chip = screen.getByText("Marco Antônio".split(" ")[0]).closest("button, div");
    expect(chip?.getAttribute("aria-haspopup")).toBeNull();
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

  it("mostra o seletor de propriedade/sítio no header", () => {
    const props = baseProps();
    render(h(Header, props));
    // seletor unificado (antes eram 2: fazenda display-only + sítio no corpo)
    const farmTrigger = screen.getByRole("button", { name: /Propriedade \/ sítio/i });
    expect(farmTrigger.textContent).toContain("Rio Novo");
  });
});
