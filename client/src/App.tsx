/* Rio Novo — raiz.
 * Permissionamento: Marco (dono) é o usuário logado. Ele gerencia acessos e pode
 * "ver como" outra pessoa — a navegação reduz às abas do perfil e os valores em R$
 * são mascarados quando o perfil não tem a flag verValores.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { type Tab, type NavTab } from "./components/Shell";
import { abrirRotaNovaOperacao, isNovaOperacaoFinanceira, isSubrotaFinanceira, isSubrotaRebanho, tabToPath, pathToTab, DEFAULT_TAB } from "./router";
import { AppSidebar } from "./components/AppSidebar";
import { ConfiguracoesHub } from "./components/ConfiguracoesHub";
import { IA } from "./components/IA";
import { FinanceiroContent } from "./financeiro/FinanceiroContent";
import { obterRascunhoOperacao, obterRascunhoRelatorioFinanceiro } from "./financeiro/novo-api";
import { limparRascunhoAtivo, useRascunhoAtivo } from "./financeiro/rascunhoAtivo";
import { resumoRascunho } from "./financeiro/lib/rascunho";
import { limparRascunhoRelatorioAtivo, useRascunhoRelatorioAtivo } from "./financeiro/rascunhoRelatorioAtivo";
import { resumoRascunhoRelatorio } from "./financeiro/lib/rascunho-relatorio";
import { RebanhoContent } from "./pecuaria/rebanho/RebanhoContent";
import { setPropriedadeAtiva, getPropriedadeAtiva } from "./propriedadeScope";
import { PlantioContent, type PlaSub } from "./plantio/PlantioContent";
import { EquipeContent, type EqpSub } from "./equipe/EquipeContent";
import { CultivoContent, type MilSub } from "./cultivo/CultivoContent";
import { CommandPalette } from "./components/CommandPalette";
import { ChatWidget } from "./components/ChatWidget";
import { ASSISTENTE_ATIVO } from "./featureFlags";
import { Login } from "./components/Login";
import { DefinirSenha } from "./components/DefinirSenha";
import { RecuperarSenha } from "./components/RecuperarSenha";
import { getToken, getUsuario, setSessao, clearSessao, type UsuarioSessao } from "./lib/auth";
import { fetchMe, logout } from "./api/auth";
import { destinoDepoisDoLogin, interpretarRotaAuth, paginaInicialAutorizada, podeAcessarTab, urlSigninPara } from "./navegacaoAuth";
import { ABAS, type User } from "./data/acessos";
import { temAcessoArea, TODAS_AREAS } from "./lib/areas";
import { BootSplash } from "./components/Loading";
import { TerranoIntro } from "./components/TerranoIntro";

// Abertura Terrano (marca grande + música no centro, some pro canto).
//   "always"  → toca em todo load do dashboard (bom pra testar)
//   "session" → uma vez por sessão do navegador (usar antes do push)
//   "once"    → uma vez por dispositivo (localStorage)
// ⚠️ TROCAR PARA "session" ANTES DO PUSH.
const INTRO_MODE: "always" | "session" | "once" = "session";
const INTRO_SEEN_KEY = "terrano:intro:seen";

// Intervalo mínimo entre recargas do rascunho ao voltar para a aba do navegador.
const INTERVALO_MIN_RECARGA_RASCUNHO = 30_000;

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
  // Atualiza o parser de rotas públicas após replaceState().
  const [locationRevision, setLocationRevision] = useState(0);
  const authRoute = useMemo(
    () => typeof window === "undefined" ? null : interpretarRotaAuth(window.location.pathname, window.location.search),
    [locationRevision],
  );

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
  // Sítio ativo (multi-propriedade) — governa TODO o app (pecuária, financeiro,
  // dashboard). Trocar grava no escopo compartilhado (header X-Propriedade-Id) e
  // remonta o conteúdo via `key` abaixo, forçando refetch no escopo novo. null =
  // consolidado; com 1 sítio o seletor fica quase invisível (só o + discreto).
  const [propAtiva, setPropAtiva] = useState<number | null>(getPropriedadeAtiva());
  const trocarPropriedade = (id: number | null) => {
    setPropriedadeAtiva(id);
    setPropAtiva(id);
  };
  // Deep-link do ⌘K: ao escolher uma entidade real, guardamos {tab, id} e o
  // módulo dono consome (abre o cockpit) via `abrirId` + `onAbriuEntidade`.
  const [deepLink, setDeepLink] = useState<{ tab: Tab; id: string } | null>(null);

  // Deep-link da IA (chat): filtros aplicados numa tela via query string
  // (ex.: /gastos?status=vencidas). Inicializa da URL no load/reload.
  const [deepLinkFiltros, setDeepLinkFiltros] = useState<{ tab: Tab; filtros: Record<string, string> } | null>(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    if (![...sp.keys()].length || isNovaOperacaoFinanceira(window.location.pathname)) return null;
    const t = pathToTab(window.location.pathname);
    return t ? { tab: t, filtros: Object.fromEntries(sp.entries()) } : null;
  });

  const entrar = (novoToken: string, u: UsuarioSessao, returnTo?: string | null) => {
    const destino = destinoDepoisDoLogin(returnTo, u);
    const url = new URL(destino, window.location.origin);
    const tabDestino = pathToTab(url.pathname) ?? DEFAULT_TAB;
    setSessao(novoToken, u);
    setTokenState(novoToken);
    setUsuario(u);
    setTab(tabDestino);
    const parametros = url.searchParams;
    setDeepLinkFiltros(
      [...parametros.keys()].length && !isNovaOperacaoFinanceira(url.pathname)
        ? { tab: tabDestino, filtros: Object.fromEntries(parametros.entries()) }
        : null,
    );
    setDeepLink(null);
    setShowIntro(deveTocarIntro(tabDestino));
    window.history.replaceState(null, "", destino);
    setLocationRevision((valor) => valor + 1);
  };

  const onSair = token
    ? () => {
        void logout();
        clearSessao();
        setTokenState(null);
        setUsuario(null);
        setShowIntro(false);
        window.history.replaceState(null, "", "/signin");
        setLocationRevision((valor) => valor + 1);
      }
    : undefined;

  // Navega a partir de um link da IA ("/caminho?filtros"): troca a aba e guarda os
  // filtros pra tela consumir na montagem. `id=` em módulo de cockpit (pla)
  // reaproveita o deepLink do ⌘K; o resto vira filtros de tabela (piloto: /gastos).
  const navegarDeepLink = (url: string) => {
    const qi = url.indexOf("?");
    const path = qi >= 0 ? url.slice(0, qi) : url;
    const query = qi >= 0 ? url.slice(qi + 1) : "";
    const t = pathToTab(path);
    if (!t) return;
    const filtros = Object.fromEntries(new URLSearchParams(query).entries());
    const s = String(t);
    const temCockpit = s.startsWith("pla-");
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
  const navegarTab = (t: Tab) => {
    setDeepLinkFiltros(null);
    setTab(t);
    const alvo = tabToPath(t);
    if (window.location.pathname + window.location.search !== alvo) window.history.pushState(null, "", alvo);
  };

  // Atalho "Trabalho ativo" da sidebar: abre o formulário de operação, que
  // continua o rascunho se houver ou começa um novo. A sub-rota é publicada
  // antes da troca de aba (ver router.ts).
  const abrirRascunhoAtivo = () => {
    setDeepLinkFiltros(null);
    abrirRotaNovaOperacao();
    setTab("lancar");
  };
  const abrirRascunhoRelatorioAtivo = () => {
    setDeepLinkFiltros(null);
    const alvo = "/financeiro/relatorios/novo";
    if (window.location.pathname + window.location.search !== alvo) window.history.pushState(null, "", alvo);
    window.dispatchEvent(new PopStateEvent("popstate"));
    setTab("relatorio");
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

  useEffect(() => {
    if (!authRoute || !("alias" in authRoute) || !authRoute.alias) return;
    const base = authRoute.kind === "invite" ? "/invite/" : "/reset-password/";
    window.history.replaceState(null, "", `${base}${encodeURIComponent(authRoute.token)}`);
    setLocationRevision((valor) => valor + 1);
  }, [authRoute]);

  useEffect(() => {
    if (token && usuario) return;
    // A rota vem da barra de endereço, não de `authRoute`: o memo é do render
    // anterior e este efeito escreve na mesma URL que lê. Sem reler aqui, uma
    // segunda execução (StrictMode, remontagem) montaria o destino a partir do
    // `/signin?returnTo=…` que ela mesma gravou e descartaria o returnTo.
    if (interpretarRotaAuth(window.location.pathname, window.location.search)) return;
    const destino = urlSigninPara(window.location.pathname, window.location.search);
    if (window.location.pathname + window.location.search === destino) return;
    window.history.replaceState(null, "", destino);
    setLocationRevision((valor) => valor + 1);
  }, [authRoute, token, usuario]);

  useEffect(() => {
    if (!token || !usuario || authRoute?.kind !== "signin") return;
    const destino = paginaInicialAutorizada(usuario);
    setTab(pathToTab(destino) ?? DEFAULT_TAB);
    window.history.replaceState(null, "", destino);
    setLocationRevision((valor) => valor + 1);
  }, [authRoute, token, usuario]);

  // Reflete a aba ativa na URL. Primeiro render usa replaceState (não empilha
  // histórico ao normalizar "/" → "/dashboard); trocas seguintes usam pushState
  // para o botão "voltar" do navegador funcionar.
  const firstSync = useRef(true);
  useEffect(() => {
    // Convite e redefinição de senha são rotas públicas independentes das
    // abas do aplicativo. Não as normalize para a aba padrão enquanto o
    // usuário estiver criando a senha.
    if (authRoute || !token || !usuario) return;
    const filtrosUrl = deepLinkFiltros?.tab === tab
      ? `${tabToPath(tab)}?${new URLSearchParams(deepLinkFiltros.filtros).toString()}`
      : null;
    const subrotaUrl = (isSubrotaFinanceira(tab, window.location.pathname) || isSubrotaRebanho(tab, window.location.pathname)) ? window.location.pathname + window.location.search : null;
    // sub-rota (ex.: /pecuaria/rebanho/animais?situacao=…) já traz a própria query:
    // tem prioridade, senão os filtros do deep-link reescreveriam o caminho para a raiz da aba
    const alvo = subrotaUrl ?? filtrosUrl ?? tabToPath(tab);
    if (window.location.pathname + window.location.search !== alvo) {
      if (firstSync.current) window.history.replaceState(null, "", alvo);
      else window.history.pushState(null, "", alvo);
    }
    firstSync.current = false;
  }, [tab, deepLinkFiltros, authRoute, token, usuario]);

  // Botões voltar/avançar restauram pathname + filtros como uma única rota.
  useEffect(() => {
    const onPop = () => {
      setTab(pathToTab(window.location.pathname) ?? DEFAULT_TAB);
      setLocationRevision((valor) => valor + 1);
      const sp = new URLSearchParams(window.location.search);
      const t = pathToTab(window.location.pathname);
      setDeepLinkFiltros(t && [...sp.keys()].length && !isNovaOperacaoFinanceira(window.location.pathname) ? { tab: t, filtros: Object.fromEntries(sp.entries()) } : null);
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
            areas: usuario.areas ?? [...TODAS_AREAS],
            flags: usuario.flags,
            dono: usuario.dono,
          }
        : null,
    [usuario],
  );

  const isAdmin = !!effectiveUser?.flags.includes("gerenciarAcessos") || !!effectiveUser?.dono;
  const hasArea = (area: (typeof TODAS_AREAS)[number]) =>
    temAcessoArea(effectiveUser?.areas, area, !!effectiveUser?.dono);
  // Módulo Equipe & Ponto expõe salário, CPF e chave Pix — mesma flag que
  // mascara "Pessoal / Salários" no financeiro. Gestor e consulta ficam de fora.
  const canSeeFolha = !!effectiveUser?.flags.includes("verSalarios") || !!effectiveUser?.dono;

  // Abas visíveis do grupo Financeiro (sem "rebanho" e sem "acessos" — Acessos
  // mora no rodapé da sidebar, renderizado via isAdmin pelo AppSidebar).
  const visibleTabs = useMemo<NavTab[]>(() => {
    if (!effectiveUser || !hasArea("financeiro")) return [];
    return ABAS.filter((a) => effectiveUser.abas.includes(a.id)).map((a) => ({
      id: a.id as Tab,
      label: a.label,
    }));
  }, [effectiveUser]);

  const canAccessTab = (id: Tab): boolean => !!usuario && podeAcessarTab(usuario, id);

  // URL direta, histórico e deep links também respeitam a mesma matriz da sidebar.
  useEffect(() => {
    if (!usuario || podeAcessarTab(usuario, tab)) return;
    setTab(pathToTab(paginaInicialAutorizada(usuario)) ?? DEFAULT_TAB);
  }, [usuario, tab]);

  // Rascunho de operação do usuário no sítio ativo, oferecido como "Trabalho
  // ativo" no topo da sidebar (sem rascunho, o atalho vira "+ Nova operação").
  // Só quem vê a aba Operações consulta o rascunho. O rascunho é por sítio:
  // trocar de sítio esquece o anterior e busca o novo.
  const rascunhoAtivo = useRascunhoAtivo();
  const rascunhoRelatorioAtivo = useRascunhoRelatorioAtivo();
  const podeVerRascunho = visibleTabs.some((t) => t.id === "lancar");
  const podeVerRascunhoRelatorio = visibleTabs.some((t) => t.id === "relatorio") && (!!effectiveUser?.dono || !!effectiveUser?.flags.includes("exportar"));
  const usuarioId = usuario?.id ?? null;
  useEffect(() => {
    limparRascunhoAtivo();
    if (!token || usuarioId == null || !podeVerRascunho) return;
    let ultimaCarga = 0;
    // Falha aqui só esconde o atalho; a tela de operações mostra seus próprios erros.
    const recarregar = () => { ultimaCarga = Date.now(); void obterRascunhoOperacao().catch(() => undefined); };
    recarregar();
    // Ao voltar de outra aba do navegador o rascunho pode ter mudado por lá. O
    // intervalo mínimo evita uma rajada de GETs a quem alterna abas o dia todo.
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && Date.now() - ultimaCarga >= INTERVALO_MIN_RECARGA_RASCUNHO) recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [token, usuarioId, podeVerRascunho, propAtiva]);
  useEffect(() => {
    limparRascunhoRelatorioAtivo();
    if (!token || usuarioId == null || !podeVerRascunhoRelatorio) return;
    let ultimaCarga = 0;
    const recarregar = () => { ultimaCarga = Date.now(); void obterRascunhoRelatorioFinanceiro().catch(() => undefined); };
    recarregar();
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && Date.now() - ultimaCarga >= INTERVALO_MIN_RECARGA_RASCUNHO) recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [token, usuarioId, podeVerRascunhoRelatorio, propAtiva]);
  const resumoRascunhoAtivo = useMemo(
    () => (rascunhoAtivo.rascunho ? resumoRascunho(rascunhoAtivo.rascunho) : null),
    [rascunhoAtivo.rascunho],
  );
  const resumoRascunhoRelatorioAtivo = useMemo(
    () => (rascunhoRelatorioAtivo.rascunho ? resumoRascunhoRelatorio(rascunhoRelatorioAtivo.rascunho) : null),
    [rascunhoRelatorioAtivo.rascunho],
  );

  const canSee = (id: Tab) => visibleTabs.some((t) => t.id === id);

  if (authRoute?.kind === "invite" || authRoute?.kind === "reset-password") {
    return (
      <DefinirSenha
        modo={authRoute.kind === "invite" ? "convite" : "senha"}
        token={authRoute.token}
        onPronto={(t, u) => {
          entrar(t, u);
        }}
      />
    );
  }
  if (authRoute?.kind === "forgot-password") return <RecuperarSenha />;
  if (authRoute?.kind === "signin") {
    return <Login onEntrar={(novoToken, u) => entrar(novoToken, u, authRoute.returnTo)} />;
  }
  // Sem sessão válida (token + usuário), só a tela de login. `entrar` recebe o
  // gesto do clique e transiciona em estado — a intro monta no MESMO documento,
  // liberando o play() da música da abertura.
  if (!token || !usuario || !effectiveUser) {
    return <Login onEntrar={(novoToken, u) => entrar(novoToken, u)} />;
  }

  const conteudo = !canAccessTab(tab)
    ? <GatedTab user={effectiveUser} abaLabel="esta área" />
    : String(tab).startsWith("pla-")
    ? <PlantioContent aba={PLA[tab]} onNavPla={(s) => setTab(("pla-" + s) as Tab)}
        abrirId={deepLink && deepLink.tab.startsWith("pla-") ? deepLink.id : undefined}
        onAbriuEntidade={() => setDeepLink(null)} />
    : tab === "pec-rebanho"
    ? <RebanhoContent podeLancar={!!effectiveUser.dono || effectiveUser.flags.includes("lancar")} />
    : String(tab).startsWith("mil-")
    ? <CultivoContent aba={MIL[tab]} onNavMil={(s) => setTab(("mil-" + s) as Tab)} />
    : String(tab).startsWith("eqp-")
    ? (canSeeFolha
        ? <EquipeContent aba={EQP[tab]} onNavEqp={(s) => setTab(("eqp-" + s) as Tab)} />
        : <GatedTab user={effectiveUser} abaLabel="Equipe & Ponto" />)
    : (["dashboard", "gastos", "lancar", "caixinha", "cadastros", "plano", "relatorio"] as Tab[]).includes(tab)
    ? <FinanceiroContent tab={tab} onNav={setTab} podeEditarCadastros={!!effectiveUser.dono || effectiveUser.flags.includes("lancar")} podeLancar={!!effectiveUser.dono || effectiveUser.flags.includes("lancar")} podeExportar={!!effectiveUser.dono || effectiveUser.flags.includes("exportar")} />
    : (
      <>
        {ASSISTENTE_ATIVO && tab === "ia" && (canSee("ia") ? <IA /> : <GatedTab user={effectiveUser} abaLabel="IA" />)}
        {/* Configurações mantém somente setup global: categorias, sítios e acessos. */}
        {(tab === "config" || tab === "acessos" || tab === "sitios") && (
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
      <AppSidebar
        current={tab}
        onNav={navegarTab}
        financeiro={visibleTabs}
        isAdmin={isAdmin}
        podeVerFolha={canSeeFolha}
        areas={effectiveUser.areas ?? [...TODAS_AREAS]}
        mobileOpen={mobileOpen}
        onMobileToggle={setMobileOpen}
        onAbrirBusca={() => setBuscaAberta(true)}
        propAtiva={propAtiva}
        onTrocarProp={trocarPropriedade}
        user={effectiveUser}
        colapsada={sideColapsada}
        onToggleColapsar={toggleSidebar}
        onAcessos={() => setTab("acessos")}
        onSair={onSair}
        // O atalho só aparece depois de se saber se há rascunho, para o "+" não
        // piscar antes de o rascunho existente carregar.
        trabalhoAtivo={podeVerRascunho && rascunhoAtivo.conhecido
          ? { resumo: resumoRascunhoAtivo, ativo: rascunhoAtivo.editando, onAbrir: abrirRascunhoAtivo }
          : null}
        trabalhoAtivoRelatorio={podeVerRascunhoRelatorio && rascunhoRelatorioAtivo.conhecido && resumoRascunhoRelatorioAtivo
          ? { resumo: resumoRascunhoRelatorioAtivo, ativo: rascunhoRelatorioAtivo.editando, onAbrir: abrirRascunhoRelatorioAtivo }
          : null}
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
          setDeepLinkFiltros(null);
          setTab(t);
          // Só entidades de cockpit (pla-*) precisam de deep-link;
          // categoria/fornecedor apenas navegam para a aba.
          const s = String(t);
          const temCockpit = s.startsWith("pla-");
          setDeepLink(entidadeId && temCockpit ? { tab: t, id: entidadeId } : null);
        }}
        podeVer={(t) => {
          return canAccessTab(t);
        }}
      />
      {ASSISTENTE_ATIVO && !ABAS_CHAT.has(tab) && <ChatWidget onNavegar={navegarDeepLink} />}
    </div>
    </>
  );
}
