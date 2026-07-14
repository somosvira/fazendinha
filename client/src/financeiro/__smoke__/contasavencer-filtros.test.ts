// Prova que ContasAVencer aplica os filtrosIniciais do deep-link (/gastos?status=…&q=…).
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ToastProvider } from "../../components/Toast";
import { ContasAVencer } from "../ContasAVencer";

const render = (filtrosIniciais?: Record<string, string>) =>
  renderToStaticMarkup(h(ToastProvider, null, h(ContasAVencer, { filtrosIniciais })));

describe("ContasAVencer — deep-link filtrosIniciais", () => {
  it("status=vencidas abre na aba Vencidas", () => {
    const html = render({ status: "vencidas" });
    // o botão da aba ativa fica aria-pressed=true
    expect(html).toMatch(/aria-pressed="true"[^>]*>Vencidas/);
  });
  it("sem filtros abre na aba A vencer (default)", () => {
    const html = render();
    expect(html).toMatch(/aria-pressed="true"[^>]*>A vencer/);
  });
  it("q (ou categoria/pessoa) pré-preenche a busca", () => {
    const html = render({ categoria: "Ração" });
    expect(html).toContain('value="Ração"');
  });
});
