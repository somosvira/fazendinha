// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Nutricao } from "./Nutricao";
vi.mock("./VisaoGeralNutricao", () => ({ VisaoGeralNutricao: () => <p>Visão geral de todos os lotes</p> }));
vi.mock("./ReceitasDieta", () => ({ ReceitasDieta: () => <p>Gestão compartilhada de receitas</p> }));
vi.mock("./NutricaoLote", () => ({ NutricaoLote: () => <p>Nutrição específica do lote</p> }));
vi.mock("./FechamentosNutricao", () => ({ FechamentosNutricao: () => <p>Fechamentos gerais</p> }));
vi.mock("./ConsultaFechamento", () => ({ ConsultaFechamento: ({ onVoltar }: { onVoltar: () => void }) => <><p>Fechamento consultado</p><button type="button" onClick={onVoltar}>Voltar à consulta</button></> }));
vi.mock("./FormOperacaoNutricional", () => ({ FormOperacaoNutricional: () => <p>Formulário próprio</p> }));
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });
describe("navegação da Nutrição", () => {
  it("abre no contexto geral sem seleção de lote e consulta os fechamentos gerais", () => {
    window.history.replaceState(null, "", "/pecuaria/nutricao");
    render(<Nutricao podeLancar />);
    expect(screen.getByText("Visão geral de todos os lotes")).toBeTruthy();
    expect(screen.queryByLabelText("Lote")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Fechamentos" }));
    expect(screen.getByText("Fechamentos gerais")).toBeTruthy();
    expect(window.location.search).not.toContain("loteId");
  });
  it("restaura a aba depois de voltar no navegador e mantém links antigos de detalhe", () => {
    window.history.replaceState(null, "", "/pecuaria/nutricao?aba=receitas");
    render(<Nutricao podeLancar />);
    fireEvent.click(screen.getByRole("tab", { name: "Fechamentos" }));
    act(() => { window.history.replaceState(null, "", "/pecuaria/nutricao?aba=receitas"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(screen.getByRole("tab", { name: "Receitas" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Gestão compartilhada de receitas")).toBeTruthy();
    act(() => { window.history.replaceState(null, "", "/pecuaria/nutricao?aba=fechamentos&loteId=l&fechamentoId=f"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(screen.getByText("Fechamento consultado")).toBeTruthy();
  });
  it("retorno explícito do detalhe preserva o filtro e a página da consulta", () => {
    window.history.replaceState(null, "", "/pecuaria/nutricao?aba=fechamentos&fechamentoId=f&filtroLoteId=l&statusFechamento=CONFIRMADO&paginaFechamentos=2");
    render(<Nutricao podeLancar />);
    fireEvent.click(screen.getByRole("button", { name: "Voltar à consulta" }));
    const params = new URLSearchParams(window.location.search);
    expect(params.get("fechamentoId")).toBeNull();
    expect(params.get("filtroLoteId")).toBe("l"); expect(params.get("statusFechamento")).toBe("CONFIRMADO"); expect(params.get("paginaFechamentos")).toBe("2");
    expect(screen.getByText("Fechamentos gerais")).toBeTruthy();
  });
  it("conferência global preserva filtros e página na entrada e no link de retorno", () => {
    window.history.replaceState(null, "", "/pecuaria/nutricao?aba=fechamentos&filtroLoteId=l&statusFechamento=ESTORNADO&paginaFechamentos=2");
    render(<Nutricao podeLancar />);
    fireEvent.click(screen.getByRole("link", { name: "Conferir consumo" }));
    let params = new URLSearchParams(window.location.search);
    expect(params.get("acao")).toBe("consumo"); expect(params.get("statusFechamento")).toBe("ESTORNADO"); expect(params.get("paginaFechamentos")).toBe("2");
    fireEvent.click(screen.getByRole("link", { name: /Voltar à nutrição/ }));
    params = new URLSearchParams(window.location.search);
    expect(params.get("acao")).toBeNull(); expect(params.get("filtroLoteId")).toBe("l"); expect(params.get("statusFechamento")).toBe("ESTORNADO"); expect(params.get("paginaFechamentos")).toBe("2");
  });
  it("abre ações em tela própria e bloqueia o formulário para perfis de consulta", () => {
    window.history.replaceState(null, "", "/pecuaria/nutricao?acao=atribuir&loteId=l");
    const { rerender } = render(<Nutricao podeLancar />);
    expect(screen.getByText("Formulário próprio")).toBeTruthy();
    expect(screen.queryByText("Nutrição específica do lote")).toBeNull();
    rerender(<Nutricao podeLancar={false} />);
    expect(screen.queryByText("Formulário próprio")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("permissão");
  });
});
