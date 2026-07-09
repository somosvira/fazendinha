import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { Button } from "./button";

describe("Button", () => {
  it("renderiza a variante default com o token primário", () => {
    const html = renderToString(h(Button, null, "Salvar"));
    expect(html).toContain("Salvar");
    expect(html).toContain("bg-primary");
    expect(html).toContain('data-slot="button"');
  });

  it("aplica a variante outline", () => {
    const html = renderToString(h(Button, { variant: "outline" }, "Cancelar"));
    expect(html).toContain("border-input");
  });
});
