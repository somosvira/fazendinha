// TEMPORARY render smoke — verifies components actually render (catches runtime
// errors tsc/build miss). Uses react-dom/server (no new deps, no DOM needed).
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { RebanhoApp } from "../RebanhoApp";
import { DashboardView } from "../components/DashboardView";
import { IaView } from "../components/IaView";

describe("render smoke", () => {
  it("RebanhoApp renders the default Reprodução herd view", () => {
    const html = renderToString(h(RebanhoApp));
    expect(html).toContain("Reprodução");
    expect(html).toContain("A inseminar");
    expect(html).toContain("Aurora");          // first row of the inseminar work-list
    expect(html).toContain("concepção caiu");  // proactive IA band
  });

  it("DashboardView renders herd KPIs, domain cards and alerts", () => {
    const html = renderToString(h(DashboardView, { onNav: () => {} }));
    expect(html).toContain("Rebanho ativo");
    expect(html).toContain("522");
    expect(html).toContain("Animais em situação de alerta");
    expect(html).toContain("Secagens atrasadas");
  });

  it("IaView renders chat, suggestions and the insights feed safely", () => {
    const html = renderToString(h(IaView));
    expect(html).toContain("Pergunte qualquer coisa sobre a fazenda");
    expect(html).toContain("CCS alto e subindo");   // suggested prompt
    expect(html).toContain("Jurema #1234");          // IA answer content
    expect(html).toContain("Insights da semana");    // side feed
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });
});
