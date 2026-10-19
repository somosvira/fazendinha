import { beforeEach, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  if (!globalThis.ResizeObserver) vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

/** Usa as opções visíveis do Select shadcn; inputs continuam com edição nativa. */
export async function alterarControle(campo: HTMLElement, evento: { target: { value?: string | number; files?: File[] } }) {
  if (campo.matches(":disabled")) return;
  if (campo.getAttribute("role") === "group") {
    const opcao = Array.from(campo.querySelectorAll<HTMLButtonElement>("button[data-value]")).find(b => b.dataset.value === String(evento.target.value));
    if (!opcao) throw new Error(`Situação ausente: ${evento.target.value}`);
    fireEvent.click(opcao);
    return;
  }
  if (campo.getAttribute("role") !== "combobox" || campo.tagName === "SELECT") {
    fireEvent.change(campo, evento);
    return;
  }
  fireEvent.click(campo);
  const opcoes = await screen.findAllByRole("option");
  const opcao = opcoes.find(item => item.getAttribute("data-value") === String(evento.target.value));
  if (!opcao) throw new Error(`Opção ausente: ${evento.target.value}`);
  fireEvent.click(opcao);
  await waitFor(() => {
    if (campo.isConnected && !campo.matches(":disabled") && document.activeElement !== campo) throw new Error("Aguardando o foco voltar ao seletor");
  });
}

/** Abre o painel da consulta indicada e altera um critério adicional como usuário. */
export async function alterarFiltroAdicional(rotulo: string, valor: string, escopo: HTMLElement = document.body) {
  const { within } = await import("@testing-library/react");
  fireEvent.click(within(escopo).getByRole("button", { name: /Mais filtros/ }));
  const painel = await screen.findByRole("dialog", { name: "Filtros" });
  await alterarControle(within(painel).getByLabelText(rotulo), { target: { value: valor } });
  fireEvent.click(within(painel).getByRole("button", { name: "Aplicar filtros" }));
  await waitFor(() => { if (screen.queryByRole("dialog", { name: "Filtros" })) throw new Error("Aguardando fechamento dos filtros"); });
}
