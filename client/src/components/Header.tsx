/* Rio Novo — header global.
 * Faixa preta no topo com logo, seletor de fazenda e chip do usuário (com
 * dropdown para "ver como" outro perfil). O burger só aparece no mobile e
 * controla o drawer da sidebar. */

import { useEffect, useRef, useState } from "react";
import { PAPEIS, type User } from "../data/acessos";
import { fazendas, fazendaAtualId, type Fazenda } from "../data/fazendas";

function useClickOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function FarmPicker({ atual }: { atual: Fazenda }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));

  return (
    <div className="ah-farm" ref={ref}>
      <button className="ah-farm-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="ah-farm-mark" aria-hidden>🥛</span>
        <span className="ah-farm-txt">
          <span className="ah-farm-eyebrow">Fazenda</span>
          <span className="ah-farm-name">{atual.apelido || atual.nome}</span>
        </span>
        <svg className={"ah-chev" + (open ? " is-open" : "")} viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className="ah-menu ah-farm-menu" role="menu">
          <div className="ah-menu-head">Fazendas</div>
          {fazendas.map((f) => (
            <div key={f.id} className={"ah-farm-opt" + (f.id === atual.id ? " is-current" : "")}>
              <span className="ah-farm-opt-mark" aria-hidden>🥛</span>
              <span className="ah-farm-opt-info">
                <span className="ah-farm-opt-nome">{f.nome}</span>
                {(f.cidade || f.uf) && (
                  <span className="ah-farm-opt-sub">
                    {[f.cidade, f.uf].filter(Boolean).join(" — ")}
                    {f.papel && <> · {f.papel}</>}
                  </span>
                )}
              </span>
              {f.id === atual.id && <span className="ah-farm-opt-check" aria-label="atual">✓</span>}
            </div>
          ))}
          {fazendas.length === 1 && (
            <div className="ah-menu-foot">Você só tem uma fazenda configurada.</div>
          )}
        </div>
      )}
    </div>
  );
}

function UserPicker({ user, allUsers, onSwitchUser, onSair }: {
  user: User;
  allUsers: User[] | null;
  onSwitchUser: (id: string) => void;
  onSair?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));
  const papelNome = (u: User) => (u.papel === "personalizado" ? "Personalizado" : PAPEIS[u.papel]?.nome || "");
  // Menu abre se for possível trocar de perfil OU se houver ação de sair (piloto).
  const canSwitch = !!allUsers && allUsers.length > 1;
  const abreMenu = canSwitch || !!onSair;

  return (
    <div className="ah-user" ref={ref}>
      <button
        className={"ah-user-btn" + (abreMenu ? " has-menu" : "")}
        onClick={() => abreMenu && setOpen((o) => !o)}
        aria-expanded={abreMenu ? open : undefined}
        aria-haspopup={abreMenu ? "menu" : undefined}
      >
        <span className="ah-user-av">{user.inicial}</span>
        <span className="ah-user-txt">
          <span className="ah-user-nome">{user.nome.split(" ")[0]}</span>
          <span className="ah-user-papel">{papelNome(user)}</span>
        </span>
        {abreMenu && (
          <svg className={"ah-chev" + (open ? " is-open" : "")} viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        )}
      </button>
      {open && abreMenu && (
        <div className="ah-menu ah-user-menu" role="menu">
          {canSwitch && allUsers && (
            <>
              <div className="ah-menu-head">Entrar como (demonstração)</div>
              {allUsers.map((u) => (
                <button
                  key={u.id}
                  className={"ah-user-opt" + (u.id === user.id ? " is-current" : "")}
                  onClick={() => { onSwitchUser(u.id); setOpen(false); }}
                >
                  <span className="ah-user-opt-av">{u.inicial}</span>
                  <span className="ah-user-opt-info">
                    <span className="ah-user-opt-nome">{u.nome}</span>
                    <span className="ah-user-opt-papel">{papelNome(u)}</span>
                  </span>
                  {u.id === user.id && <span className="ah-user-opt-check" aria-label="atual">✓</span>}
                </button>
              ))}
            </>
          )}
          {onSair && (
            <button
              className="ah-user-opt"
              onClick={() => { setOpen(false); onSair(); }}
            >
              <span className="ah-user-opt-av" aria-hidden>↩</span>
              <span className="ah-user-opt-info">
                <span className="ah-user-opt-nome">Sair</span>
                <span className="ah-user-opt-papel">Encerrar a sessão neste dispositivo</span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Header({ user, allUsers, onSwitchUser, mobileOpen, onMobileToggle, onAbrirBusca, onSair }: {
  user: User;
  allUsers: User[] | null;
  onSwitchUser: (id: string) => void;
  mobileOpen: boolean;
  onMobileToggle: (open: boolean) => void;
  onAbrirBusca?: () => void;
  onSair?: () => void;
}) {
  const atual = fazendas.find((f) => f.id === fazendaAtualId) || fazendas[0];

  return (
    <header className="app-header">
      <button
        className="ah-burger"
        aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
        onClick={() => onMobileToggle(!mobileOpen)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          {mobileOpen
            ? <><path d="M6 6l12 12"/><path d="M18 6L6 18"/></>
            : <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>}
        </svg>
      </button>

      <div className="ah-brand">
        <span className="ah-brand-mark" aria-hidden>RN</span>
        <span className="ah-brand-name">Rio Novo</span>
      </div>

      <FarmPicker atual={atual} />

      {onAbrirBusca && (
        <button className="ah-search" onClick={onAbrirBusca} aria-label="Pesquisar páginas e recursos">
          <svg className="ah-search-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <span className="ah-search-txt">Pesquisar páginas e recursos…</span>
          <span className="ah-search-kbd" aria-hidden>⌘K</span>
        </button>
      )}

      <div className="ah-spacer" />

      <UserPicker user={user} allUsers={allUsers} onSwitchUser={onSwitchUser} onSair={onSair} />
    </header>
  );
}
