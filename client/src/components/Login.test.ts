import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { Login } from "./Login";

describe("Login", () => {
  it("renderiza marca, título, label e botão", () => {
    const html = renderToString(h(Login));
    expect(html).toContain("Fazenda Rio Novo");
    expect(html).toContain("Entrar");
    expect(html).toContain("Senha");
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('data-slot="input"');
    expect(html).toContain('href="/forgot-password"');
    expect(html).toContain('aria-label="Mostrar senha"');
    expect(html).toContain('title="Mostrar senha"');
  });
});
