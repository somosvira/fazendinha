// Render smoke da aba Caixinha — espelha cultivo/__smoke__/render.test.ts:
// pega erros de runtime que tsc/build não pegam. Usa react-dom/server (sem
// DOM); hooks de fetch não disparam no SSR (useEffect), então a view renderiza
// o shell de carregando. ToastProvider é necessário (Caixinha usa useToast).
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { ToastProvider } from "../../components/Toast";
import { Caixinha } from "../Caixinha";
import { ContasAVencer } from "../ContasAVencer";

describe("financeiro render smoke", () => {
  it("Caixinha renderiza o shell da view", () => {
    const html = renderToString(h(ToastProvider, null, h(Caixinha)));
    // Sem título de topo (removido do produto); no SSR o hook fica em loading,
    // então a view renderiza o shell de carregando.
    expect(html).toContain("Carregando");
  });

  it("ContasAVencer renderiza o card (shell de carregando no SSR)", () => {
    // hooks de fetch não disparam no SSR (useEffect) → renderiza o título + shell.
    // ToastProvider necessário: o card usa useToast (botão "marcar pago").
    const html = renderToString(h(ToastProvider, null, h(ContasAVencer)));
    expect(html).toContain("Contas — a vencer, vencidas e pagas"); // aria-label do card
    expect(html).toContain("Contas em aberto ainda no prazo");
  });
});
