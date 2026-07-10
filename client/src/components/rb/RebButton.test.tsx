import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { RebButton } from "./RebButton";

/* RebButton é o primitivo de botão dos módulos operacionais (rebanho/corte/
 * plantio/cultivo/equipe). Reproduz .rb-btn / .rb-btn.pri / .rb-btn-danger.
 * Testes por SSR string (mesma convenção de ui/button.test.ts). */

describe("RebButton", () => {
  it("renderiza a variante default (borda + fundo transparente)", () => {
    const html = renderToString(h(RebButton, null, "Filtrar"));
    expect(html).toContain("Filtrar");
    expect(html).toContain("border-border");
    expect(html).toContain("bg-transparent");
    expect(html).toContain("text-ink-2");
  });

  it("renderiza a variante pri (masthead escuro)", () => {
    const html = renderToString(h(RebButton, { variant: "pri" }, "Salvar"));
    expect(html).toContain("bg-mast");
    expect(html).toContain("text-mast-ink");
  });

  it("renderiza a variante danger (vermelho prejuízo)", () => {
    const html = renderToString(h(RebButton, { variant: "danger" }, "Excluir"));
    expect(html).toContain("bg-prejuizo");
    expect(html).toContain("text-white");
  });

  it("propaga aria-pressed e traz o estilo pressionado", () => {
    const html = renderToString(
      h(RebButton, { "aria-pressed": true }, "Ativos"),
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("aria-pressed:bg-[color:var(--bg-card-2)]");
  });

  it("aplica o estado disabled", () => {
    const html = renderToString(h(RebButton, { disabled: true }, "Off"));
    expect(html).toContain("disabled");
    expect(html).toContain("disabled:cursor-not-allowed");
  });

  it("mescla className custom preservando as classes base", () => {
    const html = renderToString(h(RebButton, { className: "mt-4" }, "X"));
    expect(html).toContain("mt-4");
    expect(html).toContain("font-semibold");
  });

  it("usa type=button por padrão (não submit)", () => {
    const html = renderToString(h(RebButton, null, "X"));
    expect(html).toContain('type="button"');
  });
});
