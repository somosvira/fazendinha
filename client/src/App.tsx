/* Rio Novo — raiz.
 * Permissionamento: Marco (dono) é o usuário logado. Ele gerencia acessos e pode
 * "ver como" outra pessoa — a navegação reduz às abas do perfil e os valores em R$
 * são mascarados quando o perfil não tem a flag verValores.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { type Tab, type NavTab } from "./components/Shell";
import { tabToPath, pathToTab, DEFAULT_TAB } from "./router";
import { AppSidebar } from "./components/AppSidebar";
import { Header } from "./components/Header";
import { Dashboard } from "./components/Dashboard";
import { Gastos } from "./components/Gastos";
import { Lancar } from "./components/Lancar";
import { Caixinha } from "./financeiro/Caixinha";
import { PlanoContas } from "./components/PlanoContas";
import { IA } from "./components/IA";
import { Relatorio } from "./components/Relatorio";
import { Acessos } from "./components/Acessos";
import { RebanhoContent, type RebSub } from "./rebanho/RebanhoContent";
import { PropriedadeSelector } from "./rebanho/components/PropriedadeSelector";
import { setPropriedadeAtiva, getPropriedadeAtiva } from "./propriedadeScope";
import { PlantioContent, type PlaSub } from "./plantio/PlantioContent";
import { PlantelContent, type CorSub } from "./corte/PlantelContent";
import { EquipeContent, type EqpSub } from "./equipe/EquipeContent";
import { CultivoContent, type MilSub } from "./cultivo/CultivoContent";
import { ConfiguracoesView } from "./rebanho/components/ConfiguracoesView";
import { CadastrosView } from "./rebanho/components/CadastrosView";
import { CommandPalette } from "./components/CommandPalette";
import { ChatWidget } from "./components/ChatWidget";
import { Login } from "./components/Login";
import { getToken, clearToken } from "./lib/auth";
import { ABAS, PAPEIS, usuarios, type User } from "./data/acessos";

function GatedTab({ user, abaLabel }: { user: User; abaLabel: string }) {
  return (
    <div className="shell-wide">
      <div className="gated-msg">
        <div className="lock">⊘</div>
        <div className="h">{user.nome.split(" ")[0]} não tem acesso a esta área</div>
        <div className="s">
          A aba <strong>{abaLabel}</strong> não está liberada para este perfil. O proprietário pode liberar em
          Acessos &amp; Permissões.
        </div>
      </div>
    </div>
  );
}

const REB: Record<string, RebSub> = {
  "reb-dashboard": "dashboard",
  "reb-animal": "animal",
  "reb-reproducao": "reproducao",
  "reb-sanidade": "sanidade",
  "reb-nutricao": "nutricao",
  "reb-producao": "producao",
  "reb-estoque": "estoque",
  "reb-custo": "custo",
  "reb-ia": "ia",
};

const PLA: Record<string, PlaSub> = {
  "pla-dashboard": "dashboard",
  "pla-talhao": "talhao",
  "pla-fenologia": "fenologia",
  "pla-fitossanidade": "fitossanidade",
  "pla-nutricao": "nutricao",
  "pla-colheita": "colheita",
  "pla-planejamento": "planejamento",
  "pla-estoque": "estoque",
  "pla-custo": "custo",
  "pla-ia": "ia",
};

const COR: Record<string, CorSub> = {
  "cor-dashboard": "dashboard",
  "cor-lote": "lote",
  "cor-pesagem": "pesagem",
  "cor-pasto": "pasto",
  "cor-sanidade": "sanidade",
  "cor-nutricao": "nutricao",
  "cor-comercial": "comercial",
  "cor-custo": "custo",
  "cor-ia": "ia",
};

const EQP: Record<string, EqpSub> = {
  "eqp-funcionarios": "funcionarios",
  "eqp-ponto": "ponto",
  "eqp-folha": "folha",
};

const MIL: Record<string, MilSub> = {
  "mil-safras": "safras",
  "mil-custos": "custos",
  "mil-producao": "producao",
  "mil-silos": "silos",
  "mil-custo": "custo",
};

export function App() {
  // Auth mínima está ENGATILHADA mas NÃO trava o app:
  //   - lib/auth.ts e Login.tsx continuam no repo prontos pra ser religados
  //     quando o piloto for pro dono (basta trocar `false` abaixo por
  //     `!getToken()` e o gate volta a valer)
  //   - o middleware do server só bloqueia se SHARED_ACCESS_TOKEN estiver setado
  //     — em dev/homolog, sem env, a API fica aberta
  //   - o botão Sair no Header só aparece se houver token gravado, então quem
  //     testar com token continua conseguindo sair.
  // Motivo do downgrade: durante a fase interna atual não deve travar a entrada
  // — o dono ainda não está usando; sempre entra como Marco Antônio.
  const tokenSalvo = getToken();
  const onSair = tokenSalvo ? () => { clearToken(); window.location.reload(); } : undefined;

  // Aba inicial vem da URL (deep-link / reload); cai no dashboard se a rota não
  // casar. Guard de `window` p/ render fora do browser (smoke test SSR).
  const [tab, setTab] = useState<Tab>(() =>
    (typeof window === "undefined" ? null : pathToTab(window.location.pathname)) ?? DEFAULT_TAB,
  );
  const [users, setUsers] = useState<User[]>(usuarios);
  const realUserId = "marco"; // o dono logado
  const [viewAsId, setViewAsId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  // Sítio ativo (multi-propriedade) — governa TODO o app (rebanho, financeiro,
  // dashboard). Trocar grava no escopo compartilhado (header X-Propriedade-Id) e
  // remonta o conteúdo via `key` abaixo, forçando refetch no escopo novo. null =
  // consolidado; com 1 sítio o seletor fica quase invisível (só o + discreto).
  const [propAtiva, setPropAtiva] = useState<number | null>(getPropriedadeAtiva());
  const trocarPropriedade = (id: number | null) => { setPropriedadeAtiva(id); setPropAtiva(id); };
  // Deep-link do ⌘K: ao escolher uma entidade real, guardamos {tab, id} e o
  // módulo dono consome (abre o cockpit) via `abrirId` + `onAbriuEntidade`.
  const [deepLink, setDeepLink] = useState<{ tab: Tab; id: string } | null>(null);

  // Deep-link da IA (chat): filtros aplicados numa tela via query string
  // (ex.: /gastos?status=vencidas). Inicializa da URL no load/reload.
  const [deepLinkFiltros, setDeepLinkFiltros] = useState<{ tab: Tab; filtros: Record<string, string> } | null>(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    if (![...sp.keys()].length) return null;
    const t = pathToTab(window.location.pathname);
    return t ? { tab: t, filtros: Object.fromEntries(sp.entries()) } : null;
  });

  // Navega a partir de um link da IA ("/caminho?filtros"): troca a aba e guarda os
  // filtros pra tela consumir na montagem. `id=` em módulo de cockpit (reb/pla/cor)
  // reaproveita o deepLink do ⌘K; o resto vira filtros de tabela (piloto: /gastos).
  const navegarDeepLink = (url: string) => {
    const qi = url.indexOf("?");
    const path = qi >= 0 ? url.slice(0, qi) : url;
    const query = qi >= 0 ? url.slice(qi + 1) : "";
    const t = pathToTab(path);
    if (!t) return;
    const filtros = Object.fromEntries(new URLSearchParams(query).entries());
    const s = String(t);
    const temCockpit = s.startsWith("reb-") || s.startsWith("pla-") || s.startsWith("cor-");
    if (filtros.id && temCockpit) {
      setDeepLink({ tab: t, id: filtros.id });
      setDeepLinkFiltros(null);
    } else {
      setDeepLink(null);
      setDeepLinkFiltros(Object.keys(filtros).length ? { tab: t, filtros } : null);
    }
    setTab(t);
    const alvo = tabToPath(t) + (query ? `?${query}` : "");
    if (window.location.pathname + window.location.search !== alvo) window.history.pushState(null, "", alvo);
  };

  // Navegação MANUAL (sidebar/conteúdo) — limpa filtros de deep-link p/ não reaplicar stale.
  const navegarTab = (t: Tab) => { setDeepLinkFiltros(null); setTab(t); };

  // atalho global ⌘K / Ctrl+K abre/fecha a command palette (Esc é tratado dentro dela)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBuscaAberta((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // body lock + tecla esc fecham o drawer mobile
  useEffect(() => {
    if (!mobileOpen) return;
    document.body.classList.add("no-scroll");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("no-scroll");
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  // Reflete a aba ativa na URL. Primeiro render usa replaceState (não empilha
  // histórico ao normalizar "/" → "/dashboard); trocas seguintes usam pushState
  // para o botão "voltar" do navegador funcionar.
  const firstSync = useRef(true);
  useEffect(() => {
    const path = tabToPath(tab);
    if (window.location.pathname !== path) {
      if (firstSync.current) window.history.replaceState(null, "", path);
      else window.history.pushState(null, "", path);
    }
    firstSync.current = false;
  }, [tab]);

  // Botões voltar/avançar do navegador → atualiza a aba a partir da URL.
  useEffect(() => {
    const onPop = () => setTab(pathToTab(window.location.pathname) ?? DEFAULT_TAB);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const effectiveUser = useMemo(() => {
    const id = viewAsId || realUserId;
    return users.find((u) => u.id === id) || users[0];
  }, [users, viewAsId]);

  const isAdmin = effectiveUser.flags.includes("gerenciarAcessos");
  // Módulo Equipe & Ponto expõe salário, CPF e chave Pix — mesma flag que
  // mascara "Pessoal / Salários" no financeiro. Gestor e consulta ficam de fora.
  const canSeeFolha = effectiveUser.flags.includes("verSalarios");

  // Abas visíveis do grupo Financeiro (sem "rebanho" e sem "acessos" — Acessos
  // mora no rodapé da sidebar, renderizado via isAdmin pelo AppSidebar).
  const visibleTabs = useMemo<NavTab[]>(() => {
    return ABAS.filter((a) => effectiveUser.abas.includes(a.id)).map((a) => ({
      id: a.id as Tab,
      label: a.label,
    }));
  }, [effectiveUser]);

  // Redireciona só quando a aba ativa é financeira e não permitida (reb-* / pla-* / cor-* sempre ok;
  // eqp-* segue o gate `verSalarios` — o próprio `EquipeContent` cai no <GatedTab> se não puder).
  useEffect(() => {
    const isReb = String(tab).startsWith("reb-");
    const isPla = String(tab).startsWith("pla-");
    const isCor = String(tab).startsWith("cor-");
    const isEqp = String(tab).startsWith("eqp-");
    const isMil = String(tab).startsWith("mil-");
    if (isReb || isPla || isCor || isEqp || isMil || tab === "acessos" || tab === "config" || tab === "cadastros") return;
    const allowed = visibleTabs.map((t) => t.id);
    if (!allowed.includes(tab)) setTab(allowed[0] || "dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs]);

  const canSee = (id: Tab) => visibleTabs.some((t) => t.id === id);

  const enterViewAs = (id: string) => {
    setViewAsId(id === realUserId ? null : id);
    setTab("dashboard");
  };

  const conteudo = String(tab).startsWith("reb-")
    ? <RebanhoContent aba={REB[tab]} onNavReb={(s) => setTab(("reb-" + s) as Tab)}
        abrirId={deepLink && deepLink.tab.startsWith("reb-") ? deepLink.id : undefined}
        onAbriuEntidade={() => setDeepLink(null)} />
    : String(tab).startsWith("pla-")
    ? <PlantioContent aba={PLA[tab]} onNavPla={(s) => setTab(("pla-" + s) as Tab)}
        abrirId={deepLink && deepLink.tab.startsWith("pla-") ? deepLink.id : undefined}
        onAbriuEntidade={() => setDeepLink(null)} />
    : String(tab).startsWith("cor-")
    ? <PlantelContent aba={COR[tab]} onNavCor={(s) => setTab(("cor-" + s) as Tab)}
        abrirId={deepLink && deepLink.tab.startsWith("cor-") ? deepLink.id : undefined}
        onAbriuEntidade={() => setDeepLink(null)} />
    : String(tab).startsWith("mil-")
    ? <CultivoContent aba={MIL[tab]} onNavMil={(s) => setTab(("mil-" + s) as Tab)} />
    : String(tab).startsWith("eqp-")
    ? (canSeeFolha
        ? <EquipeContent aba={EQP[tab]} onNavEqp={(s) => setTab(("eqp-" + s) as Tab)} />
        : <GatedTab user={effectiveUser} abaLabel="Equipe & Ponto" />)
    : (
      <>
        {tab === "dashboard" &&
          (canSee("dashboard")
            ? <Dashboard
                key={deepLinkFiltros?.tab === "dashboard" ? JSON.stringify(deepLinkFiltros.filtros) : "dashboard"}
                onNav={setTab}
                user={effectiveUser}
                filtrosIniciais={deepLinkFiltros?.tab === "dashboard" ? deepLinkFiltros.filtros : undefined}
              />
            : <GatedTab user={effectiveUser} abaLabel="Dashboard" />)}
        {tab === "gastos" &&
          (canSee("gastos")
            ? <Gastos
                key={deepLinkFiltros?.tab === "gastos" ? JSON.stringify(deepLinkFiltros.filtros) : "gastos"}
                onNav={setTab}
                user={effectiveUser}
                filtrosIniciais={deepLinkFiltros?.tab === "gastos" ? deepLinkFiltros.filtros : undefined}
              />
            : <GatedTab user={effectiveUser} abaLabel="Gastos" />)}
        {tab === "ia" && (canSee("ia") ? <IA /> : <GatedTab user={effectiveUser} abaLabel="IA" />)}
        {tab === "relatorio" &&
          (canSee("relatorio") ? <Relatorio onNav={setTab} /> : <GatedTab user={effectiveUser} abaLabel="Relatório" />)}
        {tab === "lancar" &&
          (canSee("lancar") ? <Lancar onNav={setTab} /> : <GatedTab user={effectiveUser} abaLabel="Lançar" />)}
        {tab === "caixinha" &&
          (canSee("caixinha") ? <Caixinha /> : <GatedTab user={effectiveUser} abaLabel="Caixinha" />)}
        {tab === "plano" &&
          (canSee("plano") ? <PlanoContas onNav={setTab} /> : <GatedTab user={effectiveUser} abaLabel="Categorias" />)}
        {tab === "acessos" &&
          (isAdmin ? <Acessos users={users} setUsers={setUsers} onViewAs={enterViewAs} /> : <GatedTab user={effectiveUser} abaLabel="Acessos" />)}
        {tab === "config" && <ConfiguracoesView />}
        {tab === "cadastros" && <CadastrosView />}
      </>
    );

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Ir para o conteúdo</a>
      <Header
        user={effectiveUser}
        allUsers={viewAsId ? null : users}
        onSwitchUser={enterViewAs}
        mobileOpen={mobileOpen}
        onMobileToggle={setMobileOpen}
        onAbrirBusca={() => setBuscaAberta(true)}
        onSair={onSair}
      />
      <AppSidebar
        current={tab}
        onNav={navegarTab}
        financeiro={visibleTabs}
        isAdmin={isAdmin}
        podeVerFolha={canSeeFolha}
        mobileOpen={mobileOpen}
        onMobileToggle={setMobileOpen}
      />
      <main id="main-content" className="app-main" {...(mobileOpen ? { inert: "" } : {})}>
        {viewAsId && (
          <div className="viewas-banner">
            <span className="eye">👁</span>
            <span>
              Você está vendo o sistema como <strong>{effectiveUser.nome}</strong> —{" "}
              {effectiveUser.papel === "personalizado" ? "Personalizado" : PAPEIS[effectiveUser.papel]?.nome}
            </span>
            <button
              onClick={() => {
                setViewAsId(null);
                setTab("dashboard");
              }}
            >
              Voltar para Marco (admin)
            </button>
          </div>
        )}
        <PropriedadeSelector value={propAtiva} onChange={trocarPropriedade} />
        <div key={propAtiva ?? "all"} style={{ display: "contents" }}>
          {conteudo}
        </div>
      </main>
      <CommandPalette
        aberto={buscaAberta}
        onFechar={() => setBuscaAberta(false)}
        onNav={(t, entidadeId) => {
          setTab(t);
          // Só entidades de cockpit (reb-*/pla-*/cor-*) precisam de deep-link;
          // categoria/fornecedor apenas navegam para a aba.
          const s = String(t);
          const temCockpit = s.startsWith("reb-") || s.startsWith("pla-") || s.startsWith("cor-");
          setDeepLink(entidadeId && temCockpit ? { tab: t, id: entidadeId } : null);
        }}
        podeVer={(t) => {
          const s = String(t);
          if (s.startsWith("eqp-")) return canSeeFolha; // gate por verSalarios (PII: salário/CPF/Pix)
          if (s.startsWith("reb-") || s.startsWith("pla-") || s.startsWith("cor-") || s.startsWith("mil-")) return true;
          if (t === "config" || t === "cadastros") return true; // sempre visíveis na sidebar
          if (t === "acessos") return isAdmin;
          return canSee(t);
        }}
      />
      <ChatWidget onNavegar={navegarDeepLink} />
    </div>
  );
}
