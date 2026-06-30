/* Rio Novo — raiz.
 * Permissionamento: Marco (dono) é o usuário logado. Ele gerencia acessos e pode
 * "ver como" outra pessoa — a navegação reduz às abas do perfil e os valores em R$
 * são mascarados quando o perfil não tem a flag verValores.
 */

import { useEffect, useMemo, useState } from "react";
import { type Tab, type NavTab } from "./components/Shell";
import { AppSidebar } from "./components/AppSidebar";
import { Header } from "./components/Header";
import { Dashboard } from "./components/Dashboard";
import { Gastos } from "./components/Gastos";
import { Lancar } from "./components/Lancar";
import { PlanoContas } from "./components/PlanoContas";
import { IA } from "./components/IA";
import { Relatorio } from "./components/Relatorio";
import { Acessos } from "./components/Acessos";
import { RebanhoContent, type RebSub } from "./rebanho/RebanhoContent";
import { PlantioContent, type PlaSub } from "./plantio/PlantioContent";
import { PlantelContent, type CorSub } from "./corte/PlantelContent";
import { ConfiguracoesView } from "./rebanho/components/ConfiguracoesView";
import { CadastrosView } from "./rebanho/components/CadastrosView";
import { CommandPalette } from "./components/CommandPalette";
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

export function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [users, setUsers] = useState<User[]>(usuarios);
  const realUserId = "marco"; // o dono logado
  const [viewAsId, setViewAsId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);

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

  const effectiveUser = useMemo(() => {
    const id = viewAsId || realUserId;
    return users.find((u) => u.id === id) || users[0];
  }, [users, viewAsId]);

  const isAdmin = effectiveUser.flags.includes("gerenciarAcessos");

  // Abas visíveis do grupo Financeiro (sem "rebanho" e sem "acessos" — Acessos
  // mora no rodapé da sidebar, renderizado via isAdmin pelo AppSidebar).
  const visibleTabs = useMemo<NavTab[]>(() => {
    return ABAS.filter((a) => effectiveUser.abas.includes(a.id)).map((a) => ({
      id: a.id as Tab,
      label: a.label,
    }));
  }, [effectiveUser]);

  // Redireciona só quando a aba ativa é financeira e não permitida (reb-* / pla-* / cor-* sempre ok)
  useEffect(() => {
    const isReb = String(tab).startsWith("reb-");
    const isPla = String(tab).startsWith("pla-");
    const isCor = String(tab).startsWith("cor-");
    if (isReb || isPla || isCor || tab === "acessos" || tab === "config" || tab === "cadastros") return;
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
    ? <RebanhoContent aba={REB[tab]} onNavReb={(s) => setTab(("reb-" + s) as Tab)} />
    : String(tab).startsWith("pla-")
    ? <PlantioContent aba={PLA[tab]} onNavPla={(s) => setTab(("pla-" + s) as Tab)} />
    : String(tab).startsWith("cor-")
    ? <PlantelContent aba={COR[tab]} onNavCor={(s) => setTab(("cor-" + s) as Tab)} />
    : (
      <>
        {tab === "dashboard" &&
          (canSee("dashboard") ? <Dashboard onNav={setTab} user={effectiveUser} /> : <GatedTab user={effectiveUser} abaLabel="Dashboard" />)}
        {tab === "gastos" &&
          (canSee("gastos") ? <Gastos onNav={setTab} user={effectiveUser} /> : <GatedTab user={effectiveUser} abaLabel="Gastos" />)}
        {tab === "ia" && (canSee("ia") ? <IA /> : <GatedTab user={effectiveUser} abaLabel="IA" />)}
        {tab === "relatorio" &&
          (canSee("relatorio") ? <Relatorio onNav={setTab} /> : <GatedTab user={effectiveUser} abaLabel="Relatório" />)}
        {tab === "lancar" &&
          (canSee("lancar") ? <Lancar onNav={setTab} /> : <GatedTab user={effectiveUser} abaLabel="Lançar" />)}
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
      />
      <AppSidebar
        current={tab}
        onNav={setTab}
        financeiro={visibleTabs}
        isAdmin={isAdmin}
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
        {conteudo}
      </main>
      <CommandPalette
        aberto={buscaAberta}
        onFechar={() => setBuscaAberta(false)}
        onNav={setTab}
        podeVer={(t) => {
          const s = String(t);
          if (s.startsWith("reb-") || s.startsWith("pla-") || s.startsWith("cor-")) return true;
          if (t === "config" || t === "cadastros") return true; // sempre visíveis na sidebar
          if (t === "acessos") return isAdmin;
          return canSee(t);
        }}
      />
    </div>
  );
}
