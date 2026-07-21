// @vitest-environment jsdom
import { createElement } from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtencaoCard, LeiteHojeCard, CaixaCard } from "./InicioCards";

afterEach(cleanup);

describe("LeiteHojeCard", () => {
  it("mostra produção e chama onVer no atalho", () => {
    const onVer = vi.fn();
    const { getByText, getByRole } = render(createElement(LeiteHojeCard, {
      resumo: { producaoDia: 980, emLactacao: 98, mediaVaca: 10, tendenciaPct: 3 }, onVer,
    }));
    expect(getByText(/980/)).toBeTruthy();
    fireEvent.click(getByRole("button", { name: /Ver rebanho/ }));
    expect(onVer).toHaveBeenCalledOnce();
  });
  it("estado de erro não quebra e mostra aviso", () => {
    const { getByText } = render(createElement(LeiteHojeCard, {
      resumo: { producaoDia: null, emLactacao: null, mediaVaca: null, tendenciaPct: null }, erro: true, onVer: () => {},
    }));
    expect(getByText(/Não foi possível carregar/)).toBeTruthy();
  });
});

describe("CaixaCard", () => {
  it("mostra saldo e rótulo do mês", () => {
    const { getByText } = render(createElement(CaixaCard, {
      resumo: { saldo: 12345.67, mesLabel: "mai/26", entrada: 5000, saida: 3000, fluxo: 2000 }, onVer: () => {},
    }));
    expect(getByText(/mai\/26/)).toBeTruthy();
  });
});

describe("AtencaoCard", () => {
  it("vazio mostra operação em dia", () => {
    const { getByText } = render(createElement(AtencaoCard, { itens: [], onAbrir: () => {} }));
    expect(getByText(/em dia/i)).toBeTruthy();
  });
  it("item chama onAbrir com a tab", () => {
    const onAbrir = vi.fn();
    const { getByText } = render(createElement(AtencaoCard, {
      itens: [{ chave: "ccs-alta", titulo: "CCS alta", quantidade: 5, severidade: "alta", tab: "sanidade" }], onAbrir,
    }));
    fireEvent.click(getByText(/CCS alta/));
    expect(onAbrir).toHaveBeenCalledWith("sanidade");
  });
});
