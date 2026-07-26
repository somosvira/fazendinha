import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { AptidaoSection } from "./AptidaoSection";

describe("AptidaoSection", () => {
  it("renderiza a faixa de decisão reprodutiva e o estado de carregamento", () => {
    const html = renderToString(createElement(AptidaoSection)).replaceAll("<!-- -->", "");

    expect(html).toContain("Aptidão de novilhas");
    expect(html).toContain("13 meses");
    expect(html).toContain("320 kg");
    expect(html).toContain("Carregando candidatas");
  });
});
