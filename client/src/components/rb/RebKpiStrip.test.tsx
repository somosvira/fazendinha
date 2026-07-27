import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { RebKpiStrip, RebKpi } from "./RebKpiStrip";

/* RebKpiStrip/RebKpi reproduzem .rb-kstrip/.rb-k (rebanho.css). SSR string. */

describe("RebKpiStrip", () => {
  it("define o número de colunas e permite reflow estreito", () => {
    const html = renderToString(h(RebKpiStrip, { cols: 3 }, "x"));
    expect(html).toContain("--reb-kpi-cols:3");
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("min-[700px]:grid-cols-2");
    expect(html).toContain("min-[1100px]:grid-cols-[repeat(var(--reb-kpi-cols),minmax(0,1fr))]");
  });

  it("renderiza os filhos", () => {
    const html = renderToString(
      h(RebKpiStrip, { cols: 2 }, h("span", null, "célula")),
    );
    expect(html).toContain("célula");
  });
});

describe("RebKpi", () => {
  it("renderiza label e valor", () => {
    const html = renderToString(h(RebKpi, { lab: "Total", val: "522" }));
    expect(html).toContain("Total");
    expect(html).toContain("522");
    expect(html).toContain("font-serif");
  });

  it("mostra o sufixo quando presente", () => {
    const html = renderToString(h(RebKpi, { lab: "Taxa", val: "80", sufixo: "%" }));
    expect(html).toContain("80");
    expect(html).toContain("%");
  });

  it("renderiza o detalhe com tom up (prejuízo)", () => {
    const html = renderToString(h(RebKpi, { lab: "Vazias", val: "12", d: "atenção", tom: "up" }));
    expect(html).toContain("atenção");
    expect(html).toContain("text-prejuizo");
  });

  it("renderiza o detalhe com tom ok (lucro)", () => {
    const html = renderToString(h(RebKpi, { lab: "Prenhes", val: "40", d: "bom", tom: "ok" }));
    expect(html).toContain("text-lucro");
  });

  it("aplica valClassName custom no valor", () => {
    const html = renderToString(h(RebKpi, { lab: "Custo", val: "R$ 10", valClassName: "text-[color:var(--cafe)]" }));
    expect(html).toContain("text-[color:var(--cafe)]");
  });

  it("omite o detalhe quando d é ausente", () => {
    const html = renderToString(h(RebKpi, { lab: "X", val: "1" }));
    expect(html).toContain("X");
  });
});
