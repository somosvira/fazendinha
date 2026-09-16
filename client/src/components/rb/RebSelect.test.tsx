// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RebSelect } from "./RebSelect";

function Exemplo({ onChange }: { onChange?: (valor: string) => void }) {
  const [valor, setValor] = useState("");
  return (
    <RebSelect aria-label="Status" value={valor} onChange={(novo) => { setValor(novo); onChange?.(novo); }}>
      <option value="">—</option>
      <option value="PRENHE" data-descricao="Gestação confirmada no diagnóstico.">Prenhe</option>
      <option value="VAZIA">Vazia</option>
    </RebSelect>
  );
}

beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(cleanup);

describe("RebSelect", () => {
  it("explica a opção na lista sem repetir a explicação no campo", async () => {
    const onChange = vi.fn();
    render(<Exemplo onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    const prenhe = await screen.findByRole("option", { name: "Prenhe" });
    expect(prenhe.textContent).toContain("Gestação confirmada no diagnóstico.");
    fireEvent.click(prenhe);
    expect(onChange).toHaveBeenCalledWith("PRENHE");
    expect(screen.getByRole("combobox", { name: "Status" }).textContent).toBe("Prenhe");
  });

  it("mantém a opção vazia selecionável", async () => {
    const onChange = vi.fn();
    render(<Exemplo onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    fireEvent.click(await screen.findByRole("option", { name: "Vazia" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    fireEvent.click(await screen.findByRole("option", { name: "—" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
