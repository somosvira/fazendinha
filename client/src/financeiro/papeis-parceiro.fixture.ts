import { fireEvent, screen, within } from "@testing-library/react";

/** Marca ou desmarca um papel no MultiSelect "Papéis do parceiro" e fecha a lista. */
export async function alternarPapelParceiro(painel: HTMLElement, papel: string) {
  if (!("ResizeObserver" in globalThis)) (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => {};
  const gatilho = within(painel).getByRole("button", { name: /^Papéis do parceiro/ });
  fireEvent.click(gatilho);
  fireEvent.click(await screen.findByRole("option", { name: papel }));
  fireEvent.keyDown(document.activeElement ?? gatilho, { key: "Escape" });
}

/** O papel aparece como selecionado (pill removível) no formulário. */
export function papelSelecionado(painel: HTMLElement, papel: string) {
  return within(painel).queryByRole("button", { name: `Remover ${papel}` }) !== null;
}
