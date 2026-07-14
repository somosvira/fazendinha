// Prova que o chat renderiza deep-links [rótulo](/caminho?filtros) como botão
// clicável (chamando onNavegar), e não como texto cru. Cobre o item 1 (client).
import { describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Formatado } from "../ChatWidget";

describe("Formatado — deep-links do chat", () => {
  it("renderiza [rótulo](/caminho?filtros) como <button>, não texto cru", () => {
    const html = renderToStaticMarkup(
      h(Formatado, { texto: "As vencidas somam R$ 10. [Ver contas vencidas](/gastos?status=vencidas)", onNavegar: () => {} }),
    );
    expect(html).toContain("<button");
    expect(html).toContain("chat-inline-link");
    expect(html).toContain("Ver contas vencidas"); // rótulo aparece
    expect(html).not.toContain("(/gastos?status=vencidas)"); // a URL crua NÃO vaza como texto
  });

  it("preserva **negrito** junto do link", () => {
    const html = renderToStaticMarkup(
      h(Formatado, { texto: "**Total:** R$ 10 [abrir](/gastos)", onNavegar: () => {} }),
    );
    expect(html).toContain("<strong>Total:</strong>");
    expect(html).toContain("<button");
  });

  it("sem onNavegar, cai para o rótulo em texto (não quebra)", () => {
    const html = renderToStaticMarkup(h(Formatado, { texto: "veja [aqui](/gastos)" }));
    expect(html).toContain("aqui");
    expect(html).not.toContain("<button");
  });
});
