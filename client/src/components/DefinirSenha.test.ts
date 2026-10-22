import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { DefinirSenha } from "./DefinirSenha";

describe("DefinirSenha", () => {
  it("aguarda validar o link antes de oferecer campos de senha", () => {
    const html = renderToString(h(DefinirSenha, { modo: "senha", token: "fixture-token", onPronto: () => {} }));
    expect(html).toContain("Verificando seu link");
    expect(html).not.toContain('type="password"');
  });
});
