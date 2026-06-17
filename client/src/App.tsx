/* Rio Novo — raiz.
 * Permissionamento: Marco (dono) é o usuário logado. Ele gerencia acessos e pode
 * "ver como" outra pessoa — a navegação reduz às abas do perfil e os valores em R$
 * são mascarados quando o perfil não tem a flag verValores.
 */

import { useEffect, useMemo, useState } from "react";
import { Masthead, type Tab, type NavTab } from "./components/Shell";
import { Dashboard } from "./components/Dashboard";
import { Gastos } from "./components/Gastos";
import { Lancar } from "./components/Lancar";
import { PlanoContas } from "./components/PlanoContas";
import { IA } from "./components/IA";
import { Relatorio } from "./components/Relatorio";
import { Acessos } from "./components/Acessos";
import { RebanhoApp } from "./rebanho/RebanhoApp";
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

export function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [users, setUsers] = useState<User[]>(usuarios);
  const realUserId = "marco"; // o dono logado
  const [viewAsId, setViewAsId] = useState<string | null>(null);

  const effectiveUser = useMemo(() => {
    const id = viewAsId || realUserId;
    return users.find((u) => u.id === id) || users[0];
  }, [users, viewAsId]);

  const isAdmin = effectiveUser.flags.includes("gerenciarAcessos");

  // Abas visíveis: as permitidas + (Acessos, se admin)
  const visibleTabs = useMemo<NavTab[]>(() => {
    const base: NavTab[] = ABAS.filter((a) => effectiveUser.abas.includes(a.id)).map((a) => ({
      id: a.id as Tab,
      label: a.label,
    }));
    if (isAdmin) base.push({ id: "acessos", label: "Acessos" });
    base.push({ id: "rebanho", label: "Rebanho" });
    return base;
  }, [effectiveUser, isAdmin]);

  // Se a aba atual não é mais permitida, manda pra primeira disponível
  useEffect(() => {
    const allowed = visibleTabs.map((t) => t.id);
    if (!allowed.includes(tab)) setTab(allowed[0] || "dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs]);

  const canSee = (id: Tab) => visibleTabs.some((t) => t.id === id);
  const abaLabel = ABAS.find((a) => a.id === tab)?.label || tab;

  const enterViewAs = (id: string) => {
    setViewAsId(id === realUserId ? null : id);
    setTab("dashboard");
  };

  if (tab === "rebanho") return <RebanhoApp />;

  return (
    <>
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

      <Masthead
        current={tab}
        onNav={setTab}
        tabs={visibleTabs}
        user={effectiveUser}
        allUsers={viewAsId ? null : users}
        onSwitchUser={enterViewAs}
      />

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
    </>
  );
}
