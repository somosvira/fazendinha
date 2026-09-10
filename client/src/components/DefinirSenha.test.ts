import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { DefinirSenha } from "./DefinirSenha";

describe("DefinirSenha", () => {
  it("oferece mostrar senha nos dois campos de convite/reset", () => {
    const html = renderToString(h(DefinirSenha, { modo: "senha", token: "fixture-token", onPronto: () => {} }));
    expect(html.match(/aria-label="Mostrar senha"/g)).toHaveLength(2);
    expect(html.match(/title="Mostrar senha"/g)).toHaveLength(2);
    expect(html.match(/type="password"/g)).toHaveLength(2);
  });
});
