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
import { CarteiraTab } from "../components/CarteiraTab";
import { SugestoesTab } from "../components/SugestoesTab";
import { SaudeUbereSection } from "../components/SaudeUbereSection";
import { AnimalTab } from "../components/AnimalTab";
import { NutricaoTab } from "../components/NutricaoTab";
import { ConsumoLoteDrawer } from "../components/ConsumoLoteDrawer";
import { AcasalamentoPlanosTab } from "../components/AcasalamentoPlanosTab";
import { RelatorioReproducaoSection } from "../components/RelatorioReproducaoSection";
import { RelatoriosTab } from "../components/RelatoriosTab";

describe("render smoke", () => {
  it("AppSidebar renders work areas and direct operational shortcuts", () => {
    const html = renderToString(h(AppSidebar, {
      current: "dashboard", onNav: () => {}, financeiro: [{ id: "dashboard", label: "Dashboard" }, { id: "ia", label: "IA" }],
      isAdmin: true,
      podeVerFolha: true,
      mobileOpen: false, onMobileToggle: () => {},
      onAbrirBusca: () => {},
      propAtiva: null, onTrocarProp: () => {},
      user: { id: "u1", nome: "Marco", email: "marco@rio.com", inicial: "M", papel: "proprietario", status: "ativo", ultimoAcesso: "hoje", abas: [], flags: [] },
      colapsada: false, onToggleColapsar: () => {}, onAcessos: () => {}, onSair: () => {},
    }));
    // Rotinas frequentes são diretas; somente recursos secundários ficam dobrados.
    expect(html).toContain("Buscar páginas, animais e ações");
    expect(html).toContain("Financeiro");
    expect(html).toContain("Terrano");           // marca no topo da sidebar
    expect(html).toContain("Pecuária");
    expect(html).toContain("Agronomia");
    expect(html).toContain("Buscar");
    expect(html).toContain("Configurações");     // único item do rodapé (hub)
    // Cadastros/Categorias/Caixinha/Acessos dobraram para dentro dos hubs
    // (Configurações/Gastos) — não são mais itens de topo da sidebar.
    expect(html).not.toContain(">Acessos<");
    expect(html).not.toContain("Estoque de insumos"); // opção secundária inicia fechada
  });

  it("RebanhoContent renders the FIV/TE tab shell", () => {
    const html = renderToString(h(RebanhoContent, { aba: "fiv" }));
    expect(html).toContain("Coletas");
    expect(html).toContain("Pool de doadoras");
  });

  it("RelatorioReproducaoSection renders the period filter and loading shell", () => {
    const html = renderToString(h(RelatorioReproducaoSection));
    expect(html).toContain("Relatório reprodutivo");
    expect(html).toContain("Aplicar período");
  });

  it("RelatoriosTab renders the guided report builder", () => {
    const html = renderToString(h(RelatoriosTab, { onAbrirFicha: () => {}, onRegistrar: () => {} }));
    expect(html).toContain("Relatórios");
    expect(html).toContain("Modelo de relatório");
    expect(html).toContain("Gerar relatório");
  });

  it("RebanhoContent renders the reports branch", () => {
    const html = renderToString(h(RebanhoContent, { aba: "relatorios" }));
    expect(html).toContain("Modelo de relatório");
  });

  it("RebanhoContent renders a domain tab shell (live-fetched)", () => {
    const html = renderToString(h(RebanhoContent, { aba: "reproducao" }));
    expect(html).toContain("Carregando");   // shell de loading (sem fetch no SSR)
  });

  it("AcasalamentoPlanosTab renders the loading shell without crashing", () => {
    const html = renderToString(h(AcasalamentoPlanosTab, { onAbrirFicha: () => {} }));
    expect(html).toContain("Carregando");
  });

  it("RebanhoContent renders the acasalamento branch without crashing", () => {
    const html = renderToString(h(RebanhoContent, { aba: "acasalamento" }));
    expect(html).toContain("Carregando");
  });

  it("SaudeUbereSection renders the úbere map (loading shell in SSR)", () => {
    // No SSR o hook fica em loading e o componente retorna null — não pode crashar.
    expect(() => renderToString(h(SaudeUbereSection, { animalId: "1" }))).not.toThrow();
  });

  it("App gates on login when there is no session (email + senha)", () => {
    // Gate real de acesso: sem sessão (token + usuário), o App renderiza a tela
    // de Login por e-mail+senha em vez do shell. A casca da sidebar continua
    // coberta pelo smoke de AppSidebar acima. (localStorage indisponível no SSR
    // ⇒ getToken/getUsuario = null ⇒ gate.)
    const html = renderToString(h(App));
    expect(html).toContain("Fazenda Rio Novo"); // marca da tela de Login
    expect(html).toContain("E-mail");           // campo de e-mail
    expect(html).toContain("Senha");            // campo de senha
    expect(html).not.toContain("nav-tabs");     // top bar removida
  });

  it("ConfiguracoesView renders the loading shell (fetches /rebanho/config)", () => {
    const html = renderToString(h(ConfiguracoesView));
    expect(html).toContain("Carregando"); // shell de loading (título de topo removido)
  });

  it("CadastrosView renders sub-abas and the loading shell (fetches /rebanho/produtos)", () => {
    const html = renderToString(h(CadastrosView));
    // (título de topo removido do produto)
    expect(html).toContain("Produtos");       // sub-aba
    expect(html).toContain("Fornecedores");   // sub-aba
    expect(html).toContain("Medidas de acasalamento"); // cadastro compartilhado do Bloco D
    expect(html).toContain("Carregando");     // shell de loading (sem fetch no SSR)
  });

  it("ProducaoTab renders the loading shell (fetches /rebanho/producao)", () => {
    const html = renderToString(h(ProducaoTab));
    expect(html).toContain("Carregando"); // shell de loading (título de topo removido)
  });

  it("EstoqueTab renders the loading shell (fetches /rebanho/estoque/*)", () => {
    const html = renderToString(h(EstoqueTab));
    expect(html).toContain("Carregando"); // shell de loading (título de topo removido)
  });

  it("CustoProducaoTab renders the loading shell (fetches /rebanho/custo-producao)", () => {
    const html = renderToString(h(CustoProducaoTab));
    expect(html).toContain("Carregando");           // shell de loading (título de topo removido)
    expect(html).toContain("Custo de sanidade");    // seção sempre visível
  });

  it("CarteiraTab renders the loading shell (fetches /rebanho/carteira)", () => {
    const html = renderToString(h(CarteiraTab, { onAbrirFicha: () => {} }));
    expect(html).toContain("Carregando"); // shell de loading (título de topo removido)
  });

  it("SugestoesTab renders the loading shell (fetches /rebanho/sugestoes)", () => {
    const html = renderToString(h(SugestoesTab, { onNav: () => {}, onAbrirFicha: () => {} }));
    expect(html).toContain("Carregando"); // shell de loading (título de topo removido)
  });

  it("DashboardView renders the loading shell (it now fetches live)", () => {
    // A view agora busca /rebanho/dashboard via useDashboard; em SSR (sem fetch)
    // renderiza o shell de carregamento sem lançar.
    const html = renderToString(h(DashboardView, { onNav: () => {} }));
    expect(html).toContain("Carregando"); // shell de loading (título de topo removido)
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

  it("NutricaoTab renders Lotes e Dietas (fetches live)", () => {
    const html = renderToString(h(NutricaoTab));
    expect(html).toContain("Lotes"); // título de topo removido; seções Lotes/Dietas permanecem
    expect(html).toContain("Dietas");
  });

  it("ConsumoLoteDrawer pode ser montado com o Dialog portalizado", () => {
    expect(() => renderToString(h(ConsumoLoteDrawer, {
      lote: { id: 1, nome: "Lote Teste", dietaId: 2, dietaNome: "Dieta X", numAnimais: 10, producaoMedia: null },
      onFechar: () => {},
    }))).not.toThrow();
  });

  it("AnimalTab renders the status filter (Ativos/Baixados/Todos), visible while loading", () => {
    const html = renderToString(h(AnimalTab, { onAbrirAnimal: () => {}, onNovo: () => {} }));
    expect(html).toContain("Ativos");
    expect(html).toContain("Baixados");
    expect(html).toContain("Todos");
    expect(html).toContain("+ Novo animal");
    expect(html).toContain("Todas as localizações");
    expect(html).toContain("Todas as finalidades");
  });
});
