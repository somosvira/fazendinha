// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AptidaoSection } from "./AptidaoSection";

class ResizeObserverMock { observe() {} unobserve() {} disconnect() {} }

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } })));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("AptidaoSection", () => {
  it("renderiza a faixa de decisão reprodutiva e o estado de carregamento", () => {
    const html = renderToString(createElement(AptidaoSection)).replaceAll("<!-- -->", "");

    expect(html).toContain("Aptidão de novilhas");
    expect(html).toContain("13 meses");
    expect(html).toContain("320 kg");
    expect(html).toContain("Carregando candidatas");
  });

  it("explica na lista o que significa marcar a novilha como apta ou inapta", async () => {
    render(createElement(AptidaoSection));
    fireEvent.click(screen.getByRole("combobox", { name: "Decisão" }));
    expect((await screen.findByRole("option", { name: "Apta" })).textContent).toContain("pode entrar na reprodução");
    expect(screen.getByRole("option", { name: "Inapta" }).textContent).toContain("ainda não entra na reprodução");
  });

  it("usa busca para escolher a novilha e calendário para a data", async () => {
    render(createElement(AptidaoSection, {
      novilhas: [{ id: "7", numero: "207", nome: "Estrela" } as never, { id: "8", numero: "208", nome: "Ângela" } as never],
    }));
    fireEvent.click(screen.getByRole("combobox", { name: "Novilha" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar animal…"), { target: { value: "angela" } });
    fireEvent.click(await screen.findByRole("option", { name: "208 · Ângela" }));
    expect(screen.getByRole("combobox", { name: "Novilha" }).textContent).toBe("208 · Ângela");
    expect(screen.getByRole("button", { name: "Data" })).toBeTruthy();
  });
});
