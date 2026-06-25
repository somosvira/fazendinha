// TEMPORARY render smoke — verifies components actually render (catches runtime
// errors tsc/build miss). Uses react-dom/server (no new deps, no DOM needed).
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { App } from "../../App";
import { DashboardView } from "../components/DashboardView";
import { IaView } from "../components/IaView";
import { AppSidebar } from "../../components/AppSidebar";
import { RebanhoContent } from "../RebanhoContent";
import { ConfiguracoesView } from "../components/ConfiguracoesView";
import { CadastrosView } from "../components/CadastrosView";
import { ProducaoTab } from "../components/ProducaoTab";
import { EstoqueTab } from "../components/EstoqueTab";
import { CustoProducaoTab } from "../components/CustoProducaoTab";
import { AnimalTab } from "../components/AnimalTab";
import { usuarios } from "../../data/acessos";

describe("render smoke", () => {
  it("AppSidebar renders both groups and the user chip", () => {
    const html = renderToString(h(AppSidebar, {
      current: "dashboard", onNav: () => {}, financeiro: [{ id: "dashboard", label: "Dashboard" }, { id: "ia", label: "IA" }],
      isAdmin: true, user: usuarios[0], allUsers: usuarios, onSwitchUser: () => {},
      mobileOpen: false, onMobileToggle: () => {},
    }));
    expect(html).toContain("Financeiro");
    expect(html).toContain("Rebanho");
    expect(html).toContain("Painel");
    expect(html).toContain("IA financeira");
    expect(html).toContain("Acessos");
    expect(html).toContain("Configurações");
    expect(html).toContain("Cadastros");
    expect(html).toContain("Produção");
    expect(html).toContain("Estoque");
    expect(html).toContain("Custo");
  });

  it("RebanhoContent renders a domain tab shell (live-fetched)", () => {
    const html = renderToString(h(RebanhoContent, { aba: "reproducao" }));
    expect(html).toContain("Carregando");   // shell de loading (sem fetch no SSR)
  });

  it("App renders the unified sidebar (no top bar)", () => {
    const html = renderToString(h(App));
    expect(html).toContain("Financeiro");   // grupo
    expect(html).toContain("Rebanho");       // grupo
    expect(html).toContain("Painel");        // item rebanho
    expect(html).not.toContain("nav-tabs");  // top bar removida
  });

  it("ConfiguracoesView renders the loading shell (fetches /rebanho/config)", () => {
    const html = renderToString(h(ConfiguracoesView));
    expect(html).toContain("Configurações");
    expect(html).toContain("Carregando");
  });

  it("CadastrosView renders sub-abas and the loading shell (fetches /rebanho/produtos)", () => {
    const html = renderToString(h(CadastrosView));
    expect(html).toContain("Cadastros");     // título
    expect(html).toContain("Produtos");       // sub-aba
    expect(html).toContain("Fornecedores");   // sub-aba
    expect(html).toContain("Carregando");     // shell de loading (sem fetch no SSR)
  });

  it("ProducaoTab renders the loading shell (fetches /rebanho/producao)", () => {
    const html = renderToString(h(ProducaoTab));
    expect(html).toContain("Produção");
    expect(html).toContain("Carregando");
  });

  it("EstoqueTab renders the loading shell (fetches /rebanho/estoque/*)", () => {
    const html = renderToString(h(EstoqueTab));
    expect(html).toContain("Estoque");
    expect(html).toContain("Carregando");
  });

  it("CustoProducaoTab renders the loading shell (fetches /rebanho/custo-producao)", () => {
    const html = renderToString(h(CustoProducaoTab));
    expect(html).toContain("Custo de Produção");
    expect(html).toContain("Carregando");
    expect(html).toContain("Custo de sanidade");
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

  it("AnimalTab renders the status filter (Ativos/Baixados/Todos), visible while loading", () => {
    const html = renderToString(h(AnimalTab, { onAbrirAnimal: () => {}, onNovo: () => {} }));
    expect(html).toContain("Ativos");
    expect(html).toContain("Baixados");
    expect(html).toContain("Todos");
    expect(html).toContain("+ Novo animal");
    expect(html).toContain("Todos os setores");
  });
});
