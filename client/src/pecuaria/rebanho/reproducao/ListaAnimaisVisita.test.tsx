// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListaAnimaisVisita, type ListaAnimaisVisitaProps } from "./ListaAnimaisVisita";

afterEach(cleanup);
const animais: ListaAnimaisVisitaProps["animais"] = [
  { id: "p1", animalId: "a1", brinco: "023", nome: "Ágata", status: "PENDENTE", temRascunho: true },
  { id: "p2", animalId: "a2", brinco: "005", nome: "Bela", status: "CONFIRMADO" },
];
describe("Lista individual da seleção livre", () => {
  it("abrir um rascunho apenas escolhe o participante e mantém o estado pendente", () => {
    const onAbrir = vi.fn();
    render(<ListaAnimaisVisita animais={animais} busca="" onBusca={vi.fn()} onAbrir={onAbrir} />);
    const abrir = screen.getByRole("button", { name: "Abrir atendimento de 023 · Ágata" });
    expect(abrir.textContent).toContain("Pendente");
    expect(abrir.textContent).toContain("Rascunho salvo");
    fireEvent.click(abrir);
    expect(onAbrir).toHaveBeenCalledTimes(1);
    expect(onAbrir).toHaveBeenCalledWith("p1");
    expect(abrir.textContent).toContain("Pendente");
  });
  it("agrupa registros do mesmo animal sem esconder pendência atrás de um atendimento confirmado", () => {
    const onAbrir = vi.fn();
    render(<ListaAnimaisVisita animais={[...animais, { ...animais[0], id: "p3", status: "CONFIRMADO", temRascunho: false }]}
      busca="" onBusca={vi.fn()} onAbrir={onAbrir} selecionadoId="p3" />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText("2 de 2 animais")).toBeTruthy();
    const abrir = screen.getAllByRole("button")[0];
    expect(abrir.getAttribute("aria-current")).toBe("true");
    expect(abrir.textContent).toContain("Pendente · Atendimento confirmado");
    expect(abrir.textContent).toContain("2 registros na visita");
    fireEvent.click(abrir);
    expect(onAbrir).toHaveBeenCalledWith("p3");
  });
  it("a busca controlada tolera acentos e preserva seleção e ordem ao voltar", () => {
    const onBusca = vi.fn();
    const props = { animais, busca: "", onBusca, onAbrir: vi.fn(), selecionadoId: "p1" };
    const { rerender } = render(<ListaAnimaisVisita {...props} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "agata" } });
    expect(onBusca).toHaveBeenCalledWith("agata");
    rerender(<ListaAnimaisVisita {...props} busca="agata" />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button").getAttribute("aria-current")).toBe("true");
    rerender(<ListaAnimaisVisita {...props} />);
    expect(within(screen.getByRole("list")).getAllByRole("button").map(b => b.textContent?.slice(0, 3))).toEqual(["023", "005"]);
  });
  it("distingue busca vazia de seleção vazia e não interpreta status desconhecido como atendimento", () => {
    const props = { animais: [{ ...animais[0], status: "NOVO_ESTADO" }], busca: "", onBusca: vi.fn(), onAbrir: vi.fn() };
    const { rerender } = render(<ListaAnimaisVisita {...props} />);
    expect(screen.getByText("Situação não identificada")).toBeTruthy();
    rerender(<ListaAnimaisVisita {...props} busca="inexistente" />);
    expect(screen.getByText("Nenhum animal corresponde à busca.")).toBeTruthy();
    rerender(<ListaAnimaisVisita {...props} animais={[]} busca="" />);
    expect(screen.getByText("Nenhum animal nesta seleção.")).toBeTruthy();
  });
});
