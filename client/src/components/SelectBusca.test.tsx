// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SelectBusca } from "./SelectBusca";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const opcoes = [
  { value: "1", label: "Nutrição animal" },
  { value: "2", label: "Sanidade" },
  { value: "3", label: "Manutenção" },
];

function Exemplo({ inicial = "", onValueChange, opcaoVazia }: { inicial?: string; onValueChange?: (valor: string) => void; opcaoVazia?: string }) {
  const [valor, setValor] = useState(inicial);
  return <SelectBusca aria-label="Categoria" placeholder="Selecione" opcaoVazia={opcaoVazia} options={opcoes} value={valor} onValueChange={(novo) => { setValor(novo); onValueChange?.(novo); }} />;
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  if (!window.HTMLElement.prototype.scrollIntoView) window.HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("SelectBusca", () => {
  it("mostra o rótulo da opção escolhida ou o placeholder", () => {
    render(<><Exemplo inicial="2" /><SelectBusca aria-label="Vazio" placeholder="Selecione" options={opcoes} value="" onValueChange={() => {}} /></>);
    expect(screen.getByRole("combobox", { name: "Categoria" }).textContent).toBe("Sanidade");
    expect(screen.getByRole("combobox", { name: "Vazio" }).textContent).toBe("Selecione");
  });

  it("filtra pela busca e devolve o valor escolhido", () => {
    const onValueChange = vi.fn();
    render(<Exemplo onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Categoria" }));
    fireEvent.change(screen.getByPlaceholderText("Buscar…"), { target: { value: "sani" } });
    expect(screen.queryByRole("option", { name: "Nutrição animal" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Sanidade" }));
    expect(onValueChange).toHaveBeenCalledWith("2");
    expect(screen.getByRole("combobox", { name: "Categoria" }).textContent).toBe("Sanidade");
    expect(screen.queryByPlaceholderText("Buscar…")).toBeNull();
  });

  it("encontra opções acentuadas digitando sem acento", () => {
    render(<Exemplo />);
    fireEvent.click(screen.getByRole("combobox", { name: "Categoria" }));
    fireEvent.change(screen.getByPlaceholderText("Buscar…"), { target: { value: "manutencao" } });
    expect(screen.getByRole("option", { name: "Manutenção" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Sanidade" })).toBeNull();
  });

  it("permite voltar para a opção vazia", () => {
    const onValueChange = vi.fn();
    render(<Exemplo inicial="1" opcaoVazia="Sem categoria" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Categoria" }));
    fireEvent.click(screen.getByRole("option", { name: "Sem categoria" }));
    expect(onValueChange).toHaveBeenCalledWith("");
    expect(screen.getByRole("combobox", { name: "Categoria" }).textContent).toBe("Sem categoria");
  });

  it("participa da validação e do FormData do formulário", () => {
    const { unmount } = render(<form aria-label="Formulário"><SelectBusca aria-label="Categoria" name="categoria" required options={opcoes} value="" onValueChange={() => {}} /></form>);
    expect((screen.getByRole("form", { name: "Formulário" }) as HTMLFormElement).checkValidity()).toBe(false);
    unmount();
    render(<form aria-label="Formulário"><SelectBusca aria-label="Categoria" name="categoria" required options={opcoes} value="3" onValueChange={() => {}} /></form>);
    const form = screen.getByRole("form", { name: "Formulário" }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("categoria")).toBe("3");
  });

  it("avisa quando a busca não encontra nada", () => {
    render(<Exemplo />);
    fireEvent.click(screen.getByRole("combobox", { name: "Categoria" }));
    fireEvent.change(screen.getByPlaceholderText("Buscar…"), { target: { value: "xyz" } });
    expect(screen.getByText("Nenhuma opção encontrada.")).toBeTruthy();
  });
});

it("liga o texto de ajuda e o estado de erro ao campo", () => {
  render(<SelectBusca aria-label="Categoria" aria-describedby="ajuda" aria-invalid options={opcoes} value="" onValueChange={() => {}} />);
  const campo = screen.getByRole("combobox", { name: "Categoria" });
  expect(campo.getAttribute("aria-describedby")).toBe("ajuda");
  expect(campo.getAttribute("aria-invalid")).toBe("true");
});
