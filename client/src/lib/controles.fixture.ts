import { beforeEach, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";

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
  fireEvent.click(within(escopo).getByRole("button", { name: /^Filtros(?:\s*\(\d+\))?$/ }));
  const painel = await screen.findByRole("dialog", { name: "Filtros" });
  await alterarControle(within(painel).getByLabelText(rotulo), { target: { value: valor } });
  fireEvent.click(within(painel).getByRole("button", { name: "Aplicar filtros" }));
  await waitFor(() => { if (screen.queryByRole("dialog", { name: "Filtros" })) throw new Error("Aguardando fechamento dos filtros"); });
}

/** Os critérios só mudam ao confirmar o modal compartilhado. */
export async function abrirFiltrosConsulta(escopo: HTMLElement = document.body, indice = 0) {
  const { within } = await import("@testing-library/react");
  fireEvent.click(within(escopo).getAllByRole("button", {name:/^Filtros(?:\s*\(\d+\))?$/})[indice]);
  return await screen.findByRole("dialog",{name:"Filtros"});
}
export async function aplicarFiltrosConsulta() {
  const { within } = await import("@testing-library/react");
  fireEvent.click(within(screen.getByRole("dialog",{name:"Filtros"})).getByRole("button",{name:"Aplicar filtros"}));
  await waitFor(()=>{if(screen.queryByRole("dialog",{name:"Filtros"}))throw new Error("Aguardando aplicar os filtros");});
}

// Versões síncronas para trocar fireEvent.change sem tornar o teste assíncrono.
// O Escape só vai quando o menu está aberto: com ele fechado, fecharia o modal em volta.
function fechar(campo: Element) {
  if (campo.getAttribute("aria-expanded") === "true") fireEvent.keyDown(document.body, { key: "Escape" });
}
/** Muda um campo nos testes: no SelectCampo abre o menu e escolhe a opção; nos demais, dispara o change. */
export function mudarCampo(elemento: Element, init: { target: Record<string, unknown> }) {
  if (elemento.tagName !== "BUTTON" || elemento.getAttribute("role") !== "combobox") return fireEvent.change(elemento, init);
  HTMLElement.prototype.scrollIntoView ??= () => {};
  HTMLElement.prototype.hasPointerCapture ??= () => false;
  HTMLElement.prototype.releasePointerCapture ??= () => {};
  const valor = String(init.target.value ?? "");
  fireEvent.click(elemento);
  const opcao = [...document.querySelectorAll("[role=option]")].find(item => item.getAttribute("data-value") === valor);
  if (!opcao) { fechar(elemento); throw new Error(`Opção ${valor} indisponível`); }
  // Opção bloqueada não é escolhida, como na tela: o menu fecha sem mudar o valor.
  if (opcao.hasAttribute("data-disabled")) { fechar(elemento); return false; }
  fireEvent.click(opcao);
  return true;
}
/** Textos das opções de um campo; no SelectCampo abre o menu, lê e fecha. */
export function opcoesDoCampo(campo: Element): string[] {
  if (campo instanceof HTMLSelectElement) return [...campo.options].map(o => o.textContent ?? "");
  HTMLElement.prototype.scrollIntoView ??= () => {};
  HTMLElement.prototype.hasPointerCapture ??= () => false;
  HTMLElement.prototype.releasePointerCapture ??= () => {};
  fireEvent.click(campo);
  const textos = [...document.querySelectorAll("[role=option]")].map(o => o.textContent ?? "");
  fechar(campo);
  return textos;
}
/** Valor, texto e bloqueio de cada opção, para conferir o que o campo oferece. */
export function itensDoCampo(campo: Element): { valor: string; texto: string; desabilitada: boolean }[] {
  if (campo instanceof HTMLSelectElement) return [...campo.options].map(o => ({ valor: o.value, texto: o.textContent ?? "", desabilitada: o.disabled }));
  HTMLElement.prototype.scrollIntoView ??= () => {};
  HTMLElement.prototype.hasPointerCapture ??= () => false;
  HTMLElement.prototype.releasePointerCapture ??= () => {};
  fireEvent.click(campo);
  const itens = [...document.querySelectorAll("[role=option]")].map(o => ({ valor: o.getAttribute("data-value") ?? "", texto: o.textContent ?? "", desabilitada: o.hasAttribute("data-disabled") }));
  fechar(campo);
  return itens;
}
/** Espera o campo oferecer as opções. Não usa waitFor: abrir o menu muda a tela e o reativaria sem fim. */
export async function esperarOpcoes(obter: () => Element | Element[], aceita: (itens: { valor: string; texto: string }[]) => boolean, limite = 2000) {
  const fim = Date.now() + limite;
  let ultimo: { valor: string; texto: string }[] = [];
  while (Date.now() < fim) {
    await act(async () => { await new Promise(r => setTimeout(r, 25)); });
    try { const campos = obter(); ultimo = (Array.isArray(campos) ? campos : [campos]).flatMap(itensDoCampo); } catch { continue; }
    if (aceita(ultimo)) return ultimo;
  }
  throw new Error(`Opções esperadas ausentes; havia: ${ultimo.map(o => o.texto).join(" | ")}`);
}
