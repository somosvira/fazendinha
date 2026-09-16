// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MultiSelect } from "./MultiSelect";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function Exemplo() {
  const [value, setValue] = useState<number[]>([]);
  return (
    <MultiSelect
      label="Categorias"
      placeholder="Todas as categorias"
      options={[{ value: 1, label: "Nutrição" }, { value: 2, label: "Sanidade" }]}
      value={value}
      onValueChange={setValue}
    />
  );
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  if (!window.HTMLElement.prototype.scrollIntoView) window.HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("MultiSelect", () => {
  it("seleciona opções no dropdown e mostra pills removíveis", () => {
    render(<Exemplo />);
    expect(screen.getByRole("button", { name: "Categorias" }).textContent).toContain("Todas as categorias");

    fireEvent.click(screen.getByRole("button", { name: "Categorias" }));
    fireEvent.click(screen.getByRole("option", { name: "Nutrição" }));

    expect(screen.getByRole("button", { name: "Categorias" }).textContent).toContain("1 selecionado");
    const remove = screen.getByRole("button", { name: "Remover Nutrição" });
    expect(remove.closest('[data-slot="multi-select-control"]')).toBeTruthy();
    fireEvent.click(remove);
    expect(screen.queryByRole("button", { name: "Remover Nutrição" })).toBeNull();
  });

  it("permite buscar e limpar toda a seleção", () => {
    render(<Exemplo />);
    fireEvent.click(screen.getByRole("button", { name: "Categorias" }));
    fireEvent.change(screen.getByPlaceholderText("Buscar opção…"), { target: { value: "sani" } });
    expect(screen.queryByRole("option", { name: "Nutrição" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Sanidade" }));
    fireEvent.click(screen.getByRole("button", { name: "Limpar (1)" }));
    expect(screen.getByRole("button", { name: "Categorias" }).textContent).toContain("Todas as categorias");
  });
});
