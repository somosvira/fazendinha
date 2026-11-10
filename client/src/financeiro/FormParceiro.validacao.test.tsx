// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormParceiro } from "./FormParceiro";
import { ApiError, criarParceiro } from "./novo-api";
vi.mock("./novo-api", async (importOriginal) => ({ ...await importOriginal<typeof import("./novo-api")>(), criarParceiro: vi.fn() }));
const rolar = vi.fn();
const rolagemOriginal = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = rolar;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(0), 0));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); HTMLElement.prototype.scrollIntoView = rolagemOriginal; });
const abrir = () => render(<FormParceiro parceiro={null} aberto onSalvo={vi.fn()} onFechar={vi.fn()} />);
it("mostra a validação no rodapé e leva foco ao primeiro campo, sem enviar", async () => {
  abrir();
  fireEvent.click(screen.getByRole("button", { name: "Criar parceiro" }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Nome / razão social" })));
  await waitFor(() => expect(rolar).toHaveBeenCalled());
  expect(document.querySelector('[data-slot="dialog-footer"] [role="alert"]')?.textContent).toBeTruthy();
  expect(criarParceiro).not.toHaveBeenCalled();
});
it("preserva dados e aponta CPF/CNPJ quando a API recusa duplicidade", async () => {
  vi.mocked(criarParceiro).mockRejectedValue(new ApiError("Já existe um parceiro com este CPF/CNPJ", 409, "CONFLITO", "documento"));
  abrir();
  fireEvent.change(screen.getByRole("textbox", { name: "Nome / razão social" }), { target: { value: "Cliente teste" } });
  fireEvent.change(screen.getByRole("textbox", { name: "CPF/CNPJ" }), { target: { value: "12345678901" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Cliente" }));
  fireEvent.click(screen.getByRole("button", { name: "Criar parceiro" }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "CPF/CNPJ" })));
  expect(document.querySelector('[data-slot="dialog-footer"] [role="alert"]')?.textContent).toBe("Já existe um parceiro com este CPF/CNPJ");
  expect((screen.getByRole("textbox", { name: "Nome / razão social" }) as HTMLInputElement).value).toBe("Cliente teste");
  expect(rolar).toHaveBeenCalled();
});
it("abre endereço recolhido e focaliza o CEP inválido", async () => {
  abrir();
  fireEvent.change(screen.getByRole("textbox", { name: "Nome / razão social" }), { target: { value: "Cliente teste" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Cliente" }));
  fireEvent.click(screen.getByRole("button", { name: "Endereço" }));
  fireEvent.change(screen.getByRole("textbox", { name: "CEP" }), { target: { value: "123" } });
  fireEvent.click(screen.getByRole("button", { name: "Endereço" }));
  fireEvent.click(screen.getByRole("button", { name: "Criar parceiro" }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "CEP" })));
  expect(document.querySelector('[data-slot="dialog-footer"] [role="alert"]')?.textContent).toBe("Informe um CEP com 8 dígitos");
  expect(criarParceiro).not.toHaveBeenCalled();
});
