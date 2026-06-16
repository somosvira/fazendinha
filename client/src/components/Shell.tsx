/* Rio Novo — masthead + nav shell */

import { ReactNode, useState } from "react";
import { DateRangePicker, DateRange } from "./DateRangePicker";
import { PAPEIS, type User } from "../data/acessos";

export type Tab = "dashboard" | "gastos" | "lancar" | "plano" | "ia" | "relatorio" | "acessos" | "rebanho";

export type NavTab = { id: Tab; label: string };

export function Masthead({
  current,
  onNav,
  tabs,
  user,
  allUsers,
  onSwitchUser,
}: {
  current: Tab;
  onNav: (t: Tab) => void;
  tabs: NavTab[];
  user: User;
  allUsers: User[] | null;
  onSwitchUser: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const papelNome = (u: User) => (u.papel === "personalizado" ? "Personalizado" : PAPEIS[u.papel]?.nome || "");

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <div className="brand">
          <div className="brand-mark">RN</div>
          <div>
            <div className="brand-name">Fazenda Rio Novo</div>
            <div className="brand-sub">Relatório Gerencial</div>
          </div>
        </div>
        <nav className="nav-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className="nav-tab"
              aria-current={current === t.id ? "true" : "false"}
              onClick={() => onNav(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="mast-right">
          <div
            className={"user-chip " + (allUsers ? "has-menu" : "")}
            onClick={() => allUsers && setMenuOpen((o) => !o)}
          >
            <div className="user-avatar">{user.inicial}</div>
            <span>{user.nome.split(" ")[0]}</span>
            {allUsers && <span className="chip-chev">▾</span>}
            {menuOpen && allUsers && (
              <div className="user-menu" onClick={(e) => e.stopPropagation()}>
                <div className="user-menu-head">Entrar como (demonstração)</div>
                {allUsers.map((u) => (
                  <button
                    key={u.id}
                    className="user-menu-opt"
                    onClick={() => {
                      onSwitchUser(u.id);
                      setMenuOpen(false);
                    }}
                  >
                    <span className="umo-av">{u.inicial}</span>
                    <span className="umo-info">
                      <div className="umo-nome">{u.nome}</div>
                      <div className="umo-papel">{papelNome(u)}</div>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function ReportHeader({
  subtitle,
  range,
  onRangeChange,
  updatedAt,
  rightExtra,
}: {
  subtitle: string;
  range?: DateRange | null;
  onRangeChange?: (r: DateRange) => void;
  updatedAt?: string;
  rightExtra?: ReactNode;
}) {
  return (
    <div className="report-header">
      <div className="report-title">
        <span className="eyebrow">Visão executiva</span>
        <h1 className="h1">{subtitle}</h1>
      </div>
      <div className="report-meta">
        {range && onRangeChange && <DateRangePicker value={range} onChange={onRangeChange} anchor="right" />}
        {updatedAt && (
          <span className="caption" style={{ marginTop: 8 }}>
            Atualizado {updatedAt}
          </span>
        )}
        {rightExtra}
      </div>
    </div>
  );
}
