// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Checkbox } from "./checkbox";
beforeEach(() => { vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("Enter alterna sem enviar o formulário nem repetir ao manter a tecla pressionada", () => {
  const enviar = vi.fn((e) => e.preventDefault());
  render(<form onSubmit={enviar}><Checkbox aria-label="Cliente" /><button type="submit">Salvar</button></form>);
  const campo = screen.getByRole("checkbox");
  fireEvent.keyDown(campo, { key: "Enter" });
  expect(campo.getAttribute("aria-checked")).toBe("true");
  fireEvent.keyDown(campo, { key: "Enter", repeat: true });
  expect(campo.getAttribute("aria-checked")).toBe("true");
  fireEvent.keyDown(campo, { key: "Enter" });
  expect(campo.getAttribute("aria-checked")).toBe("false");
  expect(enviar).not.toHaveBeenCalled();
});
it("funciona com estado controlado e preserva o handler do consumidor", () => {
  const teclado = vi.fn();
  function Controlado() { const [checked, setChecked] = useState(false); return <Checkbox checked={checked} onCheckedChange={v => setChecked(v === true)} onKeyDown={teclado} />; }
  render(<Controlado />);
  fireEvent.keyDown(screen.getByRole("checkbox"), { key: "Enter" });
  expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("true");
  expect(teclado).toHaveBeenCalledOnce();
});
it("respeita estado desabilitado e cancelamento do consumidor", () => {
  const alterar = vi.fn();
  const { rerender } = render(<Checkbox disabled onCheckedChange={alterar} />);
  fireEvent.keyDown(screen.getByRole("checkbox"), { key: "Enter" });
  rerender(<Checkbox onCheckedChange={alterar} onKeyDown={e => e.preventDefault()} />);
  fireEvent.keyDown(screen.getByRole("checkbox"), { key: "Enter" });
  expect(alterar).not.toHaveBeenCalled();
});
