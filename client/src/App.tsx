import { descartarTrabalhoAtivo, type TipoTrabalhoAtivo } from "./financeiro/descarteTrabalhoAtivo";
/* Rio Novo — raiz.
 * Permissionamento: Marco (dono) é o usuário logado. Ele gerencia acessos e pode
 * "ver como" outra pessoa — a navegação reduz às abas do perfil e os valores em R$
 * são mascarados quando o perfil não tem a flag verValores.
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { type Tab, type NavTab } from "./components/Shell";
import { abrirRotaNovaOperacao, isNovaOperacaoFinanceira, isNovoRelatorioFinanceiro, isSubrotaFinanceira, isSubrotaRebanho, tabToPath, pathToTab, DEFAULT_TAB, navegarPara, normalizarLocalizacaoPecuaria, normalizarRotaPecuaria, isSubrotaPecuaria } from "./router";
import { AppSidebar } from "./components/AppSidebar";
import "./financeiro/financeiro-theme.css";
import { descartarRascunhoOperacao, descartarRascunhoRelatorioFinanceiro, obterRascunhoOperacao, obterRascunhoRelatorioFinanceiro } from "./financeiro/novo-api";
import { enfileirarSalvamentoRascunho, limparRascunhoAtivo, useRascunhoAtivo } from "./financeiro/rascunhoAtivo";
import { resumoRascunho } from "./financeiro/lib/rascunho";
import { enfileirarSalvamentoRascunhoRelatorio, limparRascunhoRelatorioAtivo, useRascunhoRelatorioAtivo } from "./financeiro/rascunhoRelatorioAtivo";
import { resumoRascunhoRelatorio } from "./financeiro/lib/rascunho-relatorio";
import "./pecuaria/pecuaria-theme.css";
import "./pecuaria/pecuaria-refino.css";
import "./styles/abas.css";
import "./styles/identidade-rural.css";
import "./styles/tabelas-operacionais.css";
import { setPropriedadeAtiva, getPropriedadeAtiva } from "./propriedadeScope";
import { executarComGuardaNavegacao } from "./navegacaoGuardada";
import { parseProdutoEstoqueId } from "./router";
import { CommandPalette } from "./components/CommandPalette";
import { AssistenteConsulta } from "./components/AssistenteConsulta";
import { ASSISTENTE_ATIVO } from "./featureFlags";
import { Login } from "./components/Login";
import { DefinirSenha } from "./components/DefinirSenha";
import { RecuperarSenha } from "./components/RecuperarSenha";
import { getToken, getUsuario, setSessao, clearSessao, type UsuarioSessao } from "./lib/auth";
import { fetchMe, logout } from "./api/auth";
import { destinoDepoisDoLogin, interpretarRotaAuth, paginaInicialAutorizada, podeAcessarCaminho, podeAcessarTab, urlSigninPara } from "./navegacaoAuth";
import { ABAS, type User } from "./data/acessos";
import { temAcessoArea, TODAS_AREAS } from "./lib/areas";
import { BootSplash, Loader } from "./components/Loading";
import { TerranoIntro } from "./components/TerranoIntro";
import { LimiteCarregamentoArea } from "./components/LimiteCarregamentoArea";

// Declarações estáveis: mudar sítio/rota conserva os mesmos contratos de montagem.
// O shell e os tokens ficam disponíveis enquanto o domínio é baixado.
const ConfiguracoesHub = lazy(() => import("./components/ConfiguracoesHub").then(m => ({ default: m.ConfiguracoesHub })));
const IA = lazy(() => import("./components/IA").then(m => ({ default: m.IA })));
const FinanceiroContent = lazy(() => import("./financeiro/FinanceiroContent").then(m => ({ default: m.FinanceiroContent })));
const RebanhoContent = lazy(() => import("./pecuaria/rebanho/RebanhoContent").then(m => ({ default: m.RebanhoContent })));
const Sanidade = lazy(() => import("./pecuaria/rebanho/sanidade/Sanidade").then(m => ({ default: m.Sanidade })));
const LeiteModulo = lazy(() => import("./pecuaria/rebanho/leite/LeiteModulo").then(m => ({ default: m.LeiteModulo })));
const Nutricao = lazy(() => import("./pecuaria/rebanho/nutricao/Nutricao").then(m => ({ default: m.Nutricao })));
const EstoqueContent = lazy(() => import("./estoque/EstoqueContent").then(m => ({ default: m.EstoqueContent })));
const ProdutoEstoqueDetalhe = lazy(() => import("./estoque/ProdutoEstoqueDetalhe").then(m => ({ default: m.ProdutoEstoqueDetalhe })));
const Reproducao = lazy(() => import("./pecuaria/rebanho/reproducao/Reproducao").then(m => ({ default: m.Reproducao })));
const RelatoriosPecuaria = lazy(() => import("./pecuaria/rebanho/reproducao/RelatoriosPecuaria").then(m => ({ default: m.RelatoriosPecuaria })));
const Visitas = lazy(() => import("./pecuaria/rebanho/reproducao/Visitas").then(m => ({ default: m.Visitas })));
const PainelGerencial = lazy(() => import("./gerencial/PainelGerencial").then(m => ({ default: m.PainelGerencial })));

// Abertura Terrano (marca grande + música no centro, some pro canto).
//   "always"  → toca em todo load do dashboard (bom pra testar)
//   "session" → uma vez por sessão do navegador (usar antes do push)
//   "once"    → uma vez por dispositivo (localStorage)
// ⚠️ TROCAR PARA "session" ANTES DO PUSH.
const INTRO_MODE: "always" | "session" | "once" = "session";
const INTRO_SEEN_KEY = "terrano:intro:seen";

// Intervalo mínimo entre recargas do rascunho ao voltar para a aba do navegador.
const INTERVALO_MIN_RECARGA_RASCUNHO = 30_000;

// Se a IA legada voltar explicitamente, não sobrepor o novo chat ao composer.
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
    (typeof window === "undefined" ? null : (normalizarLocalizacaoPecuaria(), pathToTab(window.location.pathname))) ?? DEFAULT_TAB,
  );
  const tabAtual = useRef(tab);
  tabAtual.current = tab;
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
  const [propAtiva, setPropAtiva] = useState<number | null>(() => {
    const destino = pathToTab(window.location.pathname);
    const recebeOrigemGerencial = destino != null && ["estoque", "pec-nutricao", "pec-reproducao", "pec-sanidade", "pec-leite", "caixinha", "gastos"].includes(destino);
    if (destino !== "gerencial" && !recebeOrigemGerencial) return getPropriedadeAtiva();
    const raw=new URLSearchParams(window.location.search).get("propriedadeId");
    if(raw && /^\d+$/.test(raw) && Number(raw)>0 && Number(raw)<=2147483647) { setPropriedadeAtiva(Number(raw)); return Number(raw); }
    if (destino === "gerencial") {
      setPropriedadeAtiva(null);
      return null;
    }
    return getPropriedadeAtiva();
  });
  const trocarPropriedade = (id: number | null) => {
    void executarComGuardaNavegacao(() => {
      if (id !== getPropriedadeAtiva() && /^\/pecuaria\/rebanho\/animais\/?$/.test(window.location.pathname)) {
        const url = new URL(window.location.href);
        url.searchParams.delete("page");
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      }
      setPropriedadeAtiva(id);
      setPropAtiva(id);
      if(tabAtual.current==="gerencial") setDeepLinkFiltros(atual=>{
        const filtros={...(atual?.tab==="gerencial"?atual.filtros:{})};
        if(id==null)delete filtros.propriedadeId;else filtros.propriedadeId=String(id);
        return {tab:"gerencial",filtros};
      });
    });
  };

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
    setShowIntro(deveTocarIntro(tabDestino));
    window.history.replaceState(null, "", destino);
    setLocationRevision((valor) => valor + 1);
  };

  const onSair = token
    ? () => {
        void executarComGuardaNavegacao(() => {
          void logout();
          clearSessao();
          setTokenState(null);
          setUsuario(null);
          setShowIntro(false);
          window.history.replaceState(null, "", "/signin");
          setLocationRevision((valor) => valor + 1);
        });
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
    void executarComGuardaNavegacao(() => {
      setDeepLinkFiltros(Object.keys(filtros).length ? { tab: t, filtros } : null);
      setTab(t);
      const alvo = normalizarRotaPecuaria(url);
      if (window.location.pathname + window.location.search !== alvo) window.history.pushState(null, "", alvo);
    });
  };

  // Navegação MANUAL (sidebar/conteúdo) — limpa filtros de deep-link p/ não reaplicar stale.
  const navegarTab = (t: Tab) => {
    void executarComGuardaNavegacao(() => {
      setDeepLinkFiltros(null);
      setTab(t);
      const contextoGerencial = t === "gerencial" && propAtiva != null
        ? `?${new URLSearchParams({ propriedadeId: String(propAtiva) })}`
        : "";
      const alvo = tabToPath(t) + contextoGerencial;
      if (window.location.pathname + window.location.search !== alvo) navegarPara(alvo);
    });
  };

  // Atalho "Trabalho ativo" da sidebar: abre o formulário de operação, que
  // continua o rascunho se houver ou começa um novo. A sub-rota é publicada
  // antes da troca de aba (ver router.ts).
  const abrirRascunhoAtivo = () => {
    void executarComGuardaNavegacao(() => {
      setDeepLinkFiltros(null);
      abrirRotaNovaOperacao();
      setTab("lancar");
    });
  };
  const abrirRascunhoRelatorioAtivo = () => {
    void executarComGuardaNavegacao(() => {
      setDeepLinkFiltros(null);
      const alvo = "/financeiro/relatorios/novo";
      if (window.location.pathname + window.location.search !== alvo) window.history.pushState(null, "", alvo);
      window.dispatchEvent(new PopStateEvent("popstate"));
      setTab("relatorio");
    });
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
  const localizacaoRenderizada = typeof window === "undefined" ? "" : window.location.pathname + window.location.search + window.location.hash;
  useEffect(() => {
    // Convite e redefinição de senha são rotas públicas independentes das
    // abas do aplicativo. Não as normalize para a aba padrão enquanto o
    // usuário estiver criando a senha.
    if (authRoute || !token || !usuario) return;
    // Uma navegação pode publicar a URL antes de efeitos passivos pendentes
    // (ex.: clique no rascunho enquanto o primeiro domínio lazy ainda carrega).
    // O efeito do render anterior não pode sobrescrever a rota recém-publicada.
    if (window.location.pathname + window.location.search + window.location.hash !== localizacaoRenderizada) return;
    const filtrosUrl = deepLinkFiltros?.tab === tab
      ? `${tabToPath(tab)}?${new URLSearchParams(deepLinkFiltros.filtros).toString()}`
      : null;
    const subrotaUrl = (isSubrotaFinanceira(tab, window.location.pathname) || isSubrotaRebanho(tab, window.location.pathname) || isSubrotaPecuaria(tab, window.location.pathname) || (tab === "estoque" && parseProdutoEstoqueId(window.location.pathname))) ? window.location.pathname + window.location.search + window.location.hash : null;
    // sub-rota (ex.: /pecuaria/rebanho/animais?situacao=…) já traz a própria query:
    // tem prioridade, senão os filtros do deep-link reescreveriam o caminho para a raiz da aba
    const alvo = subrotaUrl ?? filtrosUrl ?? tabToPath(tab);
    if (window.location.pathname + window.location.search + window.location.hash !== alvo) {
      if (firstSync.current) window.history.replaceState(null, "", alvo);
      else window.history.pushState(null, "", alvo);
    }
    firstSync.current = false;
  }, [tab, deepLinkFiltros, authRoute, token, usuario, localizacaoRenderizada]);

  // Botões voltar/avançar restauram pathname + filtros como uma única rota.
  useEffect(() => {
    const onPop = () => {
      normalizarLocalizacaoPecuaria();
      const sp = new URLSearchParams(window.location.search);
      const t = pathToTab(window.location.pathname);
      const atualizar = () => {
        if(t==="gerencial") {
          const raw=sp.get("propriedadeId");const id=raw&&/^\d+$/.test(raw)&&Number(raw)>0&&Number(raw)<=2147483647?Number(raw):null;
          setPropriedadeAtiva(id);setPropAtiva(id);
        }
        setTab(t ?? DEFAULT_TAB);
        setLocationRevision((valor) => valor + 1);
        setDeepLinkFiltros(t && [...sp.keys()].length && !isNovaOperacaoFinanceira(window.location.pathname) ? { tab: t, filtros: Object.fromEntries(sp.entries()) } : null);
      };
      if (t && t !== tabAtual.current) void executarComGuardaNavegacao(atualizar);
      else atualizar();
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
    if (!usuario || podeAcessarCaminho(usuario, window.location.pathname)) return;
    setTab(pathToTab(paginaInicialAutorizada(usuario)) ?? DEFAULT_TAB);
  }, [usuario, tab, locationRevision]);

  // Rascunho de operação do usuário no sítio ativo, oferecido como "Trabalho
  // ativo" no topo da sidebar (sem rascunho, o atalho vira "+ Nova operação").
  // Só quem vê a aba Operações consulta o rascunho. O rascunho é por sítio:
  // trocar de sítio esquece o anterior e busca o novo.
  const rascunhoAtivo = useRascunhoAtivo();
  const rascunhoRelatorioAtivo = useRascunhoRelatorioAtivo();
  const podeVerValores = !!effectiveUser?.dono || !!effectiveUser?.flags.includes("verValores");
  const podeVerRascunho = podeVerValores && (!!effectiveUser?.dono || !!effectiveUser?.flags.includes("lancar")) && visibleTabs.some((t) => t.id === "lancar");
  const podeVerRascunhoRelatorio = podeVerValores && visibleTabs.some((t) => t.id === "relatorio") && (!!effectiveUser?.dono || !!effectiveUser?.flags.includes("exportar"));
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
    () => rascunhoAtivo.recuperacao ? { ...resumoRascunho({ dados: rascunhoAtivo.recuperacao.dados, updatedAt: "" }), detalhe: rascunhoAtivo.recuperacao.erro ? "Falha ao salvar · alterações preservadas" : "Alterações não salvas" } : rascunhoAtivo.rascunho ? resumoRascunho(rascunhoAtivo.rascunho) : null,
    [rascunhoAtivo.rascunho, rascunhoAtivo.recuperacao],
  );
  const resumoRascunhoRelatorioAtivo = useMemo(
    () => rascunhoRelatorioAtivo.recuperacao ? { ...resumoRascunhoRelatorio({ configuracao: rascunhoRelatorioAtivo.recuperacao.configuracao, updatedAt: "" }), detalhe: rascunhoRelatorioAtivo.recuperacao.erro ? "Falha ao salvar · alterações preservadas" : "Alterações não salvas" } : rascunhoRelatorioAtivo.rascunho ? resumoRascunhoRelatorio(rascunhoRelatorioAtivo.rascunho) : null,
    [rascunhoRelatorioAtivo.rascunho, rascunhoRelatorioAtivo.recuperacao],
  );

  const excluirTrabalho = async (tipo: TipoTrabalhoAtivo) => {
    if (token !== getToken() || propAtiva !== getPropriedadeAtiva()) throw new Error("O sítio ou a sessão mudou. Reabra o trabalho antes de excluir.");
    const origem = window.location.pathname;
    await descartarTrabalhoAtivo(tipo, validar => tipo === "operacao"
      ? enfileirarSalvamentoRascunho(() => { validar(); return descartarRascunhoOperacao(); })
      : enfileirarSalvamentoRascunhoRelatorio(() => { validar(); return descartarRascunhoRelatorioFinanceiro(); }));
    if (token !== getToken() || propAtiva !== getPropriedadeAtiva() || origem !== window.location.pathname) return;
    if (tipo === "operacao" && isNovaOperacaoFinanceira(origem)) navegarPara("/financeiro/operacoes");
    if (tipo === "relatorio" && isNovoRelatorioFinanceiro(origem)) navegarPara("/financeiro/relatorios");
  };

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

  const conteudo = !podeAcessarCaminho(usuario, window.location.pathname)
    ? <GatedTab user={effectiveUser} abaLabel="esta área" />
    : tab === "pec-rebanho"
    ? <RebanhoContent podeLancar={!!effectiveUser.dono || effectiveUser.flags.includes("lancar")} />
    : tab === "pec-sanidade"
    ? <Sanidade podeLancar={!!effectiveUser.dono || effectiveUser.flags.includes("lancar")} />
    : tab === "pec-reproducao"
    ? <Reproducao podeLancar={!!effectiveUser.dono || effectiveUser.flags.includes("lancar")} />
    : tab === "pec-relatorios"
    ? <RelatoriosPecuaria podeExportar={!!effectiveUser.dono || effectiveUser.flags.includes("exportar")} podeFinanceiro={!!effectiveUser.dono || ((effectiveUser.areas ?? []).includes("financeiro") && effectiveUser.flags.includes("verValores"))} podeLancar={!!effectiveUser.dono || effectiveUser.flags.includes("lancar")} />
    : tab === "pec-visitas"
    ? <Visitas podeLancar={!!effectiveUser.dono || effectiveUser.flags.includes("lancar")} />
    : tab === "pec-nutricao"
    ? <Nutricao podeLancar={!!effectiveUser.dono || effectiveUser.flags.includes("lancar")} />
    : tab === "pec-leite"
    ? <LeiteModulo onSelecionarSitio={trocarPropriedade} podeExportar={!!effectiveUser.dono || effectiveUser.flags.includes("exportar")} key={propAtiva ?? "consolidado"} podeLancar={!!effectiveUser.dono || effectiveUser.flags.includes("lancar")} podeFinanceiro={!!effectiveUser.dono || ((effectiveUser.areas ?? []).includes("financeiro") && effectiveUser.flags.includes("verValores"))} />
    : tab === "gerencial"
    ? <PainelGerencial locationRevision={locationRevision} propriedadeId={propAtiva} onPeriodo={periodo=>setDeepLinkFiltros({tab:"gerencial",filtros:{...periodo,...(propAtiva==null?{}:{propriedadeId:String(propAtiva)})}})}/>
    : tab === "estoque"
    ? (parseProdutoEstoqueId(window.location.pathname) ? <ProdutoEstoqueDetalhe key={window.location.pathname} produtoId={parseProdutoEstoqueId(window.location.pathname)!} onSelecionarSitio={trocarPropriedade} /> : <EstoqueContent />)
    : (["dashboard", "gastos", "lancar", "caixinha", "cadastros", "plano", "relatorio"] as Tab[]).includes(tab)
    ? <FinanceiroContent tab={tab} onNav={navegarTab} podeVerValores={podeVerValores} podeEditarCadastros={!!effectiveUser.dono || effectiveUser.flags.includes("lancar")} podeLancar={!!effectiveUser.dono || effectiveUser.flags.includes("lancar")} podeExportar={!!effectiveUser.dono || effectiveUser.flags.includes("exportar")} />
    : (
      <>
        {ASSISTENTE_ATIVO && tab === "ia" && (canSee("ia") ? <IA /> : <GatedTab user={effectiveUser} abaLabel="IA" />)}
        {/* Configurações mantém somente setup global: categorias, sítios e acessos. */}
        {(tab === "config" || tab === "acessos" || tab === "sitios") && (
          <ConfiguracoesHub
            tab={tab}
            onNav={navegarTab}
            isAdmin={isAdmin}
            podeCategorias={canSee("plano")}
            podePecuaria={canAccessTab("pec-rebanho")}
            podeLancarPecuaria={!!effectiveUser.dono || effectiveUser.flags.includes("lancar")}
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
        areas={effectiveUser.areas ?? [...TODAS_AREAS]}
        mobileOpen={mobileOpen}
        onMobileToggle={setMobileOpen}
        onAbrirBusca={() => setBuscaAberta(true)}
        propAtiva={propAtiva}
        onTrocarProp={trocarPropriedade}
        user={effectiveUser}
        colapsada={sideColapsada}
        onToggleColapsar={toggleSidebar}
        onAcessos={() => navegarTab("acessos")}
        onSair={onSair}
        // O atalho só aparece depois de se saber se há rascunho, para o "+" não
        // piscar antes de o rascunho existente carregar.
        trabalhoAtivo={podeVerRascunho && (rascunhoAtivo.conhecido || !!rascunhoAtivo.recuperacao)
          ? { resumo: resumoRascunhoAtivo, ativo: rascunhoAtivo.editando, onAbrir: abrirRascunhoAtivo, onExcluir: () => excluirTrabalho("operacao") }
          : null}
        trabalhoAtivoRelatorio={podeVerRascunhoRelatorio && (rascunhoRelatorioAtivo.conhecido || !!rascunhoRelatorioAtivo.recuperacao) && resumoRascunhoRelatorioAtivo
          ? { resumo: resumoRascunhoRelatorioAtivo, ativo: rascunhoRelatorioAtivo.editando, onAbrir: abrirRascunhoRelatorioAtivo, onExcluir: () => excluirTrabalho("relatorio") }
          : null}
      />
      <main id="main-content" className="app-main" {...(mobileOpen ? { inert: "" } : {})}>
        <div key={propAtiva ?? "all"} className={tab.startsWith("pec-") || window.location.pathname.startsWith("/configuracoes/pecuaria") ? "pecuaria-content" : tab === "estoque" ? "estoque-content" : "cooperativa-content"} style={{ display: "contents" }}>
          <LimiteCarregamentoArea contexto={`${tab}:${propAtiva ?? "all"}`}><Suspense fallback={<div className="shell-wide pagina-financeira"><Loader label="Carregando área…" /></div>}>{conteudo}</Suspense></LimiteCarregamentoArea>
        </div>
      </main>
      <CommandPalette
        aberto={buscaAberta}
        onFechar={() => setBuscaAberta(false)}
        onNav={(t) => {
          navegarTab(t);
        }}
        podeVer={(t) => {
          return canAccessTab(t);
        }}
      />
      {!ABAS_CHAT.has(tab) && <AssistenteConsulta key={`${token}:${usuario.id}:${propAtiva ?? "all"}:${JSON.stringify([usuario.areas, usuario.abas, usuario.flags, usuario.dono])}`} />}
    </div>
    </>
  );
}
