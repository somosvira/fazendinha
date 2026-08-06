// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Relatorios } from "./Relatorios";

vi.mock("./Relatorio", () => ({
  FechamentoMensalRelatorio: ({ onVoltar }: { onVoltar: () => void }) => <div><h1>Fechamento aberto</h1><button onClick={onVoltar}>Voltar</button></div>,
}));

afterEach(() => { cleanup(); localStorage.clear(); });

describe("Central de Relatórios", () => {
  it("busca modelos de todas as áreas e abre o destino operacional", () => {
    const onNav = vi.fn();
    render(<Relatorios onNav={onNav} />);
    expect(screen.getByRole("heading", { name: "Relatórios" })).toBeTruthy();
    expect(screen.getAllByText("Em preparação").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar relatório" }), { target: { value: "serviço" } });
    expect(screen.getByText("Inseminações no período")).toBeTruthy();
    expect(screen.queryByText("Posição de estoque")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Abrir Inseminações no período" }));
    expect(onNav).toHaveBeenCalledWith("reb-relatorios");
  });

  it("favorita e recupera um relatório na aba Favoritos", () => {
    render(<Relatorios onNav={() => {}} />);
    fireEvent.click(screen.getByLabelText("Adicionar Fechamento financeiro mensal aos favoritos"));
    fireEvent.click(screen.getByRole("button", { name: "favoritos" }));
    expect(screen.getByText("Fechamento financeiro mensal")).toBeTruthy();
    expect(screen.queryByText("Inseminações no período")).toBeNull();
  });

  it("preserva o fechamento como relatório financeiro interno", () => {
    render(<Relatorios onNav={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Fechamento financeiro mensal" }));
    expect(screen.getByRole("heading", { name: "Fechamento aberto" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("heading", { name: "Relatórios" })).toBeTruthy();
  });
});
