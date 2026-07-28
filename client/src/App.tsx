/* Rio Novo — raiz.
 * Permissionamento: Marco (dono) é o usuário logado. Ele gerencia acessos e pode
 * "ver como" outra pessoa — a navegação reduz às abas do perfil e os valores em R$
 * são mascarados quando o perfil não tem a flag verValores.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { type Tab, type NavTab } from "./components/Shell";
import { buildRotaWorklistRebanho, parseRotaWorklistRebanho, tabToPath, pathToTab, DEFAULT_TAB, type RotaWorklistRebanho } from "./router";
import { AppSidebar } from "./components/AppSidebar";
import { Header } from "./components/Header";
import { Dashboard } from "./components/Dashboard";
import { Gastos } from "./components/Gastos";
import { Lancar } from "./components/Lancar";
import { ConfiguracoesHub } from "./components/ConfiguracoesHub";
import { IA } from "./components/IA";
import { Relatorio } from "./components/Relatorio";
import { RebanhoContent, type RebSub } from "./rebanho/RebanhoContent";
import type { WorklistRebanho } from "./rebanho/api";
import { setPropriedadeAtiva, getPropriedadeAtiva } from "./propriedadeScope";
import { PlantioContent, type PlaSub } from "./plantio/PlantioContent";
import { PlantelContent, type CorSub } from "./corte/PlantelContent";
import { EquipeContent, type EqpSub } from "./equipe/EquipeContent";
import { CultivoContent, type MilSub } from "./cultivo/CultivoContent";
import { CommandPalette } from "./components/CommandPalette";
import { ChatWidget } from "./components/ChatWidget";
import { Login } from "./components/Login";
import { DefinirSenha } from "./components/DefinirSenha";
import { getToken, getUsuario, setSessao, clearSessao, type UsuarioSessao } from "./lib/auth";
import { fetchMe, logout } from "./api/auth";
import { ABAS, type User } from "./data/acessos";
import { BootSplash } from "./components/Loading";
import { TerranoIntro } from "./components/TerranoIntro";

// Abertura Terrano (marca grande + música no centro, some pro canto).
//   "always"  → toca em todo load do dashboard (bom pra testar)
//   "session" → uma vez por sessão do navegador (usar antes do push)
//   "once"    → uma vez por dispositivo (localStorage)
// ⚠️ TROCAR PARA "session" ANTES DO PUSH.
const INTRO_MODE: "always" | "session" | "once" = "session";
const INTRO_SEEN_KEY = "terrano:intro:seen";

// Abas que já SÃO uma tela de chat com a IA. Nelas escondemos o botão flutuante
// do Assistente (ChatWidget) — teria um botão de chat sobre o composer de chat,
// além de colidir com o "Enviar/Perguntar" no canto inferior direito.
const ABAS_CHAT = new Set<Tab>(["ia"]);

function deveTocarIntro(tabInicial: Tab): boolean {
  if (tabInicial !== "dashboard") return false;
  if (INTRO_MODE === "always") return true;
  try {
    const store = INTRO_MODE === "session" ? sessionStorage : localStorage;
    return !store.getItem(INTRO_SEEN_KEY);
  } catch {
    return true;
  }
}

function marcarIntroVista() {
  if (INTRO_MODE === "always") return;
  try {
    (INTRO_MODE === "session" ? sessionStorage : localStorage).setItem(INTRO_SEEN_KEY, "1");
  } catch {
    /* storage indisponível — ignora */
  }
}

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
  "reb-acasalamento": "acasalamento",
  "reb-sanidade": "sanidade",
  "reb-nutricao": "nutricao",
  "reb-producao": "producao",
  "reb-estoque": "estoque",
  "reb-custo": "custo",
  "reb-carteira": "carteira",
  "reb-sugestoes": "sugestoes",
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
};

const EQP: Record<string, EqpSub> = {
  "eqp-dashboard": "dashboard",
  "eqp-funcionarios": "funcionarios",
  "eqp-ponto": "ponto",
  "eqp-folha": "folha",
};

const MIL: Record<string, MilSub> = {
  "mil-dashboard": "dashboard",
  "mil-safras": "safras",
  "mil-custos": "custos",
  "mil-producao": "producao",
  "mil-silos": "silos",
  "mil-custo": "custo",
};

export function App() {
  // Deep-link de convite/reset: /convite/<token> ou /senha/<token>. Renderiza a
  // tela de definir senha independentemente do gate de login (ver render abaixo).
  const rotaSenha = (() => {
    if (typeof window === "undefined") return null;
    const m = /^\/(convite|senha)\/(.+)$/.exec(window.location.pathname);
    if (!m) return null;
    return { modo: (m[1] === "convite" ? "convite" : "senha") as "convite" | "senha", token: m[2] };
  })();

  // Sessão real (usuários do backend). O login por e-mail+senha grava token +
  // usuário e transiciona EM ESTADO — sem window.location.reload(). Um reload
  // mataria a "sticky activation" do documento e o navegador voltaria a bloquear
  // o áudio da abertura Terrano, ancorado no clique de "Entrar".
  const [token, setTokenState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getToken(),
  );
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(() =>
    typeof window === "undefined" ? null : getUsuario(),
  );

  // Aba inicial vem da URL (deep-link / reload); cai no dashboard se a rota não
  // casar. Guard de `window` p/ render fora do browser (smoke test SSR).
  const [tab, setTab] = useState<Tab>(() =>
    (typeof window === "undefined" ? null : pathToTab(window.location.pathname)) ?? DEFAULT_TAB,
  );
  // Abertura Terrano: no boot quando abre já no dashboard (ver INTRO_MODE). No
  // clique de "Entrar" ela também é (re)disparada — aí a música toca junto com a
  // logo, porque o clique libera o áudio.
  const [showIntro, setShowIntro] = useState<boolean>(() =>
    typeof window === "undefined"
      ? false
      : deveTocarIntro(pathToTab(window.location.pathname) ?? DEFAULT_TAB),
  );
  const entrar = (novoToken: string, u: UsuarioSessao) => {
    setSessao(novoToken, u); // persiste token + usuário pras próximas requests
    setTokenState(novoToken); // transiciona pro app SEM reload (gesto vivo p/ o áudio)
    setUsuario(u);
    setShowIntro(deveTocarIntro(tab)); // abertura logo após o login → play() liberado
  };
  const onSair = token
    ? () => {
        void logout();
        clearSessao();
        setTokenState(null);
        setUsuario(null);
        setShowIntro(false);
      }
    : undefined;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  // Colapso manual da sidebar (trilho ícone-only) — persistido entre sessões.
  const [sideColapsada, setSideColapsada] = useState<boolean>(() => {
    try { return localStorage.getItem("side-collapsed") === "1"; } catch { return false; }
  });
  const toggleSidebar = () =>
    setSideColapsada((v) => {
      const n = !v;
      try { localStorage.setItem("side-collapsed", n ? "1" : "0"); } catch { /* noop */ }
      return n;
    });
  // Sítio ativo (multi-propriedade) — governa TODO o app (rebanho, financeiro,
  // dashboard). Trocar grava no escopo compartilhado (header X-Propriedade-Id) e
  // remonta o conteúdo via `key` abaixo, forçando refetch no escopo novo. null =
  // consolidado; com 1 sítio o seletor fica quase invisível (só o + discreto).
  const [propAtiva, setPropAtiva] = useState<number | null>(getPropriedadeAtiva());
  // Worklist persistente vem da URL; o snapshot é transitório e só existe quando
  // o clique parte do dashboard já carregado.
  const [rotaWorklist, setRotaWorklist] = useState<RotaWorklistRebanho | null>(() =>
    typeof window === "undefined" ? null : parseRotaWorklistRebanho(window.location.pathname, window.location.search),
  );
  const [worklistSnapshot, setWorklistSnapshot] = useState<WorklistRebanho | null>(null);
  const trocarPropriedade = (id: number | null) => {
    setPropriedadeAtiva(id);
    setPropAtiva(id);
    setWorklistSnapshot(null);
  };
  // Deep-link do ⌘K: ao escolher uma entidade real, guardamos {tab, id} e o
  // módulo dono consome (abre o cockpit) via `abrirId` + `onAbriuEntidade`.
  const [deepLink, setDeepLink] = useState<{ tab: Tab; id: string } | null>(null);

  // Deep-link da IA (chat): filtros aplicados numa tela via query string
  // (ex.: /gastos?status=vencidas). Inicializa da URL no load/reload.
  const [deepLinkFiltros, setDeepLinkFiltros] = useState<{ tab: Tab; filtros: Record<string, string> } | null>(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    if (![...sp.keys()].length || sp.has("worklist")) return null;
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
    setRotaWorklist(null);
    setWorklistSnapshot(null);
    setTab(t);
    const alvo = tabToPath(t) + (query ? `?${query}` : "");
    if (window.location.pathname + window.location.search !== alvo) window.history.pushState(null, "", alvo);
  };

  // Navegação MANUAL (sidebar/conteúdo) — limpa filtros de deep-link p/ não reaplicar stale.
  const navegarTab = (t: Tab) => {
    setDeepLinkFiltros(null);
    setRotaWorklist(null);
    setWorklistSnapshot(null);
    setTab(t);
    const alvo = tabToPath(t);
    if (window.location.pathname + window.location.search !== alvo) window.history.pushState(null, "", alvo);
  };

  const abrirWorklist = (worklist: WorklistRebanho) => {
    const alvo = buildRotaWorklistRebanho(worklist.chave, worklist.tab);
    if (!alvo) return;
    const rota = { chave: worklist.chave, tab: worklist.tab } as RotaWorklistRebanho;
    setDeepLink(null);
    setDeepLinkFiltros(null);
    setRotaWorklist(rota);
    setWorklistSnapshot(worklist);
    setTab(`reb-${worklist.tab}` as Tab);
    if (window.location.pathname + window.location.search !== alvo) window.history.pushState(null, "", alvo);
  };

  // Splash de abertura — cobre o primeiro paint até as fontes (Newsreader/DM Sans)
  // resolverem, com um tempo mínimo pra não piscar. Some com fade-out.
  const [booting, setBooting] = useState(true);
  const [bootLeaving, setBootLeaving] = useState(false);
  useEffect(() => {
    let vivo = true;
    const minTempo = new Promise<void>((r) => window.setTimeout(r, 750));
    const fontes = (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready ?? Promise.resolve();
    Promise.all([minTempo, fontes]).then(() => {
      if (!vivo) return;
      setBootLeaving(true);
      window.setTimeout(() => { if (vivo) setBooting(false); }, 480);
    });
    return () => { vivo = false; };
  }, []);

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
    const worklistUrl = rotaWorklist && tab === `reb-${rotaWorklist.tab}`
      ? buildRotaWorklistRebanho(rotaWorklist.chave, rotaWorklist.tab)
      : null;
    const filtrosUrl = deepLinkFiltros?.tab === tab
      ? `${tabToPath(tab)}?${new URLSearchParams(deepLinkFiltros.filtros).toString()}`
      : null;
    const alvo = worklistUrl ?? filtrosUrl ?? tabToPath(tab);
    if (window.location.pathname + window.location.search !== alvo) {
      if (firstSync.current) window.history.replaceState(null, "", alvo);
      else window.history.pushState(null, "", alvo);
    }
    firstSync.current = false;
  }, [tab, rotaWorklist, deepLinkFiltros]);

  // Botões voltar/avançar restauram pathname + worklist como uma única rota.
  useEffect(() => {
    const onPop = () => {
      setTab(pathToTab(window.location.pathname) ?? DEFAULT_TAB);
      setRotaWorklist(parseRotaWorklistRebanho(window.location.pathname, window.location.search));
      setWorklistSnapshot(null);
      const sp = new URLSearchParams(window.location.search);
      const t = pathToTab(window.location.pathname);
      setDeepLinkFiltros(t && [...sp.keys()].length && !sp.has("worklist") ? { tab: t, filtros: Object.fromEntries(sp.entries()) } : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Revalida a sessão no backend quando há token: se caiu (revogado/expirado),
  // desloga; se ainda vale, refresca o usuário guardado.
  useEffect(() => {
    if (!token) return;
    fetchMe()
      .then((u) => {
        if (u) {
          setUsuario(u);
          setSessao(token, u);
        } else {
          clearSessao();
          setTokenState(null);
          setUsuario(null);
        }
      })
      .catch(() => {});
  }, [token]);

  // Adaptador: o backend entrega `UsuarioSessao` (id numérico, status MAIÚSCULO,
  // sem `inicial`); as telas apresentacionais (Header/Dashboard/Gastos/GatedTab)
  // consomem o shape `User` do mock. Derivamos um `User` a partir da sessão real.
  const effectiveUser = useMemo<User | null>(
    () =>
      usuario
        ? {
            id: String(usuario.id),
            nome: usuario.nome,
            email: usuario.email,
            inicial: usuario.nome.trim()[0]?.toUpperCase() ?? "?",
            papel: usuario.papel,
            status: usuario.status.toLowerCase() as User["status"],
            ultimoAcesso: "",
            abas: usuario.abas,
            flags: usuario.flags,
            dono: usuario.dono,
          }
        : null,
    [usuario],
  );

  const isAdmin = !!effectiveUser?.flags.includes("gerenciarAcessos") || !!effectiveUser?.dono;
  // Módulo Equipe & Ponto expõe salário, CPF e chave Pix — mesma flag que
  // mascara "Pessoal / Salários" no financeiro. Gestor e consulta ficam de fora.
  const canSeeFolha = !!effectiveUser?.flags.includes("verSalarios") || !!effectiveUser?.dono;

  // Abas visíveis do grupo Financeiro (sem "rebanho" e sem "acessos" — Acessos
  // mora no rodapé da sidebar, renderizado via isAdmin pelo AppSidebar).
  const visibleTabs = useMemo<NavTab[]>(() => {
    if (!effectiveUser) return [];
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

  // Gate de acesso. Deep-link de convite/reset tem prioridade: mesmo deslogado,
  // /convite|/senha renderiza a tela de definir senha. Todos os hooks acima já
  // rodaram — os early returns aqui não violam as Rules of Hooks.
  if (rotaSenha) {
    return (
      <DefinirSenha
        modo={rotaSenha.modo}
        token={rotaSenha.token}
        onPronto={(t, u) => {
          entrar(t, u);
          window.history.replaceState(null, "", "/dashboard");
        }}
      />
    );
  }
  // Sem sessão válida (token + usuário), só a tela de login. `entrar` recebe o
  // gesto do clique e transiciona em estado — a intro monta no MESMO documento,
  // liberando o play() da música da abertura.
  if (!token || !usuario || !effectiveUser) {
    return <Login onEntrar={entrar} />;
  }

  const conteudo = String(tab).startsWith("reb-")
    ? <RebanhoContent aba={REB[tab]} onNavReb={(s) => navegarTab(("reb-" + s) as Tab)}
        onAbrirWorklist={abrirWorklist}
        worklistChave={rotaWorklist?.chave}
        worklistSnapshot={worklistSnapshot && worklistSnapshot.chave === rotaWorklist?.chave ? worklistSnapshot : undefined}
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
        {/* Gastos vira hub: Contas + Caixinha (sub-aba dobrada). /caixinha ainda
            resolve — abre o hub na sub-aba Caixinha. */}
        {(tab === "gastos" || tab === "caixinha") &&
          (canSee("gastos") || (tab === "caixinha" && canSee("caixinha"))
            ? <Gastos
                key={deepLinkFiltros?.tab === "gastos" ? JSON.stringify(deepLinkFiltros.filtros) : "gastos"}
                onNav={setTab}
                user={effectiveUser}
                sub={tab === "caixinha" ? "caixinha" : "contas"}
                podeCaixinha={canSee("caixinha")}
                filtrosIniciais={deepLinkFiltros?.tab === "gastos" ? deepLinkFiltros.filtros : undefined}
              />
            : <GatedTab user={effectiveUser} abaLabel={tab === "caixinha" ? "Caixinha" : "Gastos"} />)}
        {tab === "ia" && (canSee("ia") ? <IA /> : <GatedTab user={effectiveUser} abaLabel="IA" />)}
        {tab === "relatorio" &&
          (canSee("relatorio") ? <Relatorio onNav={setTab} /> : <GatedTab user={effectiveUser} abaLabel="Relatório" />)}
        {tab === "lancar" &&
          (canSee("lancar") ? <Lancar onNav={setTab} /> : <GatedTab user={effectiveUser} abaLabel="Lançar" />)}
        {/* Configurações vira hub: Geral · Cadastros · Categorias · Acessos.
            /cadastros, /categorias, /acessos ainda resolvem — abrem a sub-aba. */}
        {(tab === "config" || tab === "cadastros" || tab === "plano" || tab === "acessos") && (
          <ConfiguracoesHub
            tab={tab}
            onNav={setTab}
            isAdmin={isAdmin}
            podeCategorias={canSee("plano")}
          />
        )}
      </>
    );

  return (
    <>
      {/* Sem BootSplash quando a abertura Terrano vai rodar — o overlay dela já
          cobre o app (fundo desfocado) e evita dois splashes empilhados. */}
      {booting && !showIntro && <BootSplash leaving={bootLeaving} />}
      {showIntro && (
        <TerranoIntro
          onDone={() => {
            marcarIntroVista();
            setShowIntro(false);
          }}
        />
      )}
    <div className={"app" + (sideColapsada ? " side-collapsed" : "")}>
      <a className="skip-link" href="#main-content">Ir para o conteúdo</a>
      <Header
        user={effectiveUser}
        mobileOpen={mobileOpen}
        onMobileToggle={setMobileOpen}
        colapsada={sideColapsada}
        onToggleColapsar={toggleSidebar}
        onAbrirBusca={() => setBuscaAberta(true)}
        onPreferencias={() => setTab("config")}
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
        propAtiva={propAtiva}
        onTrocarProp={trocarPropriedade}
      />
      <main id="main-content" className="app-main" {...(mobileOpen ? { inert: "" } : {})}>
        <div key={propAtiva ?? "all"} style={{ display: "contents" }}>
          {conteudo}
        </div>
      </main>
      <CommandPalette
        aberto={buscaAberta}
        onFechar={() => setBuscaAberta(false)}
        onNav={(t, entidadeId) => {
          setRotaWorklist(null);
          setWorklistSnapshot(null);
          setDeepLinkFiltros(null);
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
      {!ABAS_CHAT.has(tab) && <ChatWidget onNavegar={navegarDeepLink} />}
    </div>
    </>
  );
}
