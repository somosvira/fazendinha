// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { createElement as h, useState } from "react";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/react";
import { Header } from "./Header";
import { AlternarVisualizacaoConsulta, VisualizacaoNoCabecalho } from "./VisualizacaoConsulta";
import type { User } from "../data/acessos";

afterEach(() => {
  cleanup();
  localStorage.removeItem("terrano:consultas:sessao:visualizacao-global");
  localStorage.removeItem("terrano:consultas:u1:visualizacao-global");
});

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

  it("encaminha o termo digitado e oferece o atalho de animais", () => {
    const props = { ...baseProps(), onBuscarAnimal: vi.fn() };
    render(h(Header, props));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ração" } });
    expect(props.onAbrirBusca).toHaveBeenCalledWith("ração");
    fireEvent.click(screen.getByRole("button", { name: "Buscar animal" }));
    expect(props.onBuscarAnimal).toHaveBeenCalledOnce();
  });

  it("mantém Acessos restrito a quem pode gerenciar usuários", async () => {
    const props = { ...baseProps(), onAcessos: vi.fn() };
    const { rerender } = render(h(Header, props));
    fireEvent.pointerDown(screen.getByLabelText("Menu da conta"), { button: 0 });
    expect(await screen.findByRole("menu")).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Acessos" })).toBeNull();
    rerender(h(Header, { ...props, user: { ...props.user, dono: true } }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Acessos" }));
    expect(props.onAcessos).toHaveBeenCalledOnce();
  });

  it("chama onMobileToggle ao clicar no burger", () => {
    const props = baseProps();
    render(h(Header, props));
    fireEvent.click(screen.getByLabelText("Abrir menu"));
    expect(props.onMobileToggle).toHaveBeenCalledWith(true);
  });
});

describe("Seletor do cabeçalho", () => {
  it("altera as consultas montadas, preserva os modos específicos e permanece registrado durante um diálogo", () => {
    const lotes = vi.fn();
    const consumo = vi.fn();
    const oculto = vi.fn();
    const calendario = vi.fn();
    const props = baseProps();
    const pagina = (modalAberto: boolean) => h(VisualizacaoNoCabecalho, null,
      h(Header, props),
      h("main", { "aria-hidden": modalAberto || undefined },
        h(AlternarVisualizacaoConsulta, { modo: "tabela", mudar: lotes, rotulo: "Lotes" }),
        h(AlternarVisualizacaoConsulta, { modo: "visual", mudar: consumo, rotulo: "Consumo" }),
        h("div", { hidden: true }, h(AlternarVisualizacaoConsulta, { modo: "tabela", mudar: oculto, rotulo: "Consulta oculta" })),
        h(AlternarVisualizacaoConsulta, { modo: "tabela", mudar: calendario, rotulo: "Fechamentos", visual: "Calendário" }),
      ),
    );
    const { rerender } = render(pagina(false));
    expect(screen.queryByRole("group", { name: "Lotes" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Consumo" })).toBeNull();
    expect(screen.getByRole("group", { name: "Fechamentos" })).toBeTruthy();

    rerender(pagina(true));
    rerender(pagina(false));
    const alternador = screen.getByRole("group", { name: "Visualização da tela" });
    fireEvent.click(within(alternador).getByLabelText("Cartões"));
    expect(lotes).toHaveBeenCalledWith("visual");
    expect(consumo).not.toHaveBeenCalled();
    expect(oculto).toHaveBeenCalledWith("visual");
    expect(calendario).not.toHaveBeenCalled();
  });
});


it("mantém Tabela ao abrir outra aba e ao recarregar o cabeçalho", () => {
  function Consulta({ nome }: { nome: string }) {
    const [modo, mudar] = useState<"visual" | "tabela">("visual");
    return h("section", null,
      h(AlternarVisualizacaoConsulta, { modo, mudar, rotulo: nome }),
      h("output", null, `${nome}: ${modo}`),
    );
  }

  const pagina = (nome: string, usuarioId = "u1") => h(VisualizacaoNoCabecalho, { key: usuarioId, usuarioId, children: [
    h(Header, { ...baseProps(), key: "header" }),
    h(Consulta, { key: nome, nome }),
  ] });
  const { rerender, unmount } = render(pagina("Fechamentos"));
  fireEvent.click(screen.getByLabelText("Tabela"));
  expect(screen.getByText("Fechamentos: tabela")).toBeTruthy();
  rerender(pagina("Alertas"));
  expect(screen.getByText("Alertas: tabela")).toBeTruthy();
  unmount();

  const recarregada = render(pagina("Receitas"));
  expect(screen.getByText("Receitas: tabela")).toBeTruthy();
  recarregada.rerender(pagina("Receitas", "outro-usuario"));
  expect(screen.getByText("Receitas: visual")).toBeTruthy();
});
