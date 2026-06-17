// TEMPORARY render smoke — verifies components actually render (catches runtime
// errors tsc/build miss). Uses react-dom/server (no new deps, no DOM needed).
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { RebanhoApp } from "../RebanhoApp";
import { DashboardView } from "../components/DashboardView";
import { IaView } from "../components/IaView";

describe("render smoke", () => {
  it("RebanhoApp renders the default Reprodução tab (live-fetched)", () => {
    const html = renderToString(h(RebanhoApp));
    expect(html).toContain("Reprodução");
    // A aba Reprodução agora busca os resumos reais via useAnimais; em SSR
    // (sem fetch) renderiza o shell de carregamento sem lançar.
    expect(html).toContain("Carregando…");
    expect(html).toContain("Marco Antônio");   // sidebar/masthead montou
  });

  it("DashboardView renders the loading shell (it now fetches live)", () => {
    // A view agora busca /rebanho/dashboard via useDashboard; em SSR (sem fetch)
    // renderiza o shell de carregamento sem lançar.
    const html = renderToString(h(DashboardView, { onNav: () => {} }));
    expect(html).toContain("Dashboard");
    expect(html).toContain("Carregando");
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
