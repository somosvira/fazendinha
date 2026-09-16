/* Ajudantes de teste para os campos estilizados (CampoSelect, SelectBusca,
 * CampoData, CampoMes). As opções só existem no DOM com a lista aberta, e o
 * Radix devolve o foco ao gatilho num setTimeout(0) — esperar esse tick evita
 * que o foco atrasado feche o próximo dropdown aberto pelo teste. */
import { act, fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";

export function prepararPopups() {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
}

type Escopo = Pick<typeof screen, "getByRole">;

export const esperarFoco = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

export async function escolher(rotulo: string, opcao: string | RegExp, escopo: Escopo = screen) {
  fireEvent.click(escopo.getByRole("combobox", { name: rotulo }));
  fireEvent.click(await screen.findByRole("option", { name: opcao }));
  await esperarFoco();
}

/** `dia` no formato do botão do calendário: "13 de setembro de 2026". */
export async function escolherData(rotulo: string, dia: string, escopo: Escopo = screen) {
  fireEvent.click(escopo.getByRole("button", { name: rotulo }));
  const achar = () => screen.queryByRole("button", { name: dia });
  const navegar = (nome: string) => fireEvent.click(screen.getAllByRole("button", { name: nome }).at(-1)!);
  for (let i = 0; i < 36 && !achar(); i++) navegar("Mês anterior");
  for (let i = 0; i < 72 && !achar(); i++) navegar("Próximo mês");
  fireEvent.click(achar()!);
  await esperarFoco();
}

/** Texto mostrado no gatilho de um combobox (a opção escolhida). */
export const valorDoCampo = (rotulo: string, escopo: Escopo = screen) => escopo.getByRole("combobox", { name: rotulo }).textContent;
