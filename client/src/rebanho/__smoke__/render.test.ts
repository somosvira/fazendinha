// TEMPORARY render smoke — verifies components actually render (catches runtime
// errors tsc/build miss). Uses react-dom/server (no new deps, no DOM needed).
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { RebanhoApp } from "../RebanhoApp";
import { DashboardView } from "../components/DashboardView";
import { IaView } from "../components/IaView";
import { AppSidebar } from "../../components/AppSidebar";
import { RebanhoContent } from "../RebanhoContent";
import { usuarios } from "../../data/acessos";

describe("render smoke", () => {
  it("AppSidebar renders both groups and the user chip", () => {
    const html = renderToString(h(AppSidebar, {
      current: "dashboard", onNav: () => {}, financeiro: [{ id: "dashboard", label: "Dashboard" }, { id: "ia", label: "IA" }],
      isAdmin: true, user: usuarios[0], allUsers: usuarios, onSwitchUser: () => {},
    }));
    expect(html).toContain("Financeiro");
    expect(html).toContain("Rebanho");
    expect(html).toContain("Painel");
    expect(html).toContain("IA financeira");
    expect(html).toContain("Acessos");
  });

  it("RebanhoContent renders a domain tab shell (live-fetched)", () => {
    const html = renderToString(h(RebanhoContent, { aba: "reproducao" }));
    expect(html).toContain("Carregando");   // shell de loading (sem fetch no SSR)
  });

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
    expect(html).toContain("Pergunte qualquer coisa sobre a fazenda");  // intro
    expect(html).toContain("CCS alto e subindo");   // suggested prompt
    expect(html).toContain("Insights da semana");    // side feed
    // A thread começa vazia (sem conteúdo enlatado) — só aparece após perguntar.
    expect(html).not.toContain("Jurema #1234");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });
});
