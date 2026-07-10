import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { RebTable } from "./RebTable";

/* RebTable reproduz .rb-tbl-wrap + table.rb-tbl (rebanho.css). SSR string.
 * Só o chrome estilizado — o caller passa thead/tbody. */

describe("RebTable", () => {
  it("envolve a tabela num wrapper com scroll horizontal", () => {
    const html = renderToString(h(RebTable, null, h("tbody")));
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("<table");
  });

  it("renderiza thead/tbody passados como filhos", () => {
    const html = renderToString(
      h(
        RebTable,
        null,
        h("thead", null, h("tr", null, h("th", null, "Animal"))),
        h("tbody", null, h("tr", null, h("td", null, "CAROLINA"))),
      ),
    );
    expect(html).toContain("Animal");
    expect(html).toContain("CAROLINA");
  });

  it("aplica o chrome de th/td via seletores descendentes", () => {
    const html = renderToString(h(RebTable, null, h("tbody")));
    // o & do seletor arbitrário é escapado como &amp; no HTML SSR
    expect(html).toContain("[&amp;_th]:font-serif");
    expect(html).toContain("[&amp;_td]:text-ink-2");
    expect(html).toContain("[&amp;_tr.rb-row]:cursor-pointer");
  });

  it("aceita className e wrapClassName custom", () => {
    const html = renderToString(
      h(RebTable, { className: "table-fixed", wrapClassName: "mt-2" }, h("tbody")),
    );
    expect(html).toContain("table-fixed");
    expect(html).toContain("mt-2");
  });
});
