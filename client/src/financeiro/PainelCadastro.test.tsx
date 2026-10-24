// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PainelCadastro } from "./PainelCadastro";
afterEach(cleanup);
it.each([true, false])("preserva rodapé ReactNode e fechamento intacto (compacto=%s)", (compacto) => {
  const onFechar = vi.fn();
  render(<PainelCadastro aberto compacto={compacto} titulo="Cadastro" onFechar={onFechar} rodape={<span>Rodapé existente</span>}><input aria-label="Nome" /></PainelCadastro>);
  expect(screen.getByText("Rodapé existente")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  expect(onFechar).toHaveBeenCalledOnce();
});
it.each(["Cancelar", "Fechar", "Escape", "fora"])("protege alterações ao fechar por %s", async (acao) => {
  const onFechar = vi.fn();
  render(<PainelCadastro aberto compacto titulo="Cadastro" onFechar={onFechar} rodape={(fechar) => <button onClick={fechar}>Cancelar</button>}><input aria-label="Nome" /></PainelCadastro>);
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Maria" } });
  if (acao === "Escape") fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  else if (acao === "fora") {
    // Radix instala o listener externo no próximo ciclo.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const overlay = document.querySelector('[data-slot="dialog-overlay"]')!;
    fireEvent.pointerDown(overlay, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(overlay, { pointerType: "mouse", button: 0 });
    fireEvent.click(overlay);
  } else fireEvent.click(screen.getByRole("button", { name: acao }));
  await screen.findByText("Descartar alterações?");
  expect(onFechar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Maria");
});
