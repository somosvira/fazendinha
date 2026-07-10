/* @vitest-environment node */
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement as h } from "react";
import { RebField, REB_FIELD_BOXED } from "./RebField";
import {
  RebMain,
  RebBox,
  RebBoxSection,
  RebKv,
  RebPill,
  RebAnm,
  RebEmpty,
  RebFieldset,
} from "./RebPrimitives";

describe("RebField", () => {
  it("renders the label text and wraps the control", () => {
    const html = renderToString(
      h(RebField, { label: "Nome" }, h("input", { defaultValue: "x" })),
    );
    expect(html).toContain("Nome");
    expect(html).toContain("<input");
    expect(html).toContain("<label");
  });

  it("applies the .rb-fld editorial label chrome (serif italic, ink-3)", () => {
    const html = renderToString(h(RebField, { label: "L" }, h("input")));
    expect(html).toContain("font-serif");
    expect(html).toContain("italic");
    expect(html).toContain("text-ink-3");
  });

  it("styles descendant controls with the underline look", () => {
    const html = renderToString(h(RebField, { label: "L" }, h("select")));
    // React escapes & → &amp; in the rendered class attr; Tailwind reads source.
    expect(html).toContain("[&amp;_select]:border-b");
  });

  it("omits the label span when no label given", () => {
    const html = renderToString(h(RebField, {}, h("input")));
    expect(html).not.toContain("<span");
  });

  it("exposes the boxed variant string for direct-on-control use", () => {
    expect(REB_FIELD_BOXED).toContain("border-border");
    expect(REB_FIELD_BOXED).toContain("bg-card");
  });
});

describe("RebPrimitives", () => {
  it("RebMain: max-width shell", () => {
    expect(renderToString(h(RebMain, {}, "c"))).toContain("max-w-[1520px]");
  });
  it("RebBox: card chrome", () => {
    const html = renderToString(h(RebBox, {}, h("h4", {}, "T")));
    expect(html).toContain("bg-card");
    expect(html).toContain("T");
  });
  it("RebBoxSection renders children", () => {
    expect(renderToString(h(RebBoxSection, {}, "s"))).toContain("s");
  });
  it("RebKv: key/value row", () => {
    const html = renderToString(h(RebKv, {}, h("span", {}, "k"), h("b", {}, "v")));
    expect(html).toContain("justify-between");
    expect(html).toContain("k");
    expect(html).toContain("v");
  });
  it("RebPill: default ok tone", () => {
    expect(renderToString(h(RebPill, {}, "p"))).toContain("var(--outros-soft)");
  });
  it("RebPill: bad tone", () => {
    expect(renderToString(h(RebPill, { tone: "bad" }, "p"))).toContain("text-prejuizo");
  });
  it("RebAnm: name + small", () => {
    const html = renderToString(h(RebAnm, {}, "Boi", h("small", {}, "123")));
    expect(html).toContain("font-semibold");
    expect(html).toContain("Boi");
  });
  it("RebEmpty: dashed empty state", () => {
    expect(renderToString(h(RebEmpty, {}, "vazio"))).toContain("border-dashed");
  });
  it("RebFieldset: legend chrome", () => {
    const html = renderToString(h(RebFieldset, {}, h("legend", {}, "Grau")));
    expect(html).toContain("<fieldset");
    expect(html).toContain("Grau");
  });
});
