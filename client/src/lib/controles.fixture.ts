import { beforeEach, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  if (!globalThis.ResizeObserver) vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

/** Usa as opções visíveis do Select shadcn; inputs continuam com edição nativa. */
export async function alterarControle(campo: HTMLElement, evento: { target: { value?: string | number; files?: File[] } }) {
  if (campo.matches(":disabled")) return;
  if (campo.getAttribute("role") !== "combobox" || campo.tagName === "SELECT") {
    fireEvent.change(campo, evento);
    return;
  }
  fireEvent.click(campo);
  const opcoes = await screen.findAllByRole("option");
  const opcao = opcoes.find(item => item.getAttribute("data-value") === String(evento.target.value));
  if (!opcao) throw new Error(`Opção ausente: ${evento.target.value}`);
  fireEvent.click(opcao);
}
